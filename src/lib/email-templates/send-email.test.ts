import { beforeEach, describe, expect, it, vi } from "vitest";

// Ni Resend ni Lovable ne sont joints : `fetch` et le client Lovable sont
// remplacés, les clés sont factices et les adresses n'existent pas.
const brand = vi.hoisted(() => ({ isMaReliure: true }));
vi.mock("@/brand", () => ({
  get isMaReliure() {
    return brand.isMaReliure;
  },
}));
const sendLovableEmail = vi.hoisted(() => vi.fn());
vi.mock("@lovable.dev/email-js", () => ({
  sendLovableEmail,
  EmailAPIError: class EmailAPIError extends Error {},
}));

const { MARELIURE_FROM, sendTemplateEmail } = await import("./send-email");

const FAKE_RESEND_KEY = "re_test_not_a_real_key";
const options = {
  templateData: { locale: "fr-FR", businessName: "Ma Reliure", summary: "Un demi-cuir." },
  idempotencyKey: "visitor-summary-11111111",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  sendLovableEmail.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendTemplateEmail on Ma Reliure", () => {
  beforeEach(() => {
    brand.isMaReliure = true;
  });

  it("sends through Resend, from mareliure.fr, with the idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_KEY);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "email_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTemplateEmail("visitor-summary", "lecteur@example.test", options),
    ).resolves.toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${FAKE_RESEND_KEY}`);
    expect(headers["Idempotency-Key"]).toBe(options.idempotencyKey);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.from).toBe(MARELIURE_FROM);
    expect(String(body.from)).toMatch(/@mareliure\.fr>$/);
    expect(body.to).toEqual(["lecteur@example.test"]);
    expect(body.subject).toBe("Le récapitulatif de votre projet — Ma Reliure");
    expect(body.tags).toEqual([{ name: "template", value: "visitor-summary" }]);
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });

  it("refuses to send without RESEND_API_KEY, and never falls back to Lovable", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("LOVABLE_API_KEY", "lovable_test_not_a_real_key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTemplateEmail("visitor-summary", "lecteur@example.test", options),
    ).rejects.toThrow("RESEND_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });

  it("surfaces a Resend refusal without echoing the key", async () => {
    vi.stubEnv("RESEND_API_KEY", FAKE_RESEND_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          name: "validation_error",
          message: "The mareliure.fr domain is not verified.",
        }),
      ),
    );

    const error = await sendTemplateEmail("visitor-summary", "lecteur@example.test", options).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("403");
    expect((error as Error).message).toContain("not verified");
    expect((error as Error).message).not.toContain(FAKE_RESEND_KEY);
  });
});

describe("sendTemplateEmail on Métré Build", () => {
  it("keeps sending through Lovable, from its own domain", async () => {
    brand.isMaReliure = false;
    vi.stubEnv("LOVABLE_API_KEY", "lovable_test_not_a_real_key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    sendLovableEmail.mockResolvedValue(undefined);

    await expect(
      sendTemplateEmail("visitor-summary", "visitor@example.test", options),
    ).resolves.toEqual({ sent: true });
    expect(sendLovableEmail).toHaveBeenCalledTimes(1);
    const [message] = sendLovableEmail.mock.calls[0] as [{ from: string }];
    expect(message.from).toContain("@notify.metre-pro.fr");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
