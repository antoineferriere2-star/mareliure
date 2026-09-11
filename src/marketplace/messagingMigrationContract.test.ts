// The messaging and decisions migrations (Phase B, 12 septembre 2026), read
// as a contract — same approach as migrationContract.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DECISION_KINDS, DECISION_STATUSES } from "./decisions/decisions";

const MESSAGING_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260912090000_marketplace_messaging.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const DECISIONS_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260912100000_marketplace_decisions.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const strip = (sql: string) => sql.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const MESSAGING = strip(MESSAGING_SQL);
const DECISIONS = strip(DECISIONS_SQL);

function constrainedValues(statements: string, constraint: string): string[] {
  const match = new RegExp(`CONSTRAINT ${constraint}\\s+CHECK`).exec(statements);
  expect(match, `missing constraint ${constraint}`).not.toBeNull();
  const rest = statements.slice(match!.index + match![0].length);
  const next = rest.indexOf("CONSTRAINT ");
  const clause = next === -1 ? rest : rest.slice(0, next);
  return [...clause.matchAll(/'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]);
}

const NEW_TABLES = ["marketplace_messages", "marketplace_conversation_reads", "marketplace_decisions"];

describe("the new tables are isolated exactly like every other marketplace_* table", () => {
  const combined = `${MESSAGING}\n${DECISIONS}`;

  it.each(NEW_TABLES)("%s is created", (table) => {
    expect(combined).toContain(`CREATE TABLE IF NOT EXISTS public.${table} (`);
  });

  it.each(NEW_TABLES)("%s grants only service_role", (table) => {
    expect(combined).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    expect(combined).not.toContain(`ON public.${table} TO authenticated`);
    expect(combined).not.toContain(`ON public.${table} TO anon`);
  });

  it.each(NEW_TABLES)("%s enables RLS and denies anon + authenticated", (table) => {
    expect(combined).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    const policy = combined
      .slice(combined.indexOf(`CREATE POLICY "No direct access to ${table}"`))
      .slice(0, 220);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });
});

describe("marketplace_messages", () => {
  it("never allows an entirely empty message", () => {
    expect(MESSAGING).toContain(
      "CHECK (\n    char_length(body) > 0 OR array_length(attachment_paths, 1) > 0\n  )",
    );
  });

  it("attributes a role at send time, from a fixed vocabulary", () => {
    expect(MESSAGING).toContain("CHECK (sender_role IN ('customer', 'binder', 'admin'))");
  });

  it("soft-deletes rather than removing a row", () => {
    expect(MESSAGING).toContain("deleted_at TIMESTAMPTZ");
  });
});

describe("the message-attachments bucket", () => {
  it("is private, 8MB, and accepts images plus PDF (§16)", () => {
    const bucket = MESSAGING.slice(
      MESSAGING.indexOf("INSERT INTO storage.buckets"),
      MESSAGING.indexOf("ON CONFLICT (id) DO UPDATE"),
    );
    expect(bucket).toContain("'marketplace-message-attachments'");
    expect(bucket).toContain("FALSE");
    expect(bucket).toContain("8388608");
    for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(bucket).toContain(mime);
    }
  });

  it("denies every direct access to storage.objects for this bucket", () => {
    expect(MESSAGING).toContain(
      "USING (bucket_id = 'marketplace-message-attachments' AND FALSE)",
    );
  });
});

describe("marketplace_decisions", () => {
  it("kind matches the DECISION_KINDS vocabulary exactly", () => {
    expect(new Set(constrainedValues(DECISIONS, "marketplace_decisions_kind_check"))).toEqual(
      new Set(DECISION_KINDS),
    );
  });

  it("status matches DECISION_STATUSES exactly", () => {
    expect(new Set(constrainedValues(DECISIONS, "marketplace_decisions_status_check"))).toEqual(
      new Set(DECISION_STATUSES),
    );
  });

  it("an answered decision always records who, when and what", () => {
    expect(DECISIONS).toContain(
      "status <> 'answered'\n    OR (answer IS NOT NULL AND answered_by IS NOT NULL AND answered_at IS NOT NULL)",
    );
  });

  it("a cancelled decision always records when", () => {
    expect(DECISIONS).toContain("status <> 'cancelled' OR cancelled_at IS NOT NULL");
  });

  it("corrections point forward (superseded_by), never rewrite the answer in place", () => {
    expect(DECISIONS).toContain("superseded_by UUID REFERENCES public.marketplace_decisions(id)");
    // The column exists precisely so answer/answered_by/answered_at are never
    // UPDATEd once set — nothing in this migration drops that guarantee.
    expect(DECISIONS).not.toMatch(/UPDATE\s+public\.marketplace_decisions/i);
  });
});

describe("no rollback silently drops data-bearing history", () => {
  it("both migrations document a rollback", () => {
    expect(MESSAGING_SQL).toContain("-- Rollback");
    expect(DECISIONS_SQL).toContain("-- Rollback");
  });
});
