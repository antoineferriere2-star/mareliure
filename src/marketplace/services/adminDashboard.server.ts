import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAdminDashboard, type DashboardRows, type DashboardBrand } from "@/marketplace/admin/adminDashboard";
import { unreadCount, type ConversationMessageFacts } from "@/marketplace/messaging/conversation";
import { isMessageAudience } from "@/marketplace/messaging/audience";

const PAGE = 1000;
const KEYS: Record<string, string> = {
  marketplace_binder_subscriptions: "binder_id", marketplace_workshop_connect_consents: "binder_id",
  marketplace_commercial_proposal_payments: "proposal_id", marketplace_oppe_disputes: "stripe_dispute_id",
  marketplace_workshop_online_refunds: "credit_note_id", marketplace_workshop_online_disputes: "stripe_dispute_id",
  marketplace_case_logistics_plans: "case_id", marketplace_conversation_reads: "case_id",
};

/** Pagination ordonnée par une clé unique : aucun total tronqué à 1 000 lignes. */
export async function readAll<T>(sb: SupabaseClient, table: string, columns: string, equals: Record<string, string> = {}): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = sb.from(table).select(columns);
    for (const [key, value] of Object.entries(equals)) query = query.eq(key, value);
    const { data, error } = await query.order(KEYS[table] ?? "id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(table + ": " + error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

type MessageRow = { case_id: string; sender_user_id: string | null; audience: string; created_at: string };
type ReadRow = { case_id: string; last_read_at: string };

/** Lectures seules, après autorisation admin par l'appelant ; aucune réconciliation ni écriture. */
export async function readAdminDashboard(sb: SupabaseClient, userId: string,
  filter: { brand: DashboardBrand; days: 7 | 30 | 90 | null },
  options: { now?: Date; providerConfigured?: boolean } = {}) {
  const now = options.now ?? new Date();
  const [cases, binders, applications, subscriptions, connectConsents, offer, proposals, proposalPayments, oppeRefunds, oppeDisputes,
    onlinePayments, feeDocuments, onlineRefunds, onlineDisputes, plans, labelJobs, automation, ownClientLabels, messages, conversationReads] = await Promise.all([
    readAll<DashboardRows["cases"][number]>(sb, "marketplace_cases", "id, reference, brand, status, created_at"),
    readAll<DashboardRows["binders"][number]>(sb, "marketplace_binders",
      "id, status, public_profile_status, stripe_account_id, stripe_connect_onboarded_at, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, is_demo, created_at"),
    readAll<DashboardRows["applications"][number]>(sb, "marketplace_binder_applications", "status, created_at"),
    readAll<DashboardRows["subscriptions"][number]>(sb, "marketplace_binder_subscriptions", "binder_id, status, legacy_free, cancel_at_period_end"),
    readAll<DashboardRows["connectConsents"][number]>(sb, "marketplace_workshop_connect_consents", "binder_id"),
    readAll<NonNullable<DashboardRows["offer"]>>(sb, "marketplace_workshop_offer_settings", "subscription_open, online_payment_open, connect_onboarding_open"),
    readAll<DashboardRows["proposals"][number]>(sb, "marketplace_commercial_proposals", "id, case_id, brand"),
    readAll<DashboardRows["proposalPayments"][number]>(sb, "marketplace_commercial_proposal_payments", "proposal_id, paid_at, amount_paid_cents, stripe_fee_cents"),
    readAll<DashboardRows["oppeRefunds"][number]>(sb, "marketplace_oppe_refunds", "case_id, amount_cents, status, created_at"),
    readAll<DashboardRows["oppeDisputes"][number]>(sb, "marketplace_oppe_disputes", "case_id, amount_cents, status, created_at"),
    readAll<DashboardRows["onlinePayments"][number]>(sb, "marketplace_workshop_online_payments", "id, amount_cents, paid_at, stripe_fee_cents, fee_refunded_cents, fee_brand"),
    readAll<DashboardRows["feeDocuments"][number]>(sb, "marketplace_workshop_fee_documents", "payment_id, kind, brand, total_ttc_cents"),
    readAll<DashboardRows["onlineRefunds"][number]>(sb, "marketplace_workshop_online_refunds", "payment_id, amount_cents, status, created_at"),
    readAll<DashboardRows["onlineDisputes"][number]>(sb, "marketplace_workshop_online_disputes", "payment_id, status"),
    readAll<DashboardRows["plans"][number]>(sb, "marketplace_case_logistics_plans", "case_id, mode, workshop_decision, return_ready_at, submitted_at"),
    readAll<DashboardRows["labelJobs"][number]>(sb, "marketplace_round_trip_label_jobs",
      "case_id, direction, status, fulfilment, charged_cost_ttc_cents, created_at, updated_at"),
    readAll<NonNullable<DashboardRows["automation"]>>(sb, "marketplace_round_trip_automation", "enabled, changed_at"),
    sb.from("marketplace_work_logistics_labels").select("id", { count: "exact", head: true }).then(({ count, error }) => {
      if (error) throw new Error(`marketplace_work_logistics_labels: ${error.message}`);
      return count ?? 0;
    }),
    readAll<MessageRow>(sb, "marketplace_messages", "case_id, sender_user_id, audience, created_at"),
    readAll<ReadRow>(sb, "marketplace_conversation_reads", "case_id, last_read_at", { user_id: userId }),
  ]);
  const lastRead = new Map(conversationReads.map(row => [row.case_id, row.last_read_at]));
  const perCase = new Map<string, ConversationMessageFacts[]>();
  for (const message of messages) {
    if (!isMessageAudience(message.audience)) continue;
    const facts = { senderUserId: message.sender_user_id, createdAt: message.created_at };
    const group = perCase.get(message.case_id);
    if (group) group.push(facts); else perCase.set(message.case_id, [facts]);
  }
  const unreadByCase = [...perCase].map(([case_id, facts]) => ({
    case_id, count: unreadCount(facts, userId, lastRead.get(case_id) ?? null),
  }));
  const rows: DashboardRows = {
    now: now.toISOString(), cases, binders, applications, subscriptions, connectConsents, offer: offer[0] ?? null, proposals,
    proposalPayments, oppeRefunds, oppeDisputes, onlinePayments, feeDocuments, onlineRefunds, onlineDisputes, plans, labelJobs,
    automation: automation[0] ?? null, ownClientLabels,
    providerConfigured: options.providerConfigured ?? false, unreadByCase,
  };
  const since = filter.days === null ? null : new Date(now.getTime() - filter.days * 86_400_000).toISOString();
  return buildAdminDashboard(rows, { brand: filter.brand, since });
}
