import { describe, expect, it } from "vitest";
import { resolveApprovedBinderBySlug, resolvePublishedFineBinderyBinderBySlug } from "@/marketplace/services/caseRepository.server";
import { assertNotTestWorkshop, isTestCase, isTestWorkshop, TEST_WORKSHOP_PROVIDER_REFUSED } from "./testWorkshop.server";

/** Une table d'ateliers en mémoire, qui applique réellement les filtres `eq` demandés. */
function binders(rows: Record<string, unknown>[]) {
  return {
    from: () => {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (column: string, value: unknown) => (filters.push([column, value]), q),
        maybeSingle: async () => ({ data: rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }),
      };
      return q;
    },
  } as never;
}

const base = { status: "approved", public_profile_status: "published", display_name: "QA", workshop_name: "Atelier QA" };

describe("atelier de test (is_demo)", () => {
  it("son lien personnel n'attribue aucun projet, ni sur Ma Reliure ni sur Fine Bindery", async () => {
    const sb = binders([{ ...base, id: "test", personal_referral_slug: "atelier-test", is_demo: true },
      { ...base, id: "real", personal_referral_slug: "atelier-reel", is_demo: false }]);
    expect(await resolveApprovedBinderBySlug(sb, "atelier-test")).toBeNull();
    expect(await resolvePublishedFineBinderyBinderBySlug(sb, "atelier-test")).toBeNull();
    expect(await resolveApprovedBinderBySlug(sb, "atelier-reel")).toEqual({ binderId: "real", displayName: "Atelier QA" });
  });

  it("se reconnaît à son seul marqueur", async () => {
    const sb = binders([{ id: "test", is_demo: true }, { id: "real", is_demo: false }]);
    expect([await isTestWorkshop(sb, "test"), await isTestWorkshop(sb, "real"), await isTestWorkshop(sb, "absent")]).toEqual([true, false, false]);
  });
});

/** Plusieurs tables en mémoire ; `eq`, `is` et `in` sont réellement appliqués. */
function tables(data: Record<string, Record<string, unknown>[]>) {
  return {
    from: (table: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const run = () => (data[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
        is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
      };
      return q;
    },
  } as never;
}

describe("opérations fournisseurs : refusées pour un atelier de test", () => {
  it("refuse avec un message lisible, laisse passer un atelier réel", async () => {
    const sb = binders([{ id: "test", is_demo: true }, { id: "real", is_demo: false }]);
    await expect(assertNotTestWorkshop(sb, "test")).rejects.toThrow(TEST_WORKSHOP_PROVIDER_REFUSED);
    await expect(assertNotTestWorkshop(sb, "real")).resolves.toBeUndefined();
  });

  it("rattache un dossier à l'atelier de test par apport, affectation ACTIVE ou sélection — jamais par une affectation terminée", async () => {
    const base = { marketplace_binders: [{ id: "test", is_demo: true }, { id: "real", is_demo: false }] };
    const sb = (extra: Record<string, Record<string, unknown>[]>) => tables({ ...base, ...extra });
    expect(await isTestCase(sb({ marketplace_cases: [{ id: "c", referred_binder_id: "test" }] }), "c")).toBe(true);
    expect(await isTestCase(sb({ marketplace_cases: [{ id: "c", referred_binder_id: null }],
      marketplace_oppe_order_assignments: [{ case_id: "c", binder_id: "test", ended_at: null }] }), "c")).toBe(true);
    expect(await isTestCase(sb({ marketplace_cases: [{ id: "c", referred_binder_id: null }],
      marketplace_oppe_order_assignments: [{ case_id: "c", binder_id: "test", ended_at: "2026-10-10" }, { case_id: "c", binder_id: "real", ended_at: null }] }), "c")).toBe(false);
    expect(await isTestCase(sb({ marketplace_cases: [{ id: "c", referred_binder_id: null }],
      marketplace_case_matches: [{ case_id: "c", binder_id: "test", state: "selected" }] }), "c")).toBe(true);
    expect(await isTestCase(sb({ marketplace_cases: [{ id: "c", referred_binder_id: "real" }] }), "c")).toBe(false);
  });
});
