import { describe, expect, it } from "vitest";
import { defaultNatureForName, invoiceNatureOf } from "./operationNature";
import { freeLine, lineFromService } from "./quoteLines";

describe("nature biens / services", () => {
  it("propose « bien » pour étui, boîte, coffret, chemise ; « service » pour le reste", () => {
    expect(["Étui", "Étui à rabats", "Boîte de conservation", "Mise en boite", "Coffret", "Chemise-étui", "Chemises"].map(defaultNatureForName))
      .toEqual(Array(7).fill("bien"));
    expect(["Reliure demi-cuir", "Dorure du titre", "Chemiserie", "Restauration"].map(defaultNatureForName)).toEqual(Array(4).fill("service"));
  });
  it("calcule la nature de la facture : mixte si les deux", () => {
    expect(invoiceNatureOf([])).toBe("services");
    expect(invoiceNatureOf(["service", null])).toBe("services");
    expect(invoiceNatureOf(["bien", "bien"])).toBe("goods");
    expect(invoiceNatureOf(["bien", "service"])).toBe("mixed");
  });
  it("une ligne reprend la nature de sa prestation ; une ligne libre est un service par défaut", () => {
    const service = { id: "s", categoryId: null, name: "Reliure", description: null, unitPriceCents: 100, vatRateBps: null, unit: null };
    expect(lineFromService({ ...service, nature: "bien" }, 2000, "k").nature).toBe("bien");
    expect(lineFromService({ ...service, name: "Étui" }, 2000, "k").nature).toBe("bien");
    expect(freeLine(2000, "k").nature).toBe("service");
  });
});
