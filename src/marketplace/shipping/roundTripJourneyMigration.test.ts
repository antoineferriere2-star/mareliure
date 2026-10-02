import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

// PostgreSQL réel (PGlite) : chaque test recrée la base ; la CI parallèle dépasse les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });
import {
  acceptPlanByWorkshop, insertEligiblePlan, insertProposal, payProposal, putLabelObject, RT, roundTripDb, roundTripSchema,
} from "./roundTripTestDb.fixture";

// La migration 20261002090000 sur PostgreSQL réel (PGlite) : plan logistique, offre liée à sa
// version, verrous, réservation manuelle, retour et verrou d'automatisation. Aucune étiquette achetée.
let db: PGlite;
afterEach(async () => { await db?.close(); });

const plan = async () => (await db.query<Record<string, unknown>>("SELECT * FROM marketplace_case_logistics_plans WHERE case_id=$1", [RT.case])).rows[0];
const manual = (direction: string, actor = RT.admin, replace = false) =>
  db.query<{ r: { outcome: string; id?: string } }>("SELECT marketplace_reserve_round_trip_label_manual($1,$2,$3,$4) r", [RT.case, direction, actor, replace]).then((r) => r.rows[0].r);
const transition = (job: string, kind: string, details: Record<string, unknown>) =>
  db.query<{ r: Record<string, unknown> }>("SELECT marketplace_round_trip_label_transition($1,$2,NULL,$3::jsonb) r", [job, kind, JSON.stringify(details)]).then((r) => r.rows[0].r);
const confirmManual = (job: string, cost: number, extra: Record<string, unknown> = {}) => transition(job, "label_confirmed",
  { provider: "manual", provider_label_id: `QA-${job.slice(-4)}`, carrier: "Mondial Relay", tracking: `QA${job.slice(-6)}`,
    method: "Dépôt en Point Relais", charged_cost_ttc_cents: cost, ...extra });

describe("plan logistique avant l'accord", () => {
  it("versionne chaque modification et annule l'accord de réception de l'atelier", async () => {
    db = await roundTripSchema();
    await insertEligiblePlan(db);
    await acceptPlanByWorkshop(db);
    expect(await plan()).toMatchObject({ version: 1, workshop_decision: "accepted", workshop_plan_version: 1 });
    await db.query("UPDATE marketplace_case_logistics_plans SET postal_code='13001', city='Marseille' WHERE case_id=$1", [RT.case]);
    expect(await plan()).toMatchObject({ version: 2, workshop_decision: null, workshop_plan_version: null });
    await expect(db.query("UPDATE marketplace_case_logistics_plans SET workshop_binder_id=$1, workshop_decision='accepted', workshop_plan_version=1, workshop_decided_by=$2, workshop_decided_at=now(), workshop_reception_name='QA', workshop_address_line1='3 rue QA', workshop_postal_code='69002', workshop_city='Lyon', workshop_country_code='FR' WHERE case_id=$3", [RT.binder, RT.member, RT.case]))
      .rejects.toThrow("logistics_plan_version_stale");
    await expect(db.query("DELETE FROM marketplace_case_logistics_plans")).rejects.toThrow("logistics_plan_history_required");
  });

  it("exige adresses et mesures pour l'expédition organisée, rien pour la remise en main propre", async () => {
    db = await roundTripSchema();
    await expect(insertEligiblePlan(db, { address_line1: null })).rejects.toThrow("logistics_plan_shipping_fields");
    await insertEligiblePlan(db, { mode: "hand_delivery", contact_name: null, phone: null, address_line1: null, postal_code: null,
      city: null, country_code: null, parcel_weight_grams: null, parcel_length_mm: null, parcel_width_mm: null, parcel_height_mm: null });
    expect(await plan()).toMatchObject({ mode: "hand_delivery", version: 1 });
  });

  it("refuse un plan créé avec un accord d'atelier ou un retour déjà renseigné", async () => {
    db = await roundTripSchema();
    await expect(insertEligiblePlan(db, { return_ready_at: new Date().toISOString(), return_ready_by: RT.member,
      return_weight_grams: 400, return_length_mm: 300, return_width_mm: 200, return_height_mm: 50 })).rejects.toThrow("logistics_plan_fresh_required");
  });
});

