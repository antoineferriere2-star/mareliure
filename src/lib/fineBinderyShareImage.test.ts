import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("l'image de partage de Fine Bindery", () => {
  it("existe, est déclarée au registre des images et annoncée par la racine", () => {
    expect(read("docs/content-assets.md")).toContain("public/og/finebindery-1200x630.png");
    expect(readFileSync(resolve(process.cwd(), "public/og/finebindery-1200x630.png")).length).toBeGreaterThan(10_000);
    const root = read("src/routes/__root.tsx");
    expect(root).toContain('{ property: "og:image", content: FINE_BINDERY_OG_IMAGE }');
    expect(root).toContain('{ name: "twitter:image", content: FINE_BINDERY_OG_IMAGE }');
  });
});
