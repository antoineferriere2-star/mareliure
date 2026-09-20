/**
 * Phase 0 / P1-5 — le garde-fou serveur relit le statut et la proposition acceptée, jamais le navigateur.
 * Et la source des trois chemins d'écriture de prix : chacun l'appelle AVANT d'écrire.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  status: "pricing" as string | null,
  accepted: null as null | { id: string },
  candidate: null as null | { caseId: string; acceptedAt: string | null; customerServicePriceCents: number },
  caseRow: null as null | { pricing_status: string | null; customer_price_cents: number | null },
}));

vi.mock("./commercialProposalRepository.server", () => ({
  loadAcceptedCommercialProposal: vi.fn(async () => h.accepted),
  loadCommercialProposalById: vi.fn(async () => h.candidate),
}));
vi.mock("./caseRepository.server", () => ({
  loadCaseContext: vi.fn(async () => (h.caseRow ? { row: h.caseRow } : null)),
}));

import { assertPricingOpen, assertProposalPriceCurrent } from "./pricingGuards.server";

const sb = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: h.status === null ? null : { status: h.status }, error: null }) }),
    }),
  }),
} as never;

const outcome = async () => {
  try {
    await assertPricingOpen(sb, "case-1");
    return "ok";
  } catch (e) {
    const err = e as { status?: number; message: string };
    return `${err.status}:${err.message}`;
  }
};

beforeEach(() => {
  h.status = "pricing";
  h.accepted = null;
});

describe("assertPricingOpen", () => {
  it.each(["under_review", "pricing", "matching"])("%s : le chiffrage reste ouvert", async (status) => {
    h.status = status;
    expect(await outcome()).toBe("ok");
  });

  it.each(["awaiting_binder_response", "binder_accepted", "binder_selected", "awaiting_payment", "paid", "in_progress", "delivered", "completed"])(
    "%s : refus 409, lisible",
    async (status) => {
      h.status = status;
      expect(await outcome()).toMatch(/^409:.+/);
    },
  );

  it("une proposition acceptée refuse même un dossier encore en « matching »", async () => {
    h.status = "matching";
    h.accepted = { id: "proposal-1" };
    expect(await outcome()).toMatch(/^409:.*acceptée.*nouvelle version/);
  });

  it("un dossier inconnu → 404", async () => {
    h.status = null;
    expect(await outcome()).toMatch(/^404:/);
  });
});

describe("assertProposalPriceCurrent — jamais d'acceptation d'une proposition périmée", () => {
  const run = async () => {
    try {
      await assertProposalPriceCurrent(sb, "proposal-1");
      return "ok";
    } catch (e) {
      const err = e as { status?: number; message: string };
      return `${err.status}:${err.message}`;
    }
  };
  beforeEach(() => {
    h.candidate = { caseId: "case-1", acceptedAt: null, customerServicePriceCents: 45_000 };
    h.caseRow = { pricing_status: "validated", customer_price_cents: 45_000 };
  });

  it("la proposition porte le prix validé courant → passe", async () => {
    expect(await run()).toBe("ok");
  });

  it("le prix a été re-validé depuis (50 000 → 45 000) → 409, nouvelle version demandée", async () => {
    h.candidate!.customerServicePriceCents = 50_000;
    expect(await run()).toMatch(/^409:.*nouvelle version/);
  });

  it("le prix du dossier n'est plus validé → 409", async () => {
    h.caseRow = { pricing_status: "suggested", customer_price_cents: 45_000 };
    expect(await run()).toMatch(/^409:/);
  });

  it("une proposition déjà acceptée ou inconnue n'est pas jugée ici", async () => {
    h.candidate!.acceptedAt = "2026-09-19T10:00:00.000Z";
    h.candidate!.customerServicePriceCents = 1;
    expect(await run()).toBe("ok");
    h.candidate = null;
    expect(await run()).toBe("ok");
  });
});

describe("chaque chemin d'écriture de prix appelle le garde AVANT d'écrire", () => {
  const src = readFileSync(new URL("./marketplace.data.functions.ts", import.meta.url), "utf8");
  const handler = (exportName: string) => {
    const start = src.indexOf(`export const ${exportName} =`);
    expect(start, exportName).toBeGreaterThan(-1);
    const next = src.indexOf("\nexport const ", start + 10);
    return src.slice(start, next === -1 ? undefined : next);
  };

  it.each([
    ["generateMarketplacePricing", ".update("],
    ["saveMarketplacePricing", ".update("],
    ["validateMarketplacePricing", ".rpc("],
  ])("%s", (name, firstWrite) => {
    const body = handler(name);
    const guard = body.indexOf("assertPricingOpen(");
    expect(guard, `${name}: guard present`).toBeGreaterThan(-1);
    expect(guard, `${name}: guard before the first write`).toBeLessThan(body.indexOf(firstWrite));
  });

  it("le backfill de validation ne réécrit plus service_price_cents (le SQL le recopie, une seule vérité)", () => {
    expect(handler("validateMarketplacePricing")).not.toMatch(/(?<![a-z_])service_price_cents:\s*data\.customerPriceCents/);
  });
});

describe("la proposition se construit sur le prix validé, jamais sur la sortie brute du moteur", () => {
  const src = readFileSync(new URL("./commercialProposal.data.functions.ts", import.meta.url), "utf8");
  const create = src.slice(src.indexOf("export const createCommercialProposal"), src.indexOf("export const listCaseCommercialProposals"));

  it("createCommercialProposal ne lit plus service_price_cents", () => {
    expect(create).not.toMatch(/row\.service_price_cents/);
    expect(create).toMatch(/authoritativeServicePrice\(/);
    expect(create).toMatch(/customerServicePriceCents: price\.priceCents/);
  });

  it("refuse une nouvelle version sur un dossier dont la proposition est acceptée", () => {
    expect(create).toMatch(/loadAcceptedCommercialProposal\(sb, data\.caseId\)/);
    expect(create.indexOf("loadAcceptedCommercialProposal(")).toBeLessThan(create.indexOf("insertCommercialProposal("));
  });

  it("l'acceptation par l'admin refuse une proposition périmée avant d'écrire", () => {
    const accept = src.slice(src.indexOf("export const acceptCommercialProposal"), src.indexOf("export const getAcceptedCommercialProposal"));
    expect(accept).toMatch(/assertProposalPriceCurrent\(sb, proposalId\)/);
    expect(accept.indexOf("assertProposalPriceCurrent(")).toBeLessThan(accept.indexOf("acceptCommercialProposalRow(sb"));
  });
});
