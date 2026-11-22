import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createdAfterPaymentPivot, PAYMENT_PIVOT_AT, WORKSHOP_ONLINE_PAYMENT_OPENING_RETIRED } from "./paymentPivot";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("fin des encaissements par la plateforme", () => {
  it("laisse finir un dossier créé avant la bascule", () => {
    expect(createdAfterPaymentPivot("2026-11-21T23:59:59.000Z")).toBe(false);
    expect(createdAfterPaymentPivot("2026-09-01T10:00:00+00:00")).toBe(false);
  });

  it("refuse un dossier créé à partir de la bascule", () => {
    expect(createdAfterPaymentPivot(PAYMENT_PIVOT_AT)).toBe(true);
    expect(createdAfterPaymentPivot("2026-12-01T08:00:00Z")).toBe(true);
  });

  it("refuse quand la date est illisible ou absente (fail closed)", () => {
    expect(createdAfterPaymentPivot(null)).toBe(true);
    expect(createdAfterPaymentPivot(undefined)).toBe(true);
    expect(createdAfterPaymentPivot("pas une date")).toBe(true);
  });

  it("ferme l'ouverture de nouveaux paiements d'atelier", () => {
    expect(WORKSHOP_ONLINE_PAYMENT_OPENING_RETIRED).toBe(true);
  });

  it("branche la barrière sur le Checkout et sur les fonctions serveur d'atelier", () => {
    expect(read("src/marketplace/stripe/checkoutSession.server.ts")).toContain("createdAfterPaymentPivot(caseContext.row.created_at)");
    const functions = read("src/marketplace/services/workshopOnlinePayment.data.functions.ts");
    expect(functions.match(/WORKSHOP_ONLINE_PAYMENT_OPENING_RETIRED\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(functions).toContain("!existing.data && WORKSHOP_ONLINE_PAYMENT_OPENING_RETIRED");
  });
});
