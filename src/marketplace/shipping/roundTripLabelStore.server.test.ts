import { describe, expect, it, vi } from "vitest";
import { supabaseLabelStore } from "./roundTripLabelStore.server";

const PDF = new TextEncoder().encode("%PDF-1.4 QA");
function client(opts: { uploadError?: boolean; existing?: Uint8Array | null } = {}) {
  const upload = vi.fn(async () => ({ error: opts.uploadError ? { message: "exists" } : null }));
  const download = vi.fn(async () => opts.existing ? { data: new Blob([opts.existing as Uint8Array<ArrayBuffer>]), error: null } : { data: null, error: { message: "missing" } });
  const rpc = vi.fn(async () => ({ data: { outcome: "applied", status: "confirmed" }, error: null }));
  return { upload, download, rpc, sb: { rpc, storage: { from: () => ({ upload, download }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "j", status: "claimed" }, error: null }) }) }) }) } };
}

describe("magasin serveur des étiquettes", () => {
  it("stocke l'étiquette en privé sans écrasement, au chemin contrôlé par la base", async () => {
    const c = client();
    await supabaseLabelStore(c.sb).savePrivateLabel("job-1", PDF);
    expect(c.upload).toHaveBeenCalledWith("job-1/label.pdf", PDF, { contentType: "application/pdf", upsert: false });
  });
  it("accepte un objet déjà présent seulement s'il est identique", async () => {
    await expect(supabaseLabelStore(client({ uploadError: true, existing: PDF }).sb).savePrivateLabel("job-1", PDF)).resolves.toBeUndefined();
    await expect(supabaseLabelStore(client({ uploadError: true, existing: new TextEncoder().encode("%PDF-1.4 autre") }).sb).savePrivateLabel("job-1", PDF)).rejects.toThrow("label_object_conflict");
    await expect(supabaseLabelStore(client({ uploadError: true, existing: null }).sb).savePrivateLabel("job-1", PDF)).rejects.toThrow("label_storage_failed");
  });
  it("refuse un document qui n'est pas un PDF avant tout envoi", async () => {
    const c = client();
    await expect(supabaseLabelStore(c.sb).savePrivateLabel("job-1", new TextEncoder().encode("<html>"))).rejects.toThrow("label_not_pdf");
    expect(c.upload).not.toHaveBeenCalled();
  });
  it("passe chaque transition par la fonction SQL", async () => {
    const c = client();
    await supabaseLabelStore(c.sb).transition("job-1", "tracking_update", { code: "x" }, "p:1");
    expect(c.rpc).toHaveBeenCalledWith("marketplace_round_trip_label_transition", { p_job: "job-1", p_kind: "tracking_update", p_provider_event_id: "p:1", p_details: { code: "x" } });
  });
});
