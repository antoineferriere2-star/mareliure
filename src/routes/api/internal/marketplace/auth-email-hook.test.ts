import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

// La décision (marque, gabarit) est testée dans authEmailHook.server.test.ts —
// cette suite ne couvre que ce que ce fichier ajoute : vérifier la signature
// et traduire le résultat en réponse HTTP.
const parseSendEmailHookPayload = vi.fn();
const handleSendEmailHook = vi.fn();
vi.mock("@/marketplace/auth/authEmailHook.server", () => ({
  parseSendEmailHookPayload: (...args: unknown[]) => parseSendEmailHookPayload(...args),
  handleSendEmailHook: (...args: unknown[]) => handleSendEmailHook(...args),
}));

const { handleAuthEmailHook } = await import("./auth-email-hook");

const SECRET_BASE64 = "MfKQ9r8GKYqrTwjUPD8ILPnrLIF63FaK4Yeg6oyTx3W2sD1uNqNsBP1cSNlAaVGP";
const SECRET = `v1,whsec_${SECRET_BASE64}`;
const RAW_BODY = JSON.stringify({
  user: { email: "visitor@example.test" },
  email_data: {
    token: "12345678",
    token_hash: "pkce_abcdef",
    redirect_to: "https://mareliure.fr/auth",
    email_action_type: "magiclink",
  },
});

function signedHeaders(body: string, secret: string = SECRET) {
  const webhook = new Webhook(secret.replace(/^v1,/, ""));
  const id = "msg_test";
  const timestamp = new Date();
  const signature = webhook.sign(id, timestamp, body);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature,
  };
}

function request(body: string, headers: Record<string, string>) {
  return new Request("https://mareliure.fr/api/internal/marketplace/auth-email-hook", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  parseSendEmailHookPayload.mockReset();
  handleSendEmailHook.mockReset();
  vi.stubEnv("SEND_EMAIL_HOOK_SECRET", SECRET);
  vi.stubEnv("SUPABASE_URL", "https://hljxohondjvrkzqicexl.supabase.co");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("handleAuthEmailHook", () => {
  it("refuse tout de suite si le secret ou l'URL Supabase manquent — jamais un envoi non authentifié", async () => {
    vi.stubEnv("SEND_EMAIL_HOOK_SECRET", "");
    const response = await handleAuthEmailHook(request(RAW_BODY, signedHeaders(RAW_BODY)));
    expect(response.status).toBe(500);
    expect(handleSendEmailHook).not.toHaveBeenCalled();
  });

  it("refuse une signature invalide", async () => {
    const response = await handleAuthEmailHook(
      request(RAW_BODY, signedHeaders(RAW_BODY, "v1,whsec_" + "a".repeat(64))),
    );
    expect(response.status).toBe(401);
    expect(handleSendEmailHook).not.toHaveBeenCalled();
  });

  it("refuse un corps modifié après signature", async () => {
    const headers = signedHeaders(RAW_BODY);
    const response = await handleAuthEmailHook(request(RAW_BODY + "x", headers));
    expect(response.status).toBe(401);
  });

  it("refuse une charge utile dont la forme est inattendue", async () => {
    parseSendEmailHookPayload.mockReturnValue(null);
    const response = await handleAuthEmailHook(request(RAW_BODY, signedHeaders(RAW_BODY)));
    expect(response.status).toBe(400);
    expect(handleSendEmailHook).not.toHaveBeenCalled();
  });

  it("répond 200, corps vide, quand l'envoi réussit", async () => {
    const parsed = { user: { email: "x" }, email_data: { email_action_type: "magiclink" } };
    parseSendEmailHookPayload.mockReturnValue(parsed);
    handleSendEmailHook.mockResolvedValue(undefined);
    const response = await handleAuthEmailHook(request(RAW_BODY, signedHeaders(RAW_BODY)));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(handleSendEmailHook).toHaveBeenCalledWith(parsed, "https://hljxohondjvrkzqicexl.supabase.co");
  });

  it("répond 500 sans jeter quand l'envoi échoue — Supabase doit voir un échec, pas un succès muet", async () => {
    parseSendEmailHookPayload.mockReturnValue({
      user: { email: "x" },
      email_data: { email_action_type: "magiclink" },
    });
    handleSendEmailHook.mockRejectedValue(new Error("Resend a refusé l'envoi"));
    const response = await handleAuthEmailHook(request(RAW_BODY, signedHeaders(RAW_BODY)));
    expect(response.status).toBe(500);
  });
});