describe("offre « Transport aller-retour — 15 € TTC »", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["remise en main propre", { mode: "hand_delivery" }, "mode_not_organized"],
    ["livre ancien", { book_kind: "old_or_rare" }, "valuable_book"],
    ["valeur déclarée de 100 €", { declared_value_cents: 10000 }, "valuable_book"],
    ["Corse", { postal_code: "20000" }, "outside_mainland"],
    ["Monaco", { postal_code: "98000" }, "outside_mainland"],
    ["Belgique", { country_code: "BE", postal_code: "1000" }, "outside_mainland"],
    ["retour en Martinique", { return_same_address: false, return_contact_name: "QA", return_address_line1: "1 rue QA",
      return_postal_code: "97200", return_city: "Fort-de-France", return_country_code: "FR" }, "outside_mainland"],
    ["colis de 600 g", { parcel_weight_grams: 600 }, "parcel_review"],
    ["colis trop épais", { parcel_height_mm: 90 }, "parcel_review"],
  ];
  it.each(cases)("refuse l'offre : %s", async (_label, overrides, reason) => {
    db = await roundTripSchema();
    await insertEligiblePlan(db, overrides);
    await acceptPlanByWorkshop(db);
    await expect(insertProposal(db, "book_round_trip_fr")).rejects.toThrow(`round_trip_not_eligible:${reason}`);
  });

  it("exige un plan, l'accord de l'atelier retenu sur la version courante et un dossier Ma Reliure", async () => {
    db = await roundTripSchema();
    await expect(insertProposal(db, "book_round_trip_fr")).rejects.toThrow("logistics_plan_required");
    await insertEligiblePlan(db);
    await expect(insertProposal(db, "book_round_trip_fr")).rejects.toThrow("workshop_acceptance_required");
    await acceptPlanByWorkshop(db, RT.otherBinder, RT.outsider);
    await expect(insertProposal(db, "book_round_trip_fr")).rejects.toThrow("workshop_acceptance_required");
    await acceptPlanByWorkshop(db);
    await db.query("UPDATE marketplace_cases SET brand='FINE_BINDERY'");
    await expect(insertProposal(db, "book_round_trip_fr")).rejects.toThrow("brand_unsupported");
    await db.query("UPDATE marketplace_cases SET brand='MA_RELIURE'");
    await insertProposal(db, "book_round_trip_fr");
    expect((await db.query("SELECT shipping_offer_kind, logistics_plan_version FROM marketplace_commercial_proposals")).rows)
      .toEqual([{ shipping_offer_kind: "book_round_trip_fr", logistics_plan_version: 1 }]);
  });

  it("verrouille le plan pendant l'offre, le libère si elle est remplacée, le fige après acceptation", async () => {
    db = await roundTripSchema();
    await insertEligiblePlan(db);
    await acceptPlanByWorkshop(db);
    await insertProposal(db, "book_round_trip_fr");
    await expect(db.query("UPDATE marketplace_case_logistics_plans SET city='Lille', postal_code='59000'")).rejects.toThrow("logistics_plan_locked");
    await expect(db.query("UPDATE marketplace_commercial_proposals SET shipping_offer_kind='manual', logistics_plan_version=NULL"))
      .rejects.toThrow("round_trip_offer_immutable");
    await db.query("UPDATE marketplace_commercial_proposals SET status='superseded', superseded_at=now()");
    await db.query("UPDATE marketplace_case_logistics_plans SET city='Lille', postal_code='59000'");
    expect(await plan()).toMatchObject({ version: 2, workshop_decision: null });
    await db.query("UPDATE marketplace_commercial_proposals SET status='accepted', accepted_at=now()");
    await expect(db.query("UPDATE marketplace_case_logistics_plans SET city='Lyon', postal_code='69001'")).rejects.toThrow("logistics_plan_locked");
  });

  it("une proposition sans transport ne dépend d'aucun plan", async () => {
    db = await roundTripSchema();
    await insertProposal(db, "manual", "accepted");
    expect((await db.query("SELECT logistics_plan_version FROM marketplace_commercial_proposals")).rows).toEqual([{ logistics_plan_version: null }]);
  });
});

