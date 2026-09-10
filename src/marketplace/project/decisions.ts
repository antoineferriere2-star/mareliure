/**
 * Une décision n'est pas un message.
 *
 * « Votre livre est bien arrivé » se lit et s'oublie. « Quelle couleur de cuir
 * souhaitez-vous ? » engage la réalisation : la réponse doit être trouvable,
 * datée, attribuée, et ne plus bouger. D'où un objet à part, avec des options
 * figées à la création et une réponse unique — changer d'avis crée une
 * nouvelle décision, l'ancienne reste dans le dossier.
 *
 * Le texte à dorer est le cas le plus sensible : une faute d'orthographe dorée
 * à la feuille d'or ne se corrige pas. Il a sa propre forme — les lignes, dans
 * l'ordre où l'atelier les dorera — et une seule option : « Je confirme ce
 * texte ». La correction passe par la réponse libre, et l'atelier repose la
 * question.
 *
 * Aucune décision ne porte de montant. Un choix qui changerait le prix est un
 * imprévu, et il repasse par Ma Reliure.
 */

export const DECISION_TYPES = [
  "COLOR",
  "MATERIAL",
  "PAPER",
  "GILDING_TEXT",
  "GILDING_STYLE",
  "DECOR",
  "FORMAT_DETAIL",
  "TECHNICAL_CHOICE",
  "OTHER",
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  COLOR: "Couleur",
  MATERIAL: "Matière",
  PAPER: "Papier",
  GILDING_TEXT: "Texte à dorer",
  GILDING_STYLE: "Style de dorure",
  DECOR: "Décor",
  FORMAT_DETAIL: "Détail de format",
  TECHNICAL_CHOICE: "Choix technique",
  OTHER: "Autre question",
};

export const DECISION_STATUSES = ["OPEN", "ANSWERED", "CANCELLED"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export interface DecisionOption {
  id: string;
  label: string;
  description: string | null;
}

/** Les emplacements d'un texte à dorer, dans l'ordre où un relieur les pense. */
export const GILDING_POSITIONS = [
  "Titre",
  "Auteur",
  "Tomaison",
  "Date",
  "Initiales",
  "Autre",
] as const;

export interface GildingLine {
  position: string;
  text: string;
}

export interface GildingText {
  lines: GildingLine[];
}

export const GILDING_CONFIRM_OPTION: DecisionOption = {
  id: "confirm",
  label: "Je confirme ce texte",
  description: null,
};

export const GILDING_WARNING =
  "Vérifiez attentivement l'orthographe, les accents et la ponctuation. Cette validation sera transmise à l'atelier.";

export interface ProjectDecision {
  id: string;
  caseId: string;
  createdByRole: "binder" | "admin";
  decisionType: DecisionType;
  question: string;
  description: string | null;
  options: DecisionOption[];
  gildingText: GildingText | null;
  allowFreeText: boolean;
  status: DecisionStatus;
  selectedOptionId: string | null;
  freeTextAnswer: string | null;
  answeredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  supersedesDecisionId: string | null;
  createdAt: string;
}

export interface DecisionRequestInput {
  decisionType: DecisionType;
  question: string;
  description: string | null;
  options: { label: string; description: string | null }[];
  gildingText: GildingText | null;
  allowFreeText: boolean;
}

export const MAX_DECISION_OPTIONS = 6;

export function validateDecisionRequest(input: DecisionRequestInput): string[] {
  const errors: string[] = [];
  const question = input.question.trim();
  if (question.length < 3 || question.length > 300)
    errors.push("La question doit faire entre 3 et 300 caractères.");
  if (input.description !== null && input.description.length > 2000)
    errors.push("La précision est limitée à 2 000 caractères.");

  if (input.decisionType === "GILDING_TEXT") {
    const lines = input.gildingText?.lines ?? [];
    if (lines.length === 0 || lines.length > 8)
      errors.push("Le texte à dorer compte entre une et huit lignes.");
    for (const line of lines) {
      if (line.text.trim() === "") errors.push("Une ligne du texte à dorer est vide.");
      if (line.text.length > 120) errors.push("Une ligne du texte à dorer dépasse 120 caractères.");
      if (line.position.trim() === "") errors.push("Chaque ligne dit où elle sera dorée.");
    }
    if (input.options.length > 0)
      errors.push("Le texte à dorer se confirme : il ne propose pas d'options.");
    return errors;
  }

  if (input.gildingText !== null) errors.push("Seul un texte à dorer porte des lignes de dorure.");
  const labels = input.options.map((option) => option.label.trim());
  if (labels.length === 0 || labels.length > MAX_DECISION_OPTIONS)
    errors.push(`Proposez entre une et ${MAX_DECISION_OPTIONS} options.`);
  if (labels.some((label) => label === "" || label.length > 80))
    errors.push("Chaque option a un libellé de 1 à 80 caractères.");
  if (new Set(labels.map((label) => label.toLocaleLowerCase("fr"))).size !== labels.length)
    errors.push("Deux options portent le même libellé.");
  // Une seule option sans réponse libre n'est pas un choix : c'est un ordre.
  if (labels.length === 1 && !input.allowFreeText)
    errors.push("Une seule option n'est un choix que si le client peut répondre autre chose.");
  return errors;
}

/** Les options telles qu'elles seront figées. Les identifiants ne dépendent pas des libellés. */
export function buildDecisionOptions(input: DecisionRequestInput): DecisionOption[] {
  if (input.decisionType === "GILDING_TEXT") return [GILDING_CONFIRM_OPTION];
  return input.options.map((option, index) => ({
    id: `option-${index + 1}`,
    label: option.label.trim(),
    description: option.description?.trim() || null,
  }));
}

/** Un texte à dorer accepte toujours une correction : c'est sa seule sortie honnête. */
export function allowsFreeText(input: DecisionRequestInput): boolean {
  return input.decisionType === "GILDING_TEXT" ? true : input.allowFreeText;
}

export function validateDecisionAnswer(
  decision: Pick<ProjectDecision, "status" | "options" | "allowFreeText">,
  answer: { optionId: string | null; freeText: string | null },
): string[] {
  if (decision.status !== "OPEN") return ["Cette décision est déjà tranchée."];
  if (answer.optionId !== null) {
    return decision.options.some((option) => option.id === answer.optionId)
      ? []
      : ["Cette option n'existe pas."];
  }
  if (!decision.allowFreeText) return ["Choisissez une des options proposées."];
  if (!answer.freeText?.trim()) return ["Écrivez votre réponse."];
  if (answer.freeText.length > 2000) return ["La réponse est limitée à 2 000 caractères."];
  return [];
}

/** Ce que la décision a retenu, en une phrase lisible. `null` tant qu'elle est ouverte. */
export function decisionOutcome(decision: ProjectDecision): string | null {
  if (decision.status === "CANCELLED") return "Question retirée";
  if (decision.status !== "ANSWERED") return null;
  const option = decision.options.find((candidate) => candidate.id === decision.selectedOptionId);
  if (decision.decisionType === "GILDING_TEXT")
    return option ? "Texte confirmé" : `Correction demandée : ${decision.freeTextAnswer ?? ""}`;
  if (option)
    return decision.freeTextAnswer ? `${option.label} — ${decision.freeTextAnswer}` : option.label;
  return decision.freeTextAnswer;
}
