import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { defaultOperationPhoto, defaultPhotoFile, examplesFor, type OperationPhotoView } from "./quotePhotos";

describe("illustrations par défaut des prestations", () => {
  it("couvre les 45 prestations avec un fichier existant et son crédit", () => {
    expect(WORK_ITEMS).toHaveLength(45);
    for (const item of WORK_ITEMS) {
      const photos = examplesFor({ pricingKey: item.key }, []);
      expect(photos).toHaveLength(1);
      expect(photos[0].isDefault).toBe(true);
      expect(photos[0].caption).toContain("Ferrière");
      expect(existsSync(resolve("public", photos[0].url.slice(1)))).toBe(true);
    }
  });
  it("donne priorité aux photos personnelles et rétablit le défaut après retrait", () => {
    const personal: OperationPhotoView = { id: "personal", pricingKey: "plein_cuir", serviceId: null, caption: "Mon travail", position: 1, url: "/personal.jpg" };
    expect(examplesFor({ pricingKey: "plein_cuir" }, [personal])).toEqual([personal]);
    expect(examplesFor({ pricingKey: "plein_cuir" }, [])[0].isDefault).toBe(true);
    expect(examplesFor({ pricingKey: "plein_cuir" }, [], 0)).toEqual([]);
  });
  it("ne choisit pas arbitrairement une image pour les opérations libres ou inconnues", async () => {
    expect(examplesFor({ serviceId: "custom" }, [])).toEqual([]);
    expect(defaultOperationPhoto("unknown")).toBeNull();
    expect(defaultOperationPhoto("toString")).toBeNull();
    await expect(defaultPhotoFile("default:../../secret")).rejects.toThrow("invalid_default_photo");
  });
});
