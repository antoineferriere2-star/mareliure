import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { undeclaredTables } from "./tableGrants";

export { undeclaredTables };

/**
 * Depuis 20261020100000, une table créée par `postgres` dans `public` ne donne plus aucun droit à
 * `anon` / `authenticated` (droits par défaut retirés) ; le service garde S/I/U/D. Une table lue avec
 * la session du Visiteur ou du commercial (`context.supabase`, RLS) échouerait donc en « permission
 * denied » sans que rien ne le signale. Chaque nouvelle table doit déclarer ses droits : un GRANT ou
 * un REVOKE qui la nomme, ou le marqueur `-- acl: service-only <table>` pour une table serveur seule.
 */
const DIR = new URL("../../../supabase/migrations/", import.meta.url);
const SINCE = "20261020100000";

describe("droits explicites des nouvelles tables", () => {
  it("chaque table créée depuis la réduction des droits déclare ses accès", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".sql") && f.slice(0, 14) > SINCE).sort();
    const missing = files.flatMap((f) => undeclaredTables(readFileSync(new URL(f, DIR), "utf8")).map((t) => `${f}: ${t}`));
    expect(missing).toEqual([]);
  });
  it("reconnaît une table sans droits, un GRANT, un REVOKE et le marqueur serveur", () => {
    expect(undeclaredTables("CREATE TABLE public.build_notes (id uuid);")).toEqual(["build_notes"]);
    expect(undeclaredTables("CREATE TABLE IF NOT EXISTS build_notes(id uuid);\nGRANT SELECT ON public.build_notes TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.marketplace_x(id int);\nREVOKE ALL ON TABLE public.marketplace_x FROM anon, authenticated;")).toEqual([]);
    expect(undeclaredTables("-- acl: service-only marketplace_y\nCREATE TABLE public.marketplace_y(id int);")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.a(id int); CREATE TABLE public.b(id int); GRANT SELECT ON public.a, public.b TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.c(id int); GRANT SELECT (id) ON public.c TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TEMP TABLE scratch(id int); CREATE TABLE audit.outside(id int);")).toEqual([]);
  });
  // Revue #147 : chaque forme ci-dessous laissait passer une table sans décision de droits.
  it("formes de création sans liste de colonnes ou citées", () => {
    for (const sql of [
      "CREATE TYPE public.qa_note AS (id int); CREATE TABLE public.build_notes OF public.qa_note;",
      "CREATE TABLE public.build_notes AS SELECT 1 AS id;",
      "CREATE UNLOGGED TABLE public.build_notes(id int);",
      'CREATE TABLE "public".build_notes(id int);',
      'CREATE TABLE "public"."build_notes"(id int);',
      "CREATE TABLE public.root(id int) PARTITION BY RANGE(id); GRANT SELECT ON public.root TO authenticated; CREATE TABLE public.build_notes PARTITION OF public.root FOR VALUES FROM (0) TO (10);",
      "SELECT 1 AS id INTO public.build_notes;",
    ]) expect(undeclaredTables(sql), sql).toEqual(["build_notes"]);
  });
  it("un GRANT dans un commentaire, une chaîne ou sur un nom voisin ne compte pas", () => {
    for (const sql of [
      "-- GRANT SELECT ON public.build_notes TO anon\nCREATE TABLE public.build_notes(id int);",
      "CREATE TABLE public.build_notes(id int); /* GRANT SELECT ON public.build_notes TO authenticated; */",
      "CREATE TABLE public.build_notes(id int); /* imbriqué /* */ GRANT SELECT ON public.build_notes TO authenticated; */",
      "CREATE TABLE public.build_notes(id int); SELECT 'GRANT SELECT ON public.build_notes TO authenticated;';",
      "CREATE TABLE public.build_notes(id int); SELECT E'it\\'s ; GRANT SELECT ON public.build_notes TO authenticated';",
      "CREATE TABLE public.other_build_notes(id int); GRANT SELECT ON public.other_build_notes TO authenticated; CREATE TABLE public.build_notes(id int);",
      "CREATE TABLE public.build_notes(id int); GRANT EXECUTE ON FUNCTION public.build_notes() TO authenticated;",
    ]) expect(undeclaredTables(sql), sql).toEqual(["build_notes"]);
  });
  it("suit les renommages dans l'ordre des instructions", () => {
    expect(undeclaredTables("CREATE TABLE public.build_old(id int); GRANT SELECT ON public.build_old TO authenticated; ALTER TABLE public.build_old RENAME TO build_notes;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.build_old(id int); ALTER TABLE public.build_old RENAME TO build_notes; GRANT SELECT ON public.build_notes TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.build_old(id int); ALTER TABLE IF EXISTS ONLY public.build_old RENAME TO build_notes;")).toEqual(["build_notes"]);
  });
  const DYNAMIC = "<création dynamique (EXECUTE, DO, format) à déclarer>";
  it("signale une création qu'il ne sait pas lire, au lieu de l'ignorer", () => {
    expect(undeclaredTables("DO $$ BEGIN EXECUTE 'x'; CREATE TABLE public.build_notes(id int); END $$;")).toEqual([DYNAMIC]);
    expect(undeclaredTables("CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN CREATE TEMP TABLE t(id int); END $fn$;")).toEqual([]);
  });
  // Contre-revue #152 : SQL dynamique, changement de schéma, identifiants cités.
  it("SQL dynamique entre apostrophes ou en fragments : signalé ; marqueur de relecture explicite", () => {
    const quotedDo = "DO 'BEGIN EXECUTE format(''CREATE TABLE %I.%I(id int)'', ''public'', ''build_notes''); END';";
    const fragments = "DO $$ BEGIN EXECUTE format('%s %s public.%I(id int)', 'CREATE', 'TABLE', 'build_notes'); END $$;";
    expect(undeclaredTables(quotedDo)).toEqual([DYNAMIC]);
    expect(undeclaredTables(fragments)).toEqual([DYNAMIC]);
    expect(undeclaredTables(`-- acl: dynamic-reviewed\n${fragments}`)).toEqual([]);
    expect(undeclaredTables("DO $$ BEGIN RAISE NOTICE 'aucune création'; END $$;")).toEqual([]);
  });
  it("une relation arrivée dans public par SET SCHEMA doit déclarer ses droits", () => {
    expect(undeclaredTables("CREATE TABLE audit.build_notes(id int);ALTER TABLE audit.build_notes SET SCHEMA public;")).toEqual(["build_notes"]);
    expect(undeclaredTables("CREATE TABLE audit.before_name(id int);ALTER TABLE audit.before_name RENAME TO build_notes;ALTER TABLE audit.build_notes SET SCHEMA public;")).toEqual(["build_notes"]);
    expect(undeclaredTables("ALTER TABLE audit.legacy SET SCHEMA public;")).toEqual(["legacy"]);
    expect(undeclaredTables("ALTER TABLE audit.legacy SET SCHEMA public; GRANT SELECT ON public.legacy TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE audit.only_there(id int);")).toEqual([]);
    expect(undeclaredTables("ALTER TABLE public.existing RENAME TO renamed;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.x(id int); ALTER TABLE public.x SET SCHEMA audit;")).toEqual([]);
  });
  it("GRANT global : seulement après la création, et pour le bon schéma", () => {
    expect(undeclaredTables("GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;CREATE TABLE public.build_notes(id int);")).toEqual(["build_notes"]);
    expect(undeclaredTables("CREATE TABLE public.build_notes(id int);GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;")).toEqual([]);
    expect(undeclaredTables("CREATE TABLE public.build_notes(id int);GRANT SELECT ON ALL TABLES IN SCHEMA audit TO authenticated;")).toEqual(["build_notes"]);
    expect(undeclaredTables("CREATE TABLE public.build_notes (LIKE public.qa_source INCLUDING ALL);")).toEqual(["build_notes"]);
  });
  it("identifiants cités : casse exacte, Unicode", () => {
    expect(undeclaredTables('CREATE TABLE public."CASE_NOTES"(id int);GRANT SELECT ON public.case_notes TO authenticated;')).toEqual(["CASE_NOTES"]);
    expect(undeclaredTables('CREATE TABLE public."CASE_NOTES"(id int);GRANT SELECT ON public."CASE_NOTES" TO authenticated;')).toEqual([]);
    expect(undeclaredTables('CREATE TABLE public."Étiquettes"(id int);')).toEqual(["Étiquettes"]);
    expect(undeclaredTables('CREATE TABLE public."Étiquettes"(id int);GRANT SELECT ON public."Étiquettes" TO authenticated;')).toEqual([]);
    expect(undeclaredTables('CREATE TABLE public.CASE_NOTES(id int);GRANT SELECT ON public.case_notes TO authenticated;')).toEqual([]);
    expect(undeclaredTables('CREATE TABLE public."a""b"(id int);GRANT SELECT ON public."a""b" TO authenticated;')).toEqual([]);
  });
});
