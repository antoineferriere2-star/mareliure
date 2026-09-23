import { describe, expect, it } from "vitest";
import { ManualElectronicInvoiceProvider } from "./electronicInvoiceProvider";

describe("ManualElectronicInvoiceProvider", () => {
  it("ne transmet rien et garde des statuts explicites", async () => {
    const provider = new ManualElectronicInvoiceProvider();
    const reference = await provider.sendInvoice("invoice-1");
    expect(reference).toEqual({ invoiceId: "invoice-1", providerInvoiceId: null, status: "not_sent" });
    await expect(provider.getInvoiceStatus(reference)).resolves.toBe("not_sent");
    await expect(provider.reportTransaction("invoice-1")).resolves.toBe("pending");
    await expect(provider.reportPayment("invoice-1", 12000, "2026-09-23")).resolves.toBe("pending");
  });
});
