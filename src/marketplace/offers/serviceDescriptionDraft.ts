/**
 * Brouillon de la prestation demandée à l'atelier, pour que la consigne envoyée soit précise sans
 * être retapée : les travaux chiffrés (catalogue), puis ce que le client a déclaré de l'ouvrage, puis
 * les conditions d'exécution (`WORKSHOP_EXECUTION_POLICY`). L'admin le relit et le corrige avant
 * l'envoi ; rien ne part sans lui.
 *
 * Deux filtres, l'un après l'autre (revue Codex de #193) :
 * 1. le brouillon part TOUJOURS de la projection `project_only`, celle que lit un atelier invité
 *    (`draftServiceDescriptionForCase`) : une ligne de contact, de budget ou réservée au client est
 *    retirée par son `fieldKey`, même mal classée dans un Brief stocké ;
 * 2. puis seules les rubriques qui décrivent le livre et le travail sont reprises (« L'ouvrage »,
 *    « État », « Style », « Finitions ») — liste explicite : une rubrique ajoutée plus tard au
 *    Playbook n'entre pas sans décision.
 */
import type { ProjectBrief } from "@/build/schema/brief";
import { projectCase } from "@/marketplace/cases/dossierProjection";
import type { CaseProfile } from "@/marketplace/cases/caseProfile";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { executionConditions } from "./workshopExecutionPolicy";

export interface DraftLine {
  label: string;
  value: string;
  category: string | null;
}

export interface DraftComponent {
  workItemKey: string;
  label: string;
}

const IDENTITY_CATEGORY = "L'ouvrage";
const IDENTITY_LABELS = new Set(["Titre", "Auteur", "Année d'édition", "Format (H × L × ép., cm)"]);
const DECLARED_CATEGORIES = ["État", "Style", "Finitions"] as const;

/** Un texte d'utilisateur tient sur une ligne et se termine proprement. */
function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function draftServiceDescription(input: {
  title: string;
  reference: string;
  components: readonly DraftComponent[];
  lines: readonly DraftLine[];
  heritage: boolean;
  brandName: string;
}): string {
  const identity = input.lines
    .filter((line) => line.category === IDENTITY_CATEGORY && IDENTITY_LABELS.has(line.label) && clean(line.value))
    .map((line) => `${line.label.replace(/ \(.*\)$/, "")} : ${clean(line.value)}`);

  const works = input.components.map((component) => {
    const hint = WORK_ITEMS.find((item) => item.key === component.workItemKey)?.hint;
    return `- ${clean(component.label)}${hint ? ` : ${hint.charAt(0).toLowerCase()}${hint.slice(1)}` : "."}`;
  });

  const declared = DECLARED_CATEGORIES.flatMap((category) =>
    input.lines
      .filter((line) => line.category === category && clean(line.value))
      .map((line) => `- ${line.label} : ${clean(line.value)}`),
  );

  const conditions = executionConditions(input).map((condition) => `- ${condition}`);

  return [
    `${clean(input.title)} (${input.reference})`,
    ...(identity.length ? [identity.join(" · ")] : []),
    "",
    "Travaux demandés :",
    ...(works.length ? works : ["- À préciser."]),
    ...(declared.length ? ["", "État déclaré par le client (à vérifier à réception) :", ...declared] : []),
    "",
    "Conditions :",
    ...conditions,
  ].join("\n");
}

/**
 * Le brouillon d'un dossier, à partir de ce qu'un atelier invité est autorisé à lire : la projection
 * `project_only`, qui retire contacts et données réservées au client par leur `fieldKey`. C'est la
 * seule entrée à utiliser ; la page admin reçoit le texte déjà composé par le serveur.
 */
export function draftServiceDescriptionForCase(input: {
  reference: string;
  brief: ProjectBrief;
  profile: CaseProfile;
  components: readonly DraftComponent[];
  brandName: string;
}): string {
  const workshopView = projectCase({
    reference: input.reference,
    brief: input.brief,
    profile: input.profile,
    disclosure: "project_only",
    photos: [],
    manualReviewRequired: false,
  });
  return draftServiceDescription({
    title: workshopView.title,
    reference: workshopView.reference,
    components: input.components,
    lines: workshopView.project,
    heritage: workshopView.heritage,
    brandName: input.brandName,
  });
}
