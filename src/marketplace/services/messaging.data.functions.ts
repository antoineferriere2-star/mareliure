/**
 * A case's conversation (§14-§18). Same shape as marketplace.data.functions.ts:
 * prove who the caller is with their own client, decide with a pure function
 * (conversation.ts, audience.ts), then read/write with the service-role client.
 *
 * Phase 0 / P1-6: every message carries a persisted AUDIENCE (`shared`,
 * `customer_concierge`, `workshop_platform`). Who reads what is decided here on
 * the server and applied in the query itself — never by masking in the browser —
 * and only the SELECTED workshop, still in good standing, ever enters a
 * conversation (an invited or available one has no right to the customer yet).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import {
  canAccessConversation,
  senderRoleFor,
  unreadCount,
  type ConversationAccessFacts,
  type SenderRole,
} from "@/marketplace/messaging/conversation";
import {
  audienceForNewMessage,
  customerCanReadAudience,
  isMessageAudience,
  MESSAGE_AUDIENCES,
  readableAudiences,
  type MessageAudience,
} from "@/marketplace/messaging/audience";
import { resolveViewer } from "./marketplace.data.functions";

const MESSAGE_BODY_MAX = 4000;
const uuid = z.object({ caseId: z.string().uuid() });
/**
 * `audience` (facultatif) ne fait que RESTREINDRE la lecture à un canal : l'intersection avec ce que le
 * lecteur a le droit de lire — jamais un moyen d'élargir. L'écran admin s'en sert pour afficher ses deux canaux
 * (client · atelier) séparément.
 */
const listInput = z.object({ caseId: z.string().uuid(), audience: z.enum(MESSAGE_AUDIENCES).optional() });

/** A workshop the platform has suspended or rejected is out of every conversation, even if its match still says `selected`. */
const BINDER_STATUSES_OUT_OF_CONVERSATIONS: readonly string[] = ["suspended", "rejected"];

async function loadConversationFacts(sb: Supa, caseId: string): Promise<ConversationAccessFacts> {
  const [{ data: matches }, { data: row }] = await Promise.all([
    sb.from("marketplace_case_matches").select("binder_id, state").eq("case_id", caseId),
    sb.from("marketplace_cases").select("customer_user_id").eq("id", caseId).maybeSingle(),
  ]);
  // ONLY the selected workshop enters — an invited (`offered`) or available (`accepted`) one has no
  // right to the customer's conversation yet, and one that was passed over never regains it.
  const selected = (matches ?? []).find((m) => m.state === "selected")?.binder_id ?? null;
  let selectedBinderId: string | null = null;
  if (selected) {
    const { data: binder } = await sb.from("marketplace_binders").select("status").eq("id", selected).maybeSingle();
    // Fail closed: an unknown workshop, or one that is suspended / rejected, is not admitted.
    if (binder && !BINDER_STATUSES_OUT_OF_CONVERSATIONS.includes(binder.status)) selectedBinderId = selected;
  }
  return { selectedBinderId, customerUserId: row?.customer_user_id ?? null };
}

/** `null` brand (row missing/unrecognized) falls back to Ma Reliure — never Fine Bindery by default, same rule as brandConfig.ts. */
async function loadCaseBrand(sb: Supa, caseId: string) {
  const { data } = await sb.from("marketplace_cases").select("brand").eq("id", caseId).maybeSingle();
  const { isMarketplaceBrand, marketplaceBrandConfig, canonicalHome } = await import(
    "@/marketplace/brand/brandConfig"
  );
  const rawBrand = data?.brand ?? "";
  const brand = isMarketplaceBrand(rawBrand) ? rawBrand : "MA_RELIURE";
  const config = marketplaceBrandConfig(brand);
  return {
    brand,
    brandName: config.displayName,
    locale: config.defaultLocale,
    directWorkshopMessaging: config.messaging.customerWorkshopDirectMessaging,
    origin: canonicalHome(brand).replace(/\/+$/, ""),
  };
}

