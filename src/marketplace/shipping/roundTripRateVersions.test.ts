import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { RT, RT_OUT, RT_RET, reserveLeg, roundTripDb } from "./roundTripTestDb.fixture";

// Tarifs versionnés (audit Sendcloud du 15/10/2026, P1-1 et P1-3), sur les vraies migrations.
let db: PGlite;
beforeEach(async () => { db = await roundTripDb(); });
afterEach(async () => { await db.close(); });

async function addRate(overrides: { validUntil?: string; returnWeight?: number; returnDims?: number[]; method?: string } = {}) {
  await db.query(`INSERT INTO marketplace_round_trip_rate_approvals(case_id,proposal_id,binder_id,
      outbound_address_sha256,return_address_sha256,outbound_weight_grams,return_weight_grams,
      outbound_dimensions_mm,return_dimensions_mm,outbound_method,return_method,
      provider_quote_reference,coverage_evidence_reference,outbound_cost_ttc_cents,
      return_cost_ttc_cents,all_other_costs_ttc_cents,estimated_economic_cost_cents,
      economic_cost_evidence_reference,valid_until,reviewed_by,reviewed_at)
    VALUES($1,$2,$3,$4,$5,480,$6,ARRAY[340,240,60],$7,'QA outbound',$8,'QA quote v2','QA coverage',400,400,0,700,'QA cost',$9,$10,now()+interval '1 second')`,
    [RT.case, RT.proposal, RT.binder, RT_OUT, RT_RET, overrides.returnWeight ?? 450, overrides.returnDims ?? [340, 240, 60],
      overrides.method ?? "QA return v2", overrides.validUntil ?? new Date(Date.now() + 86400000).toISOString(), RT.admin]);
}
const expireAll = () => db.exec("UPDATE marketplace_round_trip_rate_approvals SET valid_until = now() - interval '1 minute'");
const reserve = (direction: "outbound" | "return") =>
  db.query<{ r: { outcome: string; id: string } }>("SELECT marketplace_reserve_round_trip_label($1,$2,$3,$4) r", [RT.case, direction, RT_OUT, RT_RET]);

describe("tarifs aller-retour versionnés", () => {
  it("accepte une nouvelle revue pour le même dossier : la plus récente fait foi", async () => {
    await addRate({ method: "QA return v2" });
    const job = await reserveLeg(db, "return");
    const rate = await db.query<{ return_method: string }>(
      "SELECT r.return_method FROM marketplace_round_trip_label_jobs j JOIN marketplace_round_trip_rate_approvals r ON r.id=j.rate_approval_id WHERE j.id=$1", [job]);
    expect(rate.rows[0].return_method).toBe("QA return v2");
  });

  it("tarif échu : un nouvel achat est refusé, puis permis après une nouvelle revue", async () => {
    await expireAll();
    await expect(reserve("outbound")).rejects.toThrow(/current_rate_approval_required/);
    await addRate();
    expect((await reserve("outbound")).rows[0].r.outcome).toBe("claim");
  });

  it("tarif échu : une réservation existante se reprend sans nouveau devis", async () => {
    const job = await reserveLeg(db, "outbound");
    await expireAll();
    const again = (await reserve("outbound")).rows[0].r;
    expect(again).toMatchObject({ outcome: "review_required", id: job });
  });

  it("colis retour différent du tarif : nouvel achat refusé jusqu'à une revue aux bonnes mesures", async () => {
    await db.exec("UPDATE marketplace_round_trip_rate_approvals SET return_weight_grams = 499");
    await expect(reserve("return")).rejects.toThrow(/parcel_changed_rate_review_required/);
    await addRate({ returnWeight: 450, returnDims: [340, 240, 60] });
    expect((await reserve("return")).rows[0].r.outcome).toBe("claim");
  });

});
