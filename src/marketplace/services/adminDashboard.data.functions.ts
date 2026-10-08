import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { buildAdminDashboard, type DashboardRows } from "@/marketplace/admin/adminDashboard";

const PAGE = 1000;
const dashboardInput = z.object({ brand: z.enum(["ALL", "MA_RELIURE", "FINE_BINDERY"]), days: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]) });

/** Lecture complète d'une table, page par page : le tableau de bord ne doit jamais tronquer un total. */
async function readAll<T>(sb: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Agrégats d'exploitation Ma Reliure · Fine Bindery : dossiers, onboarding, paiements, envois. */
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => dashboardInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = (await admin()) as unknown as SupabaseClient;
    const now = new Date();
    try {
      const [cases, binders, applications, subscriptions, connectConsents, offer, proposals, proposalPayments, oppeRefunds, oppeDisputes,
        onlinePayments, feeDocuments, onlineRefunds, onlineDisputes, plans, labelJobs, automation, ownClientLabels] = await Promise.all([
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
        readAll<DashboardRows["onlineDisputes"][number]>(sb, "marketplace_workshop_online_disputes", "status"),
        readAll<DashboardRows["plans"][number]>(sb, "marketplace_case_logistics_plans", "case_id, mode, workshop_decision, return_ready_at, submitted_at"),
        readAll<DashboardRows["labelJobs"][number]>(sb, "marketplace_round_trip_label_jobs",
          "case_id, direction, status, fulfilment, charged_cost_ttc_cents, created_at, updated_at"),
        readAll<NonNullable<DashboardRows["automation"]>>(sb, "marketplace_round_trip_automation", "enabled, changed_at"),
        sb.from("marketplace_work_logistics_labels").select("id", { count: "exact", head: true }).then(({ count, error }) => {
          if (error) throw new Error(`marketplace_work_logistics_labels: ${error.message}`);
          return count ?? 0;
        }),
      ]);
      const rows: DashboardRows = {
        now: now.toISOString(), cases, binders, applications, subscriptions, connectConsents, offer: offer[0] ?? null, proposals,
        proposalPayments, oppeRefunds, oppeDisputes, onlinePayments, feeDocuments, onlineRefunds, onlineDisputes, plans, labelJobs,
        automation: automation[0] ?? null, ownClientLabels,
        providerConfigured: Boolean(process.env.SENDCLOUD_PUBLIC_KEY && process.env.SENDCLOUD_SECRET_KEY && process.env.SENDCLOUD_WEBHOOK_SECRET),
      };
      const since = data.days === null ? null : new Date(now.getTime() - data.days * 86_400_000).toISOString();
      return buildAdminDashboard(rows, { brand: data.brand, since });
    } catch (error) {
      console.error("admin_dashboard_unreadable", error instanceof Error ? error.message : error);
      fail(500, "Le tableau de bord n'a pas pu être chargé.");
    }
  });
