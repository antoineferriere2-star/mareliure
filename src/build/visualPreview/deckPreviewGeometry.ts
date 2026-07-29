/**
 * Pure isometric geometry for the Deck visual preview. No React, no DOM,
 * no locale, no unit conversion — everything here is plain numbers and
 * strings so it can be unit-tested without a browser, per the mapping/
 * rendering separation required for this lot. DeckIsometricSvg.tsx only
 * ever receives the output of `computeDeckIsometricGeometry` and renders
 * it; it never computes anything itself.
 *
 * V1 geometry is deliberately schematic: a rectangular platform, simplified
 * thickness, simplified corner posts, an optional generic railing/stairs, a
 * neutral ground plane, and an optional simplified house wall for context.
 * No joists, beams, footings, span calculations or exact stair geometry —
 * this is an illustrative diagram, not an engineering drawing.
 */
import type {
  DeckPreviewElevationCategory,
  DeckPreviewFeatureFlag,
  DeckPreviewMaterial,
} from "./deckPreviewParams";

export type DeckPreviewViewpoint = 0 | 1 | 2 | 3;

export type DeckMaterialVisualFamily = "wood" | "composite-brown" | "composite-gray" | "neutral";

// Rendered aspect ratio is clamped to keep extreme inputs (e.g. a 40ft x 6ft
// deck) legible as a diagram. This ONLY affects the geometry below — actual
// dimension labels shown beside the preview always come from the real,
// unclamped meters (see deckPreviewCopy-style formatting in
// DeckVisualPreview.tsx), never from these render-only numbers.
export const MIN_RENDER_ASPECT_RATIO = 0.35;
export const MAX_RENDER_ASPECT_RATIO = 2.8;
const RENDER_WIDTH_UNITS = 10;

export interface ClampedRenderDimensions {
  renderLength: number;
  renderWidth: number;
  clamped: boolean;
}

export function clampDeckRenderDimensions(
  lengthM: number,
  widthM: number,
): ClampedRenderDimensions {
  const ratio = lengthM / widthM;
  const clampedRatio = Math.min(MAX_RENDER_ASPECT_RATIO, Math.max(MIN_RENDER_ASPECT_RATIO, ratio));
  return {
    renderLength: RENDER_WIDTH_UNITS * clampedRatio,
    renderWidth: RENDER_WIDTH_UNITS,
    clamped: clampedRatio !== ratio,
  };
}

/**
 * Material choices only ever affect a generic visual family — never a
 * manufacturer, exact product, board profile, contractual color, price or
 * spec. "Not sure"/no material resolves to the same neutral family a
 * Playbook without a material field would also get.
 */
export function resolveMaterialVisualFamily(
  material: DeckPreviewMaterial | null,
): DeckMaterialVisualFamily {
  if (!material) return "neutral";
  switch (material.key) {
    case "pressure-treated-wood":
    case "cedar-or-hardwood":
      return "wood";
    case "composite":
      return "composite-brown";
    case "pvc":
      return "composite-gray";
    default:
      return "neutral";
  }
}

type Point2 = [number, number];
type Point3 = [number, number, number];

function project([x, y, z]: Point3): Point2 {
  // Standard 2:1 dimetric "isometric" projection used throughout 2D
  // tile-based rendering — simple, stable, and sufficient for a schematic.
  return [x - y, (x + y) * 0.5 - z];
}

function rotate90([dx, dy]: Point2, steps: number): Point2 {
  let [x, y] = [dx, dy];
  const n = ((steps % 4) + 4) % 4;
  for (let i = 0; i < n; i++) [x, y] = [-y, x];
  return [x, y];
}

function rotateAround(point: Point2, center: Point2, steps: number): Point2 {
  const [rx, ry] = rotate90([point[0] - center[0], point[1] - center[1]], steps);
  return [center[0] + rx, center[1] + ry];
}

