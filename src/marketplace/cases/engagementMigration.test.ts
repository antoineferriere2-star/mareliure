/**
 * Contrat de la migration 20260920120000 (garde d'engagement + validation de prix). Le comportement
 * réel — 66 scénarios de statuts, de prix figés et de la fonction de validation — est vérifié sur
 * Postgres lors du contrôle de migration ; ici on fige ce que le code TypeScript suppose.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMITTED_STATUSES } from "./engagement";

const sql = readFileSync(new URL("../../../supabase/migrations/20260920120000_marketplace_case_engagement_guard.sql", import.meta.url), "utf8")
  .split("-- Retour arrière")[0]
  .replace(/--.*$/gm, "");

describe("migration du garde d'engagement", () => {
  it("les statuts « engagés » du SQL sont exactement ceux du TypeScript", () => {
    const list = /v_committed := OLD\.status IN \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    const sqlStatuses = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(sqlStatuses).toEqual([...COMMITTED_STATUSES].sort());
  });

  it("un trigger BEFORE UPDATE protège marketplace_cases pour tous les écrivains", () => {
    expect(sql).toMatch(/CREATE TRIGGER marketplace_cases_guard_engagement\s+BEFORE UPDATE ON public\.marketplace_cases\s+FOR EACH ROW/);
  });

  it("les conditions commerciales sont figées, et pas la fiscalité ni les notes", () => {
    for (const column of ["customer_price_cents", "binder_payout_cents", "service_price_cents", "base_service_price_cents", "brand_multiplier_bps", "deposit_cents", "pricing_status", "pricing_mode", "pricing_currency"]) {
      expect(sql, column).toContain(`NEW.${column} IS DISTINCT FROM OLD.${column}`);
    }
    expect(sql).not.toContain("NEW.tax_status IS DISTINCT");
    expect(sql).not.toContain("NEW.admin_notes IS DISTINCT");
  });

  it("la validation de prix refuse hors chiffrage et recopie le prix validé", () => {
    expect(sql).toMatch(/current_case\.status NOT IN \('under_review', 'pricing', 'matching'\)/);
    expect(sql).toMatch(/service_price_cents = p_customer_price_cents/);
    expect(sql).toMatch(/'suggested_customer_price_cents', current_case\.suggested_customer_price_cents/);
  });

  it("garde la même signature (aucune surcharge) et n'efface aucune donnée", () => {
    expect(sql).not.toMatch(/DROP FUNCTION/i);
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|DROP TABLE/i);
    expect(sql).toMatch(/marketplace_validate_pricing\(\s*p_case_id UUID,\s*p_customer_price_cents INTEGER,\s*p_binder_payout_cents INTEGER,\s*p_price_includes TEXT\[\],\s*p_minimum_margin_bps INTEGER,\s*p_minimum_margin_cents INTEGER,\s*p_actor_user_id UUID\s*\)/);
  });
});
