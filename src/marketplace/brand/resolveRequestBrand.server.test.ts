import { describe, expect, it } from "vitest";
import { resolveMarketplaceBrandForRequest } from "./resolveRequestBrand.server";

describe("resolveMarketplaceBrandForRequest", () => {
  it("resolves from the Host header when there is no override", () => {
    expect(resolveMarketplaceBrandForRequest("finebindery.com", null)).toBe("FINE_BINDERY");
    expect(resolveMarketplaceBrandForRequest("mareliure.fr", undefined)).toBe("MA_RELIURE");
  });

  it("lets an explicit dev override win over the Host header — the §4 escape hatch", () => {
    expect(resolveMarketplaceBrandForRequest("mareliure.fr", "FINE_BINDERY")).toBe("FINE_BINDERY");
    expect(resolveMarketplaceBrandForRequest("localhost:8080", "FINE_BINDERY")).toBe(
      "FINE_BINDERY",
    );
  });

  it("ignores a malformed override rather than trusting it — falls back to the Host", () => {
    expect(resolveMarketplaceBrandForRequest("finebindery.com", "not-a-brand")).toBe(
      "FINE_BINDERY",
    );
  });

  it("fails safe on a host that matches no brand, override absent", () => {
    expect(resolveMarketplaceBrandForRequest("localhost:8080", null)).toBe("MA_RELIURE");
  });
});
