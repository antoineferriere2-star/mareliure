import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ assertAdmin: vi.fn(), admin: vi.fn(), read: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (handler: unknown) => handler };
  return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/adminAuth.server", () => ({ assertAdmin: mocks.assertAdmin, admin: mocks.admin }));
vi.mock("./adminDashboard.server", () => ({ readAdminDashboard: mocks.read }));
import { getAdminDashboard } from "./adminDashboard.data.functions";
const invoke = getAdminDashboard as unknown as (input: { context: { supabase: object; userId: string }; data: { brand: "ALL"; days: 30 } }) => Promise<unknown>;
const input = { context: { supabase: {}, userId: "viewer" }, data: { brand: "ALL" as const, days: 30 as const } };
beforeEach(() => vi.resetAllMocks());
describe("autorisation du tableau de bord", () => {
  it("refuse un client ou atelier avant d'ouvrir le client privilégié ou de lire les agrégats", async () => {
    mocks.assertAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(invoke(input)).rejects.toThrow("Forbidden");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("transmet l'identité de l'admin vérifié pour ses propres messages non lus", async () => {
    const privileged = {};
    mocks.assertAdmin.mockResolvedValue(undefined); mocks.admin.mockResolvedValue(privileged); mocks.read.mockResolvedValue({ unreadMessages: 4 });
    expect(await invoke(input)).toEqual({ unreadMessages: 4 });
    expect(mocks.assertAdmin).toHaveBeenCalledWith(input.context.supabase, "viewer");
    expect(mocks.read).toHaveBeenCalledWith(privileged, "viewer", input.data, expect.any(Object));
    expect(mocks.assertAdmin.mock.invocationCallOrder[0]).toBeLessThan(mocks.admin.mock.invocationCallOrder[0]);
  });
});
