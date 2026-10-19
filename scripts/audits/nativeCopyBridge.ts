import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { planColumns, planFromRow, planInput } from "../../src/marketplace/shipping/logisticsPlan";

export const nativeCopyEnabled = Boolean(process.env.E2E_NATIVE_COPY_DATABASE);
const uuid = (value: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error("Synthetic identifier required");
  return `'${value}'::uuid`;
};
function localSql(sql: string): Record<string, unknown> {
  const database = process.env.E2E_NATIVE_COPY_DATABASE ?? "";
  if (!/^acl_rehearsal_\d{8}$/.test(database)) throw new Error("Named native copy required");
  if (process.env.E2E_NATIVE_COPY_HOST !== "127.0.0.1") throw new Error("Loopback required");
  const port = process.env.E2E_NATIVE_COPY_PORT ?? "55432";
  if (!/^\d{1,5}$/.test(port)) throw new Error("Local port required");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: port,
    PGUSER: "postgres",
    PGDATABASE: database,
    PGSSLMODE: "disable",
    PGOPTIONS: "-c timezone=UTC",
  };
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGPASSWORD", "PGPASSFILE"])
    delete env[key];
  const guard = `DO $$ BEGIN IF current_database()<>'${database}' OR inet_server_addr()<>'127.0.0.1'::inet THEN RAISE EXCEPTION 'local_copy_required';END IF;END $$;`;
  const result = spawnSync(
    process.env.E2E_NATIVE_PSQL ?? "psql",
    ["-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1"],
    { env, input: guard + sql, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );
  if (result.status !== 0)
    throw new Error(`Native copy query failed (${result.status}): ${result.stderr.slice(0, 800)}`);
  const json = result.stdout.split(/\r?\n/).find((line) => line.startsWith("{"));
  if (!json) throw new Error("Native copy result missing");
  return JSON.parse(json) as Record<string, unknown>;
}
export function initializeNativeCase(caseId: string, brand: string) {
  if (!["MA_RELIURE", "FINE_BINDERY"].includes(brand)) throw new Error("Test brand required");
  // A copied actor is referenced locally; no account, Auth API or email is created.
  return localSql(`BEGIN;
    WITH d AS (INSERT INTO public.build_dossiers(id) VALUES(${uuid(randomUUID())}) RETURNING id),
    a AS (SELECT id FROM auth.users ORDER BY id LIMIT 1),
    c AS (INSERT INTO public.marketplace_cases(id,dossier_id,reference,brand,customer_user_id,claimed_at,claim_method)
      SELECT ${uuid(caseId)},d.id,'QA-COPY-${caseId}','${brand}',a.id,now(),'verified_email' FROM d CROSS JOIN a RETURNING id,customer_user_id)
    SELECT jsonb_build_object('caseId',id,'actor',customer_user_id) FROM c;COMMIT;`);
}
export function saveNativePlan(caseId: string, input: unknown) {
  const plan = planInput.parse(input);
  const data: Record<string, unknown> = {
    ...planColumns(plan),
    case_id: caseId,
    conditions_accepted_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  };
  const columns = Object.keys(data);
  const quoted = columns.map((key) => `"${key}"`).join(",");
  const patch = columns
    .filter((key) => key !== "case_id")
    .map((key) => `"${key}"=EXCLUDED."${key}"`)
    .join(",");
  const json = JSON.stringify(data).replaceAll("'", "''");
  return localSql(`BEGIN;SET LOCAL ROLE service_role;
    WITH changed AS (INSERT INTO public.marketplace_case_logistics_plans(${quoted},submitted_by)
      SELECT ${columns.map((key) => `p."${key}"`).join(",")},c.customer_user_id
      FROM jsonb_populate_record(NULL::public.marketplace_case_logistics_plans,'${json}'::jsonb) p
      JOIN public.marketplace_cases c ON c.id=p.case_id
      ON CONFLICT(case_id) DO UPDATE SET ${patch},submitted_by=EXCLUDED.submitted_by RETURNING case_id,version)
    SELECT jsonb_build_object('saved',true,'caseId',case_id,'version',version) FROM changed;COMMIT;`);
}
export function readNativePlan(caseId: string) {
  const row = localSql(
    `BEGIN READ ONLY;SET LOCAL ROLE service_role;SELECT to_jsonb(p) FROM public.marketplace_case_logistics_plans p WHERE case_id=${uuid(caseId)};COMMIT;`,
  );
  return planFromRow(row as unknown as Parameters<typeof planFromRow>[0]);
}
