/**
 * The single module allowed to turn a Métré Dossier into something the
 * marketplace shows.
 *
 * Everything else in `src/marketplace/` reads a `CaseView`, never a
 * `ProjectBrief` and never `build_dossiers`. One narrow door means the day the
 * marketplace is extracted into its own service there is exactly one seam to
 * cut, and — more urgently — exactly one place where a customer's e-mail can
 * leak to a relieur who has not been chosen.
 *
 * Pure: brief in, view out. Signed photo URLs are resolved by the caller (only
 * the server has Storage credentials) and passed in.
 */
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import type { CaseDisclosure } from "@/marketplace/permissions";
import { CASE_ANSWER_KEYS, type CaseProfile } from "./caseProfile";

/**
 * Answer keys that identify the customer. A Brief line carrying one of these,
 * or filed under the "Contact" category, never reaches a relieur before they
 * are selected.
 */
export const CONTACT_FIELD_KEYS: readonly string[] = [
  "name",
  "email",
  "phone",
  CASE_ANSWER_KEYS.location,
];

const CONTACT_CATEGORY = "Contact";

/**
 * Le budget annoncé par le client ne regarde pas l'atelier.
 *
 * Ma Reliure fixe le prix et propose une rémunération ; l'atelier accepte ou
 * refuse. Lui montrer ce que le client disait vouloir mettre lui donne de quoi
 * reconstituer la marge, et lui fait juger une offre à l'aune d'un chiffre qui
 * n'est pas le sien. Sur un dossier réel de la base de développement, le Brief
 * annonçait « 250 – 400 € » là où le prix client était 440 € et l'offre 355 € :
 * trois nombres dont un seul concerne l'atelier.
 *
 * Le délai souhaité, lui, reste : c'est une contrainte de travail, pas une
 * information de négociation.
 */
const CUSTOMER_ONLY_FIELD_KEYS: readonly string[] = [CASE_ANSWER_KEYS.budget];

export interface CaseViewLine {
  label: string;
  value: string;
  source: BriefLine["source"];
  category: string | null;
}

export interface CaseViewPhoto {
  url: string | null;
  caption: string | null;
}

export interface CaseContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface CaseView {
  reference: string;
  /** The book's title — what everyone calls this case. */
  title: string;
  summary: string;
  /** Confirmed answers, assumptions and constraints, each keeping its own provenance. */
  project: CaseViewLine[];
  constraints: CaseViewLine[];
  budgetAndTiming: CaseViewLine[];
  /** Never a promise: what the Playbook says is still unknown. */
  missingInformation: CaseViewLine[];
  photos: CaseViewPhoto[];
  /** Town only, always shown — a relieur needs to know where the book is. */
  area: string | null;
  /** Present only at `full` disclosure. Null for an invited-but-unchosen relieur. */
  contact: CaseContact | null;
  /** Mirrors the Playbook's own heritage line, so the view can lead with it. */
  heritage: boolean;
  manualReviewRequired: boolean;
}

function isCustomerOnlyLine(line: BriefLine): boolean {
  return line.fieldKey !== undefined && CUSTOMER_ONLY_FIELD_KEYS.includes(line.fieldKey);
}

function isContactLine(line: BriefLine): boolean {
  return (
    (line.fieldKey !== undefined && CONTACT_FIELD_KEYS.includes(line.fieldKey)) ||
    line.category === CONTACT_CATEGORY
  );
}

function toViewLine(line: BriefLine): CaseViewLine {
  return {
    label: line.label,
    value: line.value,
    source: line.source,
    category: line.category ?? null,
  };
}

function findValue(lines: readonly BriefLine[], fieldKey: string): string | null {
  return lines.find((line) => line.fieldKey === fieldKey)?.value ?? null;
}

export interface ProjectCaseInput {
  reference: string;
  brief: ProjectBrief;
  profile: CaseProfile;
  disclosure: CaseDisclosure;
  photos: CaseViewPhoto[];
  manualReviewRequired: boolean;
}

