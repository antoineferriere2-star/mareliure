/**
 * Phase 0 / P1-7 — the verified-e-mail rapprochement is an EXACT match on a
 * normalised address, never a pattern.
 *
 * The first version asked PostgREST `ilike("visitor_email", address)`. ILIKE is
 * a pattern operator: `_` matches any single character and `%` any run of them.
 * An account verified as `marie_dupont@example.com` therefore also inherited the
 * book typed as `marieXdupont@example.com` — somebody else's Dossier.
 *
 * The fake below models the two operators faithfully (LIKE semantics for
 * `ilike`; `lower(btrim(a)) = lower(btrim(b))` for the SQL function that
 * replaces it — the real function is exercised on Postgres in the migration
 * check), so this test fails on the old code and passes on the new one.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Supa } from "@/build/services/adminAuth.server";
import { normalizeEmail } from "../cases/ownership";
import { claimCasesByVerifiedEmail } from "./caseRepository.server";

interface Dossier {
  id: string;
  visitor_email: string | null;
}

const likeToRegExp = (pattern: string) =>
  new RegExp(
    `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
    "i",
  );
const sqlNormalise = (v: string | null) => (v ?? "").replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "").toLowerCase();

function fakeSupabase(dossiers: Dossier[]) {
  const claimedDossierIds: string[] = [];
  const sb = {
    from(table: string) {
      if (table === "build_dossiers") {
        return {
          select: () => ({
            ilike: async (_col: string, pattern: string) => ({
              data: dossiers.filter((d) => d.visitor_email && likeToRegExp(pattern).test(d.visitor_email)).map((d) => ({ id: d.id })),
            }),
          }),
        };
      }
      // marketplace_cases update chain
      let ids: string[] = [];
      const chain = {
        update: () => chain,
        in: (_c: string, v: string[]) => {
          ids = v;
          return chain;
        },
        is: () => chain,
        select: async () => {
          claimedDossierIds.push(...ids);
          return { data: ids.map((id) => ({ id: `case-of-${id}` })) };
        },
      };
      return chain;
    },
    async rpc(name: string, args: { p_email: string }) {
      if (name !== "marketplace_dossier_ids_for_verified_email") return { data: null, error: { message: "unknown fn" } };
      const wanted = sqlNormalise(args.p_email);
      return {
        data: wanted ? dossiers.filter((d) => sqlNormalise(d.visitor_email) === wanted).map((d) => d.id) : [],
        error: null,
      };
    },
  };
  return { sb: sb as unknown as Supa, claimedDossierIds };
}

const stored = (email: string | null, id: string): Dossier => ({ id, visitor_email: email });

describe("claimCasesByVerifiedEmail — exact match on a normalised e-mail", () => {
  it("does not let an underscore act as a wildcard", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([
      stored("marieXdupont@example.com", "other"),
      stored("marie_dupont@example.com", "mine"),
    ]);
    const n = await claimCasesByVerifiedEmail(sb, "user-1", "marie_dupont@example.com");
    expect(claimedDossierIds).toEqual(["mine"]);
    expect(n).toBe(1);
  });

  it("does not let a percent sign act as a wildcard", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([
      stored("marie@example.com", "victim-1"),
      stored("anything@else.org", "victim-2"),
    ]);
    // A syntactically odd but real address; the account is verified as this.
    expect(await claimCasesByVerifiedEmail(sb, "user-1", "%@example.com")).toBe(0);
    expect(await claimCasesByVerifiedEmail(sb, "user-1", "%")).toBe(0);
    expect(claimedDossierIds).toEqual([]);
  });

  it("matches regardless of case", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([stored("Marie.Dupont@Example.COM", "mine")]);
    await claimCasesByVerifiedEmail(sb, "user-1", "marie.dupont@example.com");
    expect(claimedDossierIds).toEqual(["mine"]);
  });

  it("ignores surrounding spaces on either side", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([stored("  marie@example.com ", "mine")]);
    await claimCasesByVerifiedEmail(sb, "user-1", "  Marie@Example.com  ");
    expect(claimedDossierIds).toEqual(["mine"]);
  });

  it("claims every Dossier that carries the same normalised address", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([
      stored("marie@example.com", "a"),
      stored("MARIE@example.com", "b"),
      stored(" marie@example.com", "c"),
      stored("other@example.com", "d"),
    ]);
    expect(await claimCasesByVerifiedEmail(sb, "user-1", "marie@example.com")).toBe(3);
    expect(claimedDossierIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("does not match a look-alike address", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([
      stored("marie@examp1e.com", "l1"),
      stored("marie@example.com.evil.io", "l2"),
      stored("xmarie@example.com", "l3"),
      stored("marie@example.co", "l4"),
      stored("marie+tag@example.com", "l5"),
    ]);
    expect(await claimCasesByVerifiedEmail(sb, "user-1", "marie@example.com")).toBe(0);
    expect(claimedDossierIds).toEqual([]);
  });

  it("does nothing for an empty address", async () => {
    const { sb, claimedDossierIds } = fakeSupabase([stored(null, "n"), stored("", "e")]);
    expect(await claimCasesByVerifiedEmail(sb, "user-1", "   ")).toBe(0);
    expect(claimedDossierIds).toEqual([]);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases, nothing else", () => {
    expect(normalizeEmail("  Marie_Dupont@Example.COM ")).toBe("marie_dupont@example.com");
    expect(normalizeEmail("marie+tag@example.com")).toBe("marie+tag@example.com");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("source contract", () => {
  it("never uses a pattern operator on visitor_email", () => {
    const src = readFileSync(new URL("./caseRepository.server.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\.i?like\(/);
    expect(src).not.toMatch(/\.ilike\(\s*["']visitor_email/);
  });

  it("the SQL function compares by equality, is server-only, and uses no pattern operator", () => {
    const sql = readFileSync(
      new URL("../../../supabase/migrations/20260920090000_marketplace_verified_email_exact_match.sql", import.meta.url),
      "utf8",
    ).replace(/--.*$/gm, "");
    expect(sql).toMatch(/lower\(btrim\(d\.visitor_email[^)]*\)\)\s*=\s*lower\(btrim\(p_email/);
    expect(sql).not.toMatch(/\bi?like\b/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION[^;]*TO service_role/);
  });
});
