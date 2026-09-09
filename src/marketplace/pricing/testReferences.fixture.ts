/**
 * Trois ateliers qui n'existent pas.
 *
 * Jeu d'essai du référentiel tarifaire : il permet de dérouler le moteur de
 * bout en bout sans attendre d'avoir interrogé de vrais relieurs. Les montants
 * sont ceux de la Phase 25 du cahier des charges — un demi-cuir à 320, 350 et
 * 410 € — choisis pour que la médiane soit vérifiable à la main.
 *
 * Tout y est marqué `TEST_ONLY`, ce qui n'est pas décoratif : `aggregateRates`
 * ne retient que `REAL_VERIFIED`, donc ces lignes ne peuvent pas entrer dans
 * une statistique par accident. Pour les tests qui veulent les voir agréger,
 * `asVerified()` les repromeut explicitement — un geste visible, jamais un
 * effet de bord.
 *
 * Le nom du fichier se termine par `.fixture` et rien dans `src/` hors des
 * tests ne l'importe : `noFabricatedPrices.test.ts` le vérifie.
 */
import type { BinderRate } from "./rateCard";

const BASE = {
  estimatedHours: null,
  notes: null,
  effectiveFrom: "2026-09-01",
  status: "active" as const,
  source: "binder_interview" as const,
  provenance: "TEST_ONLY" as const,
  verifiedAt: null,
  verifiedBy: null,
  sizeClass: "standard" as const,
  complexityClass: "standard" as const,
};

function rate(
  id: string,
  binderId: string,
  binderName: string,
  workItemKey: string,
  min: number,
  typical: number,
  max: number,
): BinderRate & { binderName: string } {
  return {
    ...BASE,
    id,
    binderId,
    binderName,
    workItemKey,
    minimumPayoutCents: min,
    typicalPayoutCents: typical,
    maximumPayoutCents: max,
  };
}

export const TEST_BINDERS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Atelier de test A" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Atelier de test B" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Atelier de test C" },
] as const;

const [A, B, C] = TEST_BINDERS;

export const TEST_RATES: readonly (BinderRate & { binderName: string })[] = [
  // Demi-cuir : 320 / 350 / 410 €. Médiane attendue 350 €.
  rate("r-a-demi", A.id, A.name, "demi_cuir", 30_000, 32_000, 38_000),
  rate("r-b-demi", B.id, B.name, "demi_cuir", 33_000, 35_000, 42_000),
  rate("r-c-demi", C.id, C.name, "demi_cuir", 39_000, 41_000, 47_000),

  // Recouture complète : 70 / 80 / 95 €. Médiane attendue 80 €.
  rate("r-a-recouture", A.id, A.name, "recouture_complete", 6_000, 7_000, 9_000),
  rate("r-b-recouture", B.id, B.name, "recouture_complete", 7_000, 8_000, 10_000),
  rate("r-c-recouture", C.id, C.name, "recouture_complete", 8_500, 9_500, 12_000),

  // Titrage doré : 40 / 45 / 55 €. Médiane attendue 45 €.
  rate("r-a-titrage", A.id, A.name, "dorure_titrage", 3_500, 4_000, 5_000),
  rate("r-b-titrage", B.id, B.name, "dorure_titrage", 4_000, 4_500, 5_500),
  rate("r-c-titrage", C.id, C.name, "dorure_titrage", 5_000, 5_500, 6_500),

  // Nom d'auteur : 25 / 30 / 35 €. Il accompagne presque toujours le titrage,
  // et sans lui aucun dossier de démonstration ne se chiffrait — un seul
  // travail non couvert suffit à faire renoncer le moteur.
  rate("r-a-auteur", A.id, A.name, "dorure_auteur", 2_000, 2_500, 3_000),
  rate("r-b-auteur", B.id, B.name, "dorure_auteur", 2_500, 3_000, 3_500),
  rate("r-c-auteur", C.id, C.name, "dorure_auteur", 3_000, 3_500, 4_000),

  // Le même demi-cuir en grand format, pour éprouver la recherche par classe.
  { ...rate("r-a-demi-l", A.id, A.name, "demi_cuir", 36_000, 39_000, 45_000), sizeClass: "large" },
  { ...rate("r-b-demi-l", B.id, B.name, "demi_cuir", 40_000, 43_000, 50_000), sizeClass: "large" },
  { ...rate("r-c-demi-l", C.id, C.name, "demi_cuir", 46_000, 49_000, 56_000), sizeClass: "large" },

  // Étui, pour les projets « protéger ».
  rate("r-a-etui", A.id, A.name, "etui", 6_000, 7_000, 9_000),
  rate("r-b-etui", B.id, B.name, "etui", 7_500, 8_500, 10_500),
  rate("r-c-etui", C.id, C.name, "etui", 9_000, 10_000, 12_000),
];

/**
 * Repromeut le jeu d'essai en données de référence, pour les tests qui veulent
 * observer l'agrégation. Explicite par construction : sans cet appel, rien de
 * ce fichier ne compte comme une référence de marché.
 */
export function asVerified(
  rates: readonly (BinderRate & { binderName: string })[] = TEST_RATES,
): (BinderRate & { binderName: string })[] {
  return rates.map((rate) => ({ ...rate, provenance: "REAL_VERIFIED" as const }));
}
