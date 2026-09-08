import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_STATUSES } from "./cases/state";
import { MARKETPLACE_EVENT_TYPES } from "./analytics/events";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260908210000_managed_pricing_offers.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const SERVICE = readFileSync(
  resolve(process.cwd(), "src/marketplace/services/marketplace.data.functions.ts"),
  "utf8",
);

describe("managed pricing migration", () => {
  it("adds a complete price pair and prevents inverted amounts", () => {
    for (const column of [
      "customer_price_cents",
      "binder_payout_cents",
      "pricing_status",
      "pricing_reason_codes",
      "pricing_rule_version",
      "pricing_validated_at",
    ])
      expect(STATEMENTS).toContain(`ADD COLUMN ${column}`);
    expect(STATEMENTS).toContain("binder_payout_cents <= customer_price_cents");
  });

  it("adds the active case statuses and keeps only the two legacy read states", () => {
    const start = STATEMENTS.lastIndexOf("marketplace_cases_status_check CHECK");
    const clause = STATEMENTS.slice(start, STATEMENTS.indexOf("));", start) + 3);
    const values = [...clause.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(new Set(values)).toEqual(
      new Set([...CASE_STATUSES, "sent_to_binders", "quotes_received"]),
    );
  });

  it("stores fixed-payout offers and all required decline reasons", () => {
    expect(STATEMENTS).toContain("ADD COLUMN binder_payout_cents INTEGER");
    expect(STATEMENTS).toContain("ALTER TABLE public.marketplace_quotes");
    for (const column of [
      "customer_price_cents",
      "binder_payout_cents",
      "accepted_at",
      "declined_at",
      "offered_at",
    ])
      expect(STATEMENTS).toContain(`ADD COLUMN ${column}`);
    for (const value of ["offered", "accepted", "declined", "expired", "cancelled", "selected"])
      expect(STATEMENTS).toContain(`'${value}'`);
    for (const reason of [
      "payout_insufficient",
      "deadline_impossible",
      "outside_specialty",
      "no_capacity",
      "other",
    ])
      expect(STATEMENTS).toContain(`'${reason}'`);
  });

  it("records events behind deny-all RLS", () => {
    expect(STATEMENTS).toContain("CREATE TABLE public.marketplace_events (");
    expect(STATEMENTS).toContain(
      "ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;",
    );
    expect(STATEMENTS).toContain("FOR ALL TO anon, authenticated");
    expect(STATEMENTS).toContain("USING (false) WITH CHECK (false)");
    for (const eventType of MARKETPLACE_EVENT_TYPES)
      expect(`${STATEMENTS}\n${SERVICE}`).toContain(eventType);
  });

  it("makes price validation, response and selection atomic service operations", () => {
    for (const name of [
      "marketplace_validate_pricing",
      "marketplace_respond_to_offer",
      "marketplace_select_binder_offer",
    ]) {
      expect(STATEMENTS).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`);
      expect(STATEMENTS).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}`));
    }
    expect(STATEMENTS).toContain("FOR UPDATE");
  });
});
