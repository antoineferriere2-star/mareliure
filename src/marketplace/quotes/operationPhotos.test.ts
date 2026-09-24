import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { examplesFor, photoTargetOfLine, QUOTE_OPERATION_PHOTOS_BUCKET, type OperationPhotoView } from "./quotePhotos";
import { freeLine, lineFromBasePrice, lineFromService } from "./quoteLines";

const photo = (patch: Partial<OperationPhotoView>): OperationPhotoView => ({
  id: "p", serviceId: null, pricingKey: null, caption: null, position: 1, url: "https://storage.example/p.jpg", ...patch,
});

describe("l'opération d'une ligne de devis", () => {
  it("une prestation de l'atelier, un tarif de base, ou rien pour une ligne libre", () => {
    const service = { id: "svc-1", categoryId: null, name: "Demi-cuir", description: null, unitPriceCents: 18000, vatRateBps: null, unit: null };
    expect(photoTargetOfLine(lineFromService(service, 2000, "a"))).toEqual({ serviceId: "svc-1" });
    expect(photoTargetOfLine(lineFromBasePrice({ pricingKey: "plein_cuir", label: "Plein cuir", unit: "ouvrage", unitPriceCents: 35000, pricingMode: "fixed" }, 2000, "b"))).toEqual({ pricingKey: "plein_cuir" });
    expect(photoTargetOfLine(freeLine(2000, "c", "Réparation d'un coin"))).toBeNull();
  });
});

describe("les exemples proposés pour une ligne", () => {
  const library = [
    photo({ id: "b2", pricingKey: "plein_cuir", position: 2 }),
    photo({ id: "s1", serviceId: "svc-1", position: 1 }),
    photo({ id: "b1", pricingKey: "plein_cuir", position: 1 }),
    photo({ id: "b3", pricingKey: "plein_cuir", position: 3 }),
    photo({ id: "other", pricingKey: "nerfs", position: 1 }),
  ];

  it("sont ceux de la même opération, dans l'ordre de l'atelier", () => {
    expect(examplesFor({ pricingKey: "plein_cuir" }, library).map((p) => p.id)).toEqual(["b1", "b2", "b3"]);
    expect(examplesFor({ serviceId: "svc-1" }, library).map((p) => p.id)).toEqual(["s1"]);
  });

  it("s'arrêtent aux places libres de la ligne, et ne sont rien sans opération", () => {
    expect(examplesFor({ pricingKey: "plein_cuir" }, library, 2).map((p) => p.id)).toEqual(["b1", "b2"]);
    expect(examplesFor({ pricingKey: "plein_cuir" }, library, 0)).toEqual([]);
    expect(examplesFor(null, library)).toEqual([]);
  });

  it("ne confondent jamais une prestation et un tarif de base portant le même identifiant", () => {
    expect(examplesFor({ serviceId: "plein_cuir" }, library)).toEqual([]);
  });
});

describe("migration de la bibliothèque de photos", () => {
  const SQL = readFileSync(resolve(process.cwd(), "supabase/migrations/20260924160000_marketplace_binder_operation_photos.sql"), "utf8");

  it("rattache chaque photo à exactement une opération, dans le dossier de son atelier", () => {
    expect(SQL).toContain("CHECK (num_nonnulls(service_id, pricing_key) = 1)");
    expect(SQL).toContain("REFERENCES public.marketplace_binder_services(id) ON DELETE CASCADE");
    expect(SQL).toContain("REFERENCES public.marketplace_work_items(key)");
    expect(SQL).toContain("CHECK (storage_path LIKE binder_id::TEXT || '/library/%')");
  });

  it("reste privée : aucun accès direct, seules les fonctions serveur y touchent", () => {
    expect(SQL).toContain("ENABLE ROW LEVEL SECURITY");
    expect(SQL).toContain("FOR ALL TO anon, authenticated");
    expect(SQL).toContain("USING (FALSE) WITH CHECK (FALSE)");
    expect(SQL).toContain("GRANT ALL ON public.marketplace_binder_operation_photos TO service_role");
    expect(SQL).toContain(QUOTE_OPERATION_PHOTOS_BUCKET);
  });

  it("ne touche à aucune donnée existante", () => {
    expect(SQL).not.toMatch(/\b(UPDATE|DELETE FROM|DROP TABLE|TRUNCATE|ALTER TABLE public\.marketplace_binder_(quote|invoice))/i);
  });
});
