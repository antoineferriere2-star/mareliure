import { Camera, Check, ImagePlus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoField as PhotoFieldDef } from "@/build/schema/playbook";
import { publicCopy, useOptionalPublicLocale } from "@/build/pages/public/publicLocaleContext";
import { Label } from "@/components/ui/label";
import { photoPreviewKey } from "./photoPreviews";
import {
  otherPhotos,
  photoForShot,
  shotProgress,
  withoutPhoto,
  withReplacedPhoto,
  withShotPhoto,
} from "./photoSlots";
import {
  FIELD_ERROR_CLASS,
  type FieldComponentProps,
  type PhotoPreviewStore,
  type PhotoShot,
  RequiredMark,
} from "./types";

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

const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 transition-colors hover:border-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const ICON_BUTTON_CLASS =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition-colors hover:border-stone-500 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** What the visitor's device can show of a photo they picked, or a "saved" tile once it can't. */
export function PhotoThumb({
  photo,
  previews,
  savedLabel,
}: {
  photo: PhotoAnswerEntry;
  previews?: PhotoPreviewStore;
  savedLabel: string;
}) {
  const url = previews?.get(photoPreviewKey(photo));
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      // The file name is the accessible name of the row; the picture itself is
      // decoration, and repeating it would read the same photo out twice.
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  // No bytes to show: a resumed session, or a format this browser cannot draw
  // (HEIC outside Safari). The photo is stored either way — say so.
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-stone-100 px-1 text-center text-[11px] font-medium leading-tight text-stone-600">
      <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
      {savedLabel}
    </span>
  );
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
 *
 * Independently of that, the deployment may hand the field a list of *views* to
 * capture (`photoShots`). The field then shows one illustrated slot per view —
 * each with its own add / replace / remove — above the free drop zone, and tags
 * each photo with the view it answers. It never knows what the views are.
 */
