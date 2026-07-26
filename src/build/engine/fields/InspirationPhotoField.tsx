import { useState } from "react";
import { Upload } from "lucide-react";
import type { InspirationHypothesisKey, InspirationPhotoAnswer } from "@/build/schema/answers";
import type { InspirationPhotoField as InspirationPhotoFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetectionBadge } from "@/build/components/DetectionBadge";
import type { FieldComponentProps } from "./types";

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
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <DetectionBadge state={confirmed ? "confirmed" : "detected"} />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not detected — add details if needed"
        className="mt-2 w-full min-w-0 rounded-md border border-slate-200 px-2 py-1 text-sm"
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
      <Upload className="h-6 w-6 text-emerald-700" />
      <Label htmlFor={field.key} className="mt-4 block font-semibold">
        {field.label}
      </Label>
      {field.helpText && <p className="mt-2 text-sm text-slate-600">{field.helpText}</p>}

      {!answer && (
        <Input
          id={field.key}
          type="file"
          accept={field.acceptMimeTypes.join(",")}
          className="mt-4 w-full min-w-0"
          disabled={analyzing}
          onChange={(event) => onFileSelected(event.target.files)}
        />
      )}

      {analyzing && <p className="mt-3 text-sm text-slate-600">Analyzing the image…</p>}
      {(error || analyzeError) && (
        <p className="mt-2 text-sm text-rose-700">{error ?? analyzeError}</p>
      )}

      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="mt-4 max-h-48 rounded-md border border-slate-200 object-cover"
        />
      )}

      {answer && !analyzing && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            AI observations — review and confirm
          </p>

          <HypothesisRow
            label="Style"
            confirmed={answer.confirmed.style === true}
            value={answer.hypotheses.style ?? ""}
            onChange={(v) => updateHypothesis({ style: v || undefined }, ["style"])}
          />
          <HypothesisRow
            label="Materials"
            confirmed={answer.confirmed.materials === true}
            value={answer.hypotheses.materials.join(", ")}
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
            label="Shape"
            confirmed={answer.confirmed.shape === true}
            value={answer.hypotheses.shape ?? ""}
            onChange={(v) => updateHypothesis({ shape: v || undefined }, ["shape"])}
          />
          <HypothesisRow
            label="Elements"
            confirmed={answer.confirmed.elements === true}
            value={answer.hypotheses.elements.join(", ")}
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
            <div className="rounded-md bg-white p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Topics to review with the sales team:</p>
              <ul className="mt-1 list-disc pl-4">
                {answer.suggestedQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
