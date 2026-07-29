/**
 * Locale/unit-aware presentation helpers for the Deck visual preview —
 * still framework-free (no React), so eligibility/copy-selection logic is
 * unit-testable without rendering anything. The actual EN/ES text lookup
 * reuses publicCopy/ES_PUBLIC_COPY (the same mechanism the rest of the
 * visitor UI already uses) so this feature doesn't invent a second,
 * parallel i18n system — callers pass the English key strings exported
 * here into that existing lookup.
 */
import type { SupportedLocale } from "@/build/i18n/locales";
import type { MeasurementSystem } from "@/build/measurements/types";
import { formatArea, formatLength } from "@/build/measurements/format";
import type {
  DeckPreviewDimensions,
  DeckPreviewElevationCategory,
  DeckPreviewResolution,
} from "./deckPreviewParams";

/**
 * Always formats from the real, unclamped dimensions (in meters) — the
 * geometry module's render-only aspect-ratio clamping must never leak into
 * what's displayed as the actual project size. Reuses the same centralized
 * formatLength/formatArea helpers used elsewhere, so this is never a third
 * place that reimplements unit conversion.
 */
export function formatDeckDimensionLabels(
  dimensions: DeckPreviewDimensions,
  locale: SupportedLocale,
  measurementSystem: MeasurementSystem,
): { length: string; width: string; area: string } {
  return {
    length: formatLength(dimensions.lengthM, { locale, measurementSystem, style: "feet-inches" }),
    width: formatLength(dimensions.widthM, { locale, measurementSystem, style: "feet-inches" }),
    area: formatArea(dimensions.areaSqm, { locale, measurementSystem }),
  };
}

/** Elevation is a visitor-reported category, never a measured height — always worth flagging as subject to site verification, except at grade where there is nothing to verify. */
export function shouldShowElevationVerificationNote(
  elevation: DeckPreviewElevationCategory,
): boolean {
  return elevation !== "ground-level";
}

export type DeckPreviewSectionDecision =
  { render: "geometry" } | { render: "fallback"; messageKey: string } | { render: "nothing" };

/**
 * The single gate deciding what the visual-preview section shows, given a
 * resolution. "unavailable" renders nothing (no explanation) per the
 * brief; every other non-complete status gets an honest, specific
 * fallback message — never a guess at the missing data.
 */
export function decideDeckPreviewSection(
  resolution: DeckPreviewResolution | undefined,
): DeckPreviewSectionDecision {
  if (!resolution) return { render: "nothing" };
  switch (resolution.status) {
    case "complete":
      return { render: "geometry" };
    case "partial":
      return {
        render: "fallback",
        messageKey:
          "We'll show a representative preview once approximate length and width are provided.",
      };
    case "unsupported-shape":
      return {
        render: "fallback",
        messageKey: "This project shape can't be represented in the visual preview yet.",
      };
    case "unavailable":
      return { render: "nothing" };
  }
}
