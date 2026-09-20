/**
 * Phase 0 / P1-6 — les audiences d'un message : qui lit quoi, qui écrit où. Pur.
 */
import { describe, expect, it } from "vitest";
import { audienceForNewMessage, customerCanReadAudience, isMessageAudience, MESSAGE_AUDIENCES, readableAudiences } from "./audience";

describe("readableAudiences", () => {
  it.each([
    ["customer", true, ["shared", "customer_concierge"]],
    ["customer", false, ["customer_concierge"]],
    ["binder", true, ["shared", "workshop_platform"]],
    ["binder", false, ["workshop_platform"]],
    ["admin", true, [...MESSAGE_AUDIENCES]],
    ["admin", false, [...MESSAGE_AUDIENCES]],
  ] as const)("%s (messagerie directe : %s) lit %j", (role, direct, expected) => {
    expect([...readableAudiences(role, direct)]).toEqual(expected);
  });

  it("le client ne lit JAMAIS le canal atelier ↔ plateforme, quelle que soit la marque", () => {
    for (const direct of [true, false]) expect(readableAudiences("customer", direct)).not.toContain("workshop_platform");
  });

  it("l'atelier ne lit JAMAIS le canal client ↔ concierge, quelle que soit la marque", () => {
    for (const direct of [true, false]) expect(readableAudiences("binder", direct)).not.toContain("customer_concierge");
  });

  it("en modèle concierge, ni le client ni l'atelier ne lisent le fil partagé", () => {
    expect(readableAudiences("customer", false)).not.toContain("shared");
    expect(readableAudiences("binder", false)).not.toContain("shared");
  });
});

describe("audienceForNewMessage — décidée par le serveur, jamais par l'auteur", () => {
  it("un client écrit dans son seul canal, même s'il en demande un autre", () => {
    expect(audienceForNewMessage({ senderRole: "customer", directWorkshopMessaging: true })).toEqual({ ok: true, audience: "shared" });
    expect(audienceForNewMessage({ senderRole: "customer", directWorkshopMessaging: false })).toEqual({ ok: true, audience: "customer_concierge" });
    expect(audienceForNewMessage({ senderRole: "customer", directWorkshopMessaging: false, requested: "workshop_platform" })).toEqual({
      ok: true,
      audience: "customer_concierge",
    });
  });

  it("un atelier écrit dans son seul canal, même s'il en demande un autre", () => {
    expect(audienceForNewMessage({ senderRole: "binder", directWorkshopMessaging: true })).toEqual({ ok: true, audience: "shared" });
    expect(audienceForNewMessage({ senderRole: "binder", directWorkshopMessaging: false })).toEqual({ ok: true, audience: "workshop_platform" });
    expect(audienceForNewMessage({ senderRole: "binder", directWorkshopMessaging: false, requested: "customer_concierge" })).toEqual({
      ok: true,
      audience: "workshop_platform",
    });
  });

  it("la plateforme choisit son canal ; par défaut celui du client", () => {
    expect(audienceForNewMessage({ senderRole: "admin", directWorkshopMessaging: false })).toEqual({ ok: true, audience: "customer_concierge" });
    expect(audienceForNewMessage({ senderRole: "admin", directWorkshopMessaging: true })).toEqual({ ok: true, audience: "shared" });
    expect(audienceForNewMessage({ senderRole: "admin", directWorkshopMessaging: false, requested: "workshop_platform" })).toEqual({
      ok: true,
      audience: "workshop_platform",
    });
    expect(audienceForNewMessage({ senderRole: "admin", directWorkshopMessaging: true, requested: "customer_concierge" })).toEqual({
      ok: true,
      audience: "customer_concierge",
    });
  });

  it("le fil partagé n'existe pas en modèle concierge : personne ne le lirait", () => {
    expect(audienceForNewMessage({ senderRole: "admin", directWorkshopMessaging: false, requested: "shared" })).toEqual({
      ok: false,
      reason: "audience_not_allowed",
    });
  });
});

describe("customerCanReadAudience — qui est notifié", () => {
  it("un client n'est jamais notifié d'un message qu'il ne peut pas lire", () => {
    expect(customerCanReadAudience("workshop_platform", true)).toBe(false);
    expect(customerCanReadAudience("workshop_platform", false)).toBe(false);
    expect(customerCanReadAudience("shared", false)).toBe(false);
    expect(customerCanReadAudience("shared", true)).toBe(true);
    expect(customerCanReadAudience("customer_concierge", false)).toBe(true);
  });
});

describe("isMessageAudience", () => {
  it("n'accepte que les trois audiences", () => {
    for (const a of MESSAGE_AUDIENCES) expect(isMessageAudience(a)).toBe(true);
    expect(isMessageAudience("everyone")).toBe(false);
    expect(isMessageAudience(null)).toBe(false);
    expect(isMessageAudience(undefined)).toBe(false);
  });
});
