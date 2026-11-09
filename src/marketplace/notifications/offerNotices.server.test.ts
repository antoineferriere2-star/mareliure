import { beforeEach, expect, it, vi } from "vitest";
import type { Supa } from "@/build/services/adminAuth.server";
import { alertOfferAnswer, notifyWorkshopsOfOffer, offerAnswerAlert, workshopOfferNotice } from "./offerNotices.server";

const h = vi.hoisted(() => ({ workshop: vi.fn(), admin: vi.fn(), log: vi.fn() }));
vi.mock("./workshopNotices.server", () => ({ notifyWorkshop: h.workshop }));
vi.mock("./adminAlerts.server", () => ({ notifyAdmin: h.admin }));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: h.log }));

const CASE = "aebb2c92-9ba9-421e-b3a9-8eed3b2c2caf";
function sbWith(row: Record<string, unknown> | null) {
  const q = { eq: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: row, error: null })) };
  return { from: vi.fn(() => ({ select: vi.fn(() => q) })) } as unknown as Supa;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.workshop.mockResolvedValue(undefined);
  h.admin.mockResolvedValue(true);
});

it("l'e-mail d'offre renvoie vers le dossier de l'atelier, sans montant ni coordonnées", () => {
  const notice = workshopOfferNotice({ caseId: CASE, binderId: "b1", offeredAt: "2026-11-08T10:00:00.000Z", reference: "RL-013", brand: "MA_RELIURE" });
  expect(notice.ctaPath).toBe(`/atelier/leads/${CASE}`);
  expect(notice.heading).toBe("Nouvelle proposition de projet — RL-013");
  expect(notice.id).toBe(`offer-${CASE}-b1-2026-11-08T10:00:00.000Z`);
  expect(`${notice.heading} ${notice.intro}`).not.toMatch(/€|\d+,\d{2}/);
});

it("une offre Fine Bindery est signée Fine Bindery et ouvre finebindery.com", () => {
  const notice = workshopOfferNotice({ caseId: CASE, binderId: "b1", offeredAt: "t", reference: "FB-001", brand: "FINE_BINDERY" });
  expect(notice.brand).toBe("FINE_BINDERY");
  expect(notice.intro).toContain("Fine Bindery vous propose");
  expect(`${notice.ctaOrigin}${notice.ctaPath}`).toBe(`https://finebindery.com/atelier/leads/${CASE}`);
});

it("une offre Ma Reliure garde le domaine de l'espace atelier", () => {
  expect(workshopOfferNotice({ caseId: CASE, binderId: "b1", offeredAt: "t", reference: "RL-013", brand: "MA_RELIURE" }).ctaOrigin).toBeUndefined();
});

it("une réponse de l'atelier de test est marquée comme telle", () => {
  const alert = offerAnswerAlert({ caseId: CASE, binderId: "b1", reference: "RL-099", workshopName: "Atelier de test OPPE", accepted: true, leadTimeDays: 7, answeredAt: "t", testWorkshop: true });
  expect(alert.heading).toBe("[Atelier de test] Offre acceptée — RL-099");
});

it("prévient chaque atelier sollicité, avec la marque et la référence du dossier", async () => {
  const sent = await notifyWorkshopsOfOffer(sbWith({ reference: "RL-013", brand: "MA_RELIURE" }), { caseId: CASE, binderIds: ["b1", "b2"], offeredAt: "t" });
  expect(sent).toBe(2);
  expect(h.workshop).toHaveBeenCalledTimes(2);
  expect(h.workshop.mock.calls[1][1]).toMatchObject({ binderId: "b2", brand: "MA_RELIURE", heading: expect.stringContaining("RL-013") });
});

it("un e-mail en échec ne fait pas échouer l'offre ni priver les autres ateliers", async () => {
  h.workshop.mockRejectedValueOnce(new Error("workshop_owner_email_missing"));
  const sent = await notifyWorkshopsOfOffer(sbWith({ reference: "RL-013", brand: "MA_RELIURE" }), { caseId: CASE, binderIds: ["b1", "b2"], offeredAt: "t" });
  expect(sent).toBe(1);
  expect(h.log).toHaveBeenCalledWith("workshop-offer-notice.failed", expect.any(Error), { caseId: CASE, binderId: "b1" });
});

it("une réattribution le dit dans l'e-mail", () => {
  const notice = workshopOfferNotice({ caseId: CASE, binderId: "b1", offeredAt: "t", reference: "RL-013", brand: "MA_RELIURE", reassignment: true });
  expect(notice.intro).toContain("reprendre le projet RL-013");
});

it("l'équipe est alertée d'une acceptation avec le délai", () => {
  const alert = offerAnswerAlert({ caseId: CASE, binderId: "b1", reference: "RL-013", workshopName: "Reliure Ferrière", accepted: true, leadTimeDays: 21, answeredAt: "t" });
  expect(alert.heading).toBe("Offre acceptée — RL-013");
  expect(alert.intro).toContain("Reliure Ferrière accepte");
  expect(alert.intro).toContain("21 jours");
  expect(alert.caseId).toBe(CASE);
});

it("l'équipe est alertée d'un refus avec son motif", () => {
  const alert = offerAnswerAlert({ caseId: CASE, binderId: "b1", reference: "RL-013", workshopName: "Reliure Ferrière", accepted: false, reasonCode: "payout_insufficient", answeredAt: "t" });
  expect(alert.heading).toBe("Offre refusée — RL-013");
  expect(alert.intro).toContain("(rémunération insuffisante)");
});

it("une alerte de réponse en échec ne fait jamais échouer la réponse de l'atelier", async () => {
  h.admin.mockRejectedValueOnce(new Error("resend down"));
  await expect(alertOfferAnswer(sbWith({ reference: "RL-013" }), { caseId: CASE, binderId: "b1", workshopName: "Reliure Ferrière", accepted: true, leadTimeDays: 21 })).resolves.toBe(false);
  expect(h.log).toHaveBeenCalled();
});