export function PhotoField({
  field,
  value,
  onChange,
  error,
  uploadProjectPhoto,
  photoShots,
  photoPreviews,
}: FieldComponentProps<PhotoFieldDef>) {
  const { locale } = useOptionalPublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const photos: PhotoAnswerEntry[] = Array.isArray(value) ? (value as PhotoAnswerEntry[]) : [];
  // What is being uploaded right now ("add", "shot:<key>", "replace:<i>"), so a
  // failure or a spinner shows where the visitor acted, not at the field's foot.
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ target: string; message: string } | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const busy = busyTarget !== null;
  const stores = field.storage === "supabase_storage" && Boolean(uploadProjectPhoto);
  const remaining = Math.max(0, field.maxFiles - photos.length);
  const shots = photoShots ?? [];
  const guided = shots.length > 0;

  /** Reasons to refuse a file before spending a mobile upload on it. */
  function refusal(file: File): string | null {
    if (!field.acceptMimeTypes.includes(file.type)) return "This file type is not supported.";
    if (file.size > field.maxFileSizeMb * 1024 * 1024) {
      return `${copy("Each photo must be under")} ${field.maxFileSizeMb} ${copy("MB.")}`;
    }
    return null;
  }

  /** One file to one answer entry — stored or filename-only — with a thumbnail kept for this session. */
  async function ingest(file: File): Promise<PhotoAnswerEntry> {
    const entry: PhotoAnswerEntry = stores
      ? await uploadProjectPhoto!({
          base64: await readAsBase64(file),
          mediaType: file.type,
          filename: file.name,
        })
      : { filename: file.name, sizeBytes: file.size, mimeType: file.type };
    try {
      photoPreviews?.set(photoPreviewKey(entry), URL.createObjectURL(file));
    } catch {
      /* no object URLs here (tests, very old browsers) — the "saved" tile covers it */
    }
    return entry;
  }

  function fail(target: string, err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to upload that photo.";
    setUploadError({ target, message: copy(message) });
  }

  /** The free drop zone: several files, appended, a partial result is still worth keeping. */
  async function addFree(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const selected = Array.from(files).slice(0, remaining);
    setBusyTarget("add");
    // Kept one at a time on purpose: a visitor on a phone uploading six
    // 8 MB photos at once is the case most likely to fail, and a partial
    // result is still worth keeping.
    const stored: PhotoAnswerEntry[] = [];
    try {
      for (const file of selected) {
        const refused = refusal(file);
        if (refused) {
          setUploadError({ target: "add", message: copy(refused) });
          continue;
        }
        stored.push(await ingest(file));
      }
    } catch (err) {
      fail("add", err);
    } finally {
      if (stored.length > 0) onChange([...photos, ...stored]);
      setBusyTarget(null);
    }
  }

  /** A guided view: exactly one photo, replacing the view's previous one. */
  async function addToShot(shot: PhotoShot, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const target = `shot:${shot.key}`;
    setUploadError(null);
    const refused = refusal(file);
    if (refused) {
      setUploadError({ target, message: copy(refused) });
      return;
    }
    setBusyTarget(target);
    try {
      const entry = await ingest(file);
      const previous = photoForShot(photos, shot.key);
      if (previous) photoPreviews?.release(photoPreviewKey(previous.photo));
      onChange(withShotPhoto(photos, shot.key, entry));
    } catch (err) {
      fail(target, err);
    } finally {
      setBusyTarget(null);
    }
  }

  async function replaceAt(index: number, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const target = `replace:${index}`;
    setUploadError(null);
    const refused = refusal(file);
    if (refused) {
      setUploadError({ target, message: copy(refused) });
      return;
    }
    setBusyTarget(target);
    try {
      const entry = await ingest(file);
      photoPreviews?.release(photoPreviewKey(photos[index]));
      onChange(withReplacedPhoto(photos, index, entry));
    } catch (err) {
      fail(target, err);
    } finally {
      setBusyTarget(null);
    }
  }

  function remove(index: number) {
    // Only the answer is cleared. The stored object is left where it is:
    // deleting it would need a second authenticated round-trip, and an
    // orphan in a private bucket is cheaper than a visitor stuck on a
    // failed delete.
    photoPreviews?.release(photoPreviewKey(photos[index]));
    setUploadError(null);
    onChange(withoutPhoto(photos, index));
  }

  const pick = (inputKey: string) => inputs.current[inputKey]?.click();

  /** A hidden file input the visible buttons drive: a real <button> is focusable and announced, a styled label is neither. */
  function hiddenInput(
    inputKey: string,
    onFiles: (files: FileList | null) => void,
    multiple = false,
  ) {
    return (
      <input
        ref={(node) => {
          inputs.current[inputKey] = node;
        }}
        id={inputKey === "add" ? field.key : `${field.key}-${inputKey}`}
        type="file"
        accept={field.acceptMimeTypes.join(",")}
        multiple={multiple}
        disabled={busy}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          onFiles(event.target.files);
          // Let the same file be picked again after a failure.
          event.target.value = "";
        }}
      />
    );
  }

  const errorFor = (target: string) =>
    uploadError?.target === target ? (
      <p className={FIELD_ERROR_CLASS} role="alert">
        {uploadError.message}
      </p>
    ) : null;

  const savedLabel = copy("Photo saved");
  const progress = guided ? shotProgress(photos, shots) : null;
  const others = guided ? otherPhotos(photos, shots) : photos.map((photo, index) => ({ photo, index }));

  return (
    <div className="rounded-lg border border-stone-300 bg-[#fffdf8] p-4 sm:p-5">
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

      {guided && progress && (
        <>
          <p className="mt-4 text-sm font-medium text-stone-700" role="status">
            {progress.added} {copy("of")} {progress.total}{" "}
            {copy(progress.total === 1 ? "recommended view added" : "recommended views added")}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shots.map((shot) => {
              const existing = photoForShot(photos, shot.key);
              const target = `shot:${shot.key}`;
              const uploading = busyTarget === target;
              const full = !existing && remaining === 0;
              return (
                <li
                  key={shot.key}
                  className="flex flex-col overflow-hidden rounded-lg border border-stone-300 bg-white"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                    {existing ? (
                      // Absolutely positioned: a portrait photo in an
                      // aspect-ratio box otherwise stretches the whole card.
                      <span className="absolute inset-0 block">
                        <PhotoThumb
                          photo={existing.photo}
                          previews={photoPreviews}
                          savedLabel={savedLabel}
                        />
                      </span>
                    ) : shot.exampleSrc ? (
                      <img
                        src={shot.exampleSrc}
                        alt={`${copy("Example")} — ${shot.label}`}
                        loading="lazy"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : null}
                    {existing ? (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        {copy("Added")}
                      </span>
                    ) : (
                      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                        {copy("Example")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="text-sm font-semibold text-stone-950">{shot.label}</p>
                    <p className="text-xs leading-5 text-stone-600">{shot.hint}</p>
                    <div className="mt-auto flex gap-2 pt-2">
                      {hiddenInput(target, (files) => void addToShot(shot, files))}
                      <button
                        type="button"
                        className={`${BUTTON_CLASS} flex-1`}
                        disabled={busy || full}
                        onClick={() => pick(target)}
                      >
                        {uploading ? (
                          copy("Uploading…")
                        ) : existing ? (
                          <>
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            {copy("Replace")}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {copy("Add")}
                          </>
                        )}
                        <span className="sr-only"> — {shot.label}</span>
                      </button>
                      {existing && (
                        <button
                          type="button"
                          className={ICON_BUTTON_CLASS}
                          disabled={busy}
                          onClick={() => remove(existing.index)}
                          aria-label={`${copy("Remove")} — ${shot.label}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {errorFor(target)}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(!guided || remaining > 0) && (
        <>
          {guided && (
            <p className="mt-5 text-sm font-semibold text-stone-950">{copy("Other photos")}</p>
          )}
          <button
            type="button"
            disabled={busy || remaining === 0}
            onClick={() => pick("add")}
            className={`mt-3 flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-400 bg-white px-4 text-center transition hover:border-[color:var(--metre-accent)] hover:bg-[color:var(--metre-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
              guided ? "min-h-20 py-4" : "min-h-36 py-6"
            }`}
          >
            <ImagePlus className={guided ? "h-5 w-5 text-stone-500" : "h-7 w-7 text-stone-500"} aria-hidden="true" />
            <span className="mt-2 text-sm font-semibold text-stone-950">
              {busyTarget === "add"
                ? copy("Uploading…")
                : copy(remaining === 0 ? "Photo limit reached" : "Choose photos or use your camera")}
            </span>
            <span className="mt-1 text-xs text-stone-500">
              {remaining} {copy(remaining === 1 ? "slot" : "slots")} {copy("available")}
            </span>
          </button>
          {hiddenInput("add", (files) => void addFree(files), true)}
        </>
      )}
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
      {errorFor("add")}
      {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}

      {others.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {others.map(({ photo, index }) => {
            const target = `replace:${index}`;
            return (
              <li
                key={photo.storagePath ?? `${photo.filename}-${index}`}
                className="rounded-md border border-stone-200 bg-white p-2"
              >
                <div className="flex items-center gap-3">
                  <span className="block h-14 w-14 shrink-0 overflow-hidden rounded bg-stone-100">
                    <PhotoThumb photo={photo} previews={photoPreviews} savedLabel={savedLabel} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-700">
                    {photo.filename}
                  </span>
                  {hiddenInput(target, (files) => void replaceAt(index, files))}
                  <button
                    type="button"
                    className={ICON_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => pick(target)}
                    aria-label={`${copy("Replace")} ${photo.filename}`}
                    title={copy("Replace")}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${busyTarget === target ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => remove(index)}
                    aria-label={`${copy("Remove")} ${photo.filename}`}
                    title={copy("Remove")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {errorFor(target)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
