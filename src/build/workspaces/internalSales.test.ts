import { describe, expect, it } from "vitest";
import {
  aiRunsPerHourFor,
  INTERNAL_SALES,
  INTERNAL_SALES_AI_RUNS_PER_HOUR,
  isInternalSales,
  isProspectStatus,
  PROSPECT_STATUSES,
  prospectDisplayName,
  prospectDomain,
  WORKSPACE_TYPES,
} from "./internalSales";

describe("telling an internal workspace from a customer's", () => {
  it("recognises exactly the internal_sales type", () => {
    expect(isInternalSales(INTERNAL_SALES)).toBe(true);
    expect(isInternalSales("client")).toBe(false);
  });

  it.each([null, undefined, "", "internal", "Internal_Sales", "sales", "internal_sales "])(
    "treats %p as a customer, never as internal",
    (value) => {
      // The whole point of the predicate: an unknown or malformed value must
      // fall on the *billed* side. Failing the other way would hand a paying
      // customer an unbilled account with no Stripe surface.
      expect(isInternalSales(value)).toBe(false);
    },
  );

  it("keeps client as the type a new workspace gets", () => {
    // Mirrors the column default. A workspace nobody classified is a customer.
    expect(WORKSPACE_TYPES[0]).toBe("client");
  });
});

describe("AI budget", () => {
  it("raises the hourly ceiling only for an internal workspace", () => {
    // A customer analyses their own site once; an agent analyses one site per
    // prospect, and the customer ceiling would stop the work mid-list.
    expect(aiRunsPerHourFor(INTERNAL_SALES, 8)).toBe(INTERNAL_SALES_AI_RUNS_PER_HOUR);
    expect(aiRunsPerHourFor("client", 8)).toBe(8);
    expect(aiRunsPerHourFor(null, 8)).toBe(8);
  });

  it("stays a real ceiling", () => {
    // Raised, not removed: every run costs an AI call and fetches a
    // third-party website.
    expect(INTERNAL_SALES_AI_RUNS_PER_HOUR).toBeGreaterThan(8);
    expect(Number.isFinite(INTERNAL_SALES_AI_RUNS_PER_HOUR)).toBe(true);
  });
});

describe("prospect status", () => {
  it("accepts only the four statuses the database allows", () => {
    // Kept in step with the CHECK constraint in
    // 20260815120000_internal_sales_workspace.sql — a value this accepts but
    // Postgres rejects would surface as a 500 at the end of the agent's edit.
    expect([...PROSPECT_STATUSES]).toEqual(["draft", "ready", "sent", "archived"]);
    for (const status of PROSPECT_STATUSES) expect(isProspectStatus(status)).toBe(true);
    for (const value of ["Draft", "won", "", null, 3, undefined]) {
      expect(isProspectStatus(value)).toBe(false);
    }
  });
});

describe("prospect identity", () => {
  it("derives the domain, dropping www and the scheme", () => {
    expect(prospectDomain("https://www.Acme-Decks.com/services")).toBe("acme-decks.com");
    expect(prospectDomain("http://acme-decks.com")).toBe("acme-decks.com");
  });

  it("returns null rather than guessing on unusable input", () => {
    expect(prospectDomain(null)).toBeNull();
    expect(prospectDomain("")).toBeNull();
    expect(prospectDomain("acme-decks.com")).toBeNull(); // no scheme: not a URL
  });

  it("prefers the name the agent typed", () => {
    expect(prospectDisplayName("Acme Decks", "https://www.acme-decks.com")).toBe("Acme Decks");
  });

  it("falls back to the domain, then says so plainly", () => {
    // Never invents a company name from the site: the list would read as if
    // someone had confirmed it.
    expect(prospectDisplayName(null, "https://www.acme-decks.com")).toBe("acme-decks.com");
    expect(prospectDisplayName("   ", "https://www.acme-decks.com")).toBe("acme-decks.com");
    expect(prospectDisplayName(null, null)).toBe("Unnamed prospect");
  });
});
