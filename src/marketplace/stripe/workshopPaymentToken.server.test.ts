import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openWorkshopPaymentToken, sealWorkshopPaymentToken } from "./workshopPaymentToken.server";

describe("recoverable workshop payment links", () => {
  const token = "a".repeat(64);
  beforeEach(() => vi.stubEnv("WORKSHOP_PAYMENT_LINK_KEY", btoa("t".repeat(32))));
  afterEach(() => vi.unstubAllEnvs());

  it("recovers the same bearer token with a fresh authenticated ciphertext", async () => {
    const first = await sealWorkshopPaymentToken(token, "binder", "payment");
    const second = await sealWorkshopPaymentToken(token, "binder", "payment");
    expect(first).not.toBe(second);
    expect(first).not.toContain(token);
    expect(await openWorkshopPaymentToken(first, "binder", "payment")).toBe(token);
  });

  it("refuses ciphertext moved to another workshop or invoice", async () => {
    const sealed = await sealWorkshopPaymentToken(token, "binder", "payment");
    await expect(openWorkshopPaymentToken(sealed, "other", "payment")).rejects.toThrow();
    await expect(openWorkshopPaymentToken(sealed, "binder", "other")).rejects.toThrow();
  });

  it("rejects tampering and fails closed without the key", async () => {
    const sealed = await sealWorkshopPaymentToken(token, "binder", "payment");
    const parts = sealed.split(".");
    parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
    await expect(openWorkshopPaymentToken(parts.join("."), "binder", "payment")).rejects.toThrow();
    vi.stubEnv("WORKSHOP_PAYMENT_LINK_KEY", "");
    await expect(sealWorkshopPaymentToken(token, "binder", "payment")).rejects.toThrow(
      "workshop_payment_link_key_missing",
    );
  });
});
