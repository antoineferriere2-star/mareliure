/**
 * Deck visual-preview data model — pure mapping from a visitor's structured
 * Deck Playbook answers to normalized visual parameters. This is data
 * modeling only: no rendering library, no SVG/3D scene. Lot 6 consumes
 * `DeckPreviewResolution` to decide what (if anything) to draw.
 *
 * V1 supports rectangular decks only. Every value here is read directly
 * from the visitor's answers or the Playbook schema — nothing is guessed
 * or defaulted to a "typical" deck. Missing input means missing output,
 * never an invented number.
 */
import { NOT_SURE_VALUE } from "@/build/schema/answers";
import type { Answers } from "@/build/schema/answers";
import type { PlaybookField, PlaybookSchema } from "@/build/schema/playbook";
import { toMeters } from "@/build/measurements/conversion";

export const DECK_PREVIEW_MODEL_VERSION = 1;

export type DeckPreviewFeatureFlag = "railing" | "stairs";

export type DeckPreviewElevationCategory = "ground-level" | "elevated" | "second-story" | "unknown";

export type DeckPreviewMissingField = "length" | "width";

/**
 * Dimensions are always normalized to meters, independent of both the
 * visitor's chosen locale and their chosen measurement system — those are
 * display-only concerns applied at render time (Lot 6), never baked into
 * this canonical model. Mirrors the existing locale/measurementSystem
 * separation in src/build/measurements/types.ts.
 */
export interface DeckPreviewDimensions {
  lengthM: number;
  widthM: number;
  areaSqm: number;
}

export interface DeckPreviewMaterial {
  /** Stable slug derived from the Playbook option value, e.g. "composite" — never a color. Color mapping is a Lot 6 rendering concern, not a data-modeling one. */
  key: string;
  /** The visitor-facing option label, verbatim, e.g. "Composite". */
  label: string;
}

export interface DeckPreviewParams {
  shape: "rectangle";
  dimensions: DeckPreviewDimensions;
  /** Only features this model has a visual mapping for. Every other selected feature (Lighting, Pergola, ...) is real information but has no visual representation in V1, so it is deliberately omitted here rather than invented. */
  features: DeckPreviewFeatureFlag[];
  elevation: DeckPreviewElevationCategory;
  material: DeckPreviewMaterial | null;
}

export interface DeckPreviewPartialParams {
  features: DeckPreviewFeatureFlag[];
  elevation: DeckPreviewElevationCategory;
  material: DeckPreviewMaterial | null;
  missing: DeckPreviewMissingField[];
}

export type DeckPreviewResolution =
  | { status: "complete"; params: DeckPreviewParams }
  | { status: "partial"; params: DeckPreviewPartialParams }
  | { status: "unsupported-shape"; shapeLabel: string }
  | { status: "unavailable"; reason: string };

/**
 * What gets frozen onto VisitorProjectSummary.visualPreview at submission
 * time. Deliberately a snapshot, not a recipe: the secure /project-summary
 * link must reproduce exactly this resolution later, never recompute it
 * from a Playbook that may since have changed. `version` is
 * DECK_PREVIEW_MODEL_VERSION at submit time, so a future model change can
 * tell old snapshots apart from new ones instead of misreading them.
 */
export interface DeckPreviewSnapshot {
  version: number;
  resolution: DeckPreviewResolution;
}

const LENGTH_UNIT = "ft" as const;

/**
 * Anticipated future field key for an explicit shape choice. No shipped
 * Playbook defines this today (Deck's schema is rectangle-implicit), so
 * this branch is normally unreachable — it exists so a future shape
 * selector is handled safely instead of silently mis-rendered as a
 * rectangle. Exercised directly by unit tests via a synthetic schema.
 */
const SHAPE_FIELD_KEY = "deckShape";
const RECTANGULAR_SHAPE_VALUES = new Set(["rectangular", "rectangle"]);

function flattenFields(schema: PlaybookSchema): PlaybookField[] {
  return schema.sections.flatMap((section) => section.steps.flatMap((step) => step.fields));
}

