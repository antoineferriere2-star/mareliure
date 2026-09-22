/**
 * L'état du constructeur de devis, en données pures : ce que le relieur a tapé
 * (des textes), le total qui s'en déduit en direct, et la saisie propre que le
 * serveur reçoit. Aucun composant ici — c'est ce qui rend le calcul en direct
 * testable sans navigateur.
 *
 * Le total affiché à l'écran et celui que le serveur enregistre viennent du même
 * `computeQuote` ; le serveur, lui, ne reçoit jamais le total affiché.
 */
import { computeQuote, type DepositInput, type DiscountInput, type QuoteTotals, type VatRegime } from "./quoteCalc";
import { parseEurosToCents, parsePercentToBps, centsToEuroInput, bpsToPercentInput } from "./quoteFormat";
import { parseMillimetres, type QuoteLine } from "./quoteLines";
import { quoteInput, type QuoteInput } from "./quoteInput";
import type { DocumentView } from "./quoteViews";
import type { ContactView, WorkView } from "@/marketplace/works/workViews";

export type AdjustmentType = "NONE" | "PERCENT" | "AMOUNT";

export interface BuilderState {
  /** L'ouvrage d'où vient ce devis (« Créer un devis » depuis sa fiche), ou `null`. */
  workId: string | null;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientPostalCode: string;
  clientCity: string;
  title: string;
  author: string;
  bookNotes: string;
  /** Saisies en millimètres, telles que tapées. */
  height: string;
  width: string;
  spine: string;
  lines: QuoteLine[];
  discountType: AdjustmentType;
  discountValue: string;
  depositType: AdjustmentType;
  depositValue: string;
  /** Vide : la durée du profil. */
  validityDays: string;
  notes: string;
}

export const emptyBuilder = (): BuilderState => ({
  workId: null,
  clientId: null,
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  clientPostalCode: "",
  clientCity: "",
  title: "",
  author: "",
  bookNotes: "",
  height: "",
  width: "",
  spine: "",
  lines: [],
  discountType: "NONE",
  discountValue: "",
  depositType: "NONE",
  depositValue: "",
  validityDays: "",
  notes: "",
});

const adjustment = (type: AdjustmentType, value: string): DiscountInput & DepositInput => {
  if (type === "PERCENT") return { type, bps: parsePercentToBps(value) ?? 0 };
  if (type === "AMOUNT") return { type, cents: parseEurosToCents(value) ?? 0 };
  return { type: "NONE" };
};

/** Les lignes qui comptent déjà dans le total : un libellé et un prix valides. */
const countable = (lines: QuoteLine[]) => lines.filter((l) => l.label.trim() !== "" && l.quantity > 0);

/**
 * Le total en direct. Tant que l'atelier n'a pas choisi son régime, l'aperçu
 * applique les taux des lignes (c'est une aperçu — le devis, lui, exige le régime).
 */
export function totalsOf(state: BuilderState, regime: VatRegime | null): QuoteTotals {
  return computeQuote({
    lines: countable(state.lines).map((l) => ({ quantity: l.quantity, unitPriceCents: l.unitPriceCents, vatRateBps: l.vatRateBps })),
    vatRegime: regime ?? "VAT_LIABLE",
    discount: adjustment(state.discountType, state.discountValue),
    deposit: adjustment(state.depositType, state.depositValue),
  });
}

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

export type BuiltInput = { ok: true; input: QuoteInput } | { ok: false; problems: string[] };