/**
 * Le résumé, amputé des phrases qui citent une réponse réservée au client.
 *
 * Deux chemins, parce qu'un Project Brief est **stocké** dans
 * `build_dossiers.content` et relu tel quel : les Dossiers déjà en base ont été
 * écrits avant que le moteur découpe son résumé, et ils ne porteront jamais de
 * `projectSummaryParts`.
 *
 * Le chemin nominal filtre les parts par les clés de réponse qu'elles ont
 * interpolées — précis, et sans découper de la prose à l'aveugle.
 *
 * Le repli est plus grossier et doit l'être : il retire toute phrase qui
 * contient la valeur retenue, telle qu'elle est écrite dans la ligne du Brief.
 * Il peut emporter une phrase de trop ; il ne peut pas en laisser passer une.
 * L'inverse — retomber sur le résumé complet — était la première version de ce
 * code, et elle laissait le budget visible sur tous les dossiers existants,
 * c'est-à-dire sur tous les vrais.
 */
export function disclosedSummary(brief: ProjectBrief, disclosure: CaseDisclosure): string {
  return summaryFor(brief, disclosure === "full");
}

function summaryFor(brief: ProjectBrief, showsCustomerBudget: boolean): string {
  if (showsCustomerBudget) return brief.projectSummary;

  const parts = brief.projectSummaryParts;
  if (parts && parts.length > 0)
    return parts
      .filter((part) => !part.fieldKeys.some((key) => CUSTOMER_ONLY_FIELD_KEYS.includes(key)))
      .map((part) => part.text)
      .join(" ");

  const withheld = brief.budgetAndTiming
    .filter(isCustomerOnlyLine)
    .map((line) => line.value.trim())
    .filter((value) => value.length > 2);
  if (withheld.length === 0) return brief.projectSummary;

  // Les fragments sont assemblés par une espace et se terminent par un point ;
  // découper là redonne à peu près les phrases d'origine.
  return brief.projectSummary
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !withheld.some((value) => sentence.includes(value)))
    .join(" ")
    .trim();
}

export function projectCase(input: ProjectCaseInput): CaseView {
  const { brief, profile, disclosure } = input;
  // Les coordonnées suivent la divulgation ; le budget annoncé n'appartient
  // qu'à Ma Reliure et au client, jamais à un atelier, retenu ou non.
  const showsContact = disclosure === "full" || disclosure === "assigned";
  const showsCustomerBudget = disclosure === "full";

  const projectLines = [...brief.confirmedInformation, ...brief.assumptionsAndCalculated]
    .filter((line) => showsContact || !isContactLine(line))
    .map(toViewLine);

  const contact: CaseContact | null = showsContact
    ? {
        name: findValue(brief.confirmedInformation, "name"),
        email: findValue(brief.confirmedInformation, "email"),
        phone: findValue(brief.confirmedInformation, "phone"),
        location: findValue(brief.confirmedInformation, CASE_ANSWER_KEYS.location),
      }
    : null;

  return {
    reference: input.reference,
    // The Playbook names the Dossier after the book; the reference is the
    // fallback for a submission that predates that or came from elsewhere.
    title: profile.title?.trim() || brief.missionName.trim() || input.reference,
    // Le résumé est refiltré, pas seulement les lignes. Le budget annoncé
    // était retiré du champ « Budget » et restait dans la phrase d'ouverture —
    // « … Matière souhaitée : demi-cuir. Budget 250 – 400 €. » — que tout
    // atelier lisait, y compris dans sa liste de projets. Un filtre qui ne
    // couvre qu'une des deux surfaces ne filtre rien.
    summary: summaryFor(brief, showsCustomerBudget),
    project: projectLines,
    constraints: brief.constraints.map(toViewLine),
    budgetAndTiming: brief.budgetAndTiming
      .filter((line) => showsCustomerBudget || !isCustomerOnlyLine(line))
      .map(toViewLine),
    missingInformation: brief.missingInformation.map(toViewLine),
    photos: input.photos,
    // The town, never the street: enough to judge shipping, not enough to
    // turn up at someone's door.
    area: profile.city,
    contact,
    heritage: profile.heritage,
    manualReviewRequired: input.manualReviewRequired,
  };
}
