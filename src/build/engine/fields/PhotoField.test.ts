// Structural checks (renderToStaticMarkup — no DOM in this repo's node test
// environment). What a browser adds on top — the file dialog, the upload, the
// object URL — was exercised end to end in the Phase A QA and is described in
// the PR; here we pin what the markup must contain and must not.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PhotoAnswerEntry } from "@/build/schema/answers";
import type { PhotoField as PhotoFieldDef } from "@/build/schema/playbook";
import { PhotoField } from "./PhotoField";
import type { PhotoPreviewStore, PhotoShot } from "./types";

const field: PhotoFieldDef = {
  key: "photos",
  label: "Photos",
  type: "photo",
  desirability: "required",
  maxFiles: 4,
  maxFileSizeMb: 8,
  acceptMimeTypes: ["image/jpeg", "image/png"],
  storage: "supabase_storage",
};
const shots: PhotoShot[] = [
  { key: "front", label: "Front cover", hint: "Flat, in daylight.", exampleSrc: "/photo-guide/front.svg" },
  { key: "spine", label: "Spine", hint: "Top to bottom.", exampleSrc: "/photo-guide/spine.svg" },
];
const photo = (name: string, shot?: string): PhotoAnswerEntry => ({
  filename: name,
  sizeBytes: 100,
  mimeType: "image/png",
  storagePath: `s/${name}`,
  ...(shot ? { shot } : {}),
});
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(PhotoField, {
      field,
      value: undefined,
      onChange: () => {},
      uploadProjectPhoto: async () => ({
        storagePath: "s/x",
        filename: "x",
        sizeBytes: 1,
        mimeType: "image/png",
      }),
      ...props,
    }),
  );
const previews = (map: Record<string, string>): PhotoPreviewStore => ({
  get: (key) => map[key],
  set: () => {},
  release: () => {},
});

describe("PhotoField without guided views — the field it always was", () => {
  const html = render({});

  it("shows the plain drop zone and no guide", () => {
    expect(html).toContain("Choose photos or use your camera");
    expect(html).not.toContain("recommended view");
    expect(html).not.toContain("Example");
  });

  it("offers one hidden file input, reachable from a real button", () => {
    expect(html.match(/type="file"/g)).toHaveLength(1);
    expect(html).toContain("<button");
    expect(html).toContain('id="photos"');
  });

  it("lists photos with a replace and a remove control of a usable size (44px)", () => {
    const withPhotos = render({ value: [photo("a.png"), photo("b.png")] });
    expect(withPhotos).toContain('aria-label="Remove a.png"');
    expect(withPhotos).toContain('aria-label="Replace a.png"');
    expect(withPhotos.match(/min-h-11 min-w-11/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("says a stored photo is saved when the device holds no picture of it", () => {
    expect(render({ value: [photo("a.png")] })).toContain("Photo saved");
  });

  it("draws the picture when the session still holds one", () => {
    const html = render({ value: [photo("a.png")], photoPreviews: previews({ "s/a.png": "blob:abc" }) });
    expect(html).toContain('src="blob:abc"');
    expect(html).not.toContain("Photo saved");
  });

  it("stops offering the drop zone at the limit and says why", () => {
    const full = render({ value: [1, 2, 3, 4].map((n) => photo(`p${n}.png`)) });
    expect(full).toContain("Photo limit reached");
    expect(full).toContain("Remove one to add another.");
  });
});

describe("PhotoField with guided views", () => {
  it("shows one illustrated slot per view and how many are done", () => {
    const html = render({ photoShots: shots });
    expect(html).toContain("0 of 2 recommended views added");
    expect(html).toContain("Front cover");
    expect(html).toContain("Spine");
    expect(html).toContain('src="/photo-guide/front.svg"');
    expect(html).toContain("Flat, in daylight.");
    expect(html.match(/type="file"/g)).toHaveLength(3); // two views + the free drop zone
  });

  it("gives each view its own file input, so a photo lands in the view the visitor chose", () => {
    const html = render({ photoShots: shots });
    expect(html).toContain('id="photos-shot:front"');
    expect(html).toContain('id="photos-shot:spine"');
  });

  it("shows the visitor's photo in place of the example, with Replace and a remove control", () => {
    const html = render({
      photoShots: shots,
      value: [photo("c.png", "front")],
      photoPreviews: previews({ "s/c.png": "blob:cover" }),
    });
    expect(html).toContain("1 of 2 recommended views added");
    expect(html).toContain('src="blob:cover"');
    expect(html).not.toContain('src="/photo-guide/front.svg"');
    expect(html).toContain("Replace");
    expect(html).toContain('aria-label="Remove — Front cover"');
    expect(html).toContain("Added");
    // The other view is untouched.
    expect(html).toContain('src="/photo-guide/spine.svg"');
  });

  it("uses the singular for a single view", () => {
    expect(render({ photoShots: [shots[0]] })).toContain("0 of 1 recommended view added");
  });

  it("keeps free and legacy photos visible under 'Other photos'", () => {
    const html = render({
      photoShots: shots,
      value: [photo("free.png"), photo("s.png", "spine"), photo("old.png", "a-retired-view")],
    });
    expect(html).toContain("Other photos");
    expect(html).toContain("free.png");
    expect(html).toContain("old.png");
    // The spine photo is in its slot, not in the list of others.
    expect(html.split("Other photos")[1]).not.toContain("s.png");
    expect(html).toContain("1 of 2 recommended views added");
  });

  it("hides the free drop zone when the field is full, but never hides a photo", () => {
    const html = render({
      photoShots: shots,
      value: [photo("a.png", "front"), photo("b.png", "spine"), photo("c.png"), photo("d.png")],
    });
    expect(html).not.toContain("Choose photos or use your camera");
    expect(html).toContain("c.png");
    expect(html).toContain("d.png");
    // A full field must not lock a view's Replace: replacing does not add.
    expect(html).toMatch(/Replace/);
  });

  it("disables adding to an empty view once the field is full", () => {
    const html = render({
      photoShots: shots,
      value: [photo("a.png", "front"), photo("c.png"), photo("d.png"), photo("e.png")],
    });
    // The spine view has no photo and there is no room left: its Add is disabled.
    const spineCard = html.split('id="photos-shot:spine"')[1].split("</li>")[0];
    expect(spineCard).toMatch(/<button[^>]*disabled/);
  });
});
