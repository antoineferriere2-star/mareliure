/**
 * Tableau de bord d'administration Ma Reliure · Fine Bindery : agrégats seulement.
 *
 * Calcul pur, à partir des lignes déjà lues en base par la fonction serveur. Aucune donnée
 * personnelle de client ne sort d'ici : références de dossier, montants, statuts et dates.
 * Les flux (créations, encaissements) suivent la période choisie ; les stocks (états courants)
 * sont toujours l'état présent. Les montants sont en centimes d'euro.
 */
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

export type DashboardBrand = MarketplaceBrand | "ALL";

export interface DashboardRows {
  now: string;
  cases: { id: string; reference: string; brand: MarketplaceBrand; status: string; created_at: string }[];
  binders: { id: string; status: string; public_profile_status: string | null; stripe_account_id: string | null;
    stripe_connect_onboarded_at: string | null; stripe_connect_charges_enabled: boolean | null; stripe_connect_payouts_enabled: boolean | null;
    is_demo: boolean | null; created_at: string }[];
  applications: { status: string; created_at: string }[];
  subscriptions: { binder_id: string; status: string; legacy_free: boolean; cancel_at_period_end: boolean | null }[];
  connectConsents: { binder_id: string }[];
  offer: { subscription_open: boolean; online_payment_open: boolean; connect_onboarding_open: boolean } | null;
  proposals: { id: string; case_id: string; brand: MarketplaceBrand }[];
  proposalPayments: { proposal_id: string; paid_at: string | null; amount_paid_cents: number | null; stripe_fee_cents: number | null }[];
  oppeRefunds: { case_id: string; amount_cents: number; status: string; created_at: string }[];
  oppeDisputes: { case_id: string; amount_cents: number; status: string; created_at: string }[];
  onlinePayments: { id: string; amount_cents: number; paid_at: string | null; stripe_fee_cents: number | null; fee_refunded_cents: number | null; fee_brand: MarketplaceBrand | null }[];
  feeDocuments: { payment_id: string; kind: string; brand: MarketplaceBrand; total_ttc_cents: number }[];
  onlineRefunds: { payment_id: string; amount_cents: number; status: string; created_at: string }[];
  onlineDisputes: { payment_id: string; status: string }[];
  plans: { case_id: string; mode: string; workshop_decision: string | null; return_ready_at: string | null; submitted_at: string | null }[];
  labelJobs: { case_id: string; direction: string; status: string; fulfilment: string; charged_cost_ttc_cents: number | null; created_at: string; updated_at: string }[];
  automation: { enabled: boolean; changed_at: string | null } | null;
  ownClientLabels: number;
  providerConfigured: boolean;
  unreadByCase?: { case_id: string; count: number }[];
}

/**
 * Étapes d'un dossier dans l'ordre du parcours, d'après la contrainte `marketplace_cases_status_check`
 * (`sent_to_binders` et `quotes_received` : dossiers antérieurs, lecture seule). Seul `cancelled`
 * est clos ; un statut inconnu reste visible à part, jamais rangé en clos.
 */
export const CASE_STAGES = [
  ["new", "Nouveaux", ["under_review"]],
  ["pricing", "Prix à valider", ["pricing"]],
  ["qualifying", "Sélection des ateliers", ["matching"]],
  ["sent", "Envoyés aux ateliers", ["awaiting_binder_response", "sent_to_binders"]],
  ["workshop", "Atelier disponible", ["binder_accepted", "quotes_received"]],
  ["accepted", "Atelier retenu, à payer", ["binder_selected", "awaiting_payment"]],
  ["production", "Payés / en cours", ["paid", "shipping_to_binder", "received_by_binder", "in_progress", "awaiting_approval", "shipping_to_customer"]],
  ["done", "Terminés", ["delivered", "completed"]],
  ["closed", "Clos / sans suite", ["cancelled"]],
] as const;
export type CaseStage = (typeof CASE_STAGES)[number][0] | "other";

export function caseStage(status: string): CaseStage {
  return CASE_STAGES.find(([, , statuses]) => (statuses as readonly string[]).includes(status))?.[0] ?? "other";
}

/** Même libellé de statut pour l'entonnoir et les filtres de la liste admin. */
export function caseStageLabel(status: string): string {
  const stage = caseStage(status);
  return CASE_STAGES.find(([key]) => key === stage)?.[1] ?? "Statut non reconnu";
}

