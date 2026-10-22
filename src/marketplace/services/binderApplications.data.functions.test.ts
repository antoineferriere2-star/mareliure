import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), insert: vi.fn(), email: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (input: unknown) => unknown = (input) => input;
    const chain = {
      middleware: () => chain,
      validator: (fn: typeof validate) => {
        validate = fn;
        return chain;
      },
      handler: (fn: (input: { data: unknown }) => Promise<unknown>) => (input: { data: unknown }) =>
        fn({ data: validate(input.data) }),
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: mocks.admin, assertAdmin: vi.fn() }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: mocks.email }));
import { submitBinderApplication } from "./binderApplications.data.functions";
const invoke = submitBinderApplication as unknown as (input: {
  data: unknown;
}) => Promise<{ ok: boolean; fieldErrors?: Record<string, string> }>;
const valid = {
  firstName: "Camille",
  lastName: "QA",
  workshopName: "Atelier local",
  email: "QA@example.invalid",
  consent: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ from: () => ({ insert: mocks.insert }) });
  mocks.insert.mockResolvedValue({ error: null });
});
describe("refus public avant tout accès privilégié ou notification", () => {
  it.each([
    { ...valid, email: "pas-un-email" },
    { ...valid, consent: false },
    { ...valid, yearsExperience: 2.5 },
    { ...valid, websiteUrl: "atelier.fr" },
  ])("refuse une candidature mal renseignée sans effet de bord", async (data) => {
    expect((await invoke({ data })).ok).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("préserve le faux succès anti-robot sans écriture ni e-mail", async () => {
    expect(await invoke({ data: { ...valid, hpCompanyName: "bot" } })).toEqual({ ok: true });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("le succès réel est testé avec base et e-mail simulés ; aucun consentement inventé en base", async () => {
    expect(await invoke({ data: valid })).toEqual({ ok: true });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "qa@example.invalid", city: null, phone: null }),
    );
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("consent");
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
});
