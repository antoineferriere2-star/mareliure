import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { logisticsActions, photoMime, logisticsAppend } from "./logistics";
let db: PGlite;
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY,binder_id uuid);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text,name text);
    INSERT INTO auth.users VALUES('${id(1)}'),('${id(2)}');
    INSERT INTO marketplace_binder_members VALUES('${id(3)}','${id(1)}','active'),('${id(4)}','${id(2)}','active');
    INSERT INTO marketplace_binder_works VALUES('${id(5)}','${id(3)}'),('${id(6)}','${id(4)}');`);
  await db.exec(
    readFileSync(
      new URL(
        "../../../supabase/migrations/20260928130000_work_logistics_manual.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
const call = (action: string, data: unknown = {}, binder = id(3), actor = id(1), work = id(5)) =>
  db.query("SELECT marketplace_work_logistics($1,$2,$3,$4,$5::jsonb) result", [
    work,
    binder,
    actor,
    action,
    JSON.stringify(data),
  ]);
const append = (n: number, version: number, kind: string, details: unknown) =>
  call("append", { id: id(n), version, kind, details });
it("isolates ateliers and denies browser SQL", async () => {
  await expect(call("read", {}, id(4), id(2))).rejects.toThrow("work_not_found");
  await expect(call("read", {}, id(3), id(2))).rejects.toThrow("active_membership_required");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await expect(call("read")).rejects.toThrow("permission denied");
      await expect(db.exec("SELECT * FROM marketplace_work_logistics_events")).rejects.toThrow(
        "permission denied",
      );
    } finally {
      await db.exec("RESET ROLE");
    }
  }
});
it("refuses return and final declaration before physical receipt", async () => {
  await expect(append(10, 0, "return", { mode: "hand" })).rejects.toThrow("invalid_transition");
  await expect(append(10, 0, "completed", { proof: "preuve test" })).rejects.toThrow(
    "invalid_transition",
  );
  await expect(append(10, 0, "outbound", { mode: "parcel" })).rejects.toThrow("tracking_required");
  await append(10, 0, "outbound", { mode: "parcel", carrier: "QA transport", tracking: "QA-123" });
});
it("retries once and refuses competing stale transitions", async () => {
  await append(10, 0, "outbound", { mode: "parcel", carrier: "QA transport", tracking: "QA-123" });
  await expect(append(10, 0, "outbound", { mode: "hand" })).rejects.toThrow("retry_conflict");
  const results = await Promise.allSettled([
    append(11, 1, "note", { description: "QA observation A" }),
    append(12, 1, "note", { description: "QA observation B" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
});
it("carrier delivery is never physical receipt", async () => {
  await append(13, 2, "carrier_delivered", { proof: "QA scan transporteur" });
  await expect(append(14, 3, "return", { mode: "hand" })).rejects.toThrow("invalid_transition");
  await expect(
    append(14, 3, "received", { condition: "difference", description: " " }),
  ).rejects.toThrow("description_required");
  await append(14, 3, "received", {
    condition: "difference",
    description: "QA coin abîmé à réception",
  });
});
it("attaches only private images to receipt or incident and same work", async () => {
  await expect(call("photo", { id: id(20), event: id(10) })).rejects.toThrow(
    "photo_event_required",
  );
  await expect(call("photo", { id: id(20), event: id(14) })).rejects.toThrow("photo_missing");
  const path = `${id(3)}/${id(5)}/${id(14)}/${id(20)}`;
  await db.query("INSERT INTO storage.objects VALUES('work-logistics-private',$1)", [path]);
  await call("photo", { id: id(20), event: id(14) });
  await call("photo", { id: id(20), event: id(14) });
  expect(
    (await db.query("SELECT count(*)::int n FROM marketplace_work_logistics_photos")).rows,
  ).toEqual([{ n: 1 }]);
  await expect(call("photo", { id: id(20), event: id(14) }, id(4), id(2), id(6))).rejects.toThrow(
    "photo_event_required",
  );
  expect((await db.query("SELECT public FROM storage.buckets")).rows).toEqual([{ public: false }]);
});
it("records return and a final atelier declaration with proof, preserving incidents", async () => {
  await append(21, 4, "incident", { description: "QA incident documenté" });
  await append(22, 5, "return", { mode: "hand" });
  await expect(append(23, 6, "carrier_delivered", { proof: "QA justificatif" })).rejects.toThrow(
    "parcel_required",
  );
  await expect(append(23, 6, "completed", {})).rejects.toThrow("proof_required");
  await append(23, 6, "completed", { proof: "QA reçu de remise signé" });
  await append(24, 7, "note", { description: "QA correction conservée" });
  expect(
    (await db.query("SELECT count(*)::int n FROM marketplace_work_logistics_events")).rows,
  ).toEqual([{ n: 8 }]);
  await expect(db.exec("DELETE FROM marketplace_work_logistics_events")).rejects.toThrow(
    "logistics_history_immutable",
  );
  await expect(
    db.exec("UPDATE marketplace_work_logistics_photos SET path='elsewhere'"),
  ).rejects.toThrow("logistics_history_immutable");
});
it("restricts Storage even with another broad permissive policy", async () => {
  await db.exec(`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT,INSERT ON storage.objects TO authenticated;
    CREATE POLICY unrelated_open_policy ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
    SET ROLE authenticated;`);
  try {
    expect((await db.query("SELECT * FROM storage.objects")).rows).toEqual([]);
    await expect(
      db.exec("INSERT INTO storage.objects VALUES('work-logistics-private','forged')"),
    ).rejects.toThrow("row-level security");
  } finally {
    await db.exec("RESET ROLE");
  }
});
it("rejects an inactive member even for reads", async () => {
  await db.exec(
    `UPDATE marketplace_binder_members SET account_status='inactive' WHERE user_id='${id(1)}'`,
  );
  await expect(call("read")).rejects.toThrow("active_membership_required");
});
it("validates browser input and rejects executable photo formats", () => {
  expect(photoMime(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
  expect(photoMime(new Uint8Array([255, 216, 255, 0]))).toBe("image/jpeg");
  expect(
    logisticsAppend.safeParse({
      workId: id(5),
      id: id(10),
      version: 0,
      kind: "outbound",
      details: { mode: "hand" },
      binderId: id(4),
    }).success,
  ).toBe(false);
  expect(logisticsActions([])).not.toContain("return");
});
