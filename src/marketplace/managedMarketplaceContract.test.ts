import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const service = read("src/marketplace/services/marketplace.data.functions.ts");
const pricing = [
  read("src/marketplace/pricing/pricing.types.ts"),
  read("src/marketplace/pricing/pricing.rules.ts"),
  read("src/marketplace/pricing/pricing.engine.ts"),
].join("\n");
const customerStart = service.indexOf("// Customer — their own books");
const customerCaseEnd = service.indexOf("export const claimMarketplaceCase");
const customerSurface = service.slice(customerStart, customerCaseEnd);

describe("managed marketplace boundaries", () => {
  it("has no active workshop-priced quote write or customer quote selection", () => {
    expect(service).not.toContain("submitBinderQuote");
    expect(service).not.toContain("selectQuote");
    expect(service).toContain('from("marketplace_quotes").insert');
    expect(service).toContain("customer_price_cents");
    expect(service).toContain("binder_payout_cents");
  });

  it("does not use visitor budget or Project Brief prose in pricing", () => {
    expect(pricing).not.toContain("budgetMinCents");
    expect(pricing).not.toContain("budgetMaxCents");
    expect(pricing).not.toContain("ProjectBrief");
    expect(pricing).not.toMatch(/\.brief\b/);
  });

  it("never returns payout, margin or pricing reasons from the customer case path", () => {
    expect(customerSurface).not.toContain("binder_payout_cents");
    expect(customerSurface).not.toContain("marginCents");
    expect(customerSurface).not.toContain("pricing_reason_codes");
  });

  it("uses marketplace_quotes as the managed offer source", () => {
    expect(service).toContain('from("marketplace_quotes")');
    expect(service).toContain('state: "offered"');
    expect(service).toContain("offers: offers ?? []");
  });
});
