import { Camera, ImagePlus, Upload } from "lucide-react";
import { useState } from "react";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoField as PhotoFieldDef } from "@/build/schema/playbook";
import { publicCopy, useOptionalPublicLocale } from "@/build/pages/public/publicLocaleContext";
import { Label } from "@/components/ui/label";
import { FIELD_ERROR_CLASS, type FieldComponentProps, RequiredMark } from "./types";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      // data:image/jpeg;base64,XXXX — the API wants only the payload.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Two behaviours, chosen by the Playbook, not by this component.
 *
 * `filename_only` records the name and size of each file and sends nothing —
 * the original behaviour, kept because Playbooks published against it are
 * still live and their visitors must not start seeing upload failures.
 *
 * `supabase_storage` actually stores the file and records the path alongside
 * the name, which is what lets the workspace open it later.
 */
export function PhotoField({
  field,
  value,
  onChange,
  error,
  uploadProjectPhoto,
}: FieldComponentProps<PhotoFieldDef>) {
  const { locale } = useOptionalPublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const photos: PhotoAnswerEntry[] = Array.isArray(value) ? (value as PhotoAnswerEntry[]) : [];
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const stores = field.storage === "supabase_storage" && Boolean(uploadProjectPhoto);
  const remaining = Math.max(0, field.maxFiles - photos.length);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const selected = Array.from(files).slice(0, remaining);

    if (!stores) {
      onChange([
        ...photos,
        ...selected.map((file) => ({
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
        })),
      ]);
      return;
    }

    setBusy(true);
    // Kept one at a time on purpose: a visitor on a phone uploading six
    // 8 MB photos at once is the case most likely to fail, and a partial
    // result is still worth keeping.
    const stored: PhotoAnswerEntry[] = [];
    try {
      for (const file of selected) {
        const base64 = await readAsBase64(file);
        const entry = await uploadProjectPhoto!({
          base64,
          mediaType: file.type,
          filename: file.name,
        });
        stored.push(entry);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Unable to upload that photo.");
    } finally {
      if (stored.length > 0) onChange([...photos, ...stored]);
      setBusy(false);
    }
  }

  function remove(index: number) {
    // Only the answer is cleared. The stored object is left where it is:
    // deleting it would need a second authenticated round-trip, and an
    // orphan in a private bucket is cheaper than a visitor stuck on a
    // failed delete.
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-[#fffdf8] p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--metre-accent-soft)] text-[color:var(--metre-accent)]">
          <Camera className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Label htmlFor={field.key} className="block text-base font-semibold text-stone-950">
            {field.label}
            <RequiredMark field={field} />
          </Label>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {field.helpText ??
              copy("Add photos that help the team understand the site before the first call.")}
          </p>
        </div>
      </div>
      <label
        htmlFor={field.key}
        className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-400 bg-white px-4 py-6 text-center transition hover:border-[color:var(--metre-accent)] hover:bg-[color:var(--metre-accent-soft)]"
      >
        <ImagePlus className="h-7 w-7 text-stone-500" aria-hidden="true" />
        <span className="mt-3 text-sm font-semibold text-stone-950">
          {copy(remaining === 0 ? "Photo limit reached" : "Choose photos or use your camera")}
        </span>
        <span className="mt-1 text-xs text-stone-500">
          {remaining} {copy(remaining === 1 ? "slot" : "slots")} {copy("available")}
        </span>
      </label>
      <input
        id={field.key}
        type="file"
        accept={field.acceptMimeTypes.join(",")}
        multiple
        disabled={busy || remaining === 0}
        className="sr-only"
        onChange={(event) => {
          void onFiles(event.target.files);
          // Let the same file be picked again after a failure.
          event.target.value = "";
        }}
      />
      {busy && (
        <p className="mt-3 text-sm text-stone-600" role="status">
          {copy("Uploading…")}
        </p>
      )}
      {remaining === 0 && !busy && (
        <p className="mt-3 text-sm text-stone-600">
          {copy("Maximum of")} {field.maxFiles} {copy("reached. Remove one to add another.")}
        </p>
      )}
      {uploadError && <p className={FIELD_ERROR_CLASS}>{uploadError}</p>}
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {photos.map((photo, index) => (
          <li
            key={photo.storagePath ?? `${photo.filename}-${index}`}
            className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700"
          >
            <span className="min-w-0 truncate">
              <Upload className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {photo.filename}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove ${photo.filename}`}
              className="shrink-0 text-stone-400 hover:text-stone-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
