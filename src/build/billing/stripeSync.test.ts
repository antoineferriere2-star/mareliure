import { describe, expect, it } from "vitest";
import { mapLookupKeyToPlan, resolveWorkspaceId } from "./stripeSync";

describe("mapLookupKeyToPlan", () => {
  it("resolves a known lookup_key", () => {
    expect(mapLookupKeyToPlan({ id: "price_1", lookup_key: "growth_monthly" })).toBe("growth");
  });

  it("falls back to metadata.lovable_external_id when lookup_key is missing", () => {
    expect(
      mapLookupKeyToPlan({
        id: "price_1",
        lookup_key: null,
        metadata: { lovable_external_id: "pro_monthly" },
      }),
    ).toBe("pro");
  });

  it("prefers lookup_key over the metadata fallback when both are present", () => {
    expect(
      mapLookupKeyToPlan({
        id: "price_1",
        lookup_key: "business_monthly",
        metadata: { lovable_external_id: "launch_monthly" },
      }),
    ).toBe("business");
  });

  it("returns null instead of guessing when nothing resolves", () => {
    expect(mapLookupKeyToPlan({ id: "price_1", lookup_key: "unknown_lookup_key" })).toBeNull();
    expect(mapLookupKeyToPlan({ id: "price_1" })).toBeNull();
  });
});

describe("resolveWorkspaceId", () => {
  // Fixture shape matches the real payload Lovable verified against the sandbox gateway.
  const subscription = {
    id: "sub_1TxYYY",
    object: "subscription",
    customer: "cus_ZZZ",
    status: "active",
    metadata: { workspace_id: "e3f1c8aa-1111-2222-3333-444455556666" },
    items: {
      object: "list",
      data: [
        {
          price: {
            id: "price_1TxBdYPcf5JMvDdLdmjqf7Nb",
            lookup_key: "growth_monthly",
            metadata: { lovable_external_id: "growth_monthly", lovable_managed: "true" },
          },
        },
      ],
    },
  };

  it("extracts the workspace_id we set at checkout time", () => {
    expect(resolveWorkspaceId(subscription)).toBe("e3f1c8aa-1111-2222-3333-444455556666");
  });

  it("returns null when metadata is missing (never invented)", () => {
    expect(resolveWorkspaceId({})).toBeNull();
  });
});
