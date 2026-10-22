import { describe, expect, it } from "vitest";
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";
import { authPageTitle } from "./authPageTitle";

describe("titre de la page d'accès", () => {
  it("suit l'espace choisi sur Ma Reliure", () => {
    expect(authPageTitle("MA_RELIURE", "customer")).toBe("Retrouver mes livres — Ma Reliure");
    expect(authPageTitle("MA_RELIURE", "binder")).toBe("Mon espace atelier — Ma Reliure");
  });
  it("suit l'espace et la langue sur Fine Bindery, dans les cinq langues", () => {
    expect(authPageTitle("FINE_BINDERY", "binder", "de")).toBe("Werkstattbereich — Fine Bindery");
    for (const locale of FINE_BINDERY_LOCALES) {
      const customer = authPageTitle("FINE_BINDERY", "customer", locale);
      const binder = authPageTitle("FINE_BINDERY", "binder", locale);
      expect(customer).not.toBe(binder);
      expect(binder).toMatch(/— Fine Bindery$/);
    }
  });
});
