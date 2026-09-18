import { describe, expect, it, vi, beforeEach } from "vitest";

// Same discipline as visitorSummaryEmail.server.test.ts: never touches a real
// email provider — sendTemplateEmail is the sole thing under test here.
const sendTemplateEmailMock = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: unknown[]) => sendTemplateEmailMock(...args),
}));

const {
  buildVerifyUrl,
  handleSendEmailHook,
  parseSendEmailHookPayload,
  resolveHookBrand,
} = await import("./authEmailHook.server");

function payload(overrides: {
  email?: string;
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type?: string;
}) {
  return {
    user: { email: overrides.email ?? "visitor@example.test" },
    email_data: {
      token: overrides.token ?? "12345678",
      token_hash: overrides.token_hash ?? "pkce_abcdef",
      redirect_to: overrides.redirect_to ?? "https://mareliure.fr/auth",
      email_action_type: overrides.email_action_type ?? "magiclink",
    },
  };
}

describe("resolveHookBrand", () => {
  it("reconnaît Fine Bindery, avec ou sans www", () => {
    expect(resolveHookBrand("https://finebindery.com/auth")).toBe("FINE_BINDERY");
    expect(resolveHookBrand("https://www.finebindery.com/auth")).toBe("FINE_BINDERY");
  });

  it("reconnaît Ma Reliure", () => {
    expect(resolveHookBrand("https://mareliure.fr/auth")).toBe("MA_RELIURE");
    expect(resolveHookBrand("https://www.mareliure.fr/auth")).toBe("MA_RELIURE");
  });

  it("retombe sur Ma Reliure pour un hôte inconnu — jamais Fine Bindery par défaut (§57)", () => {
    expect(resolveHookBrand("https://mareliure.aferriere.workers.dev/auth")).toBe("MA_RELIURE");
    expect(resolveHookBrand("http://localhost:8080/auth")).toBe("MA_RELIURE");
  });

  it("retombe sur Ma Reliure plutôt que de jeter, pour une URL malformée", () => {
    expect(resolveHookBrand("not a url")).toBe("MA_RELIURE");
  });
});

describe("buildVerifyUrl", () => {
  it("pointe vers le point de vérification du projet Supabase, jamais un chemin de l'application", () => {
    const url = buildVerifyUrl(
      payload({ token_hash: "pkce_xyz", email_action_type: "magiclink", redirect_to: "https://finebindery.com/auth" }),
      "https://hljxohondjvrkzqicexl.supabase.co",
    );
    expect(url).toBe(
      "https://hljxohondjvrkzqicexl.supabase.co/auth/v1/verify?token=pkce_xyz&type=magiclink&redirect_to=https%3A%2F%2Ffinebindery.com%2Fauth",
    );
  });

  it("tolère un slash final sur l'URL du projet", () => {
    const url = buildVerifyUrl(payload({}), "https://hljxohondjvrkzqicexl.supabase.co/");
    expect(url.startsWith("https://hljxohondjvrkzqicexl.supabase.co/auth/v1/verify?")).toBe(true);
  });
});

describe("parseSendEmailHookPayload", () => {
  it("accepte la forme attendue", () => {
    expect(parseSendEmailHookPayload(payload({}))).not.toBeNull();
  });

  it("refuse une forme inattendue plutôt que de jeter", () => {
    expect(parseSendEmailHookPayload({})).toBeNull();
    expect(parseSendEmailHookPayload(null)).toBeNull();
    expect(parseSendEmailHookPayload({ user: {}, email_data: {} })).toBeNull();
  });
});

describe("handleSendEmailHook", () => {
  const SUPABASE_URL = "https://hljxohondjvrkzqicexl.supabase.co";

  beforeEach(() => {
    sendTemplateEmailMock.mockReset();
    sendTemplateEmailMock.mockResolvedValue({ sent: true });
  });

  it("un lien client Fine Bindery part en anglais, signé Fine Bindery", async () => {
    await handleSendEmailHook(
      payload({ redirect_to: "https://finebindery.com/auth", email_action_type: "magiclink" }),
      SUPABASE_URL,
    );
    expect(sendTemplateEmailMock).toHaveBeenCalledTimes(1);
    const [templateName, to, options] = sendTemplateEmailMock.mock.calls[0];
    expect(templateName).toBe("auth-magic-link");
    expect(to).toBe("visitor@example.test");
    expect(options.templateData.brandName).toBe("Fine Bindery");
    expect(options.templateData.locale).toBe("en-US");
    expect(options.templateData.confirmationUrl).toContain(`${SUPABASE_URL}/auth/v1/verify?`);
    expect(options.templateData.code).toBe("12345678");
  });

  it("un lien client Ma Reliure part en français, signé Ma Reliure", async () => {
    await handleSendEmailHook(
      payload({ redirect_to: "https://mareliure.fr/auth", email_action_type: "magiclink" }),
      SUPABASE_URL,
    );
    const [templateName, , options] = sendTemplateEmailMock.mock.calls[0];
    expect(templateName).toBe("auth-magic-link");
    expect(options.templateData.brandName).toBe("Ma Reliure");
    expect(options.templateData.locale).toBe("fr-FR");
  });

  it("une inscription atelier (mot de passe) part sur le gabarit de confirmation, jamais celui du lien client", async () => {
    await handleSendEmailHook(payload({ email_action_type: "signup" }), SUPABASE_URL);
    const [templateName, , options] = sendTemplateEmailMock.mock.calls[0];
    expect(templateName).toBe("auth-signup-confirmation");
    expect(options.templateData.code).toBe("12345678");
    expect(options.templateData.brandName).toBeUndefined();
  });

  it("chaque envoi est idempotent par jeton — jamais deux e-mails pour un même token_hash", async () => {
    await handleSendEmailHook(payload({ token_hash: "same-token" }), SUPABASE_URL);
    const [, , options] = sendTemplateEmailMock.mock.calls[0];
    expect(options.idempotencyKey).toContain("same-token");
  });

  it("un type d'action imprévu obtient quand même un e-mail fonctionnel plutôt qu'un échec silencieux", async () => {
    await handleSendEmailHook(payload({ email_action_type: "recovery" }), SUPABASE_URL);
    expect(sendTemplateEmailMock).toHaveBeenCalledTimes(1);
    const [templateName] = sendTemplateEmailMock.mock.calls[0];
    expect(templateName).toBe("auth-magic-link");
  });
});
