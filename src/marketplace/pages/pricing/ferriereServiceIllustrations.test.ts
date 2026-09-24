import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import {
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_NUMBERS,
  ferriereServicePhoto,
} from "./ferriereServiceIllustrations";

describe("les illustrations des prestations Ferrière", () => {
  const keys = Object.keys(FERRIERE_SERVICE_PHOTO_NUMBERS);

  it("couvrent exactement les 45 prestations du catalogue", () => {
    expect(keys).toHaveLength(45);
    expect(keys.sort()).toEqual(WORK_ITEMS.map((item) => item.key).sort());
  });

  it("utilisent une photographie source distincte pour chaque prestation", () => {
    expect(new Set(Object.values(FERRIERE_SERVICE_PHOTO_NUMBERS)).size).toBe(45);
  });

  it("livrent les deux variantes WebP de chaque photographie", () => {
    for (const key of keys) {
      const photo = ferriereServicePhoto(key as keyof typeof FERRIERE_SERVICE_PHOTO_NUMBERS);
      for (const entry of photo.srcSet.split(", ")) {
        const path = entry.split(" ")[0].replace(/^\//, "");
        expect(existsSync(resolve(process.cwd(), "public", path)), path).toBe(true);
      }
    }
  });

  it("enregistre la provenance et le crédit dans le registre éditorial", () => {
    const register = readFileSync(resolve(process.cwd(), "docs/content-assets.md"), "utf8");
    expect(register).toContain(FERRIERE_SERVICE_PHOTO_CREDIT);
    for (const [key, number] of Object.entries(FERRIERE_SERVICE_PHOTO_NUMBERS)) {
      expect(register, key).toContain(`\`${key}\``);
      expect(register, `photo ${number}`).toContain(`n°${number}`);
    }
  });
});