function findField(schema: PlaybookSchema, key: string): PlaybookField | undefined {
  return flattenFields(schema).find((f) => f.key === key);
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readLength(answers: Answers, key: string): number | null {
  const value = answers[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function resolveElevation(answers: Answers): DeckPreviewElevationCategory {
  const heightAccess = answers.heightAccess;
  const selected = Array.isArray(heightAccess) ? (heightAccess as string[]) : [];
  if (selected.includes("Second-story")) return "second-story";
  if (selected.includes("Elevated")) return "elevated";
  if (selected.includes("Ground-level")) return "ground-level";
  return "unknown";
}

function resolveFeatures(answers: Answers): DeckPreviewFeatureFlag[] {
  const features = Array.isArray(answers.features) ? (answers.features as string[]) : [];
  const heightAccess = Array.isArray(answers.heightAccess)
    ? (answers.heightAccess as string[])
    : [];
  const flags: DeckPreviewFeatureFlag[] = [];
  if (features.includes("Railing")) flags.push("railing");
  // "Stairs required" (heightAccess) is an independent visitor signal from
  // the "Stairs" feature checkbox — either one is enough to show stairs.
  if (features.includes("Stairs") || heightAccess.includes("Stairs required")) flags.push("stairs");
  return flags;
}

function resolveMaterial(answers: Answers): DeckPreviewMaterial | null {
  const value = answers.desiredMaterial;
  if (typeof value !== "string" || value === NOT_SURE_VALUE || value === "Not sure") return null;
  return { key: slugify(value), label: value };
}

function resolveShape(schema: PlaybookSchema, answers: Answers): string | null {
  const shapeField = findField(schema, SHAPE_FIELD_KEY);
  if (!shapeField) return null; // No shape concept in this Playbook — rectangle is the only option, default.
  const value = answers[SHAPE_FIELD_KEY];
  if (typeof value !== "string" || value === NOT_SURE_VALUE) return null; // Unanswered — no positive signal of a non-rectangular shape.
  return RECTANGULAR_SHAPE_VALUES.has(value.toLowerCase()) ? null : value;
}

/**
 * Pure mapping from a visitor's answers + the Mission's Playbook schema to
 * normalized Deck visual-preview parameters. Never throws — every
 * unsupported or incomplete case is a distinct, explicit resolution state.
 */
export function resolveDeckPreviewParams(
  answers: Answers,
  schema: PlaybookSchema,
): DeckPreviewResolution {
  const lengthField = findField(schema, "length");
  const widthField = findField(schema, "width");
  const heightAccessField = findField(schema, "heightAccess");
  if (
    !lengthField ||
    lengthField.type !== "measurement" ||
    !widthField ||
    widthField.type !== "measurement" ||
    !heightAccessField ||
    heightAccessField.type !== "multi_choice"
  ) {
    return {
      status: "unavailable",
      reason:
        "This Playbook does not define the length, width, and height/access fields the Deck visual preview needs.",
    };
  }

  const unsupportedShapeLabel = resolveShape(schema, answers);
  if (unsupportedShapeLabel) {
    return { status: "unsupported-shape", shapeLabel: unsupportedShapeLabel };
  }

  const lengthRaw = readLength(answers, "length");
  const widthRaw = readLength(answers, "width");
  const features = resolveFeatures(answers);
  const elevation = resolveElevation(answers);
  const material = resolveMaterial(answers);

  if (lengthRaw === null || widthRaw === null) {
    const missing: DeckPreviewMissingField[] = [
      ...(lengthRaw === null ? (["length"] as const) : []),
      ...(widthRaw === null ? (["width"] as const) : []),
    ];
    return { status: "partial", params: { features, elevation, material, missing } };
  }

  const lengthM = toMeters(lengthRaw, LENGTH_UNIT);
  const widthM = toMeters(widthRaw, LENGTH_UNIT);
  return {
    status: "complete",
    params: {
      shape: "rectangle",
      dimensions: { lengthM, widthM, areaSqm: lengthM * widthM },
      features,
      elevation,
      material,
    },
  };
}
