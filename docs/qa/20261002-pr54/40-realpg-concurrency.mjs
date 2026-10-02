// PostgreSQL 17 réel (grappe locale jetable, données synthétiques) : les deux migrations de #54,
// puis des sessions concurrentes dans des processus psql distincts.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const PSQL = "D:/CodexProjects/qa-pg-tools/pgsql/bin/psql.exe";
const repo = "D:/CodexProjects/mareliure-roundtrip";
const tmp = "D:/CodexData/Temp/claude/C--Users-antoi-Buil-AI/1c764891-58a2-409f-a884-96c731197f3e/scratchpad/realpg";
const args = (db) => ["-h", "localhost", "-p", "55433", "-U", "postgres", "-d", db, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
const file = (sql) => { const f = `${tmp}/rt-${Math.random().toString(36).slice(2)}.sql`; writeFileSync(f, sql); return f; };
const run = (db, sql) => { const r = spawnSync(PSQL, [...args(db), "-f", file(sql)], { encoding: "utf8", timeout: 120000 }); return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr.trim() }; };
const runAsync = (db, sql) => new Promise((resolve) => { const p = spawn(PSQL, [...args(db), "-f", file(sql)]); let out = "", err = "";
  p.stdout.on("data", (d) => out += d); p.stderr.on("data", (d) => err += d); p.on("close", (code) => resolve({ ok: code === 0, out: out.trim(), err: err.trim() })); });