const OPEN_DISPUTE = new Set(["warning_needs_response", "needs_response", "warning_under_review", "under_review"]);
const PAYING_SUBSCRIPTION = new Set(["active", "trialing"]);
const LATE_SUBSCRIPTION = new Set(["past_due", "unpaid", "incomplete"]);
/** Prix B : 15 € HT + 3 € de TVA par mois (décision du 7 octobre 2026). */
export const SUBSCRIPTION_MONTHLY_HT_CENTS = 1500;
const STALE_CLAIM_MS = 60 * 60 * 1000;

export interface DashboardAlert { key: string; label: string; count: number; tone: "urgent" | "todo" }
export interface RecentPayment { at: string; circuit: "A" | "C"; brand: MarketplaceBrand | null; reference: string | null; amountCents: number }

export interface AdminDashboard {
  generatedAt: string;
  unreadMessages: number;
  brand: DashboardBrand;
  since: string | null;
  alerts: DashboardAlert[];
  cases: { created: number; byStage: { key: CaseStage; label: string; count: number }[]; acceptanceRate: number | null };
  onboarding: {
    applications: { created: number; pending: number; accepted: number; rejected: number };
    workshops: { approved: number; pendingReview: number; suspended: number; published: number };
    connect: { started: number; onboarded: number; chargesEnabled: number; payoutsEnabled: number; consents: number };
    subscriptions: { paying: number; legacyFree: number; late: number; cancelling: number; canceled: number; monthlyHtCents: number };
    offer: { subscriptionOpen: boolean; onlinePaymentOpen: boolean; connectOnboardingOpen: boolean } | null;
  };
  payments: {
    a: { count: number; grossCents: number; stripeFeeCents: number; refundedCents: number; openDisputes: number; disputedCents: number };
    c: { count: number; grossCents: number; platformFeeCents: number; stripeFeeCents: number; refundedCents: number; openDisputes: number };
    recent: RecentPayment[];
  };
  shipping: {
    plans: { roundTrip: number; customerArranged: number; handDelivery: number; awaitingWorkshop: number; returnReadyWithoutLabel: number };
    labels: { confirmed: number; inProgress: number; failedOrCancelled: number; automatic: number; manual: number; chargedCents: number };
    ownClientLabels: number;
    automation: { enabled: boolean; changedAt: string | null; providerConfigured: boolean };
  };
}

const sum = <T>(rows: T[], pick: (row: T) => number | null | undefined) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

