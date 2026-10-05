import { describe, expect, it } from "vitest";
import { commercialOriginOf, circuitRefusal, isOppeOrderProvenance } from "./commercialOrigin";
import { caseGroup, nextCaseAction } from "./workspace";

const row = (state: string, unreadCount = 0, acquisitionOrigin = "BINDER_REFERRED") => ({
  state,
  unreadCount,
  caseStatus: "binder_selected",
  acquisitionOrigin,
});

describe("atelier actions from existing case state", () => {
  it("separates offers, selected work, and closed cases without inventing statuses", () => {
    expect(caseGroup(row("offered"))).toBe("new");
    expect(caseGroup(row("selected"))).toBe("quote");
    expect(caseGroup(row("selected"), false, true)).toBe("sent");
    expect(caseGroup(row("cancelled"))).toBe("closed");
  });

  it("puts an unread reply before creating a quote", () => {
    expect(nextCaseAction(row("selected", 2), true)).toBe("Répondre au message");
    expect(nextCaseAction(row("selected"), false)).toBe("Créer la fiche ouvrage");
    expect(nextCaseAction(row("selected"), true, true)).toBe("Continuer le devis");
  });

  it("never proposes a workshop quote on an Oppe order", () => {
    const oppe = row("selected", 0, "MA_RELIURE_ACQUIRED");
    expect(caseGroup(oppe)).toBe("current");
    expect(nextCaseAction(oppe, true)).toBe("Suivre le dossier");
    expect(nextCaseAction(oppe, true, true)).toBe("Suivre le dossier");
    expect(nextCaseAction({ ...oppe, acquisitionOrigin: null }, true)).toBe("Suivre le dossier");
  });
});

describe("commercial origin", () => {
  it("follows the database rule", () => {
    expect(commercialOriginOf("MA_RELIURE_ACQUIRED")).toBe("oppe");
    expect(commercialOriginOf("BINDER_REFERRED")).toBe("workshop_client");
    expect(commercialOriginOf("FINEBINDERY_PROFILE")).toBe("workshop_client");
    expect(commercialOriginOf(undefined)).toBe("oppe");
    expect(isOppeOrderProvenance("ma_reliure")).toBe(true);
    expect(isOppeOrderProvenance("workshop_platform")).toBe(false);
  });

  it("translates database refusals", () => {
    expect(circuitRefusal('new row violates: workshop_document_forbidden_on_oppe_order')).toMatch(/facture est adressée à Oppe/);
    expect(circuitRefusal("other")).toBeNull();
  });
});
