import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeCase } from "./caseClosure.server";
import { CLOSABLE_CASE_STATUSES } from "@/marketplace/cases/closeCase";

interface State { status: string | null; matches: number; proposals: number; raceTo?: string; failEvent?: boolean }

/** Faux client minimal : lit l'état, applique les écritures conditionnelles, enregistre tout. */
function fakeDb(state: State) {
  const writes: { table: string; op: string; values: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let op = "select";
      let values: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        update: (v: Record<string, unknown>) => { op = "update"; values = v; return builder; },
        insert: (v: Record<string, unknown>) => {
          writes.push({ table, op: "insert", values: v });
          return Promise.resolve({ error: state.failEvent ? { message: "boom" } : null });
        },
        eq: (column: string, value: unknown) => { filters[column] = value; return builder; },
        maybeSingle: () => Promise.resolve({ data: state.status === null ? null : { status: state.status }, error: null }),
        then: (resolve: (value: unknown) => void) => {
          if (op === "update") {
            const current = state.raceTo ?? state.status;
            const hit = current === filters.status;
            if (hit) { writes.push({ table, op: "update", values }); state.status = values.status as string; }
            return resolve({ data: hit ? [{ id: filters.id }] : [], error: null });
          }
          const count = table === "marketplace_case_matches" ? state.matches : state.proposals;
          return resolve({ count, error: null });
        },
      };
      return builder;
    },
  };
  return { sb: client as unknown as SupabaseClient, writes, state };
}

describe("classer sans suite", () => {
  it("clôt un dossier interne et journalise le motif et le statut précédent", async () => {
    const db = fakeDb({ status: "pricing", matches: 0, proposals: 0 });
    expect(await closeCase(db.sb, "admin-1", "case-1", "Dossier de test interne")).toBe("closed");
    expect(db.state.status).toBe("cancelled");
    expect(db.writes).toEqual([
      { table: "marketplace_cases", op: "update", values: { status: "cancelled" } },
      { table: "marketplace_events", op: "insert", values: { case_id: "case-1", actor_user_id: "admin-1",
        event_type: "case_closed_without_follow_up", metadata: { reason: "Dossier de test interne", previous_status: "pricing" } } },
    ]);
  });

  it("accepte exactement les statuts internes", async () => {
    expect([...CLOSABLE_CASE_STATUSES]).toEqual(["under_review", "pricing", "matching"]);
    for (const status of ["awaiting_binder_response", "binder_accepted", "awaiting_payment", "paid", "completed", "cancelled", "sent_to_binders"]) {
      const db = fakeDb({ status, matches: 0, proposals: 0 });
      expect(await closeCase(db.sb, "a", "c", "motif valable"), status).toBe("not_closable");
      expect(db.writes).toEqual([]);
    }
  });

  it("refuse sans rien écrire si un atelier a été sollicité ou une proposition existe", async () => {
    for (const engaged of [{ matches: 1, proposals: 0 }, { matches: 0, proposals: 1 }]) {
      const db = fakeDb({ status: "matching", ...engaged });
      expect(await closeCase(db.sb, "a", "c", "motif valable")).toBe("engaged");
      expect(db.writes).toEqual([]);
    }
  });

  it("dossier introuvable ou modifié entre lecture et écriture : aucun journal", async () => {
    const missing = fakeDb({ status: null, matches: 0, proposals: 0 });
    expect(await closeCase(missing.sb, "a", "c", "motif valable")).toBe("not_found");
    const raced = fakeDb({ status: "under_review", matches: 0, proposals: 0, raceTo: "matching" });
    expect(await closeCase(raced.sb, "a", "c", "motif valable")).toBe("changed");
    expect(raced.writes).toEqual([]);
  });

  it("journal en échec : le dossier est clos mais l'échec est signalé", async () => {
    const db = fakeDb({ status: "under_review", matches: 0, proposals: 0, failEvent: true });
    expect(await closeCase(db.sb, "a", "c", "motif valable")).toBe("not_logged");
  });
});
