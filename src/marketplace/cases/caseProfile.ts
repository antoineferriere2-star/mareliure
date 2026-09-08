/**
 * The marketplace's declared read-contract over the Bookbinding Playbook.
 *
 * This is the one place that knows Reliure field keys and option values, and
 * it lives in `src/marketplace/`, never in `src/build/engine/`. The engine
 * stays generic; the marketplace is allowed to know the vertical it owns.
 *
 * It reads raw answers rather than the generated Project Brief on purpose. The
 * Brief is written for a person: its values are French labels, and rewording
 * "Plus de 1 000 €" would silently turn off manual review. Answers carry the
 * Playbook's stable machine values (`gt_1000`, `manuscrit`), which is exactly
 * why the Bookbinding Playbook uses machine values rather than repeating the
 * label — see its module docstring.
 *
 * `caseProfile.contract.test.ts` asserts every key and every option value named
 * here still exists in the Playbook, so a rename breaks a test instead of
 * quietly disarming the triage.
 */
import type { Answers } from "@/build/schema/answers";

/** Answer keys this domain depends on. */
export const CASE_ANSWER_KEYS = {
  intent: "intention",
  title: "titre",
  author: "auteur",
  nature: "nature",
  condition: "etat",
  material: "materiau",
  finishes: "finitions",
  style: "styleSouhaite",
  declaredValue: "valeurFinanciere",
  budget: "budget",
  timeline: "delai",
  location: "localisation",
} as const;

/** Option values this domain branches on. Renaming one in the Playbook is a breaking change. */
export const CASE_ANSWER_VALUES = {
  intent: {
    repair: "reparer",
    restore: "restaurer",
    recover: "couverture",
    fineBinding: "belle_reliure",
    collector: "collector",
    undecided: "ne_sais_pas",
  },
  nature: {
    common: "livre_courant",
    antique: "livre_ancien",
    familyBible: "bible_familiale",
    manuscript: "manuscrit",
    rare: "ouvrage_rare",
    album: "album",
    other: "autre",
  },
  condition: { mould: "moisissure", missingPages: "pages_manquantes" },
  material: {
    cloth: "toile",
    decoratedPaper: "papier_decore",
    halfLeather: "demi_cuir",
    fullLeather: "plein_cuir",
  },
  finishes: { gilding: "dorure", gildedEdges: "tranche_decoree", slipcase: "etui", bands: "nerfs" },
  style: { art: "art", contemporary: "contemporain" },
  declaredValue: {
    under100: "lt_100",
    from100: "100_500",
    from500: "500_1000",
    over1000: "gt_1000",
    unknown: "inconnue",
  },
  budget: {
    under150: "lt_150",
    from150: "150_250",
    from250: "250_400",
    from400: "400_700",
    over700: "gt_700",
    unknown: "ne_sais_pas",
  },
} as const;

/**
 * The marketplace's OWN vocabulary for what a book is worth.
 *
 * Deliberately not the Playbook's option values. `marketplace_cases.
 * declared_value_band` is a column the marketplace queries, reports on and
 * constrains with a CHECK; letting the Playbook's `gt_1000` flow into it would
 * make a wording change in a Métré Playbook a silent schema change here. The
 * mapping below is the only place the two vocabularies meet, and
 * caseProfile.test.ts asserts every Playbook value it names still exists.
 *
 * `unknown` rather than null: "the owner does not know" is an answer, and a
 * column that is never null is one fewer branch in every consumer.
 */
export const DECLARED_VALUE_BANDS = [
  "under_100",
  "100_500",
  "500_1000",
  "over_1000",
  "unknown",
] as const;
export type DeclaredValueBand = (typeof DECLARED_VALUE_BANDS)[number];

const DECLARED_VALUE_BY_ANSWER: Record<string, DeclaredValueBand> = {
  lt_100: "under_100",
  "100_500": "100_500",
  "500_1000": "500_1000",
  gt_1000: "over_1000",
  inconnue: "unknown",
};

/** What a budget band means in cents. `null` where the visitor did not commit to one. */
const BUDGET_BANDS: Record<string, { minCents: number; maxCents: number | null }> = {
  [CASE_ANSWER_VALUES.budget.under150]: { minCents: 0, maxCents: 15_000 },
  [CASE_ANSWER_VALUES.budget.from150]: { minCents: 15_000, maxCents: 25_000 },
  [CASE_ANSWER_VALUES.budget.from250]: { minCents: 25_000, maxCents: 40_000 },
  [CASE_ANSWER_VALUES.budget.from400]: { minCents: 40_000, maxCents: 70_000 },
  [CASE_ANSWER_VALUES.budget.over700]: { minCents: 70_000, maxCents: null },
};

