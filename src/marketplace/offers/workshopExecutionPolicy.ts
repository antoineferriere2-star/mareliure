/**
 * Politique d'exécution confiée aux ateliers — les conditions qui accompagnent toute prestation
 * Oppe. C'est une règle métier : elle vit ici, versionnée, et non dans l'interface ni dans le
 * générateur de texte, qui se contente de la recopier (revue Codex de #193, CLAUDE.md « toute règle
 * métier appartient au Playbook »). Elle n'est pas portée par le Playbook de la Mission parce
 * qu'elle ne dépend pas du visiteur ni de son parcours : elle engage l'atelier envers la marque,
 * pour tous les dossiers, quel que soit le Playbook qui les a produits.
 *
 * Toute modification change `version` et demande l'accord d'Antoine.
 */
export const WORKSHOP_EXECUTION_POLICY = {
  version: "oppe-execution-2026-11-09",
  conditions: [
    "Conserver les éléments d'origine (couvrure, gardes, fermoir, tranches, décors), sauf accord préalable.",
    "Tout travail non prévu ci-dessus (recouture, remplacement de matériaux, nettoyage ou teinture du cuir) : prévenir {brand} avant d'intervenir.",
  ],
  heritageCondition: "Ouvrage ancien : examen à réception, avec un avis transmis à {brand} avant de commencer.",
  closingConditions: ["Photos avant et après le travail, déposées dans le dossier."],
} as const;

/** Les conditions du dossier, la marque remplacée. */
export function executionConditions(input: { heritage: boolean; brandName: string }): string[] {
  const policy = WORKSHOP_EXECUTION_POLICY;
  const withBrand = (text: string) => text.replaceAll("{brand}", input.brandName);
  return [
    ...policy.conditions.map(withBrand),
    ...(input.heritage ? [withBrand(policy.heritageCondition)] : []),
    ...policy.closingConditions.map(withBrand),
  ];
}
