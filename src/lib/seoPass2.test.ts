import { describe, expect, it } from "vitest";
import { fineBinderyDirectoryHead } from "@/marketplace/i18n/fineBinderySeo";

const robots = (head: { meta: { name?: string; content?: string }[] }) => head.meta.find((m) => m.name === "robots")?.content;

describe("l'annuaire Fine Bindery et les moteurs", () => {
  it("n'est pas indexé tant qu'aucun atelier n'est publié", () => {
    expect(robots(fineBinderyDirectoryHead("en", { empty: true }))).toBe("noindex, follow");
  });

  it("redevient indexable dès le premier atelier", () => {
    expect(robots(fineBinderyDirectoryHead("de", { empty: false }))).toBe("index, follow");
    expect(robots(fineBinderyDirectoryHead("fr"))).toBe("index, follow");
  });
});
