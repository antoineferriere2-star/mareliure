import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// PostgreSQL réel (PGlite) : chaque test recrée la base ; la CI parallèle dépasse les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });
import type { PGlite } from "@electric-sql/pglite";
import {
  logisticsErrorCode, parcelWithinRoundTripLimits, planColumns, planFromRow, planInput, roundTripPlanBlock,
} from "./logisticsPlan";
import { customerNextStep } from "@/marketplace/services/caseLogistics.server";
import { acceptPlanByWorkshop, insertEligiblePlan, RT, roundTripSchema } from "./roundTripTestDb.fixture";

const validInput = {
  mode: "organized_round_trip",
  contact: { name: "QA Client", line1: "1 rue QA", line2: null, postalCode: "75011", city: "Paris", countryCode: "fr", phone: "+33 6 00 00 00 00" },
  returnSameAddress: true,
  parcel: { weightGrams: 480, lengthMm: 340, widthMm: 240, heightMm: 60 },
  bookDescription: "Roman broché", bookKind: "ordinary", declaredValueCents: 3000, acceptConditions: true,
};

describe("saisie du plan", () => {
  it("valide l'expédition organisée et normalise le pays", () => {
    const parsed = planInput.parse(validInput);
    expect(parsed.contact?.countryCode).toBe("FR");
    expect(planColumns(parsed)).toMatchObject({ mode: "organized_round_trip", postal_code: "75011", return_same_address: true });
  });
  it("refuse adresse ou colis manquants, code postal français invalide, conditions non acceptées", () => {
    expect(planInput.safeParse({ ...validInput, contact: null }).success).toBe(false);
    expect(planInput.safeParse({ ...validInput, parcel: null }).success).toBe(false);
    expect(planInput.safeParse({ ...validInput, contact: { ...validInput.contact, postalCode: "7501" } }).success).toBe(false);
    expect(planInput.safeParse({ ...validInput, acceptConditions: false }).success).toBe(false);
    expect(planInput.safeParse({ ...validInput, returnSameAddress: false }).success).toBe(false);
    expect(planInput.safeParse({ ...validInput, binderId: "x" }).success).toBe(false);
  });
  it("la remise en main propre n'enregistre ni adresse ni colis", () => {
    const parsed = planInput.parse({ ...validInput, mode: "hand_delivery" });
    expect(planColumns(parsed)).toMatchObject({ address_line1: null, parcel_weight_grams: null, return_same_address: true });
  });
  it("dimensions comparées triées : un colis posé autrement reste dans le plafond", () => {
    expect(parcelWithinRoundTripLimits({ weightGrams: 500, lengthMm: 80, widthMm: 350, heightMm: 250 })).toBe(true);
    expect(parcelWithinRoundTripLimits({ weightGrams: 501, lengthMm: 80, widthMm: 350, heightMm: 250 })).toBe(false);
    expect(parcelWithinRoundTripLimits({ weightGrams: 400, lengthMm: 90, widthMm: 260, heightMm: 300 })).toBe(false);
  });
  it("extrait les codes d'erreur stables des messages Postgres", () => {
    expect(logisticsErrorCode("round_trip_not_eligible:outside_mainland")).toBe("round_trip_not_eligible");
    expect(logisticsErrorCode("logistics_plan_locked")).toBe("logistics_plan_locked");
    expect(logisticsErrorCode("duplicate key value")).toBeNull();
  });
});

describe("même verdict que la base", () => {
  let db: PGlite;
  beforeAll(async () => { db = await roundTripSchema(); }, 30000);
  afterAll(async () => { await db?.close(); });
  const variants: Record<string, unknown>[] = [
    {}, { postal_code: "20090" }, { postal_code: "98000" }, { country_code: "BE", postal_code: "1000" },
    { parcel_weight_grams: 501 }, { parcel_length_mm: 80, parcel_width_mm: 350, parcel_height_mm: 250 },
    { parcel_height_mm: 81 }, { book_kind: "unique_or_heritage" }, { declared_value_cents: 9999 },
    { declared_value_cents: 10000 }, { mode: "customer_arranged" },
  ];
  it.each(variants.map((v) => [JSON.stringify(v), v]))("plan %s", async (_label, overrides) => {
    await db.exec("ALTER TABLE marketplace_case_logistics_plans DISABLE TRIGGER marketplace_logistics_plan_guard; DELETE FROM marketplace_case_logistics_plans; ALTER TABLE marketplace_case_logistics_plans ENABLE TRIGGER marketplace_logistics_plan_guard;");
    await insertEligiblePlan(db, overrides as Record<string, unknown>);
    await acceptPlanByWorkshop(db);
    const row = (await db.query("SELECT * FROM marketplace_case_logistics_plans")).rows[0];
    const sql = (await db.query<{ b: string | null }>(
      "SELECT marketplace_round_trip_plan_block(p,'MA_RELIURE',$1) b FROM marketplace_case_logistics_plans p", [RT.binder])).rows[0].b;
    const iso = JSON.parse(JSON.stringify(row, (_k, v) => (v instanceof Date ? v.toISOString() : v)));
    expect(roundTripPlanBlock(planFromRow(iso)!, "MA_RELIURE", RT.binder)).toBe(sql);
  });
});

describe("prochaine action du client", () => {
  const plan = planFromRow({ version: 1, mode: "organized_round_trip", address_line1: "1 rue", contact_name: "QA", phone: "+33600000000",
    postal_code: "75011", city: "Paris", country_code: "FR", return_same_address: true, book_description: "x", book_kind: "ordinary",
    declared_value_cents: 0, workshop_decision: "accepted", workshop_plan_version: 1, workshop_binder_id: RT.binder, workshop_decided_at: "t" })!;
  const base = { plan, accepted: true, paid: true, offerKind: "book_round_trip_fr", outbound: null, journal: [] as string[], returnConfirmed: false };
  it("guide pas à pas sans jamais confondre livraison transporteur et réception", () => {
    expect(customerNextStep({ ...base, plan: null, accepted: false })).toBe("choose_mode");
    expect(customerNextStep({ ...base, plan: { ...plan, workshop: null }, accepted: false })).toBe("await_workshop");
    expect(customerNextStep({ ...base, plan: { ...plan, workshop: { ...plan.workshop!, decision: "declined" } }, accepted: false })).toBe("workshop_declined");
    expect(customerNextStep({ ...base, accepted: false })).toBe("await_proposal");
    expect(customerNextStep({ ...base, paid: false })).toBe("pay");
    expect(customerNextStep(base)).toBe("await_outbound_label");
    expect(customerNextStep({ ...base, outbound: { state: "ready", carrier: "MR", tracking: "1", method: "Relais" } })).toBe("drop_parcel");
    expect(customerNextStep({ ...base, journal: ["outbound", "carrier_delivered"] })).toBe("outbound_in_transit");
    expect(customerNextStep({ ...base, journal: ["outbound", "received"] })).toBe("in_workshop");
    const ready = { ...plan, returnReady: { at: "t", parcel: { weightGrams: 400, lengthMm: 300, widthMm: 200, heightMm: 50 } } };
    expect(customerNextStep({ ...base, plan: ready, journal: ["received"] })).toBe("confirm_return_address");
    expect(customerNextStep({ ...base, plan: ready, journal: ["received"], returnConfirmed: true })).toBe("await_return");
    expect(customerNextStep({ ...base, journal: ["received", "return"] })).toBe("return_in_transit");
    expect(customerNextStep({ ...base, journal: ["received", "return", "completed"] })).toBe("completed");
    expect(customerNextStep({ ...base, offerKind: "manual" })).toBe("send_or_bring");
  });
});
