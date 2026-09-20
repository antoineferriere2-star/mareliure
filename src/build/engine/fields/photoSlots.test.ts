import { describe, expect, it, vi } from "vitest";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import { createPhotoPreviewStore, photoPreviewKey } from "./photoPreviews";
import {
  otherPhotos,
  photoForShot,
  shotProgress,
  withoutPhoto,
  withReplacedPhoto,
  withShotPhoto,
} from "./photoSlots";
import type { PhotoShot } from "./types";

const shots: PhotoShot[] = [
  { key: "front", label: "Front", hint: "h" },
  { key: "spine", label: "Spine", hint: "h" },
];
const entry = (name: string, extra: Partial<PhotoAnswerEntry> = {}): PhotoAnswerEntry => ({
  filename: name,
  sizeBytes: 10,
  mimeType: "image/png",
  storagePath: `s/${name}`,
  ...extra,
});

describe("guided photo slots", () => {
  it("adds a photo to a view and tags it", () => {
    const next = withShotPhoto([], "front", entry("a"));
    expect(next).toEqual([{ ...entry("a"), shot: "front" }]);
  });

  it("re-taking a view replaces it in place — one photo per view, and nothing else moves", () => {
    const before = [entry("free"), { ...entry("a"), shot: "front" }, { ...entry("b"), shot: "spine" }];
    const after = withShotPhoto(before, "front", entry("a2"));
    expect(after.map((p) => p.filename)).toEqual(["free", "a2", "b"]);
    expect(after.filter((p) => p.shot === "front")).toHaveLength(1);
    expect(before[1].filename).toBe("a"); // input not mutated
  });

  it("finds the photo of a view, and none for an empty one", () => {
    const list = [entry("free"), { ...entry("b"), shot: "spine" }];
    expect(photoForShot(list, "spine")).toEqual({ photo: list[1], index: 1 });
    expect(photoForShot(list, "front")).toBeNull();
  });

  it("counts the views that have a photo, not the photos", () => {
    const list = [entry("x"), entry("y"), { ...entry("b"), shot: "spine" }];
    expect(shotProgress(list, shots)).toEqual({ added: 1, total: 2 });
    expect(shotProgress([], shots)).toEqual({ added: 0, total: 2 });
    expect(shotProgress(list, [])).toEqual({ added: 0, total: 0 });
  });

  it("keeps photos the guide does not account for visible — free ones, legacy ones, and views since removed", () => {
    const list = [entry("free"), { ...entry("b"), shot: "spine" }, { ...entry("old"), shot: "retired-view" }];
    expect(otherPhotos(list, shots).map(({ photo }) => photo.filename)).toEqual(["free", "old"]);
    expect(otherPhotos(list, shots).map(({ index }) => index)).toEqual([0, 2]);
  });

  it("replacing a photo by position keeps its view tag and its place", () => {
    const before = [entry("free"), { ...entry("b"), shot: "spine" }];
    expect(withReplacedPhoto(before, 1, entry("b2")).map((p) => [p.filename, p.shot])).toEqual([
      ["free", undefined],
      ["b2", "spine"],
    ]);
    expect(withReplacedPhoto(before, 0, entry("f2"))[0].shot).toBeUndefined();
  });

  it("replacing a position that does not exist changes nothing", () => {
    const before = [entry("a")];
    expect(withReplacedPhoto(before, 5, entry("z"))).toEqual(before);
  });

  it("removes by position without touching the others", () => {
    const before = [entry("a"), entry("b"), entry("c")];
    expect(withoutPhoto(before, 1).map((p) => p.filename)).toEqual(["a", "c"]);
    expect(before).toHaveLength(3);
  });

  it("an answer recorded before views existed (no `shot`) is all 'other photos'", () => {
    const legacy = [entry("a"), entry("b")];
    expect(otherPhotos(legacy, shots)).toHaveLength(2);
    expect(shotProgress(legacy, shots).added).toBe(0);
  });
});

describe("photo previews", () => {
  it("files a stored photo under its path and a filename-only one under name and size", () => {
    expect(photoPreviewKey(entry("a"))).toBe("s/a");
    expect(photoPreviewKey({ filename: "a.png", sizeBytes: 42, mimeType: "image/png" })).toBe("a.png:42");
  });

  it("frees an object URL when it is released, replaced, or the store is disposed", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = createPhotoPreviewStore();
    store.set("k", "blob:1");
    expect(store.get("k")).toBe("blob:1");
    store.set("k", "blob:2");
    expect(revoke).toHaveBeenCalledWith("blob:1");
    store.release("k");
    expect(revoke).toHaveBeenCalledWith("blob:2");
    expect(store.get("k")).toBeUndefined();
    store.set("a", "blob:3");
    store.set("b", "blob:4");
    store.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:3");
    expect(revoke).toHaveBeenCalledWith("blob:4");
    // Still usable afterwards: strict mode re-runs effects on the same instance.
    store.set("c", "blob:5");
    expect(store.get("c")).toBe("blob:5");
    revoke.mockRestore();
  });

  it("re-setting the same URL does not free it", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = createPhotoPreviewStore();
    store.set("k", "blob:same");
    store.set("k", "blob:same");
    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
