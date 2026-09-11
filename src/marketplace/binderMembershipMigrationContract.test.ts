// The binder-membership and referral migrations (Phase A, 11 septembre 2026),
// read as a contract — same approach as migrationContract.test.ts, on the SQL
// text rather than a running database.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MEMBERSHIP_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260911120000_marketplace_binder_membership.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const REFERRAL_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260911130000_marketplace_referral.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const strip = (sql: string) => sql.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const MEMBERSHIP = strip(MEMBERSHIP_SQL);
const REFERRAL = strip(REFERRAL_SQL);

const NEW_TABLES = ["marketplace_binder_members", "marketplace_binder_invitations"];

describe("the new tables are isolated exactly like every other marketplace_* table", () => {
  it.each(NEW_TABLES)("%s is created", (table) => {
    expect(MEMBERSHIP).toContain(`CREATE TABLE IF NOT EXISTS public.${table} (`);
  });

  it.each(NEW_TABLES)("%s grants only service_role", (table) => {
    expect(MEMBERSHIP).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    expect(MEMBERSHIP).not.toContain(`ON public.${table} TO authenticated`);
    expect(MEMBERSHIP).not.toContain(`ON public.${table} TO anon`);
  });

  it.each(NEW_TABLES)("%s enables RLS and denies anon + authenticated", (table) => {
    expect(MEMBERSHIP).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    const policy = MEMBERSHIP.slice(
      MEMBERSHIP.indexOf(`CREATE POLICY "No direct access to ${table}"`),
    ).slice(0, 220);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });
});

describe("marketplace_binders.user_id is never dropped", () => {
  it("the migration only ADDs to marketplace_binders, never drops user_id", () => {
    expect(MEMBERSHIP).not.toMatch(/DROP COLUMN[^;]*user_id/i);
  });
});

describe("membership backfill", () => {
  it("turns every existing user_id relation into an active OWNER row", () => {
    const backfill = MEMBERSHIP.slice(
      MEMBERSHIP.indexOf("INSERT INTO public.marketplace_binder_members"),
    ).slice(0, 400);
    expect(backfill).toContain("'OWNER'");
    expect(backfill).toContain("'active'");
    expect(backfill).toContain("WHERE user_id IS NOT NULL");
    // Rejouable : une seconde exécution ne duplique rien.
    expect(backfill).toContain("ON CONFLICT (binder_id, user_id) DO NOTHING");
  });
});

describe("invitations are single-use tokens, not guessable ids", () => {
  it("stores only a hash, unique, never the raw token", () => {
    expect(MEMBERSHIP).toContain("token_hash TEXT NOT NULL UNIQUE");
  });

  it("an accepted invitation always records who and when", () => {
    expect(MEMBERSHIP).toContain(
      "status <> 'accepted' OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)",
    );
  });

  it("status is constrained to the vocabulary the app uses", () => {
    expect(MEMBERSHIP).toContain(
      "CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))",
    );
  });
});

describe("account_status lives on the membership, not the workshop", () => {
  it("marketplace_binder_members carries account_status", () => {
    const table = MEMBERSHIP.slice(
      MEMBERSHIP.indexOf("CREATE TABLE IF NOT EXISTS public.marketplace_binder_members ("),
      MEMBERSHIP.indexOf("GRANT ALL ON public.marketplace_binder_members"),
    );
    expect(table).toContain("account_status TEXT NOT NULL DEFAULT 'active'");
  });

  it("does not add an account_status column to marketplace_binders", () => {
    expect(MEMBERSHIP).not.toContain("ADD COLUMN IF NOT EXISTS account_status");
  });
});

describe("marketplace_events accepts binder-only events", () => {
  it("case_id becomes nullable", () => {
    expect(MEMBERSHIP).toContain("ALTER TABLE public.marketplace_events ALTER COLUMN case_id DROP NOT NULL");
  });

  it("requires at least one of case_id or binder_id", () => {
    expect(MEMBERSHIP).toContain("CHECK (case_id IS NOT NULL OR binder_id IS NOT NULL)");
  });
});

describe("the referral slug is a real identifier, not free text", () => {
  it("format-checks personal_referral_slug", () => {
    expect(MEMBERSHIP).toContain("personal_referral_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
  });

  it("is unique among workshops that have one", () => {
    expect(MEMBERSHIP).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binders_referral_slug_uidx",
    );
    expect(MEMBERSHIP).toContain("WHERE personal_referral_slug IS NOT NULL");
  });
});

describe("acquisition_origin — provenance survives what caused it", () => {
  it("defaults every existing and new case to MA_RELIURE_ACQUIRED", () => {
    expect(REFERRAL).toContain(
      "ADD COLUMN IF NOT EXISTS acquisition_origin TEXT NOT NULL DEFAULT 'MA_RELIURE_ACQUIRED'",
    );
  });

  it("constrains the vocabulary to exactly two values", () => {
    expect(REFERRAL).toContain(
      "CHECK (\n    acquisition_origin IN ('MA_RELIURE_ACQUIRED', 'BINDER_REFERRED')\n  )",
    );
  });

  it("is one-directional, unlike the bug the 8 September audit found and fixed", () => {
    // referred_binder_id set implies BINDER_REFERRED — but not the reverse,
    // so an ON DELETE SET NULL on the referring binder's account can never
    // violate this CHECK the way marketplace_cases_claim_complete once could.
    expect(REFERRAL).toContain(
      "CHECK (\n    referred_binder_id IS NULL OR acquisition_origin = 'BINDER_REFERRED'\n  )",
    );
  });

  it("referred_binder_id tolerates the referring binder's account being deleted", () => {
    expect(REFERRAL).toContain(
      "REFERENCES public.marketplace_binders(id) ON DELETE SET NULL",
    );
  });
});

describe("no rollback silently drops data-bearing history", () => {
  it("both migrations document a rollback", () => {
    // On the raw text — "-- Rollback" is itself a comment line, stripped out
    // of MEMBERSHIP/REFERRAL along with every other one.
    expect(MEMBERSHIP_SQL).toContain("-- Rollback");
    expect(REFERRAL_SQL).toContain("-- Rollback");
  });
});
