export type StructuredInvoiceFormat = "factur-x" | "ubl" | "cii" | null;
export type ElectronicInvoiceStatus = "not_sent" | "pending" | "accepted" | "rejected" | "failed";
export type TransactionReportingStatus = "not_required" | "pending" | "reported" | "failed";

export interface ElectronicInvoiceReference {
  invoiceId: string;
  providerInvoiceId: string | null;
  status: ElectronicInvoiceStatus;
}

export interface ElectronicInvoiceProvider {
  readonly id: string;
  sendInvoice(invoiceId: string): Promise<ElectronicInvoiceReference>;
  getInvoiceStatus(reference: ElectronicInvoiceReference): Promise<ElectronicInvoiceStatus>;
  reportTransaction(invoiceId: string): Promise<TransactionReportingStatus>;
  reportPayment(invoiceId: string, amountCents: number, paidAt: string): Promise<TransactionReportingStatus>;
}

/** Provider explicite d'attente : il ne transmet aucune donnée hors de Ma Reliure. */
export class ManualElectronicInvoiceProvider implements ElectronicInvoiceProvider {
  readonly id = "manual";

  async sendInvoice(invoiceId: string): Promise<ElectronicInvoiceReference> {
    return { invoiceId, providerInvoiceId: null, status: "not_sent" };
  }

  async getInvoiceStatus(): Promise<ElectronicInvoiceStatus> {
    return "not_sent";
  }

  async reportTransaction(): Promise<TransactionReportingStatus> {
    return "pending";
  }

  async reportPayment(): Promise<TransactionReportingStatus> {
    return "pending";
  }
}

