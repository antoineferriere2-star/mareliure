import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";

// Never touches a real email provider or a real visitor address — this is
// the sole thing under test, and it's mocked in every case below.
const sendTemplateEmailMock = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: unknown[]) => sendTemplateEmailMock(...args),
}));
const brand = vi.hoisted(() => ({ isMaReliure: false }));
vi.mock("@/brand", () => ({
  get isMaReliure() {
    return brand.isMaReliure;
  },
}));

const { sendVisitorSummaryEmail } = await import("./visitorSummaryEmail.server");

const summary: VisitorProjectSummary = {
  version: 1,
  locale: "en-US",
  measurementSystem: "imperial",
  businessName: "Sanibel Decks",
  summary: "New composite deck.",
  confirmedItems: [],
  calculatedItems: [],
  itemsToConfirm: [],
  budgetAndTimingItems: [],
  photos: [],
  confirmationText: "Thanks!",
  submittedAt: "2026-07-29T00:00:00.000Z",
};

const baseParams = {
  dossierId: "11111111-1111-1111-1111-111111111111",
  workspaceId: "22222222-2222-2222-2222-222222222222",
  missionId: "33333333-3333-3333-3333-333333333333",
  recipientEmail: "not-a-real-address@example.test",
  summary,
  summaryUrl: "https://metre-pro.com/project-summary/deadbeef",
};

const SUMMARY_FIELDS = [
  "budgetAndTimingItems",
  "businessName",
  "calculatedItems",
  "confirmedItems",
  "itemsToConfirm",
  "locale",
  "nextStep",
  "summary",
  "summaryUrl",
];

type SendCall = [string, string, { templateData: Record<string, unknown>; idempotencyKey: string }];

describe("sendVisitorSummaryEmail", () => {
  beforeEach(() => {
    sendTemplateEmailMock.mockReset();
    brand.isMaReliure = false;
  });

  it("returns true on a successful send and passes only VisitorProjectSummary fields and the brand", async () => {
    sendTemplateEmailMock.mockResolvedValue({ sent: true });
    const result = await sendVisitorSummaryEmail(baseParams);
    expect(result).toBe(true);
    expect(sendTemplateEmailMock).toHaveBeenCalledTimes(1);
    const [templateName, recipient, options] = sendTemplateEmailMock.mock.calls[0] as SendCall;
    expect(templateName).toBe("visitor-summary");
    expect(recipient).toBe(baseParams.recipientEmail);
    expect(options.idempotencyKey).toBe(`visitor-summary-${baseParams.dossierId}`);
    expect(Object.keys(options.templateData).sort()).toEqual(
      [...SUMMARY_FIELDS, "brandName", "accentColor"].sort(),
    );
    expect(options.templateData.brandName).toBe("Métré Build");
  });

  it("on Ma Reliure, signs as Ma Reliure and points to the customer space on mareliure.fr", async () => {
    brand.isMaReliure = true;
    sendTemplateEmailMock.mockResolvedValue({ sent: true });
    await sendVisitorSummaryEmail(baseParams);
    const [, , options] = sendTemplateEmailMock.mock.calls[0] as SendCall;
    expect(Object.keys(options.templateData).sort()).toEqual(
      [...SUMMARY_FIELDS, "brandName", "accentColor", "trackUrl"].sort(),
    );
    expect(options.templateData.brandName).toBe("Ma Reliure");
    expect(options.templateData.trackUrl).toBe("https://mareliure.fr/mes-livres");
  });

  it("never throws when the send fails, and reports false", async () => {
    sendTemplateEmailMock.mockRejectedValue(new Error("network down"));
    await expect(sendVisitorSummaryEmail(baseParams)).resolves.toBe(false);
  });

  it("reports false, without throwing, when the recipient is suppressed", async () => {
    sendTemplateEmailMock.mockResolvedValue({ sent: false, reason: "recipient_suppressed" });
    await expect(sendVisitorSummaryEmail(baseParams)).resolves.toBe(false);
  });
});
