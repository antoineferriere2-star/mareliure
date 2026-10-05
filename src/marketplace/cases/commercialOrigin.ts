/**
 * Qui vend au client : la seule question que pose l'origine commerciale d'un dossier.
 *
 * - `oppe` : demande générique confiée à Ma Reliure ou Fine Bindery (activité A). Oppe vend,
 *   choisit l'atelier et facture le client ; l'atelier facture Oppe, jamais le client.
 * - `workshop_client` : demande venue du lien personnel ou de la vitrine d'un atelier
 *   (activités B et C). L'atelier vend et facture son client ; Oppe fournit l'outil.
 *
 * Même règle que la colonne générée `marketplace_cases.commercial_origin`
 * (migration 20261005090000) : la base reste l'autorité, cette fonction ne sert qu'à afficher.
 */
export type CommercialOrigin = "oppe" | "workshop_client";

const WORKSHOP_ORIGINS: readonly string[] = ["BINDER_REFERRED", "FINEBINDERY_PROFILE"];

export function commercialOriginOf(acquisitionOrigin: string | null | undefined): CommercialOrigin {
  return acquisitionOrigin && WORKSHOP_ORIGINS.includes(acquisitionOrigin) ? "workshop_client" : "oppe";
}

/** Provenance d'une fiche atelier (contact ou ouvrage), telle que la base la fige. */
export type BinderProvenance = "mon_client" | "ma_reliure" | "workshop_platform";

/** Un ouvrage ou un contact rattaché à une commande Oppe : l'atelier ne lui émet aucun document. */
export function isOppeOrderProvenance(provenance: BinderProvenance | string | null | undefined): boolean {
  return provenance === "ma_reliure";
}

/** Le message renvoyé par la base, dit à l'atelier ou à l'admin. */
export const CIRCUIT_REFUSALS: Record<string, string> = {
  workshop_document_forbidden_on_oppe_order:
    "Ce projet est vendu par Oppe : vous ne facturez pas le client final. Votre facture est adressée à Oppe.",
  oppe_sale_forbidden_on_workshop_client:
    "Ce client appartient à l'atelier qui l'a apporté : Oppe ne lui vend rien. Le devis vient de l'atelier.",
  commercial_origin_locked: "L'origine de ce dossier est figée : un engagement existe déjà.",
  binder_provenance_immutable: "La provenance d'une fiche ne change jamais.",
  payment_circuit_retired: "Ce circuit n'existe plus pour les nouveaux dossiers.",
  circuit_origin_mismatch: "Ce circuit ne correspond pas à l'origine du dossier.",
};

export function circuitRefusal(message: string | null | undefined): string | null {
  if (!message) return null;
  const code = Object.keys(CIRCUIT_REFUSALS).find((key) => message.includes(key));
  return code ? CIRCUIT_REFUSALS[code] : null;
}
