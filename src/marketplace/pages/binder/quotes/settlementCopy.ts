import type { SettlementUnavailableReason } from "@/marketplace/services/externalSettlement.data.functions";

/**
 * Pourquoi cette facture n'a pas de suivi des règlements, et quoi faire (audit #53, C2). Aucun accord
 * n'est fabriqué après coup et aucun contrat n'est requalifié : l'atelier est orienté.
 */
export const SETTLEMENT_UNAVAILABLE: Record<SettlementUnavailableReason, string> = {
  not_issued: "Le suivi des règlements commence à l'émission de la facture.",
  historical_before_circuits: "Facture issue d'un devis accepté avant la mise en place du suivi des règlements. Conservez vos justificatifs dans votre comptabilité ; aucun accord n'est créé après coup.",
  network: "Projet vendu par Oppe : vous ne facturez pas le client final. Vous facturez Oppe, qui vous règle par virement sous 30 jours.",
  unverified_contact: "Devis établi sans fiche contact : l'origine du client n'est pas vérifiée. Pour un prochain travail, rattachez le devis à un contact ou à un ouvrage « mon client ».",
  review_required: "L'origine commerciale de ce projet est à vérifier : aucun suivi direct n'est proposé tant qu'elle n'est pas établie.",
  deposit: "Devis avec acompte : le suivi direct ne couvre pas encore les règlements en plusieurs temps. Conservez vos justificatifs dans votre comptabilité.",
  accepted_without_agreement: "Devis accepté sans référence d'accord client : le suivi direct exige un accord référencé. Conservez vos justificatifs ; pour un prochain travail, envoyez le devis puis enregistrez l'accord du client.",
};
