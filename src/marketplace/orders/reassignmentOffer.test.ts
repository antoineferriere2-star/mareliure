import { expect, it } from "vitest";
import { reassignmentOfferTiming, type ExistingWorkshopOffer } from "./reassignmentOffer";
import { workshopOfferNotice } from "@/marketplace/notifications/offerNotices.server";

const terms = { payoutCents: 7500, serviceDescription: "Réparation des deux mors, charnières en soie consolidées." };
const FIRST = "2026-11-08T10:00:00.000Z";
const SECOND = "2026-11-08T10:05:00.000Z";
const pending = (over: Partial<ExistingWorkshopOffer> = {}): ExistingWorkshopOffer => ({
  state: "offered", agreement_version: null, binder_payout_cents: 7500, service_description: terms.serviceDescription, offered_at: FIRST, ...over,
});
const noticeId = (offeredAt: string) =>
  workshopOfferNotice({ caseId: "case", binderId: "b1", offeredAt, reference: "RL-013", brand: "MA_RELIURE", reassignment: true }).id;

it("première proposition : nouvel horodatage, offre écrite", () => {
  expect(reassignmentOfferTiming(null, terms, FIRST)).toEqual({ offeredAt: FIRST, rewrite: true });
});

it("deux envois successifs aux mêmes conditions : même horodatage, même clé, un seul e-mail", () => {
  const first = reassignmentOfferTiming(null, terms, FIRST);
  const second = reassignmentOfferTiming(pending({ offered_at: first.offeredAt }), terms, SECOND);
  expect(second).toEqual({ offeredAt: FIRST, rewrite: false });
  expect(noticeId(second.offeredAt)).toBe(noticeId(first.offeredAt));
});

it("l'horodatage relu en base (+00:00) redonne la clé du premier envoi (Z)", () => {
  const second = reassignmentOfferTiming(pending({ offered_at: "2026-11-08T10:00:00+00:00" }), terms, SECOND);
  expect(noticeId(second.offeredAt)).toBe(noticeId(FIRST));
});

it("des espaces en plus dans la prestation ne font pas une nouvelle offre", () => {
  expect(reassignmentOfferTiming(pending(), { ...terms, serviceDescription: `  ${terms.serviceDescription} ` }, SECOND).rewrite).toBe(false);
});

it("une rémunération modifiée est une nouvelle offre, avec un nouvel e-mail", () => {
  const next = reassignmentOfferTiming(pending(), { ...terms, payoutCents: 9000 }, SECOND);
  expect(next).toEqual({ offeredAt: SECOND, rewrite: true });
  expect(noticeId(next.offeredAt)).not.toBe(noticeId(FIRST));
});

it("une prestation modifiée est une nouvelle offre", () => {
  expect(reassignmentOfferTiming(pending(), { ...terms, serviceDescription: "Réparation des deux mors seulement." }, SECOND).rewrite).toBe(true);
});

it("une offre refusée puis reproposée repart de zéro", () => {
  expect(reassignmentOfferTiming(pending({ state: "declined" }), terms, SECOND)).toEqual({ offeredAt: SECOND, rewrite: true });
});
