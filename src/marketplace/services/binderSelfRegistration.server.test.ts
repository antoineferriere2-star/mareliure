import { describe, expect, it } from "vitest";
import { createPendingBinderWorkspace } from "./binderSelfRegistration.server";

type Row = Record<string, unknown>;

function makeDb(binders: Row[] = [], members: Row[] = []) {
  const tables: Record<string, Row[]> = {
    marketplace_binders: binders,
    marketplace_binder_members: members,
  };
  const writes: { table: string; operation: string; value: Row }[] = [];
  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let operation = "select";
    let value: Row = {};
    const run = () => {
      if (operation !== "select") {
        writes.push({ table, operation, value });
        if (operation === "insert") tables[table].push({ id: "new-workshop", ...value });
        if (operation === "upsert" && !tables[table].some((row) => row.binder_id === value.binder_id && row.user_id === value.user_id)) {
          tables[table].push(value);
        }
        return { data: table === "marketplace_binders" ? { id: "new-workshop", ...value } : null, error: null };
      }
      return { data: tables[table].find((row) => filters.every((filter) => filter(row))) ?? null, error: null };
    };
    const query = {
      select: () => query,
      eq: (column: string, expected: unknown) => (filters.push((row) => row[column] === expected), query),
      order: () => query,
      limit: () => query,
      insert: (row: Row) => ((operation = "insert"), (value = row), query),
      upsert: (row: Row) => ((operation = "upsert"), (value = row), query),
      maybeSingle: async () => run(),
      single: async () => run(),
      then: (resolve: (result: ReturnType<typeof run>) => void) => Promise.resolve(run()).then(resolve),
    };
    return query;
  };
  return { sb: { from } as unknown as Parameters<typeof createPendingBinderWorkspace>[0], tables, writes };
}

const userId = "11111111-1111-4111-8111-111111111111";
const input = { displayName: "Camille Martin", workshopName: "Atelier Camille", city: "Tours" };

describe("création autonome d'un espace atelier", () => {
  it("crée un atelier en attente et son propriétaire, sans l'approuver", async () => {
    const db = makeDb();
    expect(await createPendingBinderWorkspace(db.sb, userId, input)).toEqual({ binderId: "new-workshop", status: "pending_review" });
    expect(db.tables.marketplace_binders).toMatchObject([{
      user_id: userId, display_name: input.displayName, workshop_name: input.workshopName,
      status: "pending_review",
    }]);
    expect(db.tables.marketplace_binder_members).toMatchObject([{
      binder_id: "new-workshop", user_id: userId, role: "OWNER", account_status: "active",
    }]);
    expect(db.writes).toHaveLength(2);
  });

  it("réutilise un atelier déjà actif sans créer de doublon", async () => {
    const db = makeDb(
      [{ id: "existing", status: "pending_review", user_id: userId }],
      [{ binder_id: "existing", user_id: userId, account_status: "active" }],
    );
    expect(await createPendingBinderWorkspace(db.sb, userId, input)).toEqual({ binderId: "existing", status: "pending_review" });
    expect(db.writes).toHaveLength(0);
  });

  it("ne permet pas de s'attribuer un atelier approuvé ni de réactiver un accès désactivé", async () => {
    const approved = makeDb([{ id: "existing", status: "approved", user_id: userId }]);
    await expect(createPendingBinderWorkspace(approved.sb, userId, input)).rejects.toThrow("Un atelier existe déjà");
    expect(approved.writes).toHaveLength(0);

    const disabled = makeDb(
      [{ id: "existing", status: "pending_review", user_id: userId }],
      [{ binder_id: "existing", user_id: userId, account_status: "disabled" }],
    );
    await expect(createPendingBinderWorkspace(disabled.sb, userId, input)).rejects.toThrow("désactivé");
    expect(disabled.writes).toHaveLength(0);
  });
});
