import { describe, expect, it } from "vitest";
import { customerJourney } from "./customerJourney";

describe("customer shipping projection", () => {
  it("shows tracking but never leaks addresses, proofs or private photos", () => {
    const rows = [
      { kind: "outbound", created_at: "2026-10-01T10:00:00Z", details: {
        mode: "parcel", carrier: "Colissimo", tracking: "FR123", sender_address: "private" } },
      { kind: "note", created_at: "2026-10-01T11:00:00Z", details: { description: "private" } },
      { kind: "received", created_at: "2026-10-02T10:00:00Z", details: {
        condition: "difference", description: "private", photos: ["private/path"] } },
      { kind: "completed", created_at: "2026-10-03T10:00:00Z", details: { proof: "private" } },
    ];
    const value = customerJourney(rows);
    expect(value.map((step) => step.kind)).toEqual(["outbound", "received", "completed"]);
    expect(value[0]).toMatchObject({ carrier: "Colissimo", tracking: "FR123" });
    expect(JSON.stringify(value)).not.toMatch(/private|sender_address|photos|proof/);
  });
});
