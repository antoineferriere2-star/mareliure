import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeCase } from "./caseClosure.server";
function client(status: string | null = "pricing", result: { data: unknown; error: { code?: string } | null } = { data: "closed", error: null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const maybeSingle = vi.fn().mockResolvedValue({ data: status ? { status } : null, error: null });
  const builder = { select: () => builder, eq: () => builder, maybeSingle };
  return { sb: { from: () => builder, rpc } as unknown as SupabaseClient, rpc };
}
describe("clôture via procédure atomique", () => {
  it("transmet le motif normalisé, l'admin et le statut attendu à la procédure", async () => {
    const db=client(); expect(await closeCase(db.sb,"admin","case","  Dossier de test interne  ")).toBe("closed");
    expect(db.rpc).toHaveBeenCalledWith("marketplace_close_case_without_follow_up", {
      p_case_id:"case",p_actor_user_id:"admin",p_reason:"Dossier de test interne",p_expected_status:"pricing",
    });
  });
  it("refuse un motif vide, court ou trop long avant tout appel de clôture", async () => {
    for(const reason of ["  ","test","x".repeat(301)]) { const db=client(); expect(await closeCase(db.sb,"a","c",reason)).toBe("invalid_reason"); expect(db.rpc).not.toHaveBeenCalled(); }
  });
  it("ne lance pas la procédure pour un dossier absent, engagé ou déjà clos", async () => {
    for(const status of [null,"awaiting_binder_response","binder_accepted","awaiting_payment","paid","completed","cancelled"]) {
      const db=client(status); expect(await closeCase(db.sb,"a","c","motif valable")).toBe(status===null?"not_found":"not_closable"); expect(db.rpc).not.toHaveBeenCalled();
    }
  });
  it.each(["engaged","changed","not_found","not_closable"])("respecte le refus SQL %s sans écriture de secours", async outcome => {
    const db=client("matching",{data:outcome,error:null}); expect(await closeCase(db.sb,"a","c","motif valable")).toBe(outcome); expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("signale un défaut d'autorisation ou une réponse inconnue sans déclarer le succès", async () => {
    expect(await closeCase(client("pricing",{data:null,error:{code:"42501"}}).sb,"a","c","motif valable")).toBe("forbidden");
    expect(await closeCase(client("pricing",{data:null,error:{code:"XX000"}}).sb,"a","c","motif valable")).toBe("unreadable");
    expect(await closeCase(client("pricing",{data:"unexpected",error:null}).sb,"a","c","motif valable")).toBe("unreadable");
  });
});
