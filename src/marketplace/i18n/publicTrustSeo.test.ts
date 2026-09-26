import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fineBinderyDirectoryHead, fineBinderyHomeHead } from "./fineBinderySeo";
import { FINE_BINDERY_LOCALES } from "./fineBinderyLocale";

describe("public search destinations", () => {
  it.each(FINE_BINDERY_LOCALES)("keeps %s metadata, canonical and alternates aligned", (locale) => {
    const head = fineBinderyHomeHead(locale);
    expect(head.links.find((link) => link.rel === "canonical")?.href).toBe(`https://finebindery.com/${locale}`);
    expect(head.links.filter((link) => link.rel === "alternate")).toHaveLength(6);
    const image = head.meta.find((meta) => "property" in meta && meta.property === "og:image");
    expect(image && "content" in image && existsSync(resolve(process.cwd(), `public${new URL(image.content!).pathname}`))).toBe(true);
  });

  it.each(FINE_BINDERY_LOCALES)("does not index an empty %s directory, but indexes published results", (locale) => {
    const robots = (published: boolean) => fineBinderyDirectoryHead(locale, published).meta.find((meta) => "name" in meta && meta.name === "robots");
    expect(robots(false)).toEqual({ name: "robots", content: "noindex, follow" });
    expect(robots(true)).toEqual({ name: "robots", content: "index, follow" });
  });
});
