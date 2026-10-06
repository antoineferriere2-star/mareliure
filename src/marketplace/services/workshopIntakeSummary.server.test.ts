import { beforeEach, expect, it, vi } from "vitest";
import { workshopSubmissionProjection } from "./workshopIntakeSummary.server";
import { resolveApprovedBinderBySlug, resolvePublishedFineBinderyBinderBySlug } from "./caseRepository.server";
import { BOOKBINDING_MISSION_ID, FINE_BINDERY_MISSION_ID } from "@/build/constants";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import { publicCopy } from "@/build/pages/public/publicLocaleContext";
vi.mock("./caseRepository.server", () => ({ resolveApprovedBinderBySlug: vi.fn(),resolvePublishedFineBinderyBinderBySlug: vi.fn() }));
const summary: VisitorProjectSummary = {version:1,locale:"fr-FR",measurementSystem:"metric",businessName:"Ma Reliure",summary:"Livre fictif",confirmedItems:[{label:"Titre",value:"Livre fictif"}],calculatedItems:[],itemsToConfirm:[{label:"Prix Ma Reliure",value:"Ancien texte"}],budgetAndTimingItems:[],photos:[{path:"private/fixture.png"}],confirmationText:"Ma Reliure fixe le prix et choisit l’atelier",submittedAt:"2026-10-06T11:00:00Z"};
beforeEach(() => { vi.resetAllMocks(); vi.mocked(resolveApprovedBinderBySlug).mockResolvedValue({binderId:"binder",displayName:"Atelier de recette"}); });
it("conserve strictement les projets génériques et les autres missions",async () => {
  expect((await workshopSubmissionProjection({} as never,BOOKBINDING_MISSION_ID,{},summary)).summary).toBe(summary);
  expect((await workshopSubmissionProjection({} as never,"other-mission",{_referral_slug:"atelier"},summary)).summary).toBe(summary);
  expect(resolveApprovedBinderBySlug).not.toHaveBeenCalled();
});
it.each(["fr-FR","en-US","de-DE","it-IT","es-ES"] as const)("%s corrige la page et l’e-mail sans perdre les réponses, photos ou langue",async locale => {
  const original={...summary,locale,itemsToConfirm:[{label:publicCopy(locale,"Prix Ma Reliure"),value:"Old role"}]};
  const result=await workshopSubmissionProjection({} as never,BOOKBINDING_MISSION_ID,{_referral_slug:"atelier"},original);
  expect(result.summary.businessName).toBe("Atelier de recette");
  expect(result.summary.confirmationText).not.toMatch(/Ma Reliure fixe|choisit l’atelier/);
  expect(result.summary.itemsToConfirm[0].label).not.toBe(original.itemsToConfirm[0].label);
  expect(result.summary.photos).toBe(original.photos); expect(result.summary.confirmedItems).toBe(original.confirmedItems);expect(result.summary.locale).toBe(locale);
  expect(original.businessName).toBe("Ma Reliure");
});
it("ne promet aucune transmission à un atelier introuvable ni aucune vente Oppe",async () => {
  vi.mocked(resolveApprovedBinderBySlug).mockResolvedValue(null);
  const result=await workshopSubmissionProjection({} as never,BOOKBINDING_MISSION_ID,{_referral_slug:"gone"},summary);
  expect(result.summary.confirmationText).toContain("doit être confirmé avant transmission");
  expect(result.summary.confirmationText).not.toContain("choisit");
});
it("ne résout la vitrine Fine Bindery que par son statut de publication",async () => {
  vi.mocked(resolvePublishedFineBinderyBinderBySlug).mockResolvedValue({binderId:"binder",displayName:"Atelier publié"});
  const result=await workshopSubmissionProjection({} as never,FINE_BINDERY_MISSION_ID,{_referral_slug:"atelier",_request_source:"finebindery_profile"},summary);
  expect(result.summary.businessName).toBe("Atelier publié"); expect(resolveApprovedBinderBySlug).not.toHaveBeenCalled();
});