describe("étiquettes en traitement manuel", () => {
  it("exige le paiement plateforme constaté par Stripe, jamais un règlement déclaré", async () => {
    db = await roundTripSchema();
    await insertEligiblePlan(db);
    await acceptPlanByWorkshop(db);
    await insertProposal(db, "book_round_trip_fr", "accepted");
    await expect(manual("outbound")).rejects.toThrow("platform_payment_required");
    await db.query("INSERT INTO marketplace_commercial_proposal_payments VALUES($1,now(),NULL,NULL,13500,'eur')", [RT.proposal]);
    await expect(manual("outbound")).rejects.toThrow("platform_payment_required");
    await db.query("UPDATE marketplace_commercial_proposal_payments SET stripe_checkout_session_id='cs', stripe_payment_intent_id='pi', amount_paid_cents=12000");
    await expect(manual("outbound")).rejects.toThrow("platform_payment_required");
  });

  it("réservée à l'opérateur ; une seule réservation active même après double clic", async () => {
    db = await roundTripDb();
    await expect(manual("outbound", RT.member)).rejects.toThrow("admin_required");
    const first = await manual("outbound");
    const second = await manual("outbound");
    expect(first.outcome).toBe("claim");
    expect(second).toMatchObject({ outcome: "claim", id: first.id });
    expect((await db.query("SELECT count(*)::int n FROM marketplace_round_trip_label_jobs")).rows).toEqual([{ n: 1 }]);
  });

  it("confirme seulement avec le PDF privé déposé, la méthode et le coût réel", async () => {
    db = await roundTripDb();
    const { id } = await manual("outbound");
    await expect(confirmManual(id!, 420)).rejects.toThrow("label_object_missing");
    await putLabelObject(db, id!);
    await expect(confirmManual(id!, 420, { method: "" })).rejects.toThrow("method_required");
    await expect(confirmManual(id!, 420, { charged_cost_ttc_cents: null })).rejects.toThrow("charged_cost_required");
    await expect(confirmManual(id!, 420, { provider: "sendcloud" })).rejects.toThrow("label_provider_mismatch");
    await expect(confirmManual(id!, 420, { address: "1 rue" })).rejects.toThrow("private_details_refused");
    expect(await confirmManual(id!, 420)).toMatchObject({ outcome: "applied", status: "confirmed" });
    expect((await db.query("SELECT status, method_label, private_label_path FROM marketplace_round_trip_label_jobs")).rows[0])
      .toEqual({ status: "confirmed", method_label: "Dépôt en Point Relais", private_label_path: `${id}/label.pdf` });
    expect((await manual("outbound")).outcome).toBe("existing");
  });

  it("un coût total au-delà de 15 € TTC n'est jamais facturé au client : déficit reconnu et consigné", async () => {
    db = await roundTripDb();
    const out = (await manual("outbound")).id!;
    await putLabelObject(db, out);
    await confirmManual(out, 900);
    const back = (await manual("return")).id!;
    await putLabelObject(db, back);
    await expect(confirmManual(back, 800)).rejects.toThrow("deficit_acknowledgement_required");
    expect(await confirmManual(back, 800, { deficit_acknowledged: true })).toMatchObject({ deficit_ttc_cents: 200 });
    expect((await db.query("SELECT customer_total_ttc_cents FROM marketplace_commercial_proposals")).rows).toEqual([{ customer_total_ttc_cents: 13500 }]);
  });

  it("remplacer une étiquette échouée ou annulée exige une confirmation explicite", async () => {
    db = await roundTripDb();
    const { id } = await manual("outbound");
    await transition(id!, "purchase_failed", { provider: "manual", code: "operator_abandoned" });
    expect((await manual("outbound")).outcome).toBe("replacement_confirmation_required");
    const replacement = await manual("outbound", RT.admin, true);
    expect(replacement.outcome).toBe("claim");
    expect(replacement.id).not.toBe(id);
  });

  it("un achat automatique ne s'enregistre pas comme manuel, et inversement", async () => {
    db = await roundTripDb();
    const { id } = await manual("outbound");
    await expect(transition(id!, "request_started", { provider: "sendcloud" })).rejects.toThrow("label_transition_invalid");
  });
});

