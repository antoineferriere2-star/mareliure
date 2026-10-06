import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sb: {}, create: vi.fn(), rights: vi.fn(), binder: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder,
    handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => state.sb }));
vi.mock("./workshopSubscription.server", () => ({ loadWorkshopSubscription: state.rights }));
vi.mock("./binderQuotes.server", async (original) => ({
  ...await original<typeof import("./binderQuotes.server")>(),
  requireBinderId: state.binder, createQuote: state.create,
}));
const { createMyQuote } = await import("./binderQuotes.data.functions");
const call = createMyQuote as unknown as (args: {context:{userId:string};data:object}) => Promise<unknown>;
beforeEach(() => {
  vi.clearAllMocks(); state.binder.mockResolvedValue("authenticated-workshop");
  state.create.mockResolvedValue({ id: "quote" });
  state.rights.mockResolvedValue({ canCreate: true });
});
it("refuse après résiliation avant la création d'un client ou d'un devis", async () => {
  state.rights.mockResolvedValue({ canCreate: false });
  await expect(call({context:{userId:"owner"},data:{}})).rejects.toThrow("workshop_subscription_required");
  expect(state.create).not.toHaveBeenCalled();
});
it("utilise les droits de l'atelier résolu depuis la session", async () => {
  const input = {};
  await expect(call({context:{userId:"owner"},data:input})).resolves.toEqual({id:"quote"});
  expect(state.rights).toHaveBeenCalledWith(state.sb,"authenticated-workshop");
  expect(state.create).toHaveBeenCalledWith(state.sb,"authenticated-workshop",input,expect.any(String));
});
it("n'écrit rien si la lecture des droits échoue", async () => {
  state.rights.mockRejectedValue(new Error("database unavailable"));
  await expect(call({context:{userId:"owner"},data:{}})).rejects.toThrow("database unavailable");
  expect(state.create).not.toHaveBeenCalled();
});