export function toQuoteInput(state: BuilderState): BuiltInput {
  const problems: string[] = [];
  if (state.lines.some((line) => line.requiresManualPrice && line.unitPriceCents <= 0))
    problems.push("Définissez le prix pour chaque prestation sur étude.");
  const dim = (raw: string, label: string) => {
    if (raw.trim() === "") return null;
    const value = parseMillimetres(raw);
    if (value === null) problems.push(`${label} : saisissez un nombre de millimètres.`);
    return value;
  };
  const heightMm = dim(state.height, "Hauteur");
  const widthMm = dim(state.width, "Largeur");
  const spineMm = dim(state.spine, "Dos");

  if (state.discountType !== "NONE" && (state.discountType === "PERCENT" ? parsePercentToBps(state.discountValue) : parseEurosToCents(state.discountValue)) === null) {
    problems.push("Remise : valeur invalide.");
  }
  if (state.depositType !== "NONE" && (state.depositType === "PERCENT" ? parsePercentToBps(state.depositValue) : parseEurosToCents(state.depositValue)) === null) {
    problems.push("Acompte : valeur invalide.");
  }
  const validity = state.validityDays.trim() === "" ? null : Number(state.validityDays);
  if (validity !== null && !(Number.isInteger(validity) && validity >= 1 && validity <= 365)) problems.push("Validité : entre 1 et 365 jours.");

  const candidate = {
    // Ajouté seulement s'il existe : un devis sans ouvrage envoie exactement ce qu'il envoyait avant.
    ...(state.workId ? { workId: state.workId } : {}),
    clientId: state.clientId,
    client: {
      name: state.clientName,
      email: blank(state.clientEmail),
      phone: blank(state.clientPhone),
      addressLine1: blank(state.clientAddress),
      postalCode: blank(state.clientPostalCode),
      city: blank(state.clientCity),
      country: null,
    },
    book: { title: blank(state.title), author: blank(state.author), heightMm, widthMm, spineMm, notes: blank(state.bookNotes) },
    lines: state.lines.map((l) => ({
      serviceId: l.serviceId,
      label: l.label,
      description: blank(l.description),
      unit: l.unit,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      catalogPriceCents: l.catalogPriceCents,
      vatRateBps: l.vatRateBps,
      ...(l.referenceVersion && l.referenceOperationKey ? { referenceVersion: l.referenceVersion, referenceOperationKey: l.referenceOperationKey } : {}),
    })),
    discount: adjustment(state.discountType, state.discountValue) as never,
    deposit: adjustment(state.depositType, state.depositValue) as never,
    validityDays: validity,
    notes: blank(state.notes),
  };
  const parsed = quoteInput.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "client" && issue.path[1] === "name") problems.push("Nom du client requis.");
      else if (issue.path[0] === "lines" && issue.path.length === 1) problems.push("Ajoutez au moins une prestation.");
      else if (issue.path[0] === "lines" && issue.path[2] === "label") problems.push("Une ligne n'a pas de libellé.");
      else if (issue.path[0] === "lines") problems.push("Une ligne a une quantité ou un prix invalide.");
    }
  }
  const unique = [...new Set(problems)];
  return unique.length === 0 && parsed.success ? { ok: true, input: parsed.data } : { ok: false, problems: unique.length ? unique : ["Vérifiez le devis."] };
}

/**
 * Un devis qui part d'un ouvrage : le contact et le livre sont déjà connus, on ne les ressaisit
 * pas. Le devis en gardera un SNAPSHOT (comme toujours) : modifier la fiche de l'ouvrage plus
 * tard ne change pas ce devis.
 */
export function stateFromWork(work: WorkView, contact: ContactView | null): BuilderState {
  const mm = (v: number | null) => (v === null ? "" : String(v));
  return {
    ...emptyBuilder(),
    workId: work.id,
    clientId: contact?.id ?? null,
    clientName: contact?.name ?? "",
    clientEmail: contact?.email ?? "",
    clientPhone: contact?.phone ?? "",
    clientAddress: contact?.addressLine1 ?? "",
    clientPostalCode: contact?.postalCode ?? "",
    clientCity: contact?.city ?? "",
    title: work.title,
    author: work.author ?? "",
    bookNotes: work.conditionNotes ?? "",
    height: mm(work.heightMm),
    width: mm(work.widthMm),
    spine: mm(work.thicknessMm),
  };
}

/** Un devis existant, remis dans le constructeur pour être modifié. */
export function stateFromDocument(doc: DocumentView): BuilderState {
  const adj = (type: "NONE" | "PERCENT" | "AMOUNT", value: number): [AdjustmentType, string] =>
    type === "PERCENT" ? [type, bpsToPercentInput(value)] : type === "AMOUNT" ? [type, centsToEuroInput(value)] : ["NONE", ""];
  const [discountType, discountValue] = adj(doc.discountType, doc.discountValue);
  const [depositType, depositValue] = adj(doc.depositType, doc.depositValue);
  const mm = (v: number | null) => (v === null ? "" : String(v));
  return {
    workId: doc.workId ?? null,
    clientId: doc.client.id,
    clientName: doc.client.name,
    clientEmail: doc.client.email ?? "",
    clientPhone: doc.client.phone ?? "",
    clientAddress: doc.client.addressLine1 ?? "",
    clientPostalCode: doc.client.postalCode ?? "",
    clientCity: doc.client.city ?? "",
    title: doc.book.title ?? "",
    author: doc.book.author ?? "",
    bookNotes: doc.book.notes ?? "",
    height: mm(doc.book.heightMm),
    width: mm(doc.book.widthMm),
    spine: mm(doc.book.spineMm),
    lines: doc.items.map((item) => ({
      key: `doc-${item.position}`,
      serviceId: item.serviceId,
      label: item.label,
      description: item.description ?? "",
      unit: item.unit,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      catalogPriceCents: item.catalogPriceCents,
      vatRateBps: item.vatRateBps,
      priceSource: item.serviceId ? "catalog" : item.referenceOperationKey && item.description === "Tarif de base Ma Reliure" ? "base" : "manual",
      requiresManualPrice: false,
      referenceVersion: item.referenceVersion ?? null,
      referenceOperationKey: item.referenceOperationKey ?? null,
    })),
    discountType,
    discountValue,
    depositType,
    depositValue,
    validityDays: doc.validUntil && doc.issueDate
      ? String(Math.round((Date.parse(`${doc.validUntil}T00:00:00Z`) - Date.parse(`${doc.issueDate}T00:00:00Z`)) / 86_400_000))
      : "",
    notes: doc.notes ?? "",
  };
}
