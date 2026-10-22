import { describe, expect, it } from "vitest";
import { resolveApprovedBinderBySlug, resolvePublishedFineBinderyBinderBySlug } from "@/marketplace/services/caseRepository.server";
import { isTestWorkshop } from "./testWorkshop.server";

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
