import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAdminDashboard, readAll } from "./adminDashboard.server";

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, failedTable?: string) {
  const calls: { table: string; columns: string; key?: string; from?: number; equals: Record<string, string> }[] = [];
  const sb = { from(table: string) {
    return { select(columns: string, options?: { head?: boolean }) {
      const call = { table, columns, equals: {} } as (typeof calls)[number]; calls.push(call);
      let data = tables[table] ?? [];
      const result = () => ({ data, count: data.length, error: table === failedTable ? { message: "unavailable" } : null });
      const query = {
        eq(key: string, value: string) { call.equals[key] = value; data = data.filter(row => row[key] === value); return query; },
        order(key: string) { call.key = key; data = [...data].sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return query; },
        range(from: number, to: number) { call.from = from; data = data.slice(from, to + 1); return Promise.resolve(result()); },
        then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      if (options?.head) return { then: query.then };
      return query;
    } };
  } } as unknown as SupabaseClient;
  return { sb, calls };
}
const now = new Date("2026-10-08T12:00:00Z");

describe("lectures du tableau de bord", () => {
  it("ne tronque pas les tables dépassant mille lignes et ordonne chaque page", async () => {
    const input = Array.from({ length: 2001 }, (_, i) => ({ id: String(2001 - i).padStart(5, "0") }));
    const { sb, calls } = database({ marketplace_cases: input });
    const result = await readAll<{ id: string }>(sb, "marketplace_cases", "id");
    expect(result).toHaveLength(2001);
    expect(new Set(result.map(row => row.id)).size).toBe(2001);
    expect(calls.map(call => [call.key, call.from])).toEqual([["id", 0], ["id", 1000], ["id", 2000]]);
  });
  it("compte les non-lus du lecteur, filtre sa dernière lecture et ne lit aucun corps de message", async () => {
    const messages = Array.from({ length: 1001 }, (_, i) => ({ id: String(i).padStart(5, "0"), case_id: "mr", sender_user_id: "client", audience: "shared", created_at: "2026-10-08T10:00:00Z" }));
    const { sb, calls } = database({
      marketplace_cases: [{ id: "mr", reference: "RL-1", brand: "MA_RELIURE", status: "paid", created_at: "2026-08-01T00:00:00Z" }, { id: "fb", reference: "FB-1", brand: "FINE_BINDERY", status: "paid", created_at: "2026-10-08T00:00:00Z" }],
      marketplace_messages: [...messages,
        { id: "self", case_id: "mr", sender_user_id: "admin", audience: "shared", created_at: "2026-10-08T10:00:00Z" },
        { id: "read", case_id: "fb", sender_user_id: "client", audience: "customer_concierge", created_at: "2026-10-08T08:00:00Z" },
        { id: "new", case_id: "fb", sender_user_id: "atelier", audience: "workshop_platform", created_at: "2026-10-08T10:00:00Z" },
        { id: "invalid", case_id: "fb", sender_user_id: "client", audience: "unknown", created_at: "2026-10-08T10:00:00Z" }],
      marketplace_conversation_reads: [{ case_id: "fb", user_id: "admin", last_read_at: "2026-10-08T09:00:00Z" }, { case_id: "mr", user_id: "someone-else", last_read_at: now.toISOString() }],
    });
    const all = await readAdminDashboard(sb, "admin", { brand: "ALL", days: 7 }, { now });
    expect(all.unreadMessages).toBe(1002);
    const fb = await readAdminDashboard(sb, "admin", { brand: "FINE_BINDERY", days: 7 }, { now });
    expect(fb.unreadMessages).toBe(1);
    const reads = calls.filter(call => call.table === "marketplace_conversation_reads");
    expect(reads.every(call => call.key === "case_id" && call.equals.user_id === "admin")).toBe(true);
    expect(calls.filter(call => call.table === "marketplace_messages").every(call => !call.columns.includes("body"))).toBe(true);
    expect(JSON.stringify(all)).not.toContain("sender_user_id");
    expect(JSON.stringify(all)).not.toContain("last_read_at");
  });
  it("remonte un échec de lecture plutôt que d'afficher des zéros trompeurs", async () => {
    const { sb } = database({}, "marketplace_workshop_online_disputes");
    await expect(readAdminDashboard(sb, "admin", { brand: "ALL", days: null }, { now })).rejects.toThrow("marketplace_workshop_online_disputes: unavailable");
  });
});
