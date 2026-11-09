/**
 * Brouillon de la prestation demandée à l'atelier, pour que la consigne envoyée soit précise sans
 * être retapée : les travaux chiffrés (catalogue), puis ce que le client a déclaré de l'ouvrage, puis
 * les conditions d'exécution. L'admin le relit et le corrige avant l'envoi ; rien ne part sans lui.
 *
 * Le texte ne reprend que des rubriques du Playbook qui décrivent le livre et le travail (« L'ouvrage »,
 * « État », « Style », « Finitions ») : jamais le contact, la valeur ni le budget du client, qui ne
 * regardent pas l'atelier. Les rubriques retenues sont une liste explicite, pas une exclusion : une
 * rubrique ajoutée plus tard au Playbook n'entre pas dans le texte sans décision.
 */
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";

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

  const conditions = [
    "- Conserver les éléments d'origine (couvrure, gardes, fermoir, tranches, décors), sauf accord préalable.",
    `- Tout travail non prévu ci-dessus (recouture, remplacement de matériaux, nettoyage ou teinture du cuir) : prévenir ${input.brandName} avant d'intervenir.`,
    ...(input.heritage
      ? [`- Ouvrage ancien : examen à réception, avec un avis transmis à ${input.brandName} avant de commencer.`]
      : []),
    "- Photos avant et après le travail, déposées dans le dossier.",
  ];

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
