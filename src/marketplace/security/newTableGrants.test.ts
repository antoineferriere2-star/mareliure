import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Depuis 20261020100000, une table créée par `postgres` dans `public` ne donne plus aucun droit à
 * `anon` / `authenticated` (droits par défaut retirés) ; le service garde S/I/U/D. Une table lue avec
 * la session du Visiteur ou du commercial (`context.supabase`, RLS) échouerait donc en « permission
 * denied » sans que rien ne le signale. Chaque nouvelle table doit déclarer ses droits : un GRANT ou
 * un REVOKE qui la nomme, ou le marqueur `-- acl: service-only <table>` pour une table serveur seule.
 */
const DIR = new URL("../../../supabase/migrations/", import.meta.url);
const SINCE = "20261020100000";

export function undeclaredTables(sql: string): string[] {
  const body = sql.replace(/--(?!\s*acl:).*$/gm, "");
  const created = [...body.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)]
    .map((m) => m[1].toLowerCase());
  return created.filter((table) => {
    const name = `(?:public\\.)?"?${table}"?\\b`;
    const granted = new RegExp(`\\b(?:grant|revoke)\\b[^;]*\\bon\\s+(?:table\\s+)?[^;]*${name}`, "i").test(body);
    const serviceOnly = new RegExp(`--\\s*acl:\\s*service-only\\s+${name}`, "i").test(body);
    return !granted && !serviceOnly;
  });
}

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
    // Un commentaire ordinaire ne compte pas, ni un GRANT sur une autre table.
    expect(undeclaredTables("-- GRANT SELECT ON public.build_a TO anon\nCREATE TABLE public.build_a(id int);\nGRANT SELECT ON public.build_ab TO anon;"))
      .toEqual(["build_a"]);
  });
});
