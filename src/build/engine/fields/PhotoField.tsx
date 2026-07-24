import { Upload } from "lucide-react";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoField as PhotoFieldDef } from "@/build/schema/playbook";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldComponentProps } from "./types";

export function PhotoField({ field, value, onChange, error }: FieldComponentProps<PhotoFieldDef>) {
  const photos: PhotoAnswerEntry[] = Array.isArray(value) ? (value as PhotoAnswerEntry[]) : [];

  function onFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, field.maxFiles);
    const entries: PhotoAnswerEntry[] = selected.map((file) => ({
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    }));
    onChange(entries);
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
        className="mt-4"
        onChange={(event) => onFiles(event.target.files)}
      />
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {photos.map((photo) => (
          <span key={photo.filename} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {photo.filename}
          </span>
        ))}
      </div>
    </div>
  );
}
