import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { payoutsChangedSincePreview, type ResolvedPayout } from "./payoutConfirmation";
import { resolvePayout, type CommercialTerm } from "@/marketplace/pricing/commercialTerms";
import { canConfirmPreview, confirmedPayoutsOf, previewState } from "@/marketplace/pages/admin/WorkshopSendPreview";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const map = (entries: Array<[string, ResolvedPayout]>) => new Map(entries);

describe("rémunération confirmée dans l'aperçu", () => {
  it("montants inchangés : l'envoi passe", () => {
    const resolved = map([[A, { payoutCents: 10000, manualRequired: false }], [B, { payoutCents: 9000, manualRequired: false }]]);
    expect(payoutsChangedSincePreview([A, B], { [A]: 10000, [B]: 9000 }, resolved)).toEqual([]);
  });

  it("condition passée de 100 % à 120 % entre l'aperçu et la confirmation : envoi refusé", () => {
    // Scénario de la revue Codex : référence 100 €, l'aperçu affiche 100 €, la condition devient 120 %.
    const term = (bps: number): CommercialTerm => ({ familyKey: "structure" as never, payoutMultiplierBps: bps, manualPayoutRequired: false });
    const shown = map([[A, resolvePayout(10000, term(10000))]]);
    const confirmed = confirmedPayoutsOf([{ binderId: A, payoutCents: shown.get(A)!.payoutCents }]);
    const atSend = map([[A, resolvePayout(10000, term(12000))]]);
    expect(confirmed).toEqual({ [A]: 10000 });
    expect(atSend.get(A)!.payoutCents).toBe(12000);
    expect(payoutsChangedSincePreview([A], confirmed, atSend)).toEqual([A]);
  });

  it("devenue « rémunération manuelle », absente de la confirmation ou inconnue : refusé", () => {
    expect(payoutsChangedSincePreview([A], { [A]: 10000 }, map([[A, { payoutCents: 10000, manualRequired: true }]]))).toEqual([A]);
    expect(payoutsChangedSincePreview([A, B], { [A]: 10000 }, map([[A, { payoutCents: 10000, manualRequired: false }], [B, { payoutCents: 9000, manualRequired: false }]]))).toEqual([B]);
    expect(payoutsChangedSincePreview([A], { [A]: 10000 }, map([]))).toEqual([A]);
  });

  it("le montant confirmé est celui que l'aperçu affiche ; un atelier sans montant n'est pas confirmé", () => {
    expect(confirmedPayoutsOf([{ binderId: A, payoutCents: 7500 }, { binderId: B, payoutCents: null }])).toEqual({ [A]: 7500 });
  });

});

describe("compteur des photos", () => {
  it("ne compte que les photos affichées", () => {
    const view = {
      reference: "RL-013", title: "Paroissien", summary: "", project: [], constraints: [], budgetAndTiming: [],
      missingInformation: [], area: null, contact: null, heritage: false, manualReviewRequired: false,
      photos: [{ url: "https://x/a.jpg", caption: null }, { url: null, caption: null }],
    };
    const html = renderToStaticMarkup(createElement(CaseBriefPanel, { view: view as never }));
    expect(html).toContain("Photos (1)");
  });
});

describe("confirmation de l'aperçu", () => {
  it("relecture échouée avec l'ancien aperçu en cache : rien n'est confirmable (contre-revue Codex)", () => {
    const state = previewState({ hasData: true, isFetching: false, hasError: true });
    expect(state).toBe("error");
    expect(canConfirmPreview({ state, blocked: false, sending: false })).toBe(false);
  });

  it("pendant la relecture, pas de confirmation ; aperçu à jour, oui", () => {
    expect(canConfirmPreview({ state: previewState({ hasData: true, isFetching: true, hasError: false }), blocked: false, sending: false })).toBe(false);
    expect(canConfirmPreview({ state: previewState({ hasData: true, isFetching: false, hasError: false }), blocked: false, sending: false })).toBe(true);
  });

  it("chargement, atelier bloqué ou envoi en cours : pas de confirmation", () => {
    expect(canConfirmPreview({ state: previewState({ hasData: false, isFetching: true, hasError: false }), blocked: false, sending: false })).toBe(false);
    expect(canConfirmPreview({ state: "current", blocked: true, sending: false })).toBe(false);
    expect(canConfirmPreview({ state: "current", blocked: false, sending: true })).toBe(false);
  });
});
