/**
 * A case's conversation (§14-§18) — customer, the selected atelier, and Ma
 * Reliure in one thread. Same shape as marketplace.data.functions.ts: prove
 * who the caller is with their own client, decide with a pure function
 * (conversation.ts), then read/write with the service-role client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import {
  canAccessConversation,
  LIVE_MATCH_STATES,
  senderRoleFor,
  unreadCount,
  type ConversationAccessFacts,
} from "@/marketplace/messaging/conversation";
import { resolveViewer } from "./marketplace.data.functions";

const MESSAGE_BODY_MAX = 4000;
const uuid = z.object({ caseId: z.string().uuid() });

async function loadConversationFacts(sb: Supa, caseId: string): Promise<ConversationAccessFacts> {
  const [{ data: matches }, { data: row }] = await Promise.all([
    sb.from("marketplace_case_matches").select("binder_id, state").eq("case_id", caseId),
    sb.from("marketplace_cases").select("customer_user_id").eq("id", caseId).maybeSingle(),
  ]);
  return {
    liveBinderIds: (matches ?? [])
      .filter((m) => (LIVE_MATCH_STATES as readonly string[]).includes(m.state))
      .map((m) => m.binder_id),
    selectedBinderId: (matches ?? []).find((m) => m.state === "selected")?.binder_id ?? null,
    customerUserId: row?.customer_user_id ?? null,
  };
}

/**
 * Best-effort notification to the customer that their conversation moved.
 *
 * Only the customer direction is covered in Phase B: a workshop can now have
 * more than one member (Phase A) and none is yet designated as the contact
 * to notify, so notifying "the atelier" is deferred rather than guessed at.
 * Never blocks or fails the send it describes — see sendVisitorSummaryEmail
 * for the same discipline.
 */
async function notifyCustomerOfNewMessage(
  sb: Supa,
  caseId: string,
  customerUserId: string | null,
  senderIsCustomer: boolean,
): Promise<void> {
  if (!customerUserId || senderIsCustomer) return;
  try {
    const { data: auth } = await sb.auth.admin.getUserById(customerUserId);
    const email = auth?.user?.email;
    if (!email) return;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { MARELIURE_CANONICAL_ORIGIN } = await import("@/marketplace/config");
    await sendTemplateEmail("case-activity", email, {
      templateData: {
        heading: "Nouveau message sur votre projet",
        intro: "Votre atelier ou Ma Reliure vous a écrit au sujet de votre livre.",
        ctaLabel: "Voir la conversation",
        ctaUrl: `${MARELIURE_CANONICAL_ORIGIN}/mes-livres/${caseId}`,
      },
    });
  } catch (err) {
    logOperationalError("messaging.notify-customer-failed", err, { caseId });
  }
}

export const listCaseMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const facts = await loadConversationFacts(sb, data.caseId);
    if (!canAccessConversation(viewer, facts)) {
      fail(403, "Cette conversation ne vous est pas accessible.");
    }

    const { data: rows, error } = await sb
      .from("marketplace_messages")
      .select("id, sender_user_id, sender_role, body, attachment_paths, created_at, deleted_at")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: true });
    if (error) fail(500, error.message);

    const { data: readRow } = await sb
      .from("marketplace_conversation_reads")
      .select("last_read_at")
      .eq("case_id", data.caseId)
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      messages: (rows ?? []).map((row) => ({
        id: row.id,
        senderRole: row.sender_role,
        isMine: row.sender_user_id === context.userId,
        // The body of a deleted message never leaves the server — a soft
        // delete that still shipped the text would not be one.
        body: row.deleted_at ? null : row.body,
        deleted: Boolean(row.deleted_at),
        attachmentCount: row.attachment_paths?.length ?? 0,
        createdAt: row.created_at,
      })),
      lastReadAt: readRow?.last_read_at ?? null,
    };
  });

export const sendCaseMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ caseId: z.string().uuid(), body: z.string().trim().min(1).max(MESSAGE_BODY_MAX) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const facts = await loadConversationFacts(sb, data.caseId);
    if (!canAccessConversation(viewer, facts)) {
      fail(403, "Cette conversation ne vous est pas accessible.");
    }
    // The prices don't negotiate in the chat (§22) — enforced by never giving
    // this endpoint a way to touch a price, not by scanning message text for
    // numbers, which would be both leaky and easy to dodge.
    const role = senderRoleFor(viewer);
    if (!role) fail(403, "Non autorisé.");

    const { data: inserted, error } = await sb
      .from("marketplace_messages")
      .insert({ case_id: data.caseId, sender_user_id: context.userId, sender_role: role!, body: data.body })
      .select("id, created_at")
      .single();
    if (error) fail(500, error.message);

    // Sending implies having read everything up to the message just sent.
    await sb
      .from("marketplace_conversation_reads")
      .upsert(
        { case_id: data.caseId, user_id: context.userId, last_read_at: inserted!.created_at },
        { onConflict: "case_id,user_id" },
      );

    await sb.from("marketplace_events").insert({
      case_id: data.caseId,
      actor_user_id: context.userId,
      event_type: "message_sent",
      metadata: { sender_role: role },
    });

    await notifyCustomerOfNewMessage(sb, data.caseId, facts.customerUserId, role === "customer");

    return { id: inserted!.id, createdAt: inserted!.created_at };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uuid.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const facts = await loadConversationFacts(sb, data.caseId);
    if (!canAccessConversation(viewer, facts)) {
      fail(403, "Cette conversation ne vous est pas accessible.");
    }
    await sb.from("marketplace_conversation_reads").upsert(
      { case_id: data.caseId, user_id: context.userId, last_read_at: new Date().toISOString() },
      { onConflict: "case_id,user_id" },
    );
    return { ok: true };
  });

/**
 * How many unread messages this account has, per case — for the "2 nouveaux
 * messages" badge on a dashboard list (§10, §12). Exported rather than
 * inlined so listMyCustomerCases and listMyBinderCases can both use it
 * without loading every message body twice.
 */
export async function unreadCountsByCase(
  sb: Supa,
  caseIds: readonly string[],
  userId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (caseIds.length === 0) return counts;

  const [{ data: messages }, { data: reads }] = await Promise.all([
    sb
      .from("marketplace_messages")
      .select("case_id, sender_user_id, created_at")
      .in("case_id", caseIds as string[]),
    sb
      .from("marketplace_conversation_reads")
      .select("case_id, last_read_at")
      .eq("user_id", userId)
      .in("case_id", caseIds as string[]),
  ]);
  const lastReadByCase = new Map((reads ?? []).map((r) => [r.case_id, r.last_read_at]));
  const byCase = new Map<string, { senderUserId: string | null; createdAt: string }[]>();
  for (const message of messages ?? []) {
    const list = byCase.get(message.case_id) ?? [];
    list.push({ senderUserId: message.sender_user_id, createdAt: message.created_at });
    byCase.set(message.case_id, list);
  }
  for (const caseId of caseIds) {
    counts.set(caseId, unreadCount(byCase.get(caseId) ?? [], userId, lastReadByCase.get(caseId) ?? null));
  }
  return counts;
}
