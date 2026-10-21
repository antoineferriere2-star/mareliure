/**
 * Où s'arrêtent les présentations « Présenter mon livre » / « Start your project » : calcul pur.
 *
 * La Mission enregistre les réponses au fil de l'eau ; l'étape la plus avancée d'une session est la
 * dernière étape du Playbook dont au moins une question a reçu une réponse. Seuls les **noms** des
 * questions répondues entrent ici, jamais les réponses (aucune donnée personnelle).
 *
 * Une session naît à l'affichage de la page : « aucune réponse » compte aussi les robots, les aperçus
 * de lien et nos propres recettes. Le chiffre utile est la suite : qui répond, et jusqu'où.
 */
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import type { PlaybookSchema } from "@/build/schema/playbook";

export interface IntakeSessionFacts {
  brand: MarketplaceBrand;
  created_at: string;
  submitted: boolean;
  /** Noms des questions répondues (clés de `answers`), sans les valeurs. */
  keys: string[];
}

export interface IntakeFunnel {
  opened: number;
  answeredFirst: number;
  submitted: number;
  /** Une ligne par étape : sessions arrivées au moins jusqu'à elle, et sessions arrêtées sur elle. */
  steps: { id: string; title: string; reached: number; stoppedHere: number }[];
}

export function buildIntakeFunnel(sessions: IntakeSessionFacts[], schema: PlaybookSchema, options: { brand: MarketplaceBrand | "ALL"; since: string | null }): IntakeFunnel {
  const steps = schema.sections.flatMap((section) => section.steps);
  const stepOf = new Map<string, number>();
  steps.forEach((step, index) => step.fields.forEach((field) => stepOf.set(field.key, index)));
  const sinceMs = options.since ? Date.parse(options.since) : null;
  const inScope = sessions.filter((session) =>
    (options.brand === "ALL" || session.brand === options.brand)
    && (sinceMs === null || Date.parse(session.created_at) >= sinceMs));

  // -1 : aucune réponse ; une session envoyée est allée au bout, quelles que soient les étapes facultatives.
  const furthest = inScope.map((session) =>
    session.submitted ? steps.length - 1 : Math.max(-1, ...session.keys.map((key) => stepOf.get(key) ?? -1)));
  return {
    opened: inScope.length,
    answeredFirst: furthest.filter((index) => index >= 0).length,
    submitted: inScope.filter((session) => session.submitted).length,
    steps: steps.map((step, index) => ({
      id: step.id,
      title: step.title,
      reached: furthest.filter((value) => value >= index).length,
      stoppedHere: inScope.filter((session, i) => !session.submitted && furthest[i] === index).length,
    })),
  };
}
