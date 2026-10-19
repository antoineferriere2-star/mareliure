import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const usage = JSON.parse(
  readFileSync(
    new URL("../../../docs/marketplace-grants-20261019/usage.json", import.meta.url),
    "utf8",
  ),
) as { tables: { table: string; used: string[] }[] };
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261020100000_marketplace_grants_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const triggers = [
  "marketplace_cases_forbid_brand_change",
  "marketplace_commercial_proposals_forbid_change_after_acceptance",
  "marketplace_logistics_immutable",
  "marketplace_settlement_immutable",
];
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;",
  );
  for (const { table } of usage.tables)
    await db.exec(
      `CREATE TABLE public.${table}(id integer PRIMARY KEY,note text);ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.${table} TO anon,authenticated,service_role;`,
    );
  await db.exec(
    "CREATE TABLE public.build_acl_control(id integer);GRANT SELECT ON public.build_acl_control TO anon,authenticated;ALTER TABLE public.build_acl_control ENABLE ROW LEVEL SECURITY;CREATE POLICY test_read ON public.build_acl_control FOR SELECT TO anon,authenticated USING(true);INSERT INTO public.marketplace_cases VALUES(1,'synthetic');REVOKE UPDATE ON public.marketplace_round_trip_rate_approvals FROM service_role;GRANT SELECT(note) ON public.marketplace_cases TO PUBLIC;",
  );
  for (const name of triggers)
    await db.exec(
      `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;`,
    );
  await db.exec(
    "CREATE TRIGGER test_case_guard BEFORE INSERT OR UPDATE ON public.marketplace_cases FOR EACH ROW EXECUTE FUNCTION public.marketplace_cases_forbid_brand_change();ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;",
  );
  await db.exec(migration);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("prepared SQL grants hardening", () => {
  it("closes all table and column permissions to the two browser roles", async () => {
    const result = await db.query<{ count: number }>(
      `SELECT count(*)::int count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['anon','authenticated']) r WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'marketplace\\_%' ESCAPE '\\' AND (has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))`,
    );
    expect(result.rows[0].count).toBe(0);
  });
  it("retains exactly the observed service DML, without granting the previously forbidden rate update", async () => {
    for (const row of usage.tables)
      for (const operation of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const { rows } = await db.query<{ allowed: boolean }>(
          "SELECT has_table_privilege('service_role',$1,$2) allowed",
          ["public." + row.table, operation],
        );
        const expected =
          row.used.includes(operation) &&
          !(row.table === "marketplace_round_trip_rate_approvals" && operation === "UPDATE");
        expect(rows[0].allowed, `${row.table} ${operation}`).toBe(expected);
      }
  });
  it("denies destructive and schema rights while service writes still fire the trigger", async () => {
    await db.exec("SET ROLE service_role");
    await db.exec("UPDATE public.marketplace_cases SET note='synthetic updated' WHERE id=1");
    await expect(db.exec("TRUNCATE public.marketplace_cases")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE");
    expect(
      (await db.query<{ note: string }>("SELECT note FROM public.marketplace_cases WHERE id=1"))
        .rows[0].note,
    ).toBe("synthetic updated");
  });
  it("keeps existing engine grants and row policies", async () => {
    expect(
      (
        await db.query<{ allowed: boolean; rls: boolean }>(
          "SELECT has_table_privilege('anon','public.build_acl_control','SELECT') allowed,(SELECT relrowsecurity FROM pg_class WHERE oid='public.build_acl_control'::regclass) rls",
        )
      ).rows[0],
    ).toEqual({ allowed: true, rls: true });
  });
  it("closes trigger execution and places pg_temp after the trusted public schema", async () => {
    for (const name of triggers) {
      const { rows } = await db.query<{ config: string[]; anon: boolean; service: boolean }>(
        "SELECT proconfig config,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('service_role',oid,'EXECUTE') service FROM pg_proc WHERE oid=$1::regprocedure",
        ["public." + name + "()"],
      );
      expect(rows[0]).toEqual({
        config: ["search_path=public, pg_temp"],
        anon: false,
        service: true,
      });
    }
  });
  it("changes future public table defaults without giving browsers data access", async () => {
    await db.exec("BEGIN;CREATE TABLE public.marketplace_future_acl_probe(id integer)");
    const { rows } = await db.query<{
      anon: boolean;
      auth: boolean;
      service: boolean;
      truncate: boolean;
    }>(
      "SELECT has_table_privilege('anon','public.marketplace_future_acl_probe','SELECT') anon,has_table_privilege('authenticated','public.marketplace_future_acl_probe','INSERT') auth,has_table_privilege('service_role','public.marketplace_future_acl_probe','INSERT') service,has_table_privilege('service_role','public.marketplace_future_acl_probe','TRUNCATE') truncate",
    );
    expect(rows[0]).toEqual({ anon: false, auth: false, service: true, truncate: false });
    await db.exec("ROLLBACK");
  });
  it("can be repeated on the same inventory and preserves application rows", async () => {
    await db.exec(migration);
    expect((await db.query("SELECT id FROM public.marketplace_cases")).rows).toEqual([{ id: 1 }]);
  });
});
