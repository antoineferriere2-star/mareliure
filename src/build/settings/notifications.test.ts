import { describe, expect, it } from "vitest";
import {
  BRIEF_NOTIFICATION_LABEL,
  BRIEF_NOTIFICATION_MODES,
  DEFAULT_BRIEF_NOTIFICATION,
  recipientsFor,
  toBriefNotificationMode,
} from "./notifications";

const members = [
  { email: "owner@acme.com", role: "owner" },
  { email: "rep@acme.com", role: "member" },
  { email: "sub@contractor.com", role: "member" },
];

describe("who gets the new-brief email", () => {
  it("emails everyone by default, exactly as before the setting existed", () => {
    // The migration defaults to this. An existing workspace must notice
    // nothing until someone chooses otherwise.
    expect(DEFAULT_BRIEF_NOTIFICATION).toBe("all_members");
    expect(recipientsFor(members, "all_members")).toEqual([
      "owner@acme.com",
      "rep@acme.com",
      "sub@contractor.com",
    ]);
  });

  it("can be narrowed to owners", () => {
    // The uncomfortable case: a subcontractor was being emailed every
    // customer's name, address and budget.
    expect(recipientsFor(members, "owners_only")).toEqual(["owner@acme.com"]);
  });

  it("can be turned off entirely", () => {
    // A real choice, not an accident — some businesses watch the portal.
    expect(recipientsFor(members, "off")).toEqual([]);
  });

  it("drops blank addresses and duplicates", () => {
    const messy = [
      { email: "a@b.com", role: "owner" },
      { email: "  a@b.com  ", role: "member" },
      { email: "", role: "member" },
      { email: null, role: "member" },
    ];
    expect(recipientsFor(messy, "all_members")).toEqual(["a@b.com"]);
  });
});

describe("reading the stored value", () => {
  it("accepts the three modes", () => {
    for (const mode of BRIEF_NOTIFICATION_MODES) {
      expect(toBriefNotificationMode(mode)).toBe(mode);
    }
  });

  it("falls back to notifying, never to silence", () => {
    // A bad value must not quietly stop a business hearing about its own
    // customers. Failing towards noise is recoverable; failing towards silence
    // is not noticed until a lead is lost.
    for (const value of [null, undefined, "", "OFF", "nobody", "owners"]) {
      expect(toBriefNotificationMode(value)).toBe("all_members");
    }
  });

  it("has a label for every mode", () => {
    for (const mode of BRIEF_NOTIFICATION_MODES) {
      expect(BRIEF_NOTIFICATION_LABEL[mode]).toBeTruthy();
    }
  });
});
