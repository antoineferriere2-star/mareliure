import { describe, expect, it } from "vitest";
import { clampDeckRenderDimensions } from "./deckPreviewGeometry";
import {
  decideDeckPreviewSection,
  formatDeckDimensionLabels,
  shouldShowElevationVerificationNote,
} from "./deckPreviewDisplay";
import type { DeckPreviewResolution } from "./deckPreviewParams";

describe("formatDeckDimensionLabels", () => {
  const dimensions = { lengthM: 3.6576, widthM: 3.048, areaSqm: 3.6576 * 3.048 };

  it("formats English + Imperial with feet/inches and square feet", () => {
    const labels = formatDeckDimensionLabels(dimensions, "en-US", "imperial");
    expect(labels.length).toContain("ft");
    expect(labels.width).toContain("ft");
    expect(labels.area).toContain("sq ft");
  });

  it("formats English + Metric with meters and square meters", () => {
    const labels = formatDeckDimensionLabels(dimensions, "en-US", "metric");
    expect(labels.length).toContain("m");
    expect(labels.area).toContain("m²");
  });

  it("formats Spanish + Imperial with Spanish unit words", () => {
    const labels = formatDeckDimensionLabels(dimensions, "es-US", "imperial");
    expect(labels.length).toMatch(/pie/);
    expect(labels.area).toContain("pies cuadrados");
  });

  it("formats Spanish + Metric with meters and square meters (locale only changes number formatting, not units)", () => {
    const labels = formatDeckDimensionLabels(dimensions, "es-US", "metric");
    expect(labels.length).toContain("m");
    expect(labels.area).toContain("m²");
  });

  it("always reflects the real dimensions, never the geometry layer's render-only clamped ratio", () => {
    // An extreme input that the geometry layer clamps for legibility...
    const extremeLengthM = 12;
    const extremeWidthM = 0.9;
    const clamp = clampDeckRenderDimensions(extremeLengthM, extremeWidthM);
    expect(clamp.clamped).toBe(true); // sanity: this case really is clamped for rendering

    // ...must still produce labels for the ACTUAL 12m / 0.9m dimensions.
    const labels = formatDeckDimensionLabels(
      { lengthM: extremeLengthM, widthM: extremeWidthM, areaSqm: extremeLengthM * extremeWidthM },
      "en-US",
      "metric",
    );
    expect(labels.length).toBe("12 m");
    expect(labels.width).toBe("90 cm");
  });
});

describe("shouldShowElevationVerificationNote", () => {
  it("is false only for ground-level", () => {
    expect(shouldShowElevationVerificationNote("ground-level")).toBe(false);
  });

  it("is true for elevated, second-story, and unknown", () => {
    expect(shouldShowElevationVerificationNote("elevated")).toBe(true);
    expect(shouldShowElevationVerificationNote("second-story")).toBe(true);
    expect(shouldShowElevationVerificationNote("unknown")).toBe(true);
  });
});

describe("decideDeckPreviewSection", () => {
  it("renders geometry only for 'complete'", () => {
    const resolution: DeckPreviewResolution = {
      status: "complete",
      params: {
        shape: "rectangle",
        dimensions: { lengthM: 1, widthM: 1, areaSqm: 1 },
        features: [],
        elevation: "ground-level",
        material: null,
      },
    };
    expect(decideDeckPreviewSection(resolution)).toEqual({ render: "geometry" });
  });

  it("renders a specific fallback message for 'partial', never inventing geometry", () => {
    const resolution: DeckPreviewResolution = {
      status: "partial",
      params: { features: [], elevation: "unknown", material: null, missing: ["length", "width"] },
    };
    const decision = decideDeckPreviewSection(resolution);
    expect(decision.render).toBe("fallback");
    if (decision.render === "fallback") {
      expect(decision.messageKey.toLowerCase()).toContain("length and width");
    }
  });

  it("renders a specific fallback message for 'unsupported-shape'", () => {
    const resolution: DeckPreviewResolution = {
      status: "unsupported-shape",
      shapeLabel: "L-shape",
    };
    const decision = decideDeckPreviewSection(resolution);
    expect(decision.render).toBe("fallback");
    if (decision.render === "fallback") {
      expect(decision.messageKey.toLowerCase()).toContain("shape");
    }
  });

  it("renders nothing for 'unavailable' (no explanation, per spec)", () => {
    const resolution: DeckPreviewResolution = { status: "unavailable", reason: "no fields" };
    expect(decideDeckPreviewSection(resolution)).toEqual({ render: "nothing" });
  });

  it("renders nothing when there is no resolution at all (capability disabled / old Mission)", () => {
    expect(decideDeckPreviewSection(undefined)).toEqual({ render: "nothing" });
  });
});
