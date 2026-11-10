// Inscription de la Mission Ferrière (10 novembre 2026). service_role ne peut
// plus écrire marketplace_intake_missions (durcissement du 20/10) : la ligne
// passe par cette migration, que seedFerriereMission.ts se contente de vérifier.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FERRIERE_MISSION_ID } from "@/build/constants";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
const SQL = read("supabase/migrations/20261110120000_enrol_ferriere_mission.sql");
const STATEMENTS = SQL.replace(/--.*$/gm, "");
const SEED = read("scripts/seedFerriereMission.ts");

describe("inscription de la Mission Ferrière", () => {
  it("inscrit la Mission Ferrière, et elle seule, sous la marque Ma Reliure", () => {
    expect(STATEMENTS).toContain("INSERT INTO public.marketplace_intake_missions (mission_id, vertical_id, brand)");
    expect(STATEMENTS).toContain("'bookbinding', 'MA_RELIURE'");
    expect(STATEMENTS.match(/'[0-9a-f-]{36}'/g)).toEqual([`'${FERRIERE_MISSION_ID}'`]);
  });

  it("est idempotente et sans effet tant que la Mission n'existe pas", () => {
    expect(STATEMENTS).toContain("FROM public.build_missions m");
    expect(STATEMENTS).toContain("ON CONFLICT (mission_id) DO NOTHING");
    expect(STATEMENTS).not.toMatch(/\bVALUES\b/);
  });

  it("ne touche ni aux droits ni aux autres dossiers", () => {
    expect(STATEMENTS).not.toMatch(/\b(GRANT|REVOKE|UPDATE|DELETE|ALTER)\b/);
    expect(STATEMENTS).not.toContain("marketplace_ingest_missing_cases");
  });

  it("le seed ne tente plus d'écrire l'inscription, il la vérifie", () => {
    const enrolment = SEED.slice(SEED.indexOf('.from("marketplace_intake_missions")'));
    expect(enrolment.slice(0, 200)).toContain(".select(");
    expect(SEED).not.toMatch(/marketplace_intake_missions"\)\s*\.(upsert|insert|update)/);
    expect(SEED).toContain("20261110120000_enrol_ferriere_mission.sql");
  });
});