export function buildAdminDashboard(rows: DashboardRows, options: { brand: DashboardBrand; since: string | null }): AdminDashboard {
  const { brand, since } = options;
  const inBrand = (value: MarketplaceBrand | null | undefined) => brand === "ALL" || value === brand;
  const inPeriod = (at: string | null | undefined) => Boolean(at) && Number.isFinite(Date.parse(at!)) && (!since || Date.parse(at!) >= Date.parse(since));

  const caseById = new Map(rows.cases.map((row) => [row.id, row]));
  const caseBrand = (caseId: string) => caseById.get(caseId)?.brand;
  const cases = rows.cases.filter((row) => inBrand(row.brand));
  const proposals = new Map(rows.proposals.map((row) => [row.id, row]));

  // Dossiers : entonnoir sur l'état courant, créations sur la période.
  const stageCounts = new Map<CaseStage, number>();
  for (const row of cases) stageCounts.set(caseStage(row.status), (stageCounts.get(caseStage(row.status)) ?? 0) + 1);
  const byStage = [...CASE_STAGES.map(([key, label]) => ({ key: key as CaseStage, label, count: stageCounts.get(key) ?? 0 })),
    ...(stageCounts.get("other") ? [{ key: "other" as const, label: "Statut non reconnu", count: stageCounts.get("other")! }] : [])];
  // Acceptation : dossiers où un atelier s'est rendu disponible, puis retenu et au-delà.
  const reachedAcceptance = cases.filter((row) => ["accepted", "production", "done"].includes(caseStage(row.status))).length;
  const proposedOrBeyond = reachedAcceptance + (stageCounts.get("workshop") ?? 0);

  // Circuit A : encaissements OPPE, marque de la proposition.
  const aPayments = rows.proposalPayments.filter((row) => inPeriod(row.paid_at) && inBrand(proposals.get(row.proposal_id)?.brand));
  const aRefunds = rows.oppeRefunds.filter((row) => row.status === "succeeded" && inPeriod(row.created_at) && inBrand(caseBrand(row.case_id)));
  const aDisputes = rows.oppeDisputes.filter((row) => inBrand(caseBrand(row.case_id)));
  const aOpenDisputes = aDisputes.filter((row) => OPEN_DISPUTE.has(row.status));

  // Circuit C : encaissements atelier, retenue OPPE lue sur sa facture, frais remboursés déduits.
  const feeInvoice = new Map(rows.feeDocuments.filter((row) => row.kind === "invoice").map((row) => [row.payment_id, row]));
  const cPayments = rows.onlinePayments.filter((row) => inPeriod(row.paid_at) && inBrand(row.fee_brand ?? feeInvoice.get(row.id)?.brand));
  const cBrandIds = new Set(rows.onlinePayments.filter((row) => inBrand(row.fee_brand ?? feeInvoice.get(row.id)?.brand)).map((row) => row.id));
  const cRefunds = rows.onlineRefunds.filter((row) => row.status === "succeeded" && inPeriod(row.created_at) && cBrandIds.has(row.payment_id));
  const cOpenDisputes = rows.onlineDisputes.filter((row) => OPEN_DISPUTE.has(row.status) && cBrandIds.has(row.payment_id)).length;

  const recent: RecentPayment[] = [
    ...aPayments.map((row) => {
      const proposal = proposals.get(row.proposal_id);
      return { at: row.paid_at!, circuit: "A" as const, brand: proposal?.brand ?? null,
        reference: proposal ? caseById.get(proposal.case_id)?.reference ?? null : null, amountCents: row.amount_paid_cents ?? 0 };
    }),
    ...cPayments.map((row) => ({ at: row.paid_at!, circuit: "C" as const, brand: row.fee_brand ?? feeInvoice.get(row.id)?.brand ?? null,
      reference: null, amountCents: row.amount_cents })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 10);

  // Onboarding : les ateliers ne relèvent d'aucune marque ; les comptes de démonstration sont écartés.
  const binders = rows.binders.filter((row) => !row.is_demo);
  const binderIds = new Set(binders.map((row) => row.id));
  const subscriptions = rows.subscriptions.filter((row) => binderIds.has(row.binder_id));
  const paying = subscriptions.filter((row) => !row.legacy_free && PAYING_SUBSCRIPTION.has(row.status));

  // Envois : plans et étiquettes des dossiers de la marque.
  const plans = rows.plans.filter((row) => inBrand(caseBrand(row.case_id)));
  const jobs = rows.labelJobs.filter((row) => inBrand(caseBrand(row.case_id)));
  const confirmedReturn = new Set(jobs.filter((row) => row.direction === "return" && ["claimed", "ambiguous", "confirmed"].includes(row.status)).map((row) => row.case_id));
  const nowMs = Date.parse(rows.now);
  const stuckJobs = jobs.filter((row) => row.status === "ambiguous" || (row.status === "claimed" && nowMs - Date.parse(row.updated_at) > STALE_CLAIM_MS));
  const returnReadyWithoutLabel = plans.filter((row) => row.mode === "organized_round_trip" && row.return_ready_at && !confirmedReturn.has(row.case_id)).length;
  const awaitingWorkshop = plans.filter((row) => row.mode === "organized_round_trip" && row.submitted_at && !row.workshop_decision).length;
  const periodJobs = jobs.filter((row) => inPeriod(row.created_at));

  const alerts: DashboardAlert[] = [
    { key: "disputes", label: "Litiges ouverts", count: aOpenDisputes.length + cOpenDisputes, tone: "urgent" as const },
    { key: "labels", label: "Étiquettes à vérifier (ambiguës ou bloquées)", count: stuckJobs.length, tone: "urgent" as const },
    { key: "refunds", label: "Remboursements en échec", count: rows.oppeRefunds.filter((row) => row.status === "failed" && inBrand(caseBrand(row.case_id))).length
      + rows.onlineRefunds.filter((row) => ["failed", "requires_action"].includes(row.status) && cBrandIds.has(row.payment_id)).length, tone: "urgent" as const },
    { key: "subscriptions", label: "Abonnements impayés", count: brand === "ALL" ? subscriptions.filter((row) => !row.legacy_free && LATE_SUBSCRIPTION.has(row.status)).length : 0, tone: "urgent" as const },
    { key: "newCases", label: "Nouveaux dossiers à qualifier", count: (stageCounts.get("new") ?? 0) + (stageCounts.get("pricing") ?? 0) + (stageCounts.get("qualifying") ?? 0), tone: "todo" as const },
    { key: "applications", label: "Candidatures d'ateliers à examiner", count: brand === "ALL" ? rows.applications.filter((row) => row.status === "new").length : 0, tone: "todo" as const },
    { key: "workshopReview", label: "Ateliers en attente de validation", count: brand === "ALL" ? binders.filter((row) => row.status === "pending_review").length : 0, tone: "todo" as const },
    { key: "shipping", label: "Envois à préparer (retour prêt sans étiquette)", count: returnReadyWithoutLabel, tone: "todo" as const },
  ].filter((alert) => alert.count > 0);

  return {
    generatedAt: rows.now,
    unreadMessages: sum(rows.unreadByCase ?? [], (row) => cases.some((c) => c.id === row.case_id) ? row.count : 0),
    brand,
    since,
    alerts,
    cases: {
      created: cases.filter((row) => inPeriod(row.created_at)).length,
      byStage,
      acceptanceRate: proposedOrBeyond ? reachedAcceptance / proposedOrBeyond : null,
    },
    onboarding: {
      applications: {
        created: rows.applications.filter((row) => inPeriod(row.created_at)).length,
        pending: rows.applications.filter((row) => row.status === "new" || row.status === "reviewed").length,
        accepted: rows.applications.filter((row) => row.status === "accepted").length,
        rejected: rows.applications.filter((row) => row.status === "rejected").length,
      },
      workshops: {
        approved: binders.filter((row) => row.status === "approved").length,
        pendingReview: binders.filter((row) => row.status === "pending_review").length,
        suspended: binders.filter((row) => row.status === "suspended").length,
        published: binders.filter((row) => row.public_profile_status === "published").length,
      },
      connect: {
        started: binders.filter((row) => row.stripe_account_id).length,
        onboarded: binders.filter((row) => row.stripe_connect_onboarded_at).length,
        chargesEnabled: binders.filter((row) => row.stripe_connect_charges_enabled).length,
        payoutsEnabled: binders.filter((row) => row.stripe_connect_payouts_enabled).length,
        consents: new Set(rows.connectConsents.filter((row) => binderIds.has(row.binder_id)).map((row) => row.binder_id)).size,
      },
      subscriptions: {
        paying: paying.length,
        legacyFree: subscriptions.filter((row) => row.legacy_free).length,
        late: subscriptions.filter((row) => !row.legacy_free && LATE_SUBSCRIPTION.has(row.status)).length,
        cancelling: paying.filter((row) => row.cancel_at_period_end).length,
        canceled: subscriptions.filter((row) => row.status === "canceled").length,
        monthlyHtCents: paying.length * SUBSCRIPTION_MONTHLY_HT_CENTS,
      },
      offer: rows.offer && { subscriptionOpen: rows.offer.subscription_open, onlinePaymentOpen: rows.offer.online_payment_open,
        connectOnboardingOpen: rows.offer.connect_onboarding_open },
    },
    payments: {
      a: {
        count: aPayments.length,
        grossCents: sum(aPayments, (row) => row.amount_paid_cents),
        stripeFeeCents: sum(aPayments, (row) => row.stripe_fee_cents),
        refundedCents: sum(aRefunds, (row) => row.amount_cents),
        openDisputes: aOpenDisputes.length,
        disputedCents: sum(aOpenDisputes, (row) => row.amount_cents),
      },
      c: {
        count: cPayments.length,
        grossCents: sum(cPayments, (row) => row.amount_cents),
        platformFeeCents: sum(cPayments, (row) => (feeInvoice.get(row.id)?.total_ttc_cents ?? 0) - (row.fee_refunded_cents ?? 0)),
        stripeFeeCents: sum(cPayments, (row) => row.stripe_fee_cents),
        refundedCents: sum(cRefunds, (row) => row.amount_cents),
        openDisputes: cOpenDisputes,
      },
      recent,
    },
    shipping: {
      plans: {
        roundTrip: plans.filter((row) => row.mode === "organized_round_trip").length,
        customerArranged: plans.filter((row) => row.mode === "customer_arranged").length,
        handDelivery: plans.filter((row) => row.mode === "hand_delivery").length,
        awaitingWorkshop,
        returnReadyWithoutLabel,
      },
      labels: {
        confirmed: periodJobs.filter((row) => row.status === "confirmed").length,
        inProgress: jobs.filter((row) => row.status === "claimed" || row.status === "ambiguous").length,
        failedOrCancelled: periodJobs.filter((row) => row.status === "failed" || row.status === "cancelled").length,
        automatic: periodJobs.filter((row) => row.status === "confirmed" && row.fulfilment === "automatic").length,
        manual: periodJobs.filter((row) => row.status === "confirmed" && row.fulfilment === "manual").length,
        chargedCents: sum(periodJobs.filter((row) => row.status === "confirmed"), (row) => row.charged_cost_ttc_cents),
      },
      ownClientLabels: brand === "ALL" ? rows.ownClientLabels : 0,
      automation: { enabled: Boolean(rows.automation?.enabled), changedAt: rows.automation?.changed_at ?? null, providerConfigured: rows.providerConfigured },
    },
  };
}
