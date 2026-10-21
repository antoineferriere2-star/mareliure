import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { undeclaredTables } from "../../src/marketplace/security/tableGrants";

const warning = "<création dynamique (EXECUTE, DO, format) à déclarer>";
const cases = [
  { name: "ajout de colonne dynamique légitime", sql: "DO $$ BEGIN EXECUTE 'ALTER TABLE public.existing ADD COLUMN checked boolean'; END $$;", expected: [warning] },
  { name: "lecture dynamique légitime", sql: "DO $$ DECLARE value int; BEGIN EXECUTE 'SELECT 1' INTO value; END $$;", expected: [warning] },
  { name: "corps entre apostrophes", sql: "DO 'BEGIN EXECUTE ''SELECT 1''; END';", expected: [warning] },
  { name: "fonction dynamique non appelée pendant la migration", sql: "CREATE FUNCTION public.dynamic_read() RETURNS int LANGUAGE plpgsql AS $$ DECLARE value int; BEGIN EXECUTE 'SELECT 1' INTO value; RETURN value; END $$;", expected: [warning] },
  { name: "GRANT EXECUTE dans DO : faux positif conservateur", sql: "DO $$ BEGIN GRANT EXECUTE ON FUNCTION public.helper() TO authenticated; END $$;", expected: [warning] },
  { name: "COMMENT contenant le mot EXECUTE : faux positif", sql: "COMMENT ON TABLE public.existing IS 'Le rôle peut EXECUTE la fonction.';", expected: [warning] },
  { name: "message contenant le mot EXECUTE : faux positif", sql: "DO $$ BEGIN RAISE NOTICE 'execute succeeded'; END $$;", expected: [warning] },
  { name: "GRANT EXECUTE statique hors corps : aucun avertissement", sql: "GRANT EXECUTE ON FUNCTION public.helper() TO authenticated;", expected: [] },
  { name: "mot dans commentaire SQL retiré", sql: "-- EXECUTE ici est un commentaire\nSELECT 1;", expected: [] },
  { name: "marqueur sur migration dynamique relue", sql: "-- acl: dynamic-reviewed\nDO $$ BEGIN EXECUTE 'ALTER TABLE public.existing ADD COLUMN checked boolean'; END $$;", expected: [] },
  { name: "marqueur dans chaîne ne vaut pas relecture", sql: "SELECT '-- acl: dynamic-reviewed'; DO $$ BEGIN EXECUTE 'SELECT 1'; END $$;", expected: [warning] },
  { name: "marqueur ne masque pas une table statique sans droits", sql: "-- acl: dynamic-reviewed\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$; CREATE TABLE public.new_notes(id int);", expected: ["new_notes"] },
  { name: "oubli ordinaire CREATE TABLE", sql: "CREATE TABLE public.new_notes(id int);", expected: ["new_notes"] },
  { name: "oubli ordinaire CREATE TABLE AS", sql: "CREATE TABLE public.new_notes AS SELECT 1 AS id;", expected: ["new_notes"] },
  { name: "oubli ordinaire SELECT INTO", sql: "SELECT 1 AS id INTO public.new_notes;", expected: ["new_notes"] },
  { name: "oubli ordinaire SELECT INTO après WITH", sql: "WITH rows AS (SELECT 1 AS id) SELECT * INTO public.new_notes FROM rows;", expected: ["new_notes"] },
  { name: "table LIKE nécessite ses droits", sql: "CREATE TABLE public.new_notes (LIKE public.existing);", expected: ["new_notes"] },
  { name: "GRANT global avant création ne vaut pas droits futurs", sql: "GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated; CREATE TABLE public.new_notes(id int);", expected: ["new_notes"] },
  { name: "table arrivée depuis autre schéma", sql: "CREATE TABLE audit.new_notes(id int); ALTER TABLE audit.new_notes SET SCHEMA public;", expected: ["new_notes"] },
  { name: "GRANT explicite après création", sql: "CREATE TABLE public.new_notes(id int); GRANT SELECT ON public.new_notes TO authenticated;", expected: [] },
];
let db: PGlite;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec("CREATE ROLE authenticated; CREATE SCHEMA audit; CREATE TABLE public.existing(id int); CREATE FUNCTION public.helper() RETURNS int LANGUAGE sql AS 'SELECT 1';");
}, 30_000);
afterAll(async()=>{ await db.close(); });
describe("contre-revue #163 limitée aux migrations ordinaires et aux faux positifs",()=>{
  for(const row of cases) it(row.name,async()=>{
    expect(undeclaredTables(row.sql)).toEqual(row.expected);
    await db.exec("BEGIN;");
    try { await db.exec(row.sql); } finally { await db.exec("ROLLBACK;"); }
  });
  it("rejoue les dix omissions signalées sur #160, désormais signalées",async()=>{
    const probes=JSON.parse(readFileSync(new URL("./previous-probes160.json",import.meta.url),"utf8")) as {name:string;sql:string;target:string;kind:string;expectedSelect:boolean}[];
    const previousOmissions = probes.filter(p=>p.kind==="remaining bypass");
    expect(previousOmissions).toHaveLength(10);
    for(const row of previousOmissions){
      expect(undeclaredTables(row.sql),row.name).not.toEqual([]);
      await db.exec("BEGIN;");
      try {
        await db.exec(row.sql);
        const result=await db.query<{allowed:boolean}>("SELECT has_table_privilege('authenticated',$1,'SELECT') AS allowed",[row.target]);
        expect(result.rows[0].allowed,row.name).toBe(false);
      } finally { await db.exec("ROLLBACK;"); }
    }
  });
  it("consigne l’inventaire historique sans imposer le marqueur rétroactivement",()=>{
    const dir=new URL("../../supabase/migrations/",import.meta.url);
    const inventory=readdirSync(dir).filter(name=>name.endsWith('.sql')).sort().map(file=>({file,findings:undeclaredTables(readFileSync(new URL(file,dir),'utf8'))}));
    writeFileSync(new URL('./inventory.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),inventory},null,2)+'\n');
    expect(inventory.filter(row=>row.file.slice(0,14)>'20261020100000').flatMap(row=>row.findings)).toEqual([]);
  });
});
