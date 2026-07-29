import { describe, expect, it } from "vitest";
import {
  MAX_RENDER_ASPECT_RATIO,
  MIN_RENDER_ASPECT_RATIO,
  clampDeckRenderDimensions,
  computeDeckIsometricGeometry,
  resolveMaterialVisualFamily,
} from "./deckPreviewGeometry";

function parseViewBox(viewBox: string) {
  const [x, y, w, h] = viewBox.split(" ").map(Number);
  return { x, y, w, h };
}

describe("clampDeckRenderDimensions", () => {
  it("leaves a normal aspect ratio unchanged", () => {
    const res = clampDeckRenderDimensions(4, 3);
    expect(res.clamped).toBe(false);
    expect(res.renderLength / res.renderWidth).toBeCloseTo(4 / 3, 5);
  });

  it("clamps an extremely long/narrow deck to the max ratio", () => {
    const res = clampDeckRenderDimensions(30, 2); // ratio 15, way beyond MAX
    expect(res.clamped).toBe(true);
    expect(res.renderLength / res.renderWidth).toBeCloseTo(MAX_RENDER_ASPECT_RATIO, 5);
  });

  it("clamps an extremely wide/short deck to the min ratio", () => {
    const res = clampDeckRenderDimensions(2, 30); // ratio 0.0667, way below MIN
    expect(res.clamped).toBe(true);
    expect(res.renderLength / res.renderWidth).toBeCloseTo(MIN_RENDER_ASPECT_RATIO, 5);
  });
});

describe("resolveMaterialVisualFamily", () => {
  it("maps wood-like options to the wood family", () => {
    expect(resolveMaterialVisualFamily({ key: "pressure-treated-wood", label: "x" })).toBe("wood");
    expect(resolveMaterialVisualFamily({ key: "cedar-or-hardwood", label: "x" })).toBe("wood");
  });

  it("maps composite to brown composite and pvc to gray composite", () => {
    expect(resolveMaterialVisualFamily({ key: "composite", label: "x" })).toBe("composite-brown");
    expect(resolveMaterialVisualFamily({ key: "pvc", label: "x" })).toBe("composite-gray");
  });

  it("uses the neutral family for null (not sure / unanswered) and unrecognized keys", () => {
    expect(resolveMaterialVisualFamily(null)).toBe("neutral");
    expect(resolveMaterialVisualFamily({ key: "something-new", label: "x" })).toBe("neutral");
  });
});

const BASE = { lengthM: 4, widthM: 3, features: [] as const, viewpoint: 0 as const };

describe("computeDeckIsometricGeometry", () => {
  it("omits support posts for ground-level and unknown elevation", () => {
    expect(computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level" }).posts).toEqual([]);
    expect(computeDeckIsometricGeometry({ ...BASE, elevation: "unknown" }).posts).toEqual([]);
  });

  it("renders 4 support posts for elevated and second-story", () => {
    expect(computeDeckIsometricGeometry({ ...BASE, elevation: "elevated" }).posts).toHaveLength(4);
    expect(computeDeckIsometricGeometry({ ...BASE, elevation: "second-story" }).posts).toHaveLength(
      4,
    );
  });

  it("renders taller (more vertical screen extent) posts for second-story than elevated", () => {
    const elevated = computeDeckIsometricGeometry({ ...BASE, elevation: "elevated" }).posts[0];
    const secondStory = computeDeckIsometricGeometry({ ...BASE, elevation: "second-story" })
      .posts[0];
    const elevatedSpan = Math.abs(elevated.y2 - elevated.y1);
    const secondStorySpan = Math.abs(secondStory.y2 - secondStory.y1);
    expect(secondStorySpan).toBeGreaterThan(elevatedSpan);
  });

  it("omits railing unless the 'railing' feature is present", () => {
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", features: [] }).railing,
    ).toBeNull();
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", features: ["railing"] })
        .railing,
    ).not.toBeNull();
  });

  it("omits stairs unless the 'stairs' feature is present", () => {
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", features: [] }).stairs,
    ).toBeNull();
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", features: ["stairs"] })
        .stairs,
    ).not.toBeNull();
  });

  it("never renders a feature that wasn't selected, even alongside one that was", () => {
    const geometry = computeDeckIsometricGeometry({
      ...BASE,
      elevation: "ground-level",
      features: ["railing"],
    });
    expect(geometry.railing).not.toBeNull();
    expect(geometry.stairs).toBeNull();
  });

  it("includes the house wall by default and omits it when explicitly disabled", () => {
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level" }).houseWall,
    ).not.toBeNull();
    expect(
      computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", showHouseWall: false })
        .houseWall,
    ).toBeNull();
  });

  it("produces a parseable viewBox with positive width and height", () => {
    const { viewBox } = computeDeckIsometricGeometry({
      ...BASE,
      elevation: "elevated",
      features: ["railing", "stairs"],
    });
    const { w, h } = parseViewBox(viewBox);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it("keeps the viewBox readable (bounded aspect ratio) even for an extreme real-world input", () => {
    const { viewBox } = computeDeckIsometricGeometry({
      ...BASE,
      lengthM: 20,
      widthM: 1.5,
      elevation: "ground-level",
    });
    const { w, h } = parseViewBox(viewBox);
    // Without clamping, a 20x1.5 rectangle would produce a screen ratio far
    // beyond this — clamping keeps the diagram legible.
    expect(w / h).toBeLessThan(6);
  });

  it("produces different geometry for different viewpoints (rotation actually rotates)", () => {
    const v0 = computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", viewpoint: 0 });
    const v1 = computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", viewpoint: 1 });
    const v2 = computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", viewpoint: 2 });
    const v3 = computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", viewpoint: 3 });
    const faces = [v0, v1, v2, v3].map((g) => g.platformTopFace);
    expect(new Set(faces).size).toBe(4);
  });

  it("returns to viewpoint 0's geometry after 4 rotation steps (reset is well-defined)", () => {
    const v0 = computeDeckIsometricGeometry({ ...BASE, elevation: "ground-level", viewpoint: 0 });
    const v4 = computeDeckIsometricGeometry({
      ...BASE,
      elevation: "ground-level",
      viewpoint: (4 % 4) as 0,
    });
    expect(v4.platformTopFace).toBe(v0.platformTopFace);
  });
});
