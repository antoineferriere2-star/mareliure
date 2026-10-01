import { describe, expect, it, vi } from "vitest";

const requireBinderId = vi.fn();
vi.mock("./binderQuotes.server", async (importOriginal) => ({ ...(await importOriginal<object>()), requireBinderId }));
const { requireWorkshopAccess } = await import("./workshopAccess.server");
const { BinderQuotesError } = await import("./binderQuotes.server");

// Audit #53, C4 : le refus demeure, l'erreur brute devient un code stable que l'écran traduit.
describe("accès aux outils d'atelier", () => {
  it("refuse un compte sans atelier avec le code no_binder et le statut 403", async () => {
    requireBinderId.mockRejectedValueOnce(new BinderQuotesError("no_binder"));
    await expect(requireWorkshopAccess({} as never, "user")).rejects.toMatchObject({ name: "ServerFnError", status: 403, message: "no_binder" });
  });
  it("laisse passer l'atelier de la session et propage les autres erreurs", async () => {
    requireBinderId.mockResolvedValueOnce("binder-1");
    await expect(requireWorkshopAccess({} as never, "user")).resolves.toBe("binder-1");
    requireBinderId.mockRejectedValueOnce(new Error("database down"));
    await expect(requireWorkshopAccess({} as never, "user")).rejects.toThrow("database down");
  });
});