function pointsAttr(points: Point2[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export interface DeckSvgGeometry {
  viewBox: string;
  groundPolygon: string;
  platformTopFace: string;
  platformFrontFace: string;
  platformSideFace: string;
  /** One line segment per support post — empty when the elevation category calls for none (ground-level, unknown). */
  posts: { x1: number; y1: number; x2: number; y2: number }[];
  /** null when the visitor didn't select the railing feature. */
  railing: { rail: string; ticks: string[] } | null;
  /** null when the visitor didn't select the stairs feature. */
  stairs: string | null;
  /** null when house-wall context is turned off by the caller. */
  houseWall: string | null;
}

const THICKNESS_RATIO = 0.08;
const POST_HEIGHT_BY_ELEVATION: Record<DeckPreviewElevationCategory, number> = {
  "ground-level": 0,
  unknown: 0,
  elevated: RENDER_WIDTH_UNITS * 0.6,
  "second-story": RENDER_WIDTH_UNITS * 1.3,
};
const RAIL_HEIGHT = RENDER_WIDTH_UNITS * 0.18;
const HOUSE_WALL_HEIGHT = RENDER_WIDTH_UNITS * 1.4;
const HOUSE_WALL_DEPTH = RENDER_WIDTH_UNITS * 0.12;
const GROUND_MARGIN_RATIO = 0.45;

export function computeDeckIsometricGeometry(options: {
  lengthM: number;
  widthM: number;
  elevation: DeckPreviewElevationCategory;
  features: readonly DeckPreviewFeatureFlag[];
  viewpoint: DeckPreviewViewpoint;
  showHouseWall?: boolean;
}): DeckSvgGeometry {
  const { renderLength: L, renderWidth: W } = clampDeckRenderDimensions(
    options.lengthM,
    options.widthM,
  );
  const thickness = Math.min(L, W) * THICKNESS_RATIO;
  const postHeight = POST_HEIGHT_BY_ELEVATION[options.elevation];
  const baseZ = postHeight;
  const topZ = baseZ + thickness;

  const center: Point2 = [L / 2, W / 2];
  const baseCorners: Point2[] = [
    [0, 0],
    [L, 0],
    [L, W],
    [0, W],
  ];
  const corners = baseCorners.map((c) => rotateAround(c, center, options.viewpoint));

  const topFacePts = corners.map(([x, y]) => project([x, y, topZ]));
  const bottomFacePts = corners.map(([x, y]) => project([x, y, baseZ]));

  const platformTopFace = pointsAttr(topFacePts);
  const platformFrontFace = pointsAttr([
    topFacePts[0],
    topFacePts[1],
    bottomFacePts[1],
    bottomFacePts[0],
  ]);
  const platformSideFace = pointsAttr([
    topFacePts[1],
    topFacePts[2],
    bottomFacePts[2],
    bottomFacePts[1],
  ]);

  const posts =
    postHeight > 0
      ? corners.map(([x, y]) => {
          const [x1, y1] = project([x, y, 0]);
          const [x2, y2] = project([x, y, baseZ]);
          return { x1, y1, x2, y2 };
        })
      : [];

  const railing = options.features.includes("railing")
    ? (() => {
        const railTopPts = corners.slice(0, 3).map(([x, y]) => project([x, y, topZ + RAIL_HEIGHT]));
        const rail = pointsAttr(railTopPts);
        const ticks: string[] = [];
        for (let i = 0; i < 2; i++) {
          const bottom = project([corners[i][0], corners[i][1], topZ]);
          const top = project([corners[i][0], corners[i][1], topZ + RAIL_HEIGHT]);
          ticks.push(pointsAttr([bottom, top]));
        }
        return { rail, ticks };
      })()
    : null;

  const stairs = options.features.includes("stairs")
    ? (() => {
        const stairWidth = L * 0.25;
        const stairDepth = W * 0.3;
        const stairHeight = Math.max(baseZ, W * 0.25);
        const midX = L / 2;
        const localPts: Point3[] = [
          [midX - stairWidth / 2, 0, baseZ],
          [midX + stairWidth / 2, 0, baseZ],
          [midX + stairWidth / 2, -stairDepth, Math.max(baseZ - stairHeight, 0)],
          [midX - stairWidth / 2, -stairDepth, Math.max(baseZ - stairHeight, 0)],
        ];
        const rotated = localPts.map(([x, y, z]): Point3 => [
          ...rotateAround([x, y], center, options.viewpoint),
          z,
        ]);
        return pointsAttr(rotated.map(project));
      })()
    : null;

  const houseWall =
    options.showHouseWall !== false
      ? (() => {
          const backEdge: [Point2, Point2] = [corners[2], corners[3]];
          const wallPts: Point3[] = [
            [backEdge[0][0], backEdge[0][1], 0],
            [backEdge[1][0], backEdge[1][1], 0],
            [backEdge[1][0], backEdge[1][1], HOUSE_WALL_HEIGHT],
            [backEdge[0][0], backEdge[0][1], HOUSE_WALL_HEIGHT],
          ];
          void HOUSE_WALL_DEPTH; // reserved for a future depth cue; kept flat (single face) for V1 simplicity.
          return pointsAttr(wallPts.map(project));
        })()
      : null;

  const groundPts: Point3[] = [
    [-L * GROUND_MARGIN_RATIO, -W * GROUND_MARGIN_RATIO, 0],
    [L * (1 + GROUND_MARGIN_RATIO), -W * GROUND_MARGIN_RATIO, 0],
    [L * (1 + GROUND_MARGIN_RATIO), W * (1 + GROUND_MARGIN_RATIO), 0],
    [-L * GROUND_MARGIN_RATIO, W * (1 + GROUND_MARGIN_RATIO), 0],
  ];
  const groundPolygon = pointsAttr(groundPts.map(project));

  const allScreenPoints: Point2[] = [
    ...groundPts.map(project),
    ...topFacePts,
    ...bottomFacePts,
    ...posts.flatMap(
      (p) =>
        [
          [p.x1, p.y1],
          [p.x2, p.y2],
        ] as Point2[],
    ),
  ];
  const xs = allScreenPoints.map((p) => p[0]);
  const ys = allScreenPoints.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys) - HOUSE_WALL_HEIGHT - RAIL_HEIGHT;
  const maxY = Math.max(...ys);
  const margin = Math.max(L, W) * 0.15;
  const viewBox = `${(minX - margin).toFixed(2)} ${(minY - margin).toFixed(2)} ${(maxX - minX + margin * 2).toFixed(2)} ${(maxY - minY + margin * 2).toFixed(2)}`;

  return {
    viewBox,
    groundPolygon,
    platformTopFace,
    platformFrontFace,
    platformSideFace,
    posts,
    railing,
    stairs,
    houseWall,
  };
}