/**
 * Best-effort notification to the customer that their conversation moved.
 *
 * A customer who may not read workshop messages (Fine Bindery: the concierge is
 * their only correspondent) is never notified of one — they would open the
 * conversation and find nothing. What the concierge writes still notifies.
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
  senderRole: SenderRole,
  audience: MessageAudience,
): Promise<void> {
  if (!customerUserId || senderRole === "customer") return;
  try {
    const { brand, brandName, locale, origin, directWorkshopMessaging } = await loadCaseBrand(sb, caseId);
    // Never notify a customer of a message they cannot read — decided by the message's audience.
    if (!customerCanReadAudience(audience, directWorkshopMessaging)) return;
    const { data: auth } = await sb.auth.admin.getUserById(customerUserId);
    const email = auth?.user?.email;
    if (!email) return;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const isEn = locale === "en-US";
    await sendTemplateEmail("case-activity", email, {
      templateData: {
        brandName,
        locale,
        heading: isEn ? "New message about your project" : "Nouveau message sur votre projet",
        intro: !directWorkshopMessaging
          ? `Your ${brandName} concierge wrote to you about your book.`
          : isEn
            ? `Your workshop or ${brandName} wrote to you about your book.`
            : `Votre atelier ou ${brandName} vous a écrit au sujet de votre livre.`,
        ctaLabel: isEn ? "View the conversation" : "Voir la conversation",
        ctaUrl: `${origin}/mes-livres/${caseId}`,
      },
      brand,
    });
  } catch (err) {
    logOperationalError("messaging.notify-customer-failed", err, { caseId });
  }
}

export const listCaseMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const viewer = await resolveViewer(context.supabase, sb, context.userId);
    const facts = await loadConversationFacts(sb, data.caseId);
    if (!canAccessConversation(viewer, facts)) {
      fail(403, "Cette conversation ne vous est pas accessible.");
    }

    // Ce que chaque lecteur reçoit est borné par l'AUDIENCE persistée de chaque message, appliquée
    // dans la requête elle-même — filtré ici, avant l'envoi, jamais masqué dans le navigateur.
    const role = senderRoleFor(viewer);
    if (!role) fail(403, "Non autorisé.");
    const { directWorkshopMessaging } = await loadCaseBrand(sb, data.caseId);
    const readable = readableAudiences(role!, directWorkshopMessaging);
    // Le canal demandé restreint, il n'élargit jamais : hors de ses droits, le lecteur reçoit une liste vide.
    const audiences = data.audience ? readable.filter((a) => a === data.audience) : readable;

    const { data: rows, error } = await sb
      .from("marketplace_messages")
      .select("id, sender_user_id, sender_role, audience, body, attachment_paths, created_at, deleted_at")
      .eq("case_id", data.caseId)
      .in("audience", [...audiences])
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
        audience: row.audience,
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
      .object({
        caseId: z.string().uuid(),
        body: z.string().trim().min(1).max(MESSAGE_BODY_MAX),
        // Le canal demandé — n'est écouté que pour la plateforme (admin). Un client ou un atelier écrit
        // toujours dans son seul canal, quoi qu'il envoie.
        audience: z.enum(MESSAGE_AUDIENCES).optional(),
      })
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

    // L'audience est décidée ICI, jamais reçue d'un client ou d'un atelier (audience.ts).
    const { directWorkshopMessaging } = await loadCaseBrand(sb, data.caseId);
    const decision = audienceForNewMessage({
      senderRole: role!,
      directWorkshopMessaging,
      requested: role === "admin" && isMessageAudience(data.audience) ? data.audience : null,
    });
    if (!decision.ok) fail(422, "Ce canal n'existe pas pour ce dossier.");
    const audience = decision.audience;

    const { data: inserted, error } = await sb
      .from("marketplace_messages")
      .insert({ case_id: data.caseId, sender_user_id: context.userId, sender_role: role!, body: data.body, audience })
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
      metadata: { sender_role: role, audience },
    });

    await notifyCustomerOfNewMessage(sb, data.caseId, facts.customerUserId, role!, audience);

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
  /**
   * Par dossier, les audiences que ce lecteur peut lire — seuls ces messages comptent. Un dossier
   * absent de la table n'a rien de lisible pour lui (un atelier non retenu, par exemple) : 0.
   */
  readableAudiencesByCase: ReadonlyMap<string, readonly string[]>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (caseIds.length === 0) return counts;

  const [{ data: messages }, { data: reads }] = await Promise.all([
    sb
      .from("marketplace_messages")
      .select("case_id, sender_user_id, audience, created_at")
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
    if (!readableAudiencesByCase.get(message.case_id)?.includes(message.audience)) continue;
    const list = byCase.get(message.case_id) ?? [];
    list.push({ senderUserId: message.sender_user_id, createdAt: message.created_at });
    byCase.set(message.case_id, list);
  }
  for (const caseId of caseIds) {
    counts.set(caseId, unreadCount(byCase.get(caseId) ?? [], userId, lastReadByCase.get(caseId) ?? null));
  }
  return counts;
}
