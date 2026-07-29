import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";

// Never touches the real Lovable API or a real visitor address — this is
// the sole thing under test, and it's mocked in every case below.
const sendTemplateEmailMock = vi.fn();
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: (...args: unknown[]) => sendTemplateEmailMock(...args),
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
};

describe("sendVisitorSummaryEmail", () => {
  beforeEach(() => {
    sendTemplateEmailMock.mockReset();
  });

  it("returns true on a successful send and passes only VisitorProjectSummary fields", async () => {
    sendTemplateEmailMock.mockResolvedValue({ sent: true });
    const result = await sendVisitorSummaryEmail(baseParams);
    expect(result).toBe(true);
    expect(sendTemplateEmailMock).toHaveBeenCalledTimes(1);
    const [templateName, recipient, options] = sendTemplateEmailMock.mock.calls[0] as [
      string,
      string,
      { templateData: Record<string, unknown>; idempotencyKey: string },
    ];
    expect(templateName).toBe("visitor-summary");
    expect(recipient).toBe(baseParams.recipientEmail);
    expect(options.idempotencyKey).toBe(`visitor-summary-${baseParams.dossierId}`);
    expect(Object.keys(options.templateData).sort()).toEqual(
      [
        "budgetAndTimingItems",
        "businessName",
        "calculatedItems",
        "confirmedItems",
        "itemsToConfirm",
        "locale",
        "nextStep",
        "summary",
      ].sort(),
    );
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
