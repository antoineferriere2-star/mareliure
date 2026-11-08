import { describe, expect, it } from "vitest";
import type { Supa } from "@/build/services/adminAuth.server";
import { saveReassignmentOffer } from "./reassignmentOfferWrite.server";
import { workshopOfferNotice } from "@/marketplace/notifications/offerNotices.server";

type Row = Record<string, unknown>;
const KEY = { caseId: "case", binderId: "b1" };
const terms = { ...KEY, payoutCents: 7500, serviceDescription: "Réparation des deux mors, charnières en soie consolidées." };

/**
 * Base en mémoire qui reproduit ce dont dépend la correction : l'UPDATE ne touche que les lignes qui
 * satisfont encore tous ses filtres au moment d'écrire (comme PostgreSQL après le verrou de ligne),
 * le déclencheur rafraîchit `updated_at`, et `(case_id, binder_id)` est unique.
 * `holdReads` retient les premières lectures jusqu'à ce que tous les appels aient lu : c'est le
 * cas simultané de la contre-revue, deux appels qui partent du même ancien état.
 */
function fakeDb(initial: Row | null, holdReads = 0, frozenStamp = false) {
  const rows: Row[] = initial ? [{ ...initial }] : [];
  let tick = 0;
  const updateFilters: Array<Array<[string, unknown]>> = [];
  let waiting: Array<() => void> = [];
  const gate = () => new Promise<void>((resolve) => {
    if (holdReads <= 0) return resolve();
    waiting.push(resolve);
    if (waiting.length >= holdReads) { holdReads = 0; waiting.forEach((r) => r()); waiting = []; }
  });
  const matches = (row: Row, filters: Array<[string, unknown]>) => filters.every(([k, v]) => (v === null ? row[k] == null : row[k] === v));
  const sb = {
    from(table: string) {
      expect(table).toBe("marketplace_quotes");
      return {
        select() {
          const filters: Array<[string, unknown]> = [];
          const q = {
            eq(k: string, v: unknown) { filters.push([k === "case_id" ? "case_id" : k, v]); return q; },
            async maybeSingle() {
              await gate();
              const row = rows.find((r) => matches(r, filters));
              return { data: row ? { ...row } : null, error: null };
            },
          };
          return q;
        },
        update(values: Row) {
          const filters: Array<[string, unknown]> = [];
          updateFilters.push(filters);
          const run = () => {
            const hit = rows.filter((r) => matches(r, filters));
            hit.forEach((r) => Object.assign(r, values, { updated_at: frozenStamp ? r.updated_at : `t${++tick}` }));
            return { data: hit.map((r) => ({ id: r.id })), error: null };
          };
          const q = {
            eq(k: string, v: unknown) { filters.push([k, v]); return q; },
            is(k: string, v: null) { filters.push([k, v]); return q; },
            select: async () => run(),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
          };
          return q;
        },
        async insert(values: Row) {
          if (rows.some((r) => r.case_id === values.case_id && r.binder_id === values.binder_id))
            return { error: { code: "23505", message: "duplicate key" } };
          rows.push({ id: `q${rows.length + 1}`, agreement_version: null, ...values, updated_at: `t${++tick}` });
          return { error: null };
        },
      };
    },
  };
  return { sb: sb as unknown as Supa, rows, updateFilters };
}

const declined: Row = {
  id: "q1", case_id: "case", binder_id: "b1", state: "declined", agreement_version: null,
  binder_payout_cents: 6000, service_description: "Ancienne prestation, refusée par l'atelier.",
  offered_at: "2026-11-01T09:00:00+00:00", updated_at: "t0",
};
const noticeKey = (offeredAt: string) =>
  workshopOfferNotice({ ...KEY, offeredAt, reference: "RL-013", brand: "MA_RELIURE", reassignment: true }).id;

describe("réattribution : deux envois simultanés", () => {
  it("offre refusée reproposée deux fois en même temps : une seule écriture, une seule annonce", async () => {
    const db = fakeDb(declined, 2);
    const [a, b] = await Promise.all([
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z"),
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.250Z"),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["superseded", "written"]);
    const written = a.outcome === "written" ? a : b;
    const loser = a.outcome === "written" ? b : a;
    expect(db.rows[0].offered_at).toBe(written.offeredAt);
    // Le perdant n'annonce rien ; s'il le faisait, ce serait sous la clé de l'offre réellement écrite.
    expect(noticeKey(loser.offeredAt)).toBe(noticeKey(written.offeredAt));
  });

  it("première proposition envoyée deux fois en même temps : l'unicité départage, une seule annonce", async () => {
    const db = fakeDb(null, 2);
    const results = await Promise.all([
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z"),
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.250Z"),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["superseded", "written"]);
    expect(db.rows).toHaveLength(1);
  });

  it("deux réglages différents qui se croisent : le second est refusé, pas écrasé en silence", async () => {
    const db = fakeDb(declined, 2);
    const outcomes = await Promise.allSettled([
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z"),
      saveReassignmentOffer(db.sb, { ...terms, payoutCents: 9000 }, "2026-11-08T10:00:00.250Z"),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((o) => o.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason?.message ?? rejected.reason)).toMatch(/vient d'être modifiée/);
  });
});

  it("même horodatage updated_at après l'écriture concurrente : l'ancien état suffit à départager", async () => {
    // Le déclencheur donne now() : rien ne garantit une valeur nouvelle. Ici elle ne change pas du tout.
    const db = fakeDb(declined, 2, true);
    const [a, b] = await Promise.all([
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z"),
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.250Z"),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["superseded", "written"]);
  });

  it("seule la prestation change, deux envois simultanés, updated_at figé : une seule écriture", async () => {
    const pending: Row = { ...declined, state: "offered", binder_payout_cents: terms.payoutCents };
    const db = fakeDb(pending, 2, true);
    const [a, b] = await Promise.all([
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z"),
      saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.250Z"),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["superseded", "written"]);
  });

  it("le filtre ne porte pas le texte de la prestation (limite d'URL de 16 Ko)", async () => {
    const db = fakeDb(declined);
    await saveReassignmentOffer(db.sb, { ...terms, serviceDescription: "é,(\")\n".repeat(330) }, "2026-11-08T10:00:00.000Z");
    const columns = db.updateFilters.flat().map(([column]) => column);
    expect(columns).toEqual(expect.arrayContaining(["id", "updated_at", "state", "binder_payout_cents", "offered_at"]));
    expect(columns).not.toContain("service_description");
  });

describe("réattribution : appels successifs", () => {
  it("un clic répété aux mêmes conditions ne réécrit rien", async () => {
    const db = fakeDb(declined);
    const first = await saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z");
    const stamp = db.rows[0].updated_at;
    const second = await saveReassignmentOffer(db.sb, terms, "2026-11-08T10:05:00.000Z");
    expect(first.outcome).toBe("written");
    expect(second).toEqual({ outcome: "unchanged", offeredAt: first.offeredAt });
    expect(db.rows[0].updated_at).toBe(stamp);
  });

  it("des conditions modifiées ensuite font une nouvelle offre", async () => {
    const db = fakeDb(declined);
    await saveReassignmentOffer(db.sb, terms, "2026-11-08T10:00:00.000Z");
    const next = await saveReassignmentOffer(db.sb, { ...terms, payoutCents: 9000 }, "2026-11-08T10:05:00.000Z");
    expect(next).toEqual({ outcome: "written", offeredAt: "2026-11-08T10:05:00.000Z" });
  });
});