/** The natures that make an ouvrage patrimonial — §24, expressed once. */
const HERITAGE_NATURES: readonly string[] = [
  CASE_ANSWER_VALUES.nature.antique,
  CASE_ANSWER_VALUES.nature.manuscript,
  CASE_ANSWER_VALUES.nature.rare,
];

export interface CaseProfile {
  title: string | null;
  intent: string | null;
  nature: string | null;
  condition: string[];
  material: string | null;
  finishes: string[];
  style: string | null;
  /** The marketplace's canonical band, never the Playbook's raw option value. */
  declaredValueBand: DeclaredValueBand;
  budgetBand: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  timeline: string | null;
  city: string | null;
  postalCode: string | null;
  /** True when the book itself calls for specialist handling before anything else. */
  heritage: boolean;
  mouldSuspected: boolean;
  /** Skill slugs (see binders/skills.ts) the project actually calls for. */
  requiredSkills: string[];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Which skills this project needs, derived from what the visitor asked for.
 * Additive and deliberately generous: a missing skill costs a relieur points
 * in the score, it never excludes them — the admin decides.
 */
function requiredSkills(input: {
  intent: string | null;
  nature: string | null;
  material: string | null;
  finishes: string[];
  style: string | null;
}): string[] {
  const skills = new Set<string>();
  const V = CASE_ANSWER_VALUES;

  switch (input.material) {
    case V.material.cloth:
      skills.add("reliure_toile");
      break;
    case V.material.decoratedPaper:
      skills.add("papier_decore");
      break;
    case V.material.halfLeather:
      skills.add("demi_cuir");
      break;
    case V.material.fullLeather:
      skills.add("plein_cuir");
      break;
  }

  if (
    input.finishes.includes(V.finishes.gilding) ||
    input.finishes.includes(V.finishes.gildedEdges)
  )
    skills.add("dorure");
  if (input.finishes.includes(V.finishes.slipcase)) skills.add("cartonnage");

  if (input.intent === V.intent.repair || input.intent === V.intent.restore)
    skills.add("restauration");
  if (input.intent === V.intent.restore) skills.add("conservation");

  if (input.nature && HERITAGE_NATURES.includes(input.nature)) {
    skills.add("restauration");
    skills.add("conservation");
  }

  if (input.style === V.style.art) skills.add("reliure_art");
  if (input.style === V.style.contemporary) skills.add("rebinding_contemporain");

  return [...skills].sort();
}

/** Total: any answer shape in, a usable profile out. Never throws. */
export function buildCaseProfile(answers: Answers): CaseProfile {
  const K = CASE_ANSWER_KEYS;
  const intent = str(answers[K.intent]);
  const nature = str(answers[K.nature]);
  const material = str(answers[K.material]);
  const style = str(answers[K.style]);
  const finishes = list(answers[K.finishes]);
  const condition = list(answers[K.condition]);
  const budgetBand = str(answers[K.budget]);
  const band = budgetBand ? (BUDGET_BANDS[budgetBand] ?? null) : null;

  const location = answers[K.location];
  const locationRecord =
    location && typeof location === "object" && !Array.isArray(location)
      ? (location as Record<string, unknown>)
      : {};

  return {
    title: str(answers[K.title]),
    intent,
    nature,
    condition,
    material,
    finishes,
    style,
    // An answer the mapping does not know reads as `unknown` rather than
    // crashing or leaking through: a Playbook may add a band before the
    // marketplace has decided what it means, and an unrecognised value must
    // never be silently treated as a low one.
    declaredValueBand: DECLARED_VALUE_BY_ANSWER[str(answers[K.declaredValue]) ?? ""] ?? "unknown",
    budgetBand,
    budgetMinCents: band?.minCents ?? null,
    budgetMaxCents: band?.maxCents ?? null,
    timeline: str(answers[K.timeline]),
    city: str(locationRecord.city_state),
    postalCode: str(locationRecord.zip),
    heritage: nature !== null && HERITAGE_NATURES.includes(nature),
    mouldSuspected: condition.includes(CASE_ANSWER_VALUES.condition.mould),
    requiredSkills: requiredSkills({ intent, nature, material, finishes, style }),
  };
}
