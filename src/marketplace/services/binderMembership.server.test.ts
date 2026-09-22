import { describe, expect, it, vi } from "vitest";
import { acceptVerifiedEmailBinderInvitation } from "./binderMembership.server";

const invitation = {
  id: "11111111-1111-4111-8111-111111111111",
  binder_id: "22222222-2222-4222-8222-222222222222",
  email: "relieur@example.com",
  status: "pending",
  expires_at: "2099-01-01T00:00:00Z",
};

describe("activation d'une invitation par un compte déjà vérifié", () => {
  it("refuse une invitation destinée à une autre adresse sans écrire", async () => {
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invitation, error: null }) }) }),
    }));
    const result = await acceptVerifiedEmailBinderInvitation(
      { from } as unknown as Parameters<typeof acceptVerifiedEmailBinderInvitation>[0],
      { invitationId: invitation.id, userId: "33333333-3333-4333-8333-333333333333", verifiedEmail: "autre@example.com" },
    );
    expect(result.ok).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("consomme l'invitation une seule fois puis crée le rattachement actif", async () => {
    const userId = "33333333-3333-4333-8333-333333333333";
    const update = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          gt: () => ({ select: async () => ({ data: [{ id: invitation.id }] }) }),
        }),
      }),
    }));
    const upsert = vi.fn(async () => ({ error: null }));
    const events = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "marketplace_binder_invitations") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invitation, error: null }) }) }),
          update,
        };
      }
      if (table === "marketplace_binder_members") {
        return {
          select: () => ({ eq: async () => ({ count: 0 }) }),
          upsert,
        };
      }
      if (table === "marketplace_events") return { insert: events };
      throw new Error("Unexpected table");
    });
    const result = await acceptVerifiedEmailBinderInvitation(
      { from } as unknown as Parameters<typeof acceptVerifiedEmailBinderInvitation>[0],
      { invitationId: invitation.id, userId, verifiedEmail: "RELIEUR@example.com" },
    );
    expect(result).toEqual({ ok: true, binderId: invitation.binder_id });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "accepted",
      accepted_by_user_id: userId,
    }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      binder_id: invitation.binder_id,
      user_id: userId,
      role: "OWNER",
      account_status: "active",
    }), { onConflict: "binder_id,user_id" });
    expect(events).toHaveBeenCalledTimes(1);
  });
});
