import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoPreviewStore } from "./types";

/**
 * The key a photo's thumbnail is filed under. A stored photo has a path that is
 * unique by construction; a `filename_only` entry has only a name and a size,
 * which is as unique as we can make it for a picture that never left the device.
 */
export function photoPreviewKey(entry: PhotoAnswerEntry): string {
  return entry.storagePath ?? `${entry.filename}:${entry.sizeBytes}`;
}

/**
 * A store that owns its object URLs: `dispose` revokes all of them, and the
 * store stays usable afterwards (React strict mode runs an effect's cleanup and
 * then its body again on the same instance).
 */
export function createPhotoPreviewStore(): PhotoPreviewStore & { dispose(): void } {
  const urls = new Map<string, string>();
  const revoke = (url: string) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* not an object URL — nothing to free */
    }
  };
  return {
    get: (key) => urls.get(key),
    set(key, url) {
      const previous = urls.get(key);
      if (previous && previous !== url) revoke(previous);
      urls.set(key, url);
    },
    release(key) {
      const url = urls.get(key);
      if (url) revoke(url);
      urls.delete(key);
    },
    dispose() {
      for (const url of urls.values()) revoke(url);
      urls.clear();
    },
  };
}
