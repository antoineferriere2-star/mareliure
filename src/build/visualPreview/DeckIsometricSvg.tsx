// Dumb, presentational-only isometric renderer. Receives already-computed
// render parameters from deckPreviewGeometry.ts and never reads raw
// runtime answers, the Playbook schema, or performs any unit conversion,
// localization, or business-rule logic itself — that separation is
// deliberate (see the module doc on deckPreviewGeometry.ts).
import type { DeckSvgGeometry, DeckMaterialVisualFamily } from "./deckPreviewGeometry";

const MATERIAL_COLORS: Record<DeckMaterialVisualFamily, { fill: string; stroke: string }> = {
  wood: { fill: "#c9a06a", stroke: "#96754a" },
  "composite-brown": { fill: "#8a5a3b", stroke: "#623f28" },
  "composite-gray": { fill: "#a4abb2", stroke: "#767e86" },
  neutral: { fill: "#c9c9c9", stroke: "#9a9a9a" },
};

const GROUND_COLOR = "#e4ece2";
const HOUSE_WALL_COLOR = { fill: "#ece6d8", stroke: "#c9c1a9" };
const POST_STROKE = "#6b5a46";
const RAIL_STROKE = "#4a4a4a";

export function DeckIsometricSvg({
  geometry,
  materialFamily,
  ariaLabel,
}: {
  geometry: DeckSvgGeometry;
  materialFamily: DeckMaterialVisualFamily;
  ariaLabel: string;
}) {
  const material = MATERIAL_COLORS[materialFamily];

  return (
    <svg
      viewBox={geometry.viewBox}
      role="img"
      aria-label={ariaLabel}
      className="h-full w-full"
      style={{ maxHeight: 320 }}
    >
      <polygon points={geometry.groundPolygon} fill={GROUND_COLOR} stroke="none" />

      {geometry.houseWall && (
        <polygon
          points={geometry.houseWall}
          fill={HOUSE_WALL_COLOR.fill}
          stroke={HOUSE_WALL_COLOR.stroke}
          strokeWidth={0.5}
        />
      )}

      {geometry.posts.map((post, i) => (
        <line
          key={i}
          x1={post.x1}
          y1={post.y1}
          x2={post.x2}
          y2={post.y2}
          stroke={POST_STROKE}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
      ))}

      <polygon
        points={geometry.platformFrontFace}
        fill={material.fill}
        stroke={material.stroke}
        strokeWidth={0.4}
        opacity={0.85}
      />
      <polygon
        points={geometry.platformSideFace}
        fill={material.fill}
        stroke={material.stroke}
        strokeWidth={0.4}
        opacity={0.7}
      />
      <polygon
        points={geometry.platformTopFace}
        fill={material.fill}
        stroke={material.stroke}
        strokeWidth={0.4}
      />

      {geometry.stairs && (
        <polygon
          points={geometry.stairs}
          fill={material.fill}
          stroke={material.stroke}
          strokeWidth={0.4}
          opacity={0.75}
        />
      )}

      {geometry.railing && (
        <>
          <polyline
            points={geometry.railing.rail}
            fill="none"
            stroke={RAIL_STROKE}
            strokeWidth={0.4}
          />
          {geometry.railing.ticks.map((tick, i) => (
            <polyline key={i} points={tick} fill="none" stroke={RAIL_STROKE} strokeWidth={0.35} />
          ))}
        </>
      )}
    </svg>
  );
}
