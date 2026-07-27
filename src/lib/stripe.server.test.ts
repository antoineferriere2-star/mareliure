import { describe, expect, it } from "vitest";
import { parseStripeEnv } from "./stripe.server";

describe("parseStripeEnv", () => {
  it("accepts only sandbox and live", () => {
    expect(parseStripeEnv("sandbox")).toBe("sandbox");
    expect(parseStripeEnv("live")).toBe("live");
  });

  it("rejects missing or unknown webhook environments", () => {
    expect(parseStripeEnv(null)).toBeNull();
    expect(parseStripeEnv("production")).toBeNull();
    expect(parseStripeEnv("")).toBeNull();
  });
});
