import { Upload } from "lucide-react";
import { useState } from "react";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoField as PhotoFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_ERROR_CLASS, type FieldComponentProps } from "./types";

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
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
      <Upload className="h-6 w-6 text-emerald-700" />
      <Label htmlFor={field.key} className="mt-4 block font-semibold">
        {field.label}
      </Label>
      {field.helpText && <p className="mt-2 text-sm text-slate-600">{field.helpText}</p>}
      <Input
        id={field.key}
        type="file"
        accept={field.acceptMimeTypes.join(",")}
        multiple
        disabled={busy || remaining === 0}
        className="mt-4"
        onChange={(event) => {
          void onFiles(event.target.files);
          // Let the same file be picked again after a failure.
          event.target.value = "";
        }}
      />
      {busy && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          Uploading…
        </p>
      )}
      {remaining === 0 && !busy && (
        <p className="mt-2 text-sm text-slate-600">
          Maximum of {field.maxFiles} reached. Remove one to add another.
        </p>
      )}
      {uploadError && <p className={FIELD_ERROR_CLASS}>{uploadError}</p>}
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
      <ul className="mt-4 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li
            key={photo.storagePath ?? `${photo.filename}-${index}`}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
          >
            {photo.filename}
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove ${photo.filename}`}
              className="text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
