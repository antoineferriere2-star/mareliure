import { describe, expect, it, vi } from "vitest";
import {
  ACCESS_LINK_MESSAGES,
  accessCodeErrorMessage,
  accessLinkErrorMessage,
  linkErrorFromUrl,
  requestAccessLink,
  verifyAccessCode,
} from "./accessLink";

describe("requestAccessLink", () => {
  it("asks Supabase for a link that returns to /auth and opens the space on first use", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    await expect(
      requestAccessLink({ signInWithOtp }, "  lecteur@example.test ", "https://mareliure.fr/"),
    ).resolves.toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "lecteur@example.test",
      options: { emailRedirectTo: "https://mareliure.fr/auth", shouldCreateUser: true },
    });
  });

  it("does not call Supabase for something that cannot be an address", async () => {
    const signInWithOtp = vi.fn();
    await expect(
      requestAccessLink({ signInWithOtp }, "lecteur@", "https://mareliure.fr"),
    ).resolves.toEqual({ ok: false, message: ACCESS_LINK_MESSAGES.invalid });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("reports a failure rather than throwing when the request itself fails", async () => {
    const signInWithOtp = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      requestAccessLink({ signInWithOtp }, "lecteur@example.test", "https://mareliure.fr"),
    ).resolves.toEqual({ ok: false, message: ACCESS_LINK_MESSAGES.failed });
  });

  it("passes Supabase's refusal through as a French sentence", async () => {
    const signInWithOtp = vi
      .fn()
      .mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });
    await expect(
      requestAccessLink({ signInWithOtp }, "lecteur@example.test", "https://mareliure.fr"),
    ).resolves.toEqual({ ok: false, message: ACCESS_LINK_MESSAGES.tooSoon });
  });
});

describe("accessLinkErrorMessage", () => {
  it("tells apart what the person can fix from what they cannot", () => {
    expect(accessLinkErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      ACCESS_LINK_MESSAGES.tooSoon,
    );
    expect(accessLinkErrorMessage({ status: 429 })).toBe(ACCESS_LINK_MESSAGES.tooSoon);
    expect(accessLinkErrorMessage({ code: "email_address_invalid", status: 400 })).toBe(
      ACCESS_LINK_MESSAGES.invalid,
    );
    expect(accessLinkErrorMessage({ code: "signup_disabled", status: 422 })).toBe(
      ACCESS_LINK_MESSAGES.unavailable,
    );
    expect(accessLinkErrorMessage({ code: "email_address_not_authorized", status: 400 })).toBe(
      ACCESS_LINK_MESSAGES.unavailable,
    );
    expect(accessLinkErrorMessage({ status: 500 })).toBe(ACCESS_LINK_MESSAGES.failed);
  });

  it("gives the unavailable case a way out", () => {
    expect(ACCESS_LINK_MESSAGES.unavailable).toContain("@");
  });
});

describe("verifyAccessCode", () => {
  it("verifies the same token family as the link, with type email", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    await expect(
      verifyAccessCode({ verifyOtp }, "  lecteur@example.test ", " 12345678 "),
    ).resolves.toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "lecteur@example.test",
      token: "12345678",
      type: "email",
    });
  });

  it("does not call Supabase for something that cannot be a code", async () => {
    const verifyOtp = vi.fn();
    await expect(verifyAccessCode({ verifyOtp }, "lecteur@example.test", "")).resolves.toEqual({
      ok: false,
      message: ACCESS_LINK_MESSAGES.codeMissing,
    });
    await expect(verifyAccessCode({ verifyOtp }, "lecteur@example.test", "abc123")).resolves.toEqual(
      { ok: false, message: ACCESS_LINK_MESSAGES.codeMissing },
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("reports a failure rather than throwing when the request itself fails", async () => {
    const verifyOtp = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      verifyAccessCode({ verifyOtp }, "lecteur@example.test", "12345678"),
    ).resolves.toEqual({ ok: false, message: ACCESS_LINK_MESSAGES.failed });
  });

  it("passes Supabase's refusal through as a French sentence", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    await expect(
      verifyAccessCode({ verifyOtp }, "lecteur@example.test", "12345678"),
    ).resolves.toEqual({ ok: false, message: ACCESS_LINK_MESSAGES.codeInvalid });
  });
});

describe("accessCodeErrorMessage", () => {
  it("tells apart what the person can fix from what they cannot", () => {
    expect(accessCodeErrorMessage({ code: "otp_expired", status: 403 })).toBe(
      ACCESS_LINK_MESSAGES.codeInvalid,
    );
    expect(accessCodeErrorMessage({ status: 401 })).toBe(ACCESS_LINK_MESSAGES.codeInvalid);
    expect(accessCodeErrorMessage({ code: "over_request_rate_limit", status: 429 })).toBe(
      ACCESS_LINK_MESSAGES.tooSoon,
    );
    expect(accessCodeErrorMessage({ status: 500 })).toBe(ACCESS_LINK_MESSAGES.failed);
  });
});

describe("linkErrorFromUrl", () => {
  it("recognises an expired or already used link", () => {
    expect(
      linkErrorFromUrl(
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        "",
      ),
    ).toMatch(/expiré ou a déjà servi/);
  });

  it("recognises an error carried in the query string", () => {
    expect(linkErrorFromUrl("", "?error=server_error&error_code=unexpected_failure")).toMatch(
      /n'a pas pu être utilisé/,
    );
  });

  it("stays silent on an ordinary visit and on a successful sign-in", () => {
    expect(linkErrorFromUrl("", "")).toBeNull();
    expect(linkErrorFromUrl("#access_token=abc&type=magiclink", "?redirect=%2Fmes-livres")).toBeNull();
  });
});
