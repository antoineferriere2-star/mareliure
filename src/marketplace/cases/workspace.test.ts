import { describe, expect, it } from "vitest";
import { caseGroup, nextCaseAction } from "./workspace";

const row = (state: string, unreadCount = 0) => ({ state, unreadCount, caseStatus: "binder_selected" });

describe("atelier actions from existing case state", () => {
  it("separates offers, selected work, and closed cases without inventing statuses", () => {
    expect(caseGroup(row("offered"))).toBe("new");
    expect(caseGroup(row("selected"))).toBe("quote");
    expect(caseGroup(row("selected"), false, true)).toBe("sent");
    expect(caseGroup(row("cancelled"))).toBe("closed");
  });

  it("puts an unread reply before creating a quote", () => {
    expect(nextCaseAction(row("selected", 2), true)).toBe("Répondre au message");
    expect(nextCaseAction(row("selected"), false)).toBe("Créer la fiche ouvrage");
    expect(nextCaseAction(row("selected"), true, true)).toBe("Continuer le devis");
  });
});
