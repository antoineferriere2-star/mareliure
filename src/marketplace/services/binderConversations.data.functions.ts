/** Bounded conversation previews for one selected workshop; full threads use the existing message API. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireLeadApprovedBinderId } from "./binderQuotes.server";
import { isMessageAudience, readableAudiences } from "@/marketplace/messaging/audience";
import { isMarketplaceBrand, marketplaceBrandConfig } from "@/marketplace/brand/brandConfig";

export const listMyConversationPreviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binderId = await requireLeadApprovedBinderId(sb, context.userId);
    const { data: matches, error: matchError } = await sb.from("marketplace_case_matches")
      .select("case_id").eq("binder_id", binderId).eq("state", "selected");
    if (matchError) fail(500, matchError.message);
    const ids = (matches ?? []).map((row) => row.case_id);
    if (!ids.length) return [];
    const { data: cases, error: caseError } = await sb.from("marketplace_cases")
      .select("id, brand").in("id", ids);
    if (caseError) fail(500, caseError.message);
    const audiences = new Map((cases ?? []).map((row) => {
      const brand = isMarketplaceBrand(row.brand) ? row.brand : "MA_RELIURE";
      return [row.id, readableAudiences("binder", marketplaceBrandConfig(brand).messaging.customerWorkshopDirectMessaging)] as const;
    }));
    // One bounded query, no per-conversation fetch. A quiet old thread remains listed with no preview.
    const { data: messages, error: messageError } = await sb.from("marketplace_messages")
      .select("case_id, audience, body, created_at, deleted_at")
      .in("case_id", ids).order("created_at", { ascending: false }).limit(1000);
    if (messageError) fail(500, messageError.message);
    const latest = new Map<string, { body: string; createdAt: string }>();
    for (const message of messages ?? []) {
      if (latest.has(message.case_id) || !isMessageAudience(message.audience) || !audiences.get(message.case_id)?.includes(message.audience)) continue;
      latest.set(message.case_id, { body: message.deleted_at ? "Message supprimé" : message.body ?? "Pièce jointe", createdAt: message.created_at });
    }
    return ids.map((caseId) => ({ caseId, latest: latest.get(caseId) ?? null }));
  });