describe("retour vers le client", () => {
  it("après réception physique, par l'atelier retenu seulement, avec mesures du colis retour", async () => {
    db = await roundTripSchema();
    await insertEligiblePlan(db);
    await acceptPlanByWorkshop(db);
    await insertProposal(db, "book_round_trip_fr", "accepted");
    await payProposal(db);
    const ready = (actor: string, binder: string) =>
      db.query("SELECT marketplace_round_trip_return_ready($1,$2,$3,450,340,240,60)", [RT.case, binder, actor]);
    await expect(ready(RT.outsider, RT.otherBinder)).rejects.toThrow("selected_workshop_required");
    await expect(ready(RT.outsider, RT.binder)).rejects.toThrow("active_membership_required");
    await expect(ready(RT.member, RT.binder)).rejects.toThrow("physical_receipt_required");
    await db.query("INSERT INTO marketplace_work_logistics_events VALUES($1,'received')", [RT.work]);
    await ready(RT.member, RT.binder);
    await expect(manual("return")).rejects.toThrow("return_address_confirmation_required");
    await db.query("UPDATE marketplace_case_logistics_plans SET return_address_confirmed_at=now(), return_address_confirmed_version=version");
    expect((await manual("return")).outcome).toBe("claim");
    // Redéclarer les mêmes mesures est sans effet ; les changer sous une étiquette active est refusé.
    await ready(RT.member, RT.binder);
    await expect(db.query("SELECT marketplace_round_trip_return_ready($1,$2,$3,700,340,240,60)", [RT.case, RT.binder, RT.member]))
      .rejects.toThrow("return_label_in_progress");
  });

  it("le retour n'est pas prêt sans déclaration de l'atelier, même livré selon le transporteur", async () => {
    db = await roundTripSchema();
    await insertEligiblePlan(db);
    await acceptPlanByWorkshop(db);
    await insertProposal(db, "book_round_trip_fr", "accepted");
    await payProposal(db);
    await db.query("INSERT INTO marketplace_work_logistics_events VALUES($1,'carrier_delivered')", [RT.work]);
    await expect(manual("return")).rejects.toThrow("physical_receipt_required");
    await db.query("INSERT INTO marketplace_work_logistics_events VALUES($1,'received')", [RT.work]);
    await expect(manual("return")).rejects.toThrow("return_not_ready");
  });

  it("un colis retour hors plafond reste possible en manuel, jamais en automatique", async () => {
    db = await roundTripDb();
    await db.query("SELECT marketplace_round_trip_return_ready($1,$2,$3,900,340,240,60)", [RT.case, RT.binder, RT.member]);
    await expect(db.query("SELECT marketplace_reserve_round_trip_label($1,'return',$2,$3)", [RT.case, "a".repeat(64), "b".repeat(64)]))
      .rejects.toThrow("return_parcel_review_required");
    expect((await manual("return")).outcome).toBe("claim");
  });
});

describe("verrou d'automatisation", () => {
  it("fermé par défaut ; ouverture tracée et justifiée par l'administration ; fermeture immédiate", async () => {
    db = await roundTripSchema();
    expect((await db.query("SELECT enabled FROM marketplace_round_trip_automation")).rows).toEqual([{ enabled: false }]);
    const set = (actor: string, enabled: boolean, evidence: Record<string, string>) =>
      db.query("SELECT marketplace_set_round_trip_automation($1,$2,$3::jsonb)", [actor, enabled, JSON.stringify(evidence)]);
    await expect(set(RT.member, false, {})).rejects.toThrow("admin_required");
    await expect(set(RT.admin, true, { provider_quote: "QA devis 2026-10" })).rejects.toThrow("evidence_missing:coverage_terms");
    const evidence = { provider_quote: "QA devis 2026-10", coverage_terms: "QA conditions écrites", tax_validation: "QA TVA validée",
      api_recette: "QA recette isolée", commercial_decision: "QA décision du 2 oct." };
    await set(RT.admin, true, evidence);
    await set(RT.admin, false, {});
    expect((await db.query("SELECT enabled FROM marketplace_round_trip_automation")).rows).toEqual([{ enabled: false }]);
    expect((await db.query("SELECT enabled FROM marketplace_round_trip_automation_changes ORDER BY created_at")).rows)
      .toEqual([{ enabled: true }, { enabled: false }]);
  });

  it("verrou fermé : aucun achat automatique, le traitement manuel reste disponible", async () => {
    db = await roundTripDb();
    await db.query("UPDATE marketplace_round_trip_automation SET enabled=false");
    await expect(db.query("SELECT marketplace_reserve_round_trip_label($1,'outbound',$2,$3)", [RT.case, "a".repeat(64), "b".repeat(64)]))
      .rejects.toThrow("automation_closed");
    expect((await manual("outbound")).outcome).toBe("claim");
  });
});
