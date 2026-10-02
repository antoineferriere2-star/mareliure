import { describe, expect, it, vi } from "vitest";
import { LogisticsError, operatorConfirmManual } from "./caseLogistics.server";

// Dépôt d'une étiquette manuelle : défaut trouvé en recette (référence déjà utilisée ⇒ message
// trompeur et PDF corrigé bloqué). Base simulée : la vraie machine d'états est testée sur PGlite.
const PDF = new TextEncoder().encode("%PDF-1.4 QA etiquette fictive");
function fakeDb(transitionError: string | null) {
  const upload = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async (name: string) => name === "marketplace_reserve_round_trip_label_manual"
    ? { data: { outcome: "claim", id: "11111111-1111-4111-8111-111111111111" }, error: null }
    : transitionError ? { data: null, error: { message: transitionError } } : { data: { outcome: "applied", status: "confirmed" }, error: null });
  return { upload, rpc, sb: { rpc, storage: { from: () => ({ upload }) } } as never };
}
const details = { carrier: "Mondial Relay", tracking: "QA-1", method: "Dépôt en Point Relais", providerReference: "QA-1", chargedCostTtcCents: 469, deficitAcknowledged: false };
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof LogisticsError ? e.code : String(e)));

describe("dépôt d'une étiquette achetée manuellement", () => {
  it("remplace le PDF d'une tentative non confirmée puis confirme", async () => {
    const db = fakeDb(null);
    expect(await operatorConfirmManual(db.sb, "admin", "case", "outbound", PDF, details)).toEqual({ outcome: "confirmed", deficitTtcCents: null });
    expect(db.upload).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111/label.pdf", PDF, { contentType: "application/pdf", upsert: true });
  });
  it("une référence déjà enregistrée sur une autre étiquette donne un message explicite", async () => {
    const db = fakeDb('duplicate key value violates unique constraint "marketplace_round_trip_provider_label_uidx"');
    expect(await code(operatorConfirmManual(db.sb, "admin", "case", "outbound", PDF, details))).toBe("label_reference_duplicate");
  });
  it("double soumission : la seconde trouve l'étiquette confirmée et ne crée rien", async () => {
    const db = fakeDb("label_transition_invalid:confirmed:label_confirmed");
    expect(await operatorConfirmManual(db.sb, "admin", "case", "outbound", PDF, details)).toEqual({ outcome: "existing", deficitTtcCents: null });
  });
  it("refuse un fichier qui n'est pas un PDF avant toute réservation", async () => {
    const db = fakeDb(null);
    expect(await code(operatorConfirmManual(db.sb, "admin", "case", "outbound", new TextEncoder().encode("<svg/>"), details))).toBe("label_pdf_invalid");
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
