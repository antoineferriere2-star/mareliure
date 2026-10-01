import { describe, expect, it } from "vitest";
import { creditedByInvoice, invoiceListStatus } from "./quoteViews";
import { awaitsPayment, isPaymentOverdue } from "@/marketplace/binders/todayAgenda";

// Audit #53, C3 : une facture neutralisée par un avoir n'est ni « non payée » ni « en retard ».
const issued = (payment_status: string) => ({ status: "issued", payment_status, total_ttc_cents: 10000 });
const agenda = (status: string) => ({ id: "i", number: "F-1", status, issueDate: "2026-09-01", dueDate: "2026-09-15", clientName: "QA", bookTitle: null, totalTtcCents: 10000, currency: "EUR" });

describe("statut affiché d'une facture couverte par un avoir", () => {
  it("neutralise une facture intégralement couverte, quel que soit le règlement déclaré", () => {
    for (const payment of ["unpaid", "partial", "paid", "deposit_paid"]) expect(invoiceListStatus(issued(payment), 10000)).toBe("credited");
    expect(awaitsPayment(agenda("credited") as never)).toBe(false);
    expect(isPaymentOverdue(agenda("credited") as never, "2026-10-01")).toBe(false);
  });
  it("n'assimile jamais un avoir partiel à un paiement", () => {
    expect(invoiceListStatus(issued("unpaid"), 4000)).toBe("unpaid");
    expect(invoiceListStatus(issued("partial"), 9999)).toBe("partial");
    expect(isPaymentOverdue(agenda("unpaid") as never, "2026-10-01")).toBe(true);
  });
  it("laisse un brouillon et une facture sans avoir inchangés", () => {
    expect(invoiceListStatus({ status: "draft", payment_status: "unpaid", total_ttc_cents: 10000 }, 10000)).toBe("draft");
    expect(invoiceListStatus(issued("paid"))).toBe("paid");
  });
  it("cumule les avoirs d'une même facture", () => {
    const totals = creditedByInvoice([{ invoice_id: "a", total_ttc_cents: 4000 }, { invoice_id: "a", total_ttc_cents: 6000 }, { invoice_id: "b", total_ttc_cents: 1 }]);
    expect(invoiceListStatus(issued("unpaid"), totals.get("a"))).toBe("credited");
    expect(invoiceListStatus(issued("unpaid"), totals.get("b"))).toBe("unpaid");
  });
});
