import { useState } from "react";
import { ImagePlus, Sparkles, Upload } from "lucide-react";
import type { InspirationHypothesisKey, InspirationPhotoAnswer } from "@/build/schema/answers";
import type { InspirationPhotoField as InspirationPhotoFieldDef } from "@/build/schema/playbook";
import { Label } from "@/components/ui/label";
import { DetectionBadge } from "@/build/components/DetectionBadge";
import { publicCopy, useOptionalPublicLocale } from "@/build/pages/public/publicLocaleContext";
import { RequiredMark, type FieldComponentProps } from "./types";

function resizeToBase64(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(objectUrl);
      if (!ctx) {
        reject(new Error("Canvas unavailable."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({ base64, mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the image."));
    };
    img.src = objectUrl;
  });
}

function HypothesisRow({
  label,
  value,
  confirmed,
  onChange,
}: {
  label: string;
  value: string;
  confirmed: boolean;
  onChange: (value: string) => void;
}) {
  const { locale } = useOptionalPublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <div className="rounded-lg border border-stone-300 bg-[#fffdf8] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">
          {label}
        </span>
        <DetectionBadge
          state={confirmed ? "confirmed" : "detected"}
          labels={{
            detected: copy("Detected from the provided information"),
            confirmed: copy("Confirmed"),
          }}
        />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy("Not detected — add details if needed")}
        className="mt-2 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)]"
      />
    </div>
  );
}

export function InspirationPhotoField({
  field,
  value,
  onChange,
  error,
  analyzeInspirationPhoto,
}: FieldComponentProps<InspirationPhotoFieldDef>) {
  const { locale } = useOptionalPublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const answer =
    value && typeof value === "object" && "photoPath" in value
      ? (value as InspirationPhotoAnswer)
      : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  async function onFileSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file || !analyzeInspirationPhoto) return;
    if (file.size > field.maxFileSizeMb * 1024 * 1024) {
      setAnalyzeError(`The image must be smaller than ${field.maxFileSizeMb} MB.`);
      return;
    }
    setAnalyzeError(null);
    setAnalyzing(true);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const image = await resizeToBase64(file);
      const result = await analyzeInspirationPhoto(image);
      const nextAnswer: InspirationPhotoAnswer = {
        photoPath: result.photoPath,
        hypotheses: {
          style: result.hypotheses.style,
          materials: result.hypotheses.materials,
          shape: result.hypotheses.shape,
          elements: result.hypotheses.elements,
        },
        confirmed: {},
        suggestedQuestions: result.hypotheses.suggestedQuestions,
      };
      onChange(nextAnswer);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Unable to analyze the image.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateHypothesis(
    patch: Partial<InspirationPhotoAnswer["hypotheses"]>,
    confirmedKeys: InspirationHypothesisKey[],
  ) {
    if (!answer) return;
    const nextConfirmed = { ...answer.confirmed };
    for (const key of confirmedKeys) nextConfirmed[key] = true;
    onChange({
      ...answer,
      hypotheses: { ...answer.hypotheses, ...patch },
      confirmed: nextConfirmed,
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-300 bg-[#fffdf8]">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--metre-accent-soft)] text-[color:var(--metre-accent)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <Label htmlFor={field.key} className="block text-base font-semibold text-stone-950">
              {copy(field.label)}
              <RequiredMark field={field} />
            </Label>
            {field.helpText && (
              <p className="mt-2 text-sm leading-6 text-stone-600">{copy(field.helpText)}</p>
            )}
          </div>
        </div>

        {!answer && (
          <label
            htmlFor={field.key}
            className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-400 bg-white px-4 py-6 text-center transition hover:border-[color:var(--metre-accent)] hover:bg-[color:var(--metre-accent-soft)]"
          >
            <ImagePlus className="h-8 w-8 text-stone-500" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-stone-950">
              {copy("Choose an inspiration image")}
            </span>
            <span className="mt-1 max-w-sm text-xs leading-5 text-stone-500">
              {copy("Métré will suggest what it notices, then you confirm or adjust it.")}
            </span>
          </label>
        )}
        <input
          id={field.key}
          type="file"
          accept={field.acceptMimeTypes.join(",")}
          className="sr-only"
          disabled={analyzing}
          onChange={(event) => onFileSelected(event.target.files)}
        />

        {analyzing && (
          <p className="mt-3 text-sm text-stone-600" role="status">
            {copy("Looking at your inspiration…")}
          </p>
        )}
        {(error || analyzeError) && (
          <p className="mt-2 text-sm text-rose-700">{copy(error ?? analyzeError ?? "")}</p>
        )}
      </div>

      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="h-56 w-full border-y border-stone-200 object-cover"
        />
      )}

      {answer && !analyzing && (
        <div className="space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            {copy("Here's what we noticed — review and confirm")}
          </p>

          <HypothesisRow
            label={copy("Style")}
            confirmed={answer.confirmed.style === true}
            value={copy(answer.hypotheses.style ?? "")}
            onChange={(v) => updateHypothesis({ style: v || undefined }, ["style"])}
          />
          <HypothesisRow
            label={copy("Materials")}
            confirmed={answer.confirmed.materials === true}
            value={answer.hypotheses.materials.map(copy).join(", ")}
            onChange={(v) =>
              updateHypothesis(
                {
                  materials: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                ["materials"],
              )
            }
          />
          <HypothesisRow
            label={copy("Shape")}
            confirmed={answer.confirmed.shape === true}
            value={copy(answer.hypotheses.shape ?? "")}
            onChange={(v) => updateHypothesis({ shape: v || undefined }, ["shape"])}
          />
          <HypothesisRow
            label={copy("Elements")}
            confirmed={answer.confirmed.elements === true}
            value={answer.hypotheses.elements.map(copy).join(", ")}
            onChange={(v) =>
              updateHypothesis(
                {
                  elements: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                ["elements"],
              )
            }
          />

          {answer.suggestedQuestions.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
              <p className="font-medium text-stone-800">
                {copy("Topics to review with the sales team:")}
              </p>
              <ul className="mt-1 list-disc pl-4">
                {answer.suggestedQuestions.map((q) => (
                  <li key={q}>{copy(q)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
