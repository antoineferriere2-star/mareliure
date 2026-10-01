/** A deliberately small projection of the private atelier journal for the case owner. */
export type CustomerJourneyStep = {
  kind: "outbound" | "carrier_delivered" | "received" | "incident" | "return" | "completed";
  at: string;
  carrier: string | null;
  tracking: string | null;
};

type JournalRow = { kind: string; created_at: string; details: unknown };

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;

/** No addresses, photo paths, proofs or arbitrary workshop notes leave this projection. */
export function customerJourney(rows: JournalRow[]): CustomerJourneyStep[] {
  const allowed = new Set<CustomerJourneyStep["kind"]>([
    "outbound", "carrier_delivered", "received", "incident", "return", "completed",
  ]);
  return rows.flatMap((row) => {
    if (!allowed.has(row.kind as CustomerJourneyStep["kind"])) return [];
    const details = row.details && typeof row.details === "object" && !Array.isArray(row.details)
      ? row.details as Record<string, unknown> : {};
    const parcel = details.mode === "parcel" && (row.kind === "outbound" || row.kind === "return");
    return [{
      kind: row.kind as CustomerJourneyStep["kind"],
      at: row.created_at,
      carrier: parcel ? text(details.carrier) : null,
      tracking: parcel ? text(details.tracking) : null,
    }];
  });
}
