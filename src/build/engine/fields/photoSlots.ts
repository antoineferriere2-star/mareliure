import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoShot } from "./types";

/**
 * The list operations behind a guided photo field, kept out of the component so
 * the rules — one photo per guided view, a replacement keeps its place, nothing
 * is lost when a view is re-taken — can be tested without a browser.
 */

export function photoForShot(
  photos: readonly PhotoAnswerEntry[],
  shotKey: string,
): { photo: PhotoAnswerEntry; index: number } | null {
  const index = photos.findIndex((photo) => photo.shot === shotKey);
  return index === -1 ? null : { photo: photos[index], index };
}

/**
 * Photos the guide does not account for: added through the free drop zone, or
 * recorded before guided views existed, or tagged with a view this Playbook no
 * longer lists. They stay visible and removable — a photo the visitor took must
 * never vanish because the guide changed.
 */
export function otherPhotos(
  photos: readonly PhotoAnswerEntry[],
  shots: readonly PhotoShot[],
): { photo: PhotoAnswerEntry; index: number }[] {
  const known = new Set(shots.map((shot) => shot.key));
  return photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !photo.shot || !known.has(photo.shot));
}

export function shotProgress(
  photos: readonly PhotoAnswerEntry[],
  shots: readonly PhotoShot[],
): { added: number; total: number } {
  return {
    added: shots.filter((shot) => photoForShot(photos, shot.key)).length,
    total: shots.length,
  };
}

/**
 * Put `entry` in the slot for `shotKey`. If that view already has a photo the
 * new one takes its place in the list; otherwise it is appended. Never grows
 * the list past one photo per view.
 */
export function withShotPhoto(
  photos: readonly PhotoAnswerEntry[],
  shotKey: string,
  entry: PhotoAnswerEntry,
): PhotoAnswerEntry[] {
  const tagged = { ...entry, shot: shotKey };
  const existing = photoForShot(photos, shotKey);
  if (!existing) return [...photos, tagged];
  return photos.map((photo, index) => (index === existing.index ? tagged : photo));
}

/** Swap the photo at `index` for `entry`, keeping its view tag and its place. */
export function withReplacedPhoto(
  photos: readonly PhotoAnswerEntry[],
  index: number,
  entry: PhotoAnswerEntry,
): PhotoAnswerEntry[] {
  const previous = photos[index];
  if (!previous) return [...photos];
  const next = previous.shot ? { ...entry, shot: previous.shot } : entry;
  return photos.map((photo, i) => (i === index ? next : photo));
}

export function withoutPhoto(
  photos: readonly PhotoAnswerEntry[],
  index: number,
): PhotoAnswerEntry[] {
  return photos.filter((_, i) => i !== index);
}
