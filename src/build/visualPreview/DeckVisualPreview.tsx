// Orchestrator for the Deck visual preview: owns the tiny bit of UI state
// (which of the 4 fixed isometric viewpoints, whether zoomed in), wires the
// pure mapping/geometry/copy modules together, and renders either the
// geometry, an honest fallback, or nothing at all. Never reads raw runtime
// answers or the Playbook schema directly — only the already-resolved
// DeckPreviewSnapshot frozen onto the visitor summary at submission time.
import { useMemo, useState } from "react";
import type { MeasurementSystem } from "@/build/measurements/types";
import type { DeckPreviewSnapshot } from "./deckPreviewParams";
import {
  decideDeckPreviewSection,
  formatDeckDimensionLabels,
  shouldShowElevationVerificationNote,
} from "./deckPreviewDisplay";
import {
  computeDeckIsometricGeometry,
  resolveMaterialVisualFamily,
  type DeckPreviewViewpoint,
} from "./deckPreviewGeometry";
import { DeckIsometricSvg } from "./DeckIsometricSvg";
import { DeckPreviewFallback } from "./DeckPreviewFallback";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const DISCLAIMER: Record<"en-US" | "es-US", string> = {
  "en-US":
    "This is a simplified visual preview based on your answers. Dimensions, colors and project features are illustrative. It is not a final design, construction plan or technical approval.",
  "es-US":
    "Esta es una vista previa visual simplificada basada en sus respuestas. Las dimensiones, los colores y las características del proyecto son ilustrativos. No es un diseño final, un plano de construcción ni una aprobación técnica.",
};

function nextViewpoint(current: DeckPreviewViewpoint, delta: 1 | -1): DeckPreviewViewpoint {
  return ((((current + delta) % 4) + 4) % 4) as DeckPreviewViewpoint;
}

export function DeckVisualPreview({
  snapshot,
  measurementSystem,
}: {
  snapshot?: DeckPreviewSnapshot;
  measurementSystem: MeasurementSystem;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const [viewpoint, setViewpoint] = useState<DeckPreviewViewpoint>(0);
  const [zoomed, setZoomed] = useState(false);

  const decision = decideDeckPreviewSection(snapshot?.resolution);

  // Hooks must run unconditionally, so this is computed every render but
  // only ever used when decision.render === "geometry".
  const geometryData = useMemo(() => {
    if (decision.render !== "geometry" || snapshot?.resolution.status !== "complete") return null;
    const { params } = snapshot.resolution;
    const geometry = computeDeckIsometricGeometry({
      lengthM: params.dimensions.lengthM,
      widthM: params.dimensions.widthM,
      elevation: params.elevation,
      features: params.features,
      viewpoint,
    });
    const materialFamily = resolveMaterialVisualFamily(params.material);
    const labels = formatDeckDimensionLabels(params.dimensions, locale, measurementSystem);
    return { geometry, materialFamily, labels, elevation: params.elevation };
  }, [decision.render, snapshot, viewpoint, locale, measurementSystem]);

  if (decision.render === "nothing") return null;

  if (decision.render === "fallback") {
    return <DeckPreviewFallback message={copy(decision.messageKey)} />;
  }

  if (!geometryData) return null;

  const ariaLabel = `${copy("Illustrative preview of your deck")}: ${geometryData.labels.length} × ${geometryData.labels.width}`;

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2"
        style={{ transform: zoomed ? "scale(1.3)" : "scale(1)", transformOrigin: "center" }}
      >
        <DeckIsometricSvg
          geometry={geometryData.geometry}
          materialFamily={geometryData.materialFamily}
          ariaLabel={ariaLabel}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {geometryData.labels.length} × {geometryData.labels.width} ({geometryData.labels.area})
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={copy("Rotate left")}
            onClick={() => setViewpoint((v) => nextViewpoint(v, -1))}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            ↺ {copy("Rotate left")}
          </button>
          <button
            type="button"
            aria-label={copy("Rotate right")}
            onClick={() => setViewpoint((v) => nextViewpoint(v, 1))}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            ↻ {copy("Rotate right")}
          </button>
          <button
            type="button"
            aria-label={copy(zoomed ? "Zoom out" : "Zoom in")}
            onClick={() => setZoomed((z) => !z)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {zoomed ? "−" : "+"} {copy(zoomed ? "Zoom out" : "Zoom in")}
          </button>
          <button
            type="button"
            aria-label={copy("Reset view")}
            onClick={() => {
              setViewpoint(0);
              setZoomed(false);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {copy("Reset view")}
          </button>
        </div>
      </div>

      {shouldShowElevationVerificationNote(geometryData.elevation) && (
        <p className="text-xs text-slate-500">
          {copy("Elevation shown is simplified and subject to on-site verification.")}
        </p>
      )}

      <p className="text-xs text-slate-500">{DISCLAIMER[locale]}</p>
    </div>
  );
}

export default DeckVisualPreview;
