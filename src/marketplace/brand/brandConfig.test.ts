import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKETPLACE_BRAND,
  MARKETPLACE_BRAND_CONFIGS,
  canonicalHome,
  resolveMarketplaceBrandForHostname,
} from "./brandConfig";

describe("resolveMarketplaceBrandForHostname — §57", () => {
  it("recognises mareliure.fr and its www subdomain", () => {
    expect(resolveMarketplaceBrandForHostname("mareliure.fr")).toBe("MA_RELIURE");
    expect(resolveMarketplaceBrandForHostname("www.mareliure.fr")).toBe("MA_RELIURE");
  });

  it("recognises finebindery.com and its www subdomain", () => {
    expect(resolveMarketplaceBrandForHostname("finebindery.com")).toBe("FINE_BINDERY");
    expect(resolveMarketplaceBrandForHostname("www.finebindery.com")).toBe("FINE_BINDERY");
  });

  it("is case-insensitive", () => {
    expect(resolveMarketplaceBrandForHostname("FineBindery.COM")).toBe("FINE_BINDERY");
    expect(resolveMarketplaceBrandForHostname("MARELIURE.FR")).toBe("MA_RELIURE");
  });

  it("strips a port before matching", () => {
    expect(resolveMarketplaceBrandForHostname("finebindery.com:443")).toBe("FINE_BINDERY");
  });

  it("fails safe to Ma Reliure on an unknown host — never leaks Fine Bindery", () => {
    expect(resolveMarketplaceBrandForHostname("some-preview.workers.dev")).toBe(
      DEFAULT_MARKETPLACE_BRAND,
    );
    expect(resolveMarketplaceBrandForHostname("some-preview.workers.dev")).toBe("MA_RELIURE");
    expect(resolveMarketplaceBrandForHostname(null)).toBe("MA_RELIURE");
    expect(resolveMarketplaceBrandForHostname(undefined)).toBe("MA_RELIURE");
    expect(resolveMarketplaceBrandForHostname("")).toBe("MA_RELIURE");
  });

  it("never resolves one brand's hostname to the other", () => {
    expect(resolveMarketplaceBrandForHostname("mareliure.fr")).not.toBe("FINE_BINDERY");
    expect(resolveMarketplaceBrandForHostname("finebindery.com")).not.toBe("MA_RELIURE");
  });
});

describe("MARKETPLACE_BRAND_CONFIGS — la politique par marque", () => {
  it("gives Ma Reliure the identity multiplier and its own single-thread messaging", () => {
    const config = MARKETPLACE_BRAND_CONFIGS.MA_RELIURE;
    expect(config.pricingPolicy.serviceMultiplierBps).toBe(10_000);
    expect(config.messaging.customerWorkshopDirectMessaging).toBe(true);
    expect(config.conciergeRequired).toBe(false);
    expect(config.international).toBe(false);
    expect(config.defaultLocale).toBe("fr-FR");
  });

  it("gives Fine Bindery the +30% multiplier, no direct messaging, and a concierge", () => {
    const config = MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY;
    expect(config.pricingPolicy.serviceMultiplierBps).toBe(13_000);
    expect(config.messaging.customerWorkshopDirectMessaging).toBe(false);
    expect(config.conciergeRequired).toBe(true);
    expect(config.international).toBe(true);
    expect(config.defaultLocale).toBe("en-US");
  });

  it("does not publish a minimum international price without admin validation (§15)", () => {
    expect(MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.pricingPolicy.minimumServicePriceCents).toBeNull();
  });

  it("keeps each brand's canonical origin distinct — no cross-brand canonical (§35)", () => {
    expect(canonicalHome("MA_RELIURE")).toBe("https://mareliure.fr/");
    expect(canonicalHome("FINE_BINDERY")).toBe("https://finebindery.com/");
  });
});
