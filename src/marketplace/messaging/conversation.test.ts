import { describe, expect, it } from "vitest";
import { canAccessConversation, senderRoleFor, unreadCount } from "./conversation";
import type { Viewer } from "@/marketplace/permissions";

describe("canAccessConversation", () => {
  const facts = { liveBinderIds: ["b-live"], selectedBinderId: "b-selected", customerUserId: "u1" };

  it("admin always sees the conversation", () => {
    expect(canAccessConversation({ role: "admin" }, facts)).toBe(true);
  });

  it("the case's own customer sees it", () => {
    expect(canAccessConversation({ role: "customer", userId: "u1" }, facts)).toBe(true);
  });

  it("a different customer never sees it", () => {
    expect(canAccessConversation({ role: "customer", userId: "someone-else" }, facts)).toBe(false);
  });

  it("an unclaimed case (no customer yet) opens for nobody as customer", () => {
    expect(
      canAccessConversation(
        { role: "customer", userId: "u1" },
        { ...facts, customerUserId: null },
      ),
    ).toBe(false);
  });

  it("a binder with a live match (offered/accepted) sees it", () => {
    expect(canAccessConversation({ role: "binder", binderId: "b-live" }, facts)).toBe(true);
  });

  it("the selected binder sees it even if not in liveBinderIds", () => {
    expect(
      canAccessConversation(
        { role: "binder", binderId: "b-selected" },
        { ...facts, liveBinderIds: [] },
      ),
    ).toBe(true);
  });

  it("a binder who was declined or cancelled — not in liveBinderIds, not selected — cannot see it", () => {
    // The whole point of this module over a raw canViewCase reuse (§72):
    // a workshop passed over must lose access to what the customer and the
    // chosen atelier say to each other, even though its match row still
    // exists (state 'declined' or 'cancelled', not deleted).
    expect(canAccessConversation({ role: "binder", binderId: "b-declined" }, facts)).toBe(false);
  });

  it("anonymous never sees it", () => {
    expect(canAccessConversation({ role: "anonymous" }, facts)).toBe(false);
  });
});

describe("senderRoleFor", () => {
  it("maps each authorised viewer to its message role", () => {
    expect(senderRoleFor({ role: "admin" })).toBe("admin");
    expect(senderRoleFor({ role: "customer", userId: "u1" })).toBe("customer");
    expect(senderRoleFor({ role: "binder", binderId: "b1" })).toBe("binder");
  });

  it("anonymous cannot be attributed a sender role", () => {
    expect(senderRoleFor({ role: "anonymous" })).toBeNull();
  });
});

describe("unreadCount", () => {
  const messages = [
    { senderUserId: "me", createdAt: "2026-09-10T10:00:00.000Z" },
    { senderUserId: "them", createdAt: "2026-09-10T11:00:00.000Z" },
    { senderUserId: "them", createdAt: "2026-09-10T12:00:00.000Z" },
  ];

  it("counts everything from someone else when the thread was never opened", () => {
    expect(unreadCount(messages, "me", null)).toBe(2);
  });

  it("never counts the viewer's own messages", () => {
    expect(unreadCount(messages, "me", null)).not.toBe(3);
  });

  it("counts only messages after the last read timestamp", () => {
    expect(unreadCount(messages, "me", "2026-09-10T11:00:00.000Z")).toBe(1);
  });

  it("is zero once everything has been read", () => {
    expect(unreadCount(messages, "me", "2026-09-10T12:00:00.000Z")).toBe(0);
  });
});
