/**
 * Le pilotage ne compte que l'exploitation réelle : tout ce qui relève d'un atelier de test (`is_demo`) en est
 * retiré avant le calcul. Un dossier est « de test » s'il est apporté par cet atelier ou s'il lui est confié.
 * Les pièces émises ne sont jamais concernées : elles restent conservées et vérifiées (journal de l'émetteur).
 */
import type { DashboardRows } from "./adminDashboard";

export interface TestScopeFacts {
  /** Atelier apporteur de chaque dossier (clients propres d'un atelier). */
  caseReferrers: { id: string; referred_binder_id: string | null }[];
  /** Atelier auquel chaque commande OPPE est confiée. */
  assignments: { case_id: string; binder_id: string }[];
  /** Atelier de chaque paiement en ligne. */
  paymentBinders: { id: string; binder_id: string }[];
}

export function excludeTestWorkshops(rows: DashboardRows, facts: TestScopeFacts): DashboardRows {
  const testBinders = new Set(rows.binders.filter((b) => b.is_demo).map((b) => b.id));
  if (testBinders.size === 0) return rows;
  const testCases = new Set([
    ...facts.caseReferrers.filter((c) => c.referred_binder_id && testBinders.has(c.referred_binder_id)).map((c) => c.id),
    ...facts.assignments.filter((a) => testBinders.has(a.binder_id)).map((a) => a.case_id),
  ]);
  const testPayments = new Set(facts.paymentBinders.filter((p) => testBinders.has(p.binder_id)).map((p) => p.id));
  const realCase = (row: { case_id: string }) => !testCases.has(row.case_id);
  const realPayment = (row: { payment_id: string }) => !testPayments.has(row.payment_id);
  const proposals = rows.proposals.filter(realCase);
  const realProposals = new Set(proposals.map((p) => p.id));
  return {
    ...rows,
    cases: rows.cases.filter((c) => !testCases.has(c.id)),
    subscriptions: rows.subscriptions.filter((s) => !testBinders.has(s.binder_id)),
    connectConsents: rows.connectConsents.filter((c) => !testBinders.has(c.binder_id)),
    proposals,
    proposalPayments: rows.proposalPayments.filter((p) => realProposals.has(p.proposal_id)),
    oppeRefunds: rows.oppeRefunds.filter(realCase),
    oppeDisputes: rows.oppeDisputes.filter(realCase),
    onlinePayments: rows.onlinePayments.filter((p) => !testPayments.has(p.id)),
    feeDocuments: rows.feeDocuments.filter(realPayment),
    onlineRefunds: rows.onlineRefunds.filter(realPayment),
    onlineDisputes: rows.onlineDisputes.filter(realPayment),
    plans: rows.plans.filter(realCase),
    labelJobs: rows.labelJobs.filter(realCase),
    unreadByCase: rows.unreadByCase?.filter(realCase),
  };
}
