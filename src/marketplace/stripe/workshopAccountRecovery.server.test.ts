import { beforeEach, describe, expect, it, vi } from "vitest";
import { findWorkshopCustomerAccount } from "./workshopAccountRecovery.server";
const h = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("./stripeClient.server", () => ({
  getMarketplaceStripeClient: () => ({ v2: { core: { accounts: { list: h.list } } } }),
}));
type Account = { id: string; metadata: Record<string, string> };
let accounts: Account[];
beforeEach(() => {
  accounts = [];
  h.list.mockImplementation(({ limit }: { limit: number }) => {
    if (limit > 20) throw Error("Limit cannot be greater than 20");
    return (async function* () {
      for (const account of accounts) yield account;
    })();
  });
});
describe("account-create response recovery", () => {
  it("does not adopt another workshop's customer", async () => {
    accounts = [{ id: "acct_other", metadata: { binder_id: "other" } }];
    expect(await findWorkshopCustomerAccount("owner")).toBeNull();
  });
  it("finds the account after iterating earlier results with the permitted v2 page size", async () => {
    accounts = Array.from({ length: 25 }, (_, i) => ({
      id: `acct_${i}`,
      metadata: { binder_id: "other" },
    }));
    accounts.push({ id: "acct_recovered", metadata: { binder_id: "owner" } });
    expect(await findWorkshopCustomerAccount("owner")).toBe("acct_recovered");
  });
  it("refuses ambiguous recovery when two accounts claim the same workshop", async () => {
    accounts = ["acct_first", "acct_second"].map((id) => ({
      id,
      metadata: { binder_id: "owner" },
    }));
    await expect(findWorkshopCustomerAccount("owner")).rejects.toThrow(
      "workshop_accounts_require_reconciliation",
    );
  });
});
