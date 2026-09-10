/**
 * Ce que vaut une marge : OK, Attention, Alerte.
 *
 * Un signal, jamais un verrou. La personne qui arrête un prix peut avoir de
 * bonnes raisons de descendre sous la cible — un premier client, un travail
 * d'appel, un relieur qu'on veut garder — et un écran qui refuse d'enregistrer
 * pousse à maquiller la saisie plutôt qu'à assumer la décision. On montre donc
 * l'état, on l'écrit dans l'historique, et on laisse décider.
 *
 * La marge se calcule toujours sur le **HT** : la TVA n'est pas un revenu, et
 * une marge calculée sur le TTC paraîtrait meilleure de vingt points.
 */
import { formatEuros } from "./money";
import { marginOf } from "./pricebook";

export const MARGIN_STATUSES = ["OK", "ATTENTION", "ALERTE"] as const;
export type MarginStatus = (typeof MARGIN_STATUSES)[number];

export const MARGIN_STATUS_LABELS: Record<MarginStatus, string> = {
  OK: "OK",
  ATTENTION: "Attention",
  ALERTE: "Alerte",
};

export interface MarginInput {
  priceHtCents: number;
  payoutCents: number;
  /** La marge visée, en part du prix HT. */
  targetMarginBps: number;
  /** Le montant de marge en dessous duquel un travail ne vaut pas la peine. */
  minimumMarginCents: number;
}

export interface MarginAssessment {
  status: MarginStatus;
  marginCents: number;
  marginBps: number;
  targetMarginBps: number;
  minimumMarginCents: number;
  reasons: string[];
}

const percent = (bps: number) =>
  `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export function assessMargin(input: MarginInput): MarginAssessment {
  const { marginCents, marginBps } = marginOf(input.priceHtCents, input.payoutCents);
  const base = {
    marginCents,
    marginBps,
    targetMarginBps: input.targetMarginBps,
    minimumMarginCents: input.minimumMarginCents,
  };

  if (marginCents <= 0)
    return {
      ...base,
      status: "ALERTE",
      reasons: ["La rémunération atelier atteint ou dépasse le prix HT."],
    };
  if (marginCents < input.minimumMarginCents)
    return {
      ...base,
      status: "ALERTE",
      reasons: [
        `Marge de ${formatEuros(marginCents)}, sous le minimum de ${formatEuros(input.minimumMarginCents)}.`,
      ],
    };
  if (marginBps < input.targetMarginBps)
    return {
      ...base,
      status: "ATTENTION",
      reasons: [
        `Marge de ${percent(marginBps)}, sous la cible de ${percent(input.targetMarginBps)}.`,
      ],
    };
  return { ...base, status: "OK", reasons: [] };
}
