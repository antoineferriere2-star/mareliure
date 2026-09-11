import { describe, expect, it, vi } from "vitest";
import { ResendEmailError, sendResendEmail } from "./resend";

const message = {
  from: "Ma Reliure <noreply@mareliure.fr>",
  to: "lecteur@example.test",
  subject: "Sujet",
  html: "<p>Corps</p>",
  text: "Corps",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe("sendResendEmail", () => {
  it("returns the id Resend assigns", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "email_42" }));
    await expect(sendResendEmail(message, { apiKey: "re_fake", fetchImpl })).resolves.toEqual({
      id: "email_42",
    });
  });

  it("sends no idempotency header, reply-to or tag it was not given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: "email_1" }));
    await sendResendEmail({ ...message, tag: "pas une étiquette" }, { apiKey: "re_fake", fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Idempotency-Key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("reply_to");
    expect(body).not.toHaveProperty("tags");
  });

  it("throws a typed error carrying Resend's status and code", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { name: "rate_limit_exceeded", message: "Too many" }));
    const error = await sendResendEmail(message, { apiKey: "re_fake", fetchImpl }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ResendEmailError);
    expect((error as ResendEmailError).status).toBe(429);
    expect((error as ResendEmailError).code).toBe("rate_limit_exceeded");
  });

  it("still throws when the refusal has no readable body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(sendResendEmail(message, { apiKey: "re_fake", fetchImpl })).rejects.toThrow(
      "Resend a refusé l'envoi (502)",
    );
  });
});
