/**
 * Du projet décrit par Métré aux travaux du catalogue.
 *
 * C'est l'étape qui manquait. L'ancien moteur sautait directement des réponses
 * à des montants : chaque condition ajoutait des centimes, et le raisonnement
 * du métier — « ce livre-là demande une recouture complète et un demi-cuir »
 * — n'existait nulle part. On ne pouvait donc ni le discuter avec un relieur,
 * ni le tarifer à partir de sa grille.
 *
 * Ici, les réponses produisent une liste de travaux nommés. Les montants
 * viennent après, d'ailleurs, et seulement du terrain.
 *
 * Deux garde-fous :
 *
 * - **On ne lit que des réponses structurées**, jamais une phrase du Project
 *   Brief. Le Brief est écrit pour une personne ; le reformuler casserait
 *   silencieusement le chiffrage. C'est la même règle que `caseProfile.ts`.
 * - **Aucune valeur d'option en dur** : tout passe par `CASE_ANSWER_VALUES`,
 *   dont un test de contrat vérifie qu'elles existent encore dans le Playbook.
 */
import { CASE_ANSWER_VALUES, type CaseProfile } from "@/marketplace/cases/caseProfile";
import type { ComplexityClass, SizeClass } from "./catalog";

export interface ResolvedWork {
  /** Les travaux identifiés, dans l'ordre du catalogue : structure puis compléments. */
  workItemKeys: string[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  /** Réponses absentes qui pèsent sur le chiffrage, en français. */
  missingAnswers: string[];
}

const V = CASE_ANSWER_VALUES;

/**
 * La structure : le travail principal, celui qui définit l'ouvrage rendu.
 *
 * Un projet en porte au plus un. Renvoie `null` quand l'intention n'en implique
 * aucune — personnaliser un livre déjà relié, par exemple, n'est que de la
 * dorure et du décor.
 */
function resolveStructure(profile: CaseProfile): string | null {
  const intent = profile.intent;

  if (intent === V.intent.restore) {
    if (profile.heritage) return "restauration_patrimoniale";
    if (profile.material === V.material.halfLeather || profile.material === V.material.fullLeather)
      return "restauration_cuir";
    return "restauration_cartonnage";
  }

  if (intent === V.intent.repair) {
    // Une réparation n'a de structure que si le corps d'ouvrage a quitté sa
    // couverture. Sinon ce sont des reprises ponctuelles, et elles se
    // facturent une par une.
    const detached =
      profile.boardCondition === V.boardCondition.detached ||
      profile.condition.includes(V.condition.detachedCover);
    return detached ? "reemboitage" : null;
  }

  if (intent === V.intent.collector) return "rebind_collector";

  if (intent === V.intent.protect) {
    if (profile.finishes.includes(V.finishes.slipcase)) return "etui";
    return "boite";
  }

  // Personnaliser : on embellit un livre déjà relié. Pas de structure.
  if (intent === V.intent.personalise) return null;

  if (intent === V.intent.fineBinding || intent === V.intent.recover) {
    switch (profile.material) {
      case V.material.fullLeather:
        return "plein_cuir";
      case V.material.halfLeather:
        return "demi_cuir";
      case V.material.cloth:
        return "pleine_toile";
      case V.material.decoratedPaper:
        return "demi_toile";
      default:
        return null;
    }
  }

  return null;
}

function resolveComplements(profile: CaseProfile): string[] {
  const works: string[] = [];
  const has = (value: string) => profile.condition.includes(value);
  const finish = (value: string) => profile.finishes.includes(value);

  if (
    has(V.condition.damagedSpine) ||
    profile.spineCondition === V.spineCondition.fragile ||
    profile.spineCondition === V.spineCondition.split ||
    profile.spineCondition === V.spineCondition.missing
  )
    works.push("reparation_dos");

  if (profile.boardCondition === V.boardCondition.detached) works.push("reparation_plats");
  else if (profile.boardCondition === V.boardCondition.worn) works.push("reparation_coins");

  if (profile.sewingCondition === V.sewingCondition.someLoose) works.push("couture_partielle");
  else if (profile.sewingCondition === V.sewingCondition.detached) works.push("recouture_complete");

  if (has(V.condition.detachedPages)) works.push("pages_detachees");
  if (has(V.condition.tornPages) || has(V.condition.missingPages)) works.push("reparation_papier");
  // L'humidité et la moisissure sont d'abord un problème de papier. La
  // moisissure déclenche par ailleurs la revue manuelle en amont (triage).
  if (has(V.condition.damp) || has(V.condition.mould)) works.push("restauration_papier");

  if (finish(V.finishes.title)) works.push("dorure_titrage");
  if (finish(V.finishes.author)) works.push("dorure_auteur");
  if (finish(V.finishes.gilding)) works.push("dorure_decor");
  if (finish(V.finishes.bands)) works.push("nerfs");
  if (finish(V.finishes.decoratedEndpapers)) works.push("gardes_decorees");
  if (finish(V.finishes.gildedEdges)) works.push("tranches");
  if (finish(V.finishes.slipcase)) works.push("etui");

  return works;
}

/**
 * Le format, à partir de la hauteur du livre.
 *
 * La hauteur seule, parce que c'est ce qu'un relieur annonce quand il classe
 * un ouvrage, et parce que c'est la dimension que les visiteurs renseignent le
 * plus fiablement. Sans hauteur, on retient le format courant et on le signale
 * comme information manquante plutôt que de deviner.
 */
export function sizeClassOf(heightCm: number | null): SizeClass {
  if (heightCm === null) return "standard";
  if (heightCm < 18) return "small";
  if (heightCm <= 28) return "standard";
  if (heightCm <= 38) return "large";
  return "oversize";
}

/**
 * La complexité, à partir de ce que le projet montre.
 *
 * Ne renvoie jamais `simple`, volontairement. La classe existe au catalogue
 * parce qu'un relieur peut vouloir tarifer une variante allégée sur sa grille,
 * mais nous ne sommes pas en position de la déduire : un demi-cuir sans
 * dommage déclaré n'est pas un demi-cuir « simple », c'est le demi-cuir
 * courant. Le déduire faisait chercher un tarif que personne ne saisit, et
 * chaque projet ordinaire ressortait en approximation.
 *
 * Le sens est donc : `standard` par défaut, `complex` quand quelque chose le
 * justifie. Une classe qu'on ne sait pas reconnaître ne se devine pas.
 */
function complexityOf(profile: CaseProfile, workCount: number): ComplexityClass {
  if (profile.heritage) return "complex";
  if (profile.condition.length >= 3 || workCount >= 5) return "complex";
  return "standard";
}

export function resolveWork(profile: CaseProfile): ResolvedWork {
  const structure = resolveStructure(profile);
  const complements = resolveComplements(profile);

  // `etui` peut arriver deux fois : comme structure d'un projet « protéger »
  // et comme finition demandée. Un travail ne se facture qu'une fois.
  const workItemKeys = [...new Set([...(structure ? [structure] : []), ...complements])];

  const missingAnswers: string[] = [];
  if (profile.heightCm === null) missingAnswers.push("hauteur du livre");
  if (profile.material === null && structure === null && complements.length === 0)
    missingAnswers.push("matière souhaitée");
  if (profile.sewingCondition === null && profile.intent === V.intent.repair)
    missingAnswers.push("état des cahiers");

  return {
    workItemKeys,
    sizeClass: sizeClassOf(profile.heightCm),
    complexityClass: complexityOf(profile, workItemKeys.length),
    missingAnswers,
  };
}
