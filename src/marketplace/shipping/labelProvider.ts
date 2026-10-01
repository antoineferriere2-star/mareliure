/**
 * Contrat d'un fournisseur d'étiquettes, indépendant du prix et du transporteur.
 *
 * La référence externe d'un achat est TOUJOURS l'identifiant de la réservation (un par dossier
 * et par sens) : un fournisseur qui la traite comme clé d'unicité (Sendcloud :
 * `external_reference_id`, doublon ⇒ 409 avec l'envoi existant) rend la reprise sans double achat.
 */
export type LabelDirection = "outbound" | "return";

/** Adresses et colis : passés au fournisseur, jamais écrits dans le journal ni les logs. */
export interface LabelRequest {
  reference: string;
  direction: LabelDirection;
  shippingOptionCode: string;
  from: PostalParty;
  to: PostalParty;
  parcel: { weightGrams: number; dimensionsMm: [number, number, number] };
}
export interface PostalParty {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  email?: string | null;
  phone?: string | null;
}

export interface ProviderLabel {
  provider: string;
  /** Identifiant du colis chez le fournisseur : clé des webhooks. */
  labelId: string;
  carrier: string;
  tracking: string;
  /** Montant facturé connu à la création, `null` si le fournisseur ne le donne pas. */
  chargedTtcCents: number | null;
  status: { code: string; message: string } | null;
  /** Étiquette PDF, chargée seulement pour la stocker en privé. */
  pdf: () => Promise<Uint8Array>;
}

export type CreateOutcome =
  /** Étiquette créée (ou déjà existante pour cette référence). */
  | { kind: "created"; label: ProviderLabel }
  /** Refus définitif de validation : rien n'a été créé. */
  | { kind: "rejected"; code: string }
  /** Rien n'a été créé et on peut réessayer (limite de débit, identifiants refusés). */
  | { kind: "not_created"; code: string }
  /** Délai, réseau, 5xx : une étiquette peut exister. */
  | { kind: "ambiguous"; code: string };

export type CancelOutcome =
  | { kind: "cancelled"; reference: string }
  | { kind: "queued"; reference: string }
  | { kind: "refused"; code: string }
  | { kind: "ambiguous"; code: string };

export interface LabelProvider {
  readonly name: string;
  create(request: LabelRequest): Promise<CreateOutcome>;
  /** `null` = le fournisseur confirme l'absence ; `"unknown"` = lecture impossible. */
  findByReference(reference: string): Promise<ProviderLabel | null | "unknown">;
  cancel(reference: string): Promise<CancelOutcome>;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
export const LABEL_MAX_BYTES = 5 * 1024 * 1024;
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > PDF_MAGIC.length && bytes.length <= LABEL_MAX_BYTES && PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}
