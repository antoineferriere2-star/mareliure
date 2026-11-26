/**
 * Ce que chaque refus de `buildEnInvoice` veut dire, et qui doit agir.
 *
 * Une pièce que la traduction ne sait pas rendre fidèlement est refusée, jamais approchée. Ce
 * catalogue rend ces refus lisibles par l'atelier et distingue ce qui se corrige (une donnée à
 * compléter) de ce qui attend une décision comptable ou sort du périmètre transmis. Aucune règle
 * fiscale n'est décidée ici : les cas « décision comptable » restent refusés tant que l'expert-comptable
 * ne les a pas arrêtés (docs/einvoicing/lot1-decision-pa.md, §3 et §4).
 */
import type { EnInvoiceBlocker } from "./enInvoice";

export type EnInvoiceBlockerKind =
  /** L'atelier peut corriger lui-même : une information manque ou est incohérente. */
  | "atelier_data"
  /** Traitement fiscal à arrêter avec l'expert-comptable avant tout envoi. */
  | "accounting_decision"
  /** Pas de facture transmise par la plateforme : déclaration de la vente seulement (e-reporting). */
  | "reporting_only"
  /** Circuit non couvert à ce stade : à traiter hors plateforme. */
  | "out_of_scope"
  /** Incohérence des montants : la pièce ne doit jamais être transmise, l'équipe technique est prévenue. */
  | "integrity";

export interface EnInvoiceBlockerInfo {
  kind: EnInvoiceBlockerKind;
  /** Phrase adressée à l'atelier. */
  message: string;
}

export const EN_INVOICE_BLOCKERS: Record<EnInvoiceBlocker, EnInvoiceBlockerInfo> = {
  not_issued: { kind: "atelier_data", message: "Seule une facture ou un avoir émis peut être transmis : un brouillon ou un devis ne l'est pas." },
  missing_compliance: { kind: "atelier_data", message: "Des informations de conformité manquent sur cette pièce (nature de l'opération, conditions de paiement, pénalités de retard ou escompte)." },
  missing_client_type: { kind: "atelier_data", message: "Indiquez si le client est un particulier ou une entreprise : cette information n'est jamais supposée." },
  missing_seller_identity: { kind: "atelier_data", message: "L'identité de votre atelier est incomplète : SIREN, raison sociale ou nom, et numéro de TVA si vous y êtes assujetti." },
  missing_buyer_identity: { kind: "atelier_data", message: "Le SIREN de votre client entreprise est nécessaire pour lui adresser la facture." },
  missing_buyer_address: { kind: "atelier_data", message: "L'adresse e-mail de votre client particulier est nécessaire pour compléter la facture." },
  zero_rate_without_reason: { kind: "atelier_data", message: "Une ligne à 0 % de TVA exige un motif d'exonération : corrigez le taux ou précisez le motif." },
  vat_on_debits_not_mapped: { kind: "accounting_decision", message: "Les ateliers qui ont opté pour la TVA sur les débits ne sont pas encore pris en charge : le traitement attend la validation de votre expert-comptable." },
  deposit_not_mapped: { kind: "accounting_decision", message: "Une facture comportant un acompte, demandé ou reçu, n'est pas encore prise en charge : le traitement attend la validation de votre expert-comptable." },
  unsupported_vat_regime: { kind: "accounting_decision", message: "Ce régime de TVA n'est pas encore pris en charge pour la transmission." },
  b2c_mixed: { kind: "accounting_decision", message: "Une vente à un particulier mêlant bien et service n'est pas encore prise en charge : sa qualification attend votre expert-comptable." },
  international_reporting_only: { kind: "reporting_only", message: "Une vente à un client étranger ne s'envoie pas comme facture par la plateforme : elle se déclare par les données de transaction." },
  unsupported_public_entity: { kind: "out_of_scope", message: "Les factures à une entité publique passent par un circuit spécifique, non couvert à ce stade." },
  unsupported_currency: { kind: "out_of_scope", message: "Seules les factures en euros sont prises en charge à ce stade." },
  amounts_mismatch: { kind: "integrity", message: "Les montants de cette pièce ne se recoupent pas : elle ne sera jamais transmise en l'état." },
};

/** Les refus d'une pièce, lisibles et regroupés par ce qu'il faut faire. */
export function describeEnInvoiceBlockers(blockers: readonly EnInvoiceBlocker[]): { kind: EnInvoiceBlockerKind; blocker: EnInvoiceBlocker; message: string }[] {
  return blockers.map((blocker) => ({ kind: EN_INVOICE_BLOCKERS[blocker].kind, blocker, message: EN_INVOICE_BLOCKERS[blocker].message }));
}

/** Vrai quand l'atelier peut tout régler lui-même : aucune décision comptable ni exclusion en jeu. */
export function blockersFixedByAtelier(blockers: readonly EnInvoiceBlocker[]): boolean {
  return blockers.every((blocker) => EN_INVOICE_BLOCKERS[blocker].kind === "atelier_data");
}