const id = (n) => `41000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const results = [];
const check = (label, cond, detail = "") => { results.push({ label, pass: Boolean(cond), detail }); console.log(`${cond ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`); };
const DB = "rt54real";

run("postgres", `DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB};`);
const fixture = readFileSync(`${repo}/src/marketplace/shipping/roundTripTestDb.fixture.ts`, "utf8");
const base = fixture.slice(fixture.indexOf("await db.exec(`") + "await db.exec(`".length, fixture.indexOf("`);\n  await db.exec(migration("))
  .replace(/\$\{id\((\d+)\)\}/g, (_, n) => id(Number(n)))
  .replace("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
    () => "DO $$ BEGIN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
let r = run(DB, base); check("schéma synthétique", r.ok, r.err);
for (const m of ["20261001160000_book_round_trip_shipping", "20261002090000_book_round_trip_journey"]) {
  r = run(DB, readFileSync(`${repo}/supabase/migrations/${m}.sql`, "utf8")); check(`migration ${m}`, r.ok, r.err);
}
const C = id(1), B = id(2), P = id(4), W = id(5), ADMIN = id(7), CUST = id(8), MEMBER = id(9);
r = run(DB, `INSERT INTO marketplace_case_logistics_plans(case_id,mode,contact_name,phone,address_line1,postal_code,city,country_code,
    parcel_weight_grams,parcel_length_mm,parcel_width_mm,parcel_height_mm,book_description,book_kind,declared_value_cents,conditions_accepted_at,submitted_by)
  VALUES('${C}','organized_round_trip','QA','+33600000000','1 rue QA','75011','Paris','FR',480,340,240,60,'QA livre','ordinary',3000,now(),'${CUST}');`);
check("plan synthétique", r.ok, r.err);

// 1. Course : le client modifie son plan pendant que l'atelier accepte la version qu'il a lue.
let [a, b] = await Promise.all([
  runAsync(DB, `BEGIN; UPDATE marketplace_case_logistics_plans SET postal_code='13001', city='Marseille' WHERE case_id='${C}'; SELECT pg_sleep(1.5); COMMIT;`),
  runAsync(DB, `SELECT pg_sleep(0.3); UPDATE marketplace_case_logistics_plans SET workshop_binder_id='${B}', workshop_decision='accepted', workshop_plan_version=1,
    workshop_decided_by='${MEMBER}', workshop_decided_at=now(), workshop_reception_name='QA', workshop_address_line1='3 rue QA', workshop_postal_code='69002',
    workshop_city='Lyon', workshop_country_code='FR' WHERE case_id='${C}' AND version=1 RETURNING 'accepted';`),
]);
const afterRace = run(DB, `SELECT version||'/'||coalesce(workshop_decision,'none') FROM marketplace_case_logistics_plans WHERE case_id='${C}'`).out;
check("Course plan/accord : l'accord porte sur une version obsolète et ne s'applique pas", a.ok && b.ok && !b.out.includes("accepted") && afterRace === "2/none", `${afterRace} | B: ${b.out || b.err.split("\n")[0]}`);

// Accord sur la version courante, offre acceptée, paiement Stripe, réception, retour prêt et confirmé.
r = run(DB, `UPDATE marketplace_case_logistics_plans SET workshop_binder_id='${B}', workshop_decision='accepted', workshop_plan_version=version,
    workshop_decided_by='${MEMBER}', workshop_decided_at=now(), workshop_reception_name='QA', workshop_address_line1='3 rue QA', workshop_postal_code='69002',
    workshop_city='Lyon', workshop_country_code='FR' WHERE case_id='${C}';
  INSERT INTO marketplace_commercial_proposals(id,case_id,status,accepted_at,currency,payment_circuit,deposit_type,shipping_total_cents,shipping_other_cents,
    shipping_outbound_cents,shipping_return_cents,customer_vat_rate_bps,tax_country,customer_total_ttc_cents,shipping_offer_kind)
    VALUES('${P}','${C}','accepted',now(),'EUR','legacy_resale','NONE',1250,1250,0,0,2000,'FR',13500,'book_round_trip_fr');
  INSERT INTO marketplace_commercial_proposal_payments VALUES('${P}',now(),'cs_qa','pi_qa',13500,'eur');
  INSERT INTO marketplace_work_logistics_events VALUES('${W}','received');
  SELECT marketplace_round_trip_return_ready('${C}','${B}','${MEMBER}',450,340,240,60);
  UPDATE marketplace_case_logistics_plans SET return_address_confirmed_at=now(), return_address_confirmed_version=version WHERE case_id='${C}';`);
check("dossier payé, reçu, retour prêt", r.ok, r.err);

// 2. Double réservation manuelle simultanée (double clic, deux onglets) : une seule réservation.
[a, b] = await Promise.all([
  runAsync(DB, `BEGIN; SELECT marketplace_reserve_round_trip_label_manual('${C}','outbound','${ADMIN}',false)->>'id'; SELECT pg_sleep(1.5); COMMIT;`),
  runAsync(DB, `SELECT pg_sleep(0.3); SELECT marketplace_reserve_round_trip_label_manual('${C}','outbound','${ADMIN}',false)->>'id';`),
]);
let jobs = run(DB, `SELECT count(*) FROM marketplace_round_trip_label_jobs WHERE case_id='${C}' AND direction='outbound'`).out;
check("Réservations manuelles simultanées : la seconde attend puis reprend la même", a.ok && b.ok && a.out.split("\n").pop() === b.out.split("\n").pop() && jobs === "1", `jobs=${jobs}`);

// 3. Deux confirmations simultanées de la même étiquette : une seule appliquée.
const job = b.out.split("\n").pop();
run(DB, `INSERT INTO storage.objects VALUES('round-trip-labels-private','${job}/label.pdf');`);
const confirm = `SELECT marketplace_round_trip_label_transition('${job}','label_confirmed',NULL,'{"provider":"manual","provider_label_id":"QA-1","carrier":"QA","tracking":"QA-1","method":"QA relais","charged_cost_ttc_cents":469}'::jsonb)->>'outcome';`;
[a, b] = await Promise.all([runAsync(DB, `BEGIN; ${confirm} SELECT pg_sleep(1.5); COMMIT;`), runAsync(DB, `SELECT pg_sleep(0.3); ${confirm}`)]);
const events = run(DB, `SELECT count(*) FROM marketplace_round_trip_label_events WHERE job_id='${job}' AND kind='label_confirmed'`).out;
check("Confirmations simultanées : une appliquée, l'autre refusée sans doublon", a.ok && !b.ok && b.err.includes("label_transition_invalid") && events === "1", `events=${events}`);

// 4. Achat automatique (verrou ouvert, tarif revu) : deux réservations simultanées du retour, une seule.
r = run(DB, `UPDATE marketplace_round_trip_automation SET enabled=true WHERE id;
  INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
    outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
    return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,economic_cost_evidence_reference,valid_until,reviewed_by)
  VALUES('${C}','${P}','${B}','${"a".repeat(64)}','${"b".repeat(64)}',480,450,ARRAY[340,240,60],ARRAY[340,240,60],'qa:out','qa:ret','QA devis','QA couverture',469,469,0,800,'QA coût net',now()+interval '1 day','${ADMIN}');`);
check("verrou ouvert et tarif revu synthétique", r.ok, r.err);
const reserve = `SELECT marketplace_reserve_round_trip_label('${C}','return','${"a".repeat(64)}','${"b".repeat(64)}')->>'outcome';`;
[a, b] = await Promise.all([runAsync(DB, `BEGIN; ${reserve} SELECT pg_sleep(1.5); COMMIT;`), runAsync(DB, `SELECT pg_sleep(0.3); ${reserve}`)]);
jobs = run(DB, `SELECT count(*) FROM marketplace_round_trip_label_jobs WHERE case_id='${C}' AND direction='return'`).out;
check("Réservations automatiques simultanées : une réservation, la seconde demande une revue", a.out.endsWith("claim") && b.out.endsWith("review_required") && jobs === "1", `A=${a.out.split("\n").pop()} B=${b.out.split("\n").pop()} jobs=${jobs}`);

// 5. Fermeture du verrou pendant l'attente : l'achat automatique suivant est refusé.
run(DB, `UPDATE marketplace_round_trip_automation SET enabled=false WHERE id;`);
r = run(DB, reserve);
check("Verrou refermé : plus aucune réservation automatique", !r.ok && r.err.includes("automation_closed"));

writeFileSync(`D:/CodexProjects/pr54-journey-qwf-operation/40-realpg-concurrency.json`, JSON.stringify({ engine: run("postgres", "SELECT version()").out, results }, null, 2));
run("postgres", `DROP DATABASE IF EXISTS ${DB};`);
