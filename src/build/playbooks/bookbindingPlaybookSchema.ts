/**
 * The Bookbinding (Reliure) Playbook — the second curated vertical, and the
 * one the Reliure marketplace runs on. Like the Deck Playbook beside it, it is
 * **data only**: every question, every branch, every trap and every line of the
 * resulting Dossier is expressed here and interpreted by the generic engine in
 * `src/build/engine/`. No bookbinding rule exists anywhere in TypeScript.
 *
 * Two conventions differ from `deckPlaybookSchema.ts`, on purpose:
 *
 * 1. Option `value`s are stable machine identifiers, not the label repeated.
 *    Conditions, stored answers and the marketplace's own reading all key off
 *    the value, so a reworded question must not invalidate answers already
 *    submitted. `engine/brief.ts` resolves values to labels unconditionally,
 *    so the Dossier still reads in words.
 * 2. The labels are French, because this vertical's visitors are French. That
 *    is a property of the data, not of the engine — see
 *    docs/reliure-marketplace-architecture.md §C.4 for the runtime chrome.
 *
 * The `name` and `email` keys are deliberately English and deliberately those
 * exact words: `handleSubmitSession` in build-runtime.ts reads
 * `answers.name` / `answers.email` to populate `build_dossiers.visitor_name` /
 * `visitor_email`. Renaming them would silently produce Dossiers no one can
 * reply to.
 */
import type { PlaybookSchema } from "@/build/schema/playbook";

const NOT_SURE = { value: "ne_sais_pas", label: "Je ne sais pas", isNotSure: true } as const;

/** Every damage the visitor can report — reused by the contradiction rules below. */
const DAMAGE_VALUES = [
  "couverture_usee",
  "couverture_detachee",
  "dos_abime",
  "pages_detachees",
  "pages_dechirees",
  "pages_manquantes",
  "humidite",
  "moisissure",
] as const;

/** The intents that lead to a physical diagnosis rather than a design conversation. */
const REPAIR_INTENTS = ["reparer", "restaurer", "couverture"] as const;

/**
 * The intents where the visitor is choosing an appearance, so style questions
 * apply.
 *
 * `personnaliser` et `proteger` rejoignent ce groupe plutôt que d'ouvrir leurs
 * propres étapes : embellir un livre, c'est choisir une matière, une couleur et
 * des finitions — exactement ce que ces trois étapes demandent déjà. Et
 * « Étui de protection » est depuis toujours une des finitions proposées, donc
 * un projet de protection s'exprime dans les questions existantes.
 *
 * `couverture` y reste bien qu'il ne soit plus proposé au visiteur : neuf
 * dossiers le portent, et une valeur retirée d'une liste ne disparaît pas des
 * réponses déjà données.
 */
const DESIGN_INTENTS = [
  "couverture",
  "belle_reliure",
  "collector",
  "personnaliser",
  "proteger",
] as const;

export const bookbindingPlaybookSchema: PlaybookSchema = {
  schemaVersion: 1,
  sections: [
    {
      id: "reliure-intake",
      title: "Votre projet de reliure",
      steps: [
        // ---------------------------------------------------------------
        // 1. Intent. Everything downstream branches off this one answer.
        // ---------------------------------------------------------------
        {
          id: "intention",
          title: "Que souhaitez-vous faire de votre livre ?",
          why: "Réparer un livre abîmé et créer une édition unique ne demandent ni les mêmes informations, ni les mêmes savoir-faire.",
          fields: [
            {
              key: "intention",
              label: "Que souhaitez-vous faire ?",
              type: "single_choice",
              desirability: "required",
              // Les libellés parlent du besoin du propriétaire, jamais de la
              // technique : « Le personnaliser » plutôt que « dorure et
              // décor ». Les valeurs, elles, sont des clés machine lues par
              // caseProfile.ts et pricing.rules.ts — on en ajoute, on n'en
              // renomme jamais.
              options: [
                {
                  value: "reparer",
                  label: "Le réparer",
                  briefLabel: "Réparation",
                  reassurance:
                    "Le livre est fatigué et vous voulez pouvoir le manipuler à nouveau.",
                },
                {
                  value: "restaurer",
                  label: "Le restaurer",
                  briefLabel: "Restauration",
                  reassurance:
                    "L'objectif est de conserver l'ouvrage au plus près de son état d'origine.",
                },
                {
                  value: "belle_reliure",
                  label: "Le faire relier",
                  briefLabel: "Reliure",
                  reassurance:
                    "Lui donner une couverture durable : toile, demi-cuir ou plein cuir.",
                },
                {
                  value: "personnaliser",
                  label: "Le personnaliser",
                  briefLabel: "Personnalisation",
                  reassurance: "Dorure, titrage, décor, matières, couleurs ou gardes choisies.",
                },
                {
                  value: "collector",
                  label: "Le transformer",
                  briefLabel: "Transformation",
                  reassurance: "En faire une pièce unique : matières choisies, dorure, étui.",
                },
                {
                  value: "proteger",
                  label: "Le protéger",
                  briefLabel: "Protection sur mesure",
                  reassurance: "Un étui, une chemise, une boîte ou un coffret sur mesure.",
                },
                {
                  value: "ne_sais_pas",
                  label: "Je ne sais pas encore",
                  briefLabel: "Projet à préciser",
                  reassurance: "Décrivez le livre, un relieur vous dira ce qui est possible.",
                  isNotSure: true,
                },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Type de projet",
                category: "Le projet",
                format: "option_label",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 2. The book itself.
        // ---------------------------------------------------------------
        {
          id: "ouvrage",
          title: "De quel ouvrage s'agit-il ?",
          why: "Ce qu'est le livre, bien plus que le budget, détermine l'atelier à qui nous le confierons.",
          fields: [
            {
              key: "titre",
              label: "Titre de l'ouvrage",
              type: "text",
              desirability: "required",
              maxLength: 160,
              placeholder: "Le Comte de Monte-Cristo",
              briefMapping: {
                section: "confirmedInformation",
                label: "Titre",
                category: "L'ouvrage",
                format: "raw",
              },
            },
            {
              key: "auteur",
              label: "Auteur",
              type: "text",
              desirability: "optional",
              maxLength: 160,
              briefMapping: {
                section: "confirmedInformation",
                label: "Auteur",
                category: "L'ouvrage",
                format: "raw",
              },
            },
            {
              key: "annee",
              label: "Année d'édition",
              type: "text",
              desirability: "recommended",
              allowNotSure: true,
              maxLength: 40,
              helpText:
                "Souvent imprimée sur la page de titre ou juste après. Une approximation suffit.",
              missingMessage: "L'année d'édition n'a pas été communiquée.",
              briefMapping: {
                section: "confirmedInformation",
                label: "Année d'édition",
                category: "L'ouvrage",
                format: "raw",
              },
            },
            {
              key: "nature",
              label: "Comment décririez-vous cet ouvrage ?",
              type: "single_choice",
              desirability: "required",
              options: [
                { value: "livre_courant", label: "Un livre courant" },
                {
                  value: "livre_ancien",
                  label: "Un livre ancien",
                  reassurance:
                    "Antérieur au XXᵉ siècle, ou dont le papier et la reliure sont d'époque.",
                },
                { value: "bible_familiale", label: "Une bible ou un livre de famille" },
                { value: "manuscrit", label: "Un manuscrit" },
                {
                  value: "ouvrage_rare",
                  label: "Une édition rare ou numérotée",
                  reassurance: "Tirage limité, exemplaire numéroté, envoi ou dédicace de l'auteur.",
                },
                { value: "album", label: "Un album ou un livre de photos" },
                { value: "autre", label: "Autre" },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Nature de l'ouvrage",
                category: "L'ouvrage",
                format: "option_label",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 3. Dimensions. Recommended, never required: a visitor without a
        //    ruler must still be able to finish.
        // ---------------------------------------------------------------
        {
          id: "dimensions",
          title: "Les dimensions du livre",
          why: "Le format détermine la quantité de matière et le temps d'atelier. Une mesure au centimètre près suffit.",
          fields: [
            {
              key: "hauteur",
              label: "Hauteur",
              type: "measurement",
              unit: "cm",
              desirability: "recommended",
              min: 1,
              max: 100,
              allowNotSure: true,
              helpText: "Le côté le plus long de la couverture, dos compris.",
              missingMessage: "La hauteur de l'ouvrage n'a pas été mesurée.",
            },
            {
              key: "largeur",
              label: "Largeur",
              type: "measurement",
              unit: "cm",
              desirability: "recommended",
              min: 1,
              max: 100,
              allowNotSure: true,
              missingMessage: "La largeur de l'ouvrage n'a pas été mesurée.",
            },
            {
              key: "epaisseur",
              label: "Épaisseur",
              type: "measurement",
              unit: "cm",
              desirability: "recommended",
              min: 0.1,
              max: 40,
              allowNotSure: true,
              helpText: "L'épaisseur du dos, couverture comprise.",
              missingMessage: "L'épaisseur de l'ouvrage n'a pas été mesurée.",
            },
          ],
        },

        // ---------------------------------------------------------------
        // 4. Condition — asked of everyone, including collector projects:
        //    a beautiful binding still starts from a physical book.
        // ---------------------------------------------------------------
        {
          id: "etat",
          title: "Dans quel état est le livre aujourd'hui ?",
          why: "L'état conditionne ce qu'un relieur peut promettre. Ne cochez que ce que vous voyez.",
          fields: [
            {
              key: "etat",
              label: "État du livre",
              type: "multi_choice",
              desirability: "required",
              minSelected: 1,
              helpText: "Plusieurs réponses possibles.",
              options: [
                { value: "bon_etat", label: "Le livre est en bon état" },
                { value: "couverture_usee", label: "Couverture usée" },
                { value: "couverture_detachee", label: "Couverture détachée" },
                { value: "dos_abime", label: "Dos abîmé" },
                { value: "pages_detachees", label: "Pages détachées" },
                { value: "pages_dechirees", label: "Pages déchirées" },
                { value: "pages_manquantes", label: "Pages manquantes" },
                { value: "humidite", label: "Traces d'humidité" },
                {
                  value: "moisissure",
                  label: "Suspicion de moisissure",
                  reassurance: "Taches duveteuses, odeur de cave, points noirs ou violacés.",
                },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "État déclaré",
                category: "État",
                format: "join_comma",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 5. Physical diagnosis — only for the repair-shaped intents.
        // ---------------------------------------------------------------
        {
          id: "diagnostic",
          title: "Regardons le livre de plus près",
          why: "Ces trois points séparent une réparation d'une heure d'une restauration complète.",
          displayWhen: {
            any: REPAIR_INTENTS.map((value) => ({
              fieldKey: "intention",
              operator: "equals" as const,
              value,
            })),
          },
          fields: [
            {
              key: "etatDos",
              label: "Le dos du livre",
              type: "single_choice",
              desirability: "recommended",
              helpText:
                "Le dos est la tranche sur laquelle on lit le titre quand le livre est rangé.",
              missingMessage: "L'état du dos n'a pas été précisé.",
              options: [
                { value: "intact", label: "Intact" },
                { value: "fragile", label: "Fragilisé, mais en place" },
                { value: "fendu", label: "Fendu ou décollé" },
                { value: "manquant", label: "Absent" },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Dos",
                category: "État",
                format: "option_label",
              },
            },
            {
              key: "etatPlats",
              label: "Les plats (les deux faces de la couverture)",
              type: "single_choice",
              desirability: "recommended",
              missingMessage: "L'état des plats n'a pas été précisé.",
              options: [
                { value: "intacts", label: "Intacts" },
                { value: "uses", label: "Usés aux coins" },
                { value: "taches", label: "Tachés ou marqués" },
                { value: "detaches", label: "Détachés du corps du livre" },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Plats",
                category: "État",
                format: "option_label",
              },
            },
            {
              key: "cahiers",
              label: "Les cahiers tiennent-ils encore ensemble ?",
              type: "single_choice",
              desirability: "recommended",
              helpText:
                "Un livre est cousu par petits groupes de pages appelés cahiers. Ouvrez le livre au milieu : voyez-vous des fils ou de la colle ?",
              missingMessage: "La tenue des cahiers n'a pas été précisée.",
              options: [
                { value: "solidaires", label: "Oui, le bloc est solide" },
                { value: "quelques_uns", label: "Un ou deux cahiers se détachent" },
                { value: "desolidarises", label: "Non, le bloc se défait" },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Cahiers",
                category: "État",
                format: "option_label",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 6. Photos. The single most valuable answer in the whole intake —
        //    a relieur can price from photos, never from adjectives.
        // ---------------------------------------------------------------
        {
          id: "photos",
          title: "Photographiez votre livre",
          why: "Un relieur lit une photo bien mieux qu'une description. C'est ce qui permet d'estimer le travail sans que vous ayez à vous déplacer.",
          fields: [
            {
              key: "photos",
              label: "Photos du livre",
              type: "photo",
              desirability: "required",
              helpText:
                "Idéalement : couverture avant, couverture arrière, dos, tranche, et le livre ouvert. JPG, PNG, WEBP ou HEIC, 8 Mo maximum par photo.",
              maxFiles: 8,
              maxFileSizeMb: 8,
              acceptMimeTypes: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/heic",
                "image/heif",
              ],
              storage: "supabase_storage",
              briefMapping: {
                section: "confirmedInformation",
                label: "Photos",
                category: "Pièces jointes",
                format: "join_comma",
              },
            },
            {
              key: "photosDommages",
              label: "Photos des dommages",
              type: "photo",
              desirability: "recommended",
              helpText:
                "Un gros plan sur chaque zone abîmée : mors, coiffes, coins, pages atteintes.",
              missingMessage: "Aucun gros plan des dommages n'a été fourni.",
              maxFiles: 4,
              maxFileSizeMb: 8,
              acceptMimeTypes: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/heic",
                "image/heif",
              ],
              storage: "supabase_storage",
              displayWhen: {
                any: DAMAGE_VALUES.map((value) => ({
                  fieldKey: "etat",
                  operator: "includes" as const,
                  value,
                })),
              },
              briefMapping: {
                section: "confirmedInformation",
                label: "Photos des dommages",
                category: "Pièces jointes",
                format: "join_comma",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 7. Style and material — only when the visitor is choosing a look.
        // ---------------------------------------------------------------
        {
          id: "style",
          title: "Quel aspect souhaitez-vous ?",
          why: "Le style et la matière décident du savoir-faire à mobiliser, et donc de l'atelier.",
          displayWhen: {
            any: DESIGN_INTENTS.map((value) => ({
              fieldKey: "intention",
              operator: "equals" as const,
              value,
            })),
          },
          fields: [
            {
              key: "styleSouhaite",
              label: "Style souhaité",
              type: "single_choice",
              desirability: "recommended",
              missingMessage: "Le style souhaité n'a pas été précisé.",
              options: [
                {
                  value: "traditionnel",
                  label: "Traditionnel, esprit bibliothèque",
                  reassurance:
                    "Cuir, nerfs au dos, titrage doré. Ce qu'on imagine en disant « beau livre ».",
                },
                {
                  value: "classique_sobre",
                  label: "Classique et sobre",
                  reassurance: "Toile ou papier, titrage discret, sans ornement.",
                },
                {
                  value: "contemporain",
                  label: "Contemporain",
                  reassurance: "Lignes nettes, matières actuelles, contrastes assumés.",
                },
                {
                  value: "art",
                  label: "Reliure d'art",
                  reassurance:
                    "Une création originale, pensée pour cet ouvrage. Compter un budget et un délai plus élevés.",
                },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Style souhaité",
                category: "Style",
                format: "option_label",
              },
            },
            {
              key: "materiau",
              label: "Matière de couverture",
              type: "single_choice",
              desirability: "recommended",
              helpText: "Aucune connaissance technique attendue : choisissez ce qui vous plaît.",
              missingMessage: "La matière de couverture n'a pas été choisie.",
              options: [
                {
                  value: "toile",
                  label: "Toile",
                  reassurance:
                    "Solide et sobre, la solution la plus courante et la plus abordable.",
                },
                {
                  value: "papier_decore",
                  label: "Papier décoré",
                  reassurance:
                    "Papiers marbrés ou imprimés, souvent associés à un dos en toile ou en cuir.",
                },
                {
                  value: "demi_cuir",
                  label: "Demi-cuir",
                  reassurance:
                    "Le dos et les coins en cuir, les plats en papier ou en toile. Le meilleur rapport allure / prix.",
                },
                {
                  value: "plein_cuir",
                  label: "Plein cuir",
                  reassurance:
                    "Tout l'extérieur en cuir. La solution la plus noble, et la plus coûteuse.",
                },
                { value: "autre", label: "Autre / à discuter" },
                NOT_SURE,
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Matière",
                category: "Style",
                format: "option_label",
              },
            },
            {
              key: "couleur",
              label: "Couleur souhaitée",
              type: "text",
              desirability: "optional",
              maxLength: 80,
              placeholder: "Vert foncé, brun, bordeaux…",
              briefMapping: {
                section: "confirmedInformation",
                label: "Couleur",
                category: "Style",
                format: "raw",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 8. Finishes — conditional on the style step having been shown.
        // ---------------------------------------------------------------
        {
          id: "finitions",
          title: "Les finitions",
          why: "Chaque finition est un geste d'atelier qui compte dans le prix. Les nommer maintenant permet de vous annoncer un prix juste du premier coup.",
          displayWhen: {
            any: DESIGN_INTENTS.map((value) => ({
              fieldKey: "intention",
              operator: "equals" as const,
              value,
            })),
          },
          fields: [
            {
              key: "finitions",
              label: "Finitions souhaitées",
              type: "multi_choice",
              desirability: "optional",
              helpText: "Plusieurs réponses possibles. Rien de cela n'est obligatoire.",
              options: [
                {
                  value: "dorure",
                  label: "Dorure",
                  reassurance: "Motifs ou filets posés à l'or sur le cuir.",
                },
                { value: "titre", label: "Titre au dos" },
                { value: "auteur", label: "Nom de l'auteur au dos" },
                {
                  value: "nerfs",
                  label: "Nerfs",
                  reassurance: "Les reliefs horizontaux qui barrent le dos des livres anciens.",
                },
                { value: "coins", label: "Coins renforcés" },
                {
                  value: "gardes_decorees",
                  label: "Gardes décorées",
                  reassurance: "Les pages de couleur collées à l'intérieur des plats.",
                },
                { value: "tranche_decoree", label: "Tranche décorée ou dorée" },
                {
                  value: "etui",
                  label: "Étui de protection",
                  reassurance: "Un boîtier sur mesure pour ranger et protéger l'ouvrage.",
                },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Finitions",
                category: "Finitions",
                format: "join_comma",
              },
            },
            {
              key: "nerfs",
              label: "Nombre de nerfs",
              type: "number",
              desirability: "optional",
              min: 1,
              max: 9,
              helpText:
                "Cinq nerfs est le choix classique. Laissez vide si vous préférez laisser le relieur décider.",
              displayWhen: {
                all: [{ fieldKey: "finitions", operator: "includes", value: "nerfs" }],
              },
              briefMapping: {
                section: "confirmedInformation",
                label: "Nombre de nerfs",
                category: "Finitions",
                format: "raw",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 9. Inspiration image — the vision agent proposes, the visitor
        //    confirms. Never presented to the relieur as a certainty.
        // ---------------------------------------------------------------
        {
          id: "inspiration",
          title: "Une reliure qui vous plaît ?",
          why: "Une image vaut mieux qu'un adjectif. Elle sera transmise au relieur comme une intention, pas comme un modèle à copier.",
          displayWhen: {
            any: DESIGN_INTENTS.map((value) => ({
              fieldKey: "intention",
              operator: "equals" as const,
              value,
            })),
          },
          fields: [
            {
              key: "inspiration",
              label: "Photo d'inspiration",
              type: "inspiration_photo",
              desirability: "optional",
              helpText:
                "Une photo prise en librairie, une capture Pinterest, une reliure vue chez quelqu'un : « j'aimerais une reliure dans cet esprit ».",
              maxFileSizeMb: 8,
              acceptMimeTypes: ["image/jpeg", "image/png", "image/webp"],
            },
            // §16 asks for "une ou plusieurs références visuelles", and
            // `inspiration_photo` is single-image by design: one image, one set
            // of AI hypotheses the visitor confirms. This is the plain
            // companion — several references, no analysis, nothing to confirm.
            // Kept as a separate field rather than making the other one
            // multiple, because the two carry different weight in the Dossier:
            // one is a reading of the image, these are just what the customer
            // liked.
            {
              key: "inspirationsRef",
              label: "Autres références visuelles",
              type: "photo",
              desirability: "optional",
              helpText:
                "Jusqu'à quatre images supplémentaires. Elles seront transmises telles quelles au relieur.",
              maxFiles: 4,
              maxFileSizeMb: 8,
              acceptMimeTypes: [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/heic",
                "image/heif",
              ],
              storage: "supabase_storage",
              briefMapping: {
                section: "confirmedInformation",
                label: "Références visuelles",
                category: "Style",
                format: "join_comma",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 10. What the book is worth — sentimentally and financially.
        // ---------------------------------------------------------------
        {
          id: "valeur",
          title: "Ce que ce livre représente",
          why: "Un livre auquel on tient et un livre qui vaut cher n'appellent pas les mêmes précautions, ni le même artisan.",
          fields: [
            {
              key: "valeurRaisons",
              label: "Qu'est-ce qui rend ce livre important pour vous ?",
              type: "multi_choice",
              desirability: "required",
              minSelected: 1,
              helpText: "Plusieurs réponses possibles.",
              options: [
                { value: "sentimentale", label: "Valeur sentimentale" },
                { value: "souvenir_familial", label: "Souvenir familial" },
                { value: "collection", label: "Il fait partie d'une collection" },
                { value: "financiere", label: "Valeur financière" },
                { value: "historique", label: "Valeur historique" },
                { value: "decoration", label: "Décoration" },
                { value: "autre", label: "Autre" },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Importance de l'ouvrage",
                category: "Valeur",
                format: "join_comma",
              },
            },
            {
              key: "valeurFinanciere",
              label: "Connaissez-vous sa valeur financière approximative ?",
              type: "single_choice",
              desirability: "required",
              helpText:
                "Une estimation suffit. Elle sert à décider du niveau de précaution, pas du prix.",
              options: [
                { value: "lt_100", label: "Moins de 100 €" },
                { value: "100_500", label: "Entre 100 et 500 €" },
                { value: "500_1000", label: "Entre 500 et 1 000 €" },
                { value: "gt_1000", label: "Plus de 1 000 €" },
                { value: "inconnue", label: "Je ne sais pas", isNotSure: true },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Valeur déclarée",
                category: "Valeur",
                format: "option_label",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 11. Budget and timing. A budget is not the managed price.
        // ---------------------------------------------------------------
        {
          id: "budget-delai",
          title: "Budget et délai",
          why: "Cette fourchette aide Ma Reliure à comprendre vos attentes. Le prix sera fixé après étude du projet.",
          fields: [
            {
              key: "budget",
              label: "Budget envisagé",
              type: "budget",
              desirability: "required",
              currency: "EUR",
              mode: "ranges",
              helpText: "Indicatif. Ma Reliure fixera le prix après étude du travail demandé.",
              ranges: [
                { value: "lt_150", label: "Moins de 150 €" },
                { value: "150_250", label: "150 – 250 €" },
                { value: "250_400", label: "250 – 400 €" },
                { value: "400_700", label: "400 – 700 €" },
                { value: "gt_700", label: "Plus de 700 €" },
                { value: "ne_sais_pas", label: "Je ne sais pas encore" },
              ],
              briefMapping: {
                section: "budgetAndTiming",
                label: "Budget envisagé",
                format: "option_label",
              },
            },
            {
              key: "delai",
              label: "Sous quel délai souhaitez-vous récupérer le livre ?",
              type: "timeline",
              desirability: "required",
              options: [
                { value: "moins_1_mois", label: "Moins d'un mois", urgency: "high" },
                { value: "1_2_mois", label: "1 à 2 mois", urgency: "normal" },
                { value: "2_3_mois", label: "2 à 3 mois", urgency: "normal" },
                { value: "pas_urgent", label: "Pas d'urgence", urgency: "normal" },
              ],
              briefMapping: {
                section: "budgetAndTiming",
                label: "Délai souhaité",
                format: "option_label",
              },
            },
          ],
        },

        // ---------------------------------------------------------------
        // 12. Contact. `name` and `email` keys are load-bearing — see the
        //     module docstring.
        // ---------------------------------------------------------------
        {
          id: "contact",
          title: "Pour vous répondre",
          why: "C'est à cette adresse que Ma Reliure vous présentera le travail proposé et son prix. Vos coordonnées ne sont communiquées qu'à l'atelier retenu pour votre projet.",
          fields: [
            {
              key: "name",
              label: "Votre nom",
              type: "text",
              desirability: "required",
              maxLength: 120,
              briefMapping: {
                section: "confirmedInformation",
                label: "Nom",
                category: "Contact",
                format: "raw",
              },
            },
            {
              key: "email",
              label: "Votre e-mail",
              type: "text",
              desirability: "required",
              pattern: "^\\S+@\\S+\\.\\S+$",
              maxLength: 200,
              briefMapping: {
                section: "confirmedInformation",
                label: "E-mail",
                category: "Contact",
                format: "raw",
              },
            },
            {
              key: "phone",
              label: "Téléphone",
              type: "text",
              desirability: "recommended",
              maxLength: 40,
              missingMessage: "Aucun numéro de téléphone n'a été communiqué.",
              briefMapping: {
                section: "confirmedInformation",
                label: "Téléphone",
                category: "Contact",
                format: "raw",
              },
            },
            {
              key: "localisation",
              label: "Où se trouve le livre ?",
              type: "address",
              desirability: "required",
              requireAtLeastOne: true,
              helpText:
                "La ville suffit. L'adresse d'enlèvement sera demandée plus tard, une fois votre relieur choisi.",
              components: [
                { key: "zip", label: "Code postal", pattern: "^\\d{5}$" },
                { key: "city_state", label: "Ville" },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Localisation",
                category: "Contact",
                format: "raw",
              },
            },
            {
              key: "consentement",
              label:
                "J'accepte que Ma Reliure étudie ma demande et en partage le descriptif avec des ateliers partenaires. Mes coordonnées ne sont communiquées qu'à l'atelier retenu.",
              type: "consent",
              desirability: "required",
              consentText:
                "J'accepte que Ma Reliure étudie ma demande et en partage le descriptif avec des ateliers partenaires. Mes coordonnées ne sont communiquées qu'à l'atelier retenu.",
            },
          ],
        },
      ],
    },
  ],

  // The Vérificateur's traps. Same discipline as the Deck Playbook: `error` is
  // reserved for combinations that cannot physically be true (almost always a
  // mis-click), everything a visitor could legitimately mean is a `warning`
  // they read once and may move past.
  validationRules: [
    {
      id: "bookbinding-good-condition-and-damage",
      scope: "step",
      stepId: "etat",
      severity: "error",
      message:
        "Vous avez indiqué que le livre est en bon état tout en signalant un dommage. Gardez seulement ce qui décrit votre exemplaire.",
      when: {
        all: [{ fieldKey: "etat", operator: "includes", value: "bon_etat" }],
        any: DAMAGE_VALUES.map((value) => ({
          fieldKey: "etat",
          operator: "includes" as const,
          value,
        })),
      },
    },
    {
      id: "bookbinding-unsure-and-specific",
      scope: "step",
      stepId: "etat",
      severity: "error",
      message:
        "« Je ne sais pas » ne peut pas être coché en même temps qu'un état précis. Choisissez l'un ou l'autre.",
      when: {
        all: [{ fieldKey: "etat", operator: "includes", value: "ne_sais_pas" }],
        any: [
          { fieldKey: "etat", operator: "includes", value: "bon_etat" },
          ...DAMAGE_VALUES.map((value) => ({
            fieldKey: "etat",
            operator: "includes" as const,
            value,
          })),
        ],
      },
    },
    {
      id: "bookbinding-mould-handling",
      scope: "step",
      stepId: "etat",
      severity: "warning",
      // Not a contradiction — a warning, because the visitor is right and
      // needs to act now, before the book reaches anyone.
      message:
        "Suspicion de moisissure : isolez l'ouvrage dans un sac non fermé hermétiquement, dans un endroit sec, et évitez de le manipuler. Tous les ateliers ne prennent pas ces livres en charge.",
      when: {
        all: [{ fieldKey: "etat", operator: "includes", value: "moisissure" }],
      },
    },
    {
      id: "bookbinding-valuable-book-rushed",
      scope: "step",
      stepId: "budget-delai",
      severity: "warning",
      message:
        "Un ouvrage estimé à plus de 1 000 € demande un examen préalable qui tient rarement dans un mois. Indiquez un délai plus large si vous le pouvez.",
      when: {
        all: [
          { fieldKey: "valeurFinanciere", operator: "equals", value: "gt_1000" },
          { fieldKey: "delai", operator: "equals", value: "moins_1_mois" },
        ],
      },
    },
    {
      id: "bookbinding-collector-budget-floor",
      scope: "step",
      stepId: "budget-delai",
      severity: "warning",
      message:
        "Une édition collector demande plusieurs jours d'atelier et des matières choisies. En dessous de 250 €, très peu d'ateliers pourront répondre.",
      when: {
        all: [{ fieldKey: "intention", operator: "equals", value: "collector" }],
        any: [
          { fieldKey: "budget", operator: "equals", value: "lt_150" },
          { fieldKey: "budget", operator: "equals", value: "150_250" },
        ],
      },
    },
  ],

  briefConfig: {
    // The Dossier is named after the book, which is how both the customer and
    // the relieur will refer to it. `titre` is required, so this template can
    // never resolve to an empty name at submit time.
    missionNameTemplate: "{{titre}}",
    statusLabel: "Dossier de reliure",
    summaryFragments: [
      { template: "{{intention}}." },
      {
        template: "Ouvrage : « {{titre}} »",
        when: { all: [{ fieldKey: "titre", operator: "is_not_empty" }] },
      },
      {
        template: "de {{auteur}}.",
        when: { all: [{ fieldKey: "auteur", operator: "is_not_empty" }] },
      },
      {
        template: "Format {{format}}.",
        when: { all: [{ fieldKey: "hauteur", operator: "is_not_empty" }] },
      },
      {
        template: "Matière souhaitée : {{materiau|lower}}.",
        when: { all: [{ fieldKey: "materiau", operator: "is_not_empty" }] },
      },
      {
        template: "Budget {{budget|lower}}.",
        when: { all: [{ fieldKey: "budget", operator: "is_not_empty" }] },
      },
    ],
    emptySummaryFallback: "Demande de reliure comportant peu d'informations.",
    calculatedFields: [
      {
        key: "format",
        section: "assumptionsAndCalculated",
        label: "Format (H × L × ép., cm)",
        category: "L'ouvrage",
        compute: { op: "concat", inputs: ["hauteur", "largeur", "epaisseur"], separator: " × " },
        onMissingLabel: "Dimensions",
        onMissingValue: "Aucune dimension n'a été communiquée.",
      },
    ],
    derivedLines: [
      // §24 of the marketplace brief, expressed as Playbook data: the system
      // states a fact and hands the decision to a human. It never claims a
      // diagnosis.
      {
        id: "reliure-ouvrage-patrimonial",
        section: "constraints",
        when: {
          any: [
            { fieldKey: "nature", operator: "equals", value: "livre_ancien" },
            { fieldKey: "nature", operator: "equals", value: "manuscrit" },
            { fieldKey: "nature", operator: "equals", value: "ouvrage_rare" },
          ],
        },
        label: "Ouvrage patrimonial",
        value:
          "Ce type d'ouvrage nécessite une validation spécifique par un professionnel avant prise en charge.",
        source: "deterministic_rule",
      },
      {
        id: "reliure-valeur-elevee",
        section: "constraints",
        when: {
          all: [{ fieldKey: "valeurFinanciere", operator: "equals", value: "gt_1000" }],
        },
        label: "Valeur déclarée élevée",
        value:
          "Valeur estimée à plus de 1 000 € : le dossier doit être revu par un humain avant d'être diffusé.",
        source: "visitor_answer",
      },
      {
        id: "reliure-moisissure",
        section: "constraints",
        when: { all: [{ fieldKey: "etat", operator: "includes", value: "moisissure" }] },
        label: "Suspicion de moisissure",
        value:
          "L'ouvrage doit être isolé et examiné avant tout transport. Tous les ateliers n'acceptent pas ce type d'intervention.",
        source: "visitor_answer",
      },
      {
        id: "reliure-pages-manquantes",
        section: "constraints",
        when: { all: [{ fieldKey: "etat", operator: "includes", value: "pages_manquantes" }] },
        label: "Pages manquantes",
        value:
          "Des pages manquent. Un relieur ne peut pas les recréer : il faudra décider ensemble comment traiter le manque.",
        source: "visitor_answer",
      },
      {
        id: "reliure-bloc-desolidarise",
        section: "constraints",
        when: { all: [{ fieldKey: "cahiers", operator: "equals", value: "desolidarises" }] },
        label: "Corps d'ouvrage",
        value:
          "Le bloc se défait : une couture complète est probable, ce qui change l'ampleur de l'intervention.",
        source: "visitor_answer",
      },
      {
        id: "reliure-intention-indecise",
        section: "constraints",
        when: { all: [{ fieldKey: "intention", operator: "equals", value: "ne_sais_pas" }] },
        label: "Intention",
        value:
          "Le visiteur ne sait pas encore quel type d'intervention il souhaite : à cadrer avant de solliciter des ateliers.",
        source: "deterministic_rule",
      },
      {
        id: "reliure-valeur-inconnue",
        section: "missingInformation",
        when: { all: [{ fieldKey: "valeurFinanciere", operator: "equals", value: "inconnue" }] },
        label: "Valeur financière",
        value: "La valeur de l'ouvrage n'est pas connue du propriétaire.",
        source: "deterministic_rule",
      },
    ],
    // Deliberately in `constraints`, not in `missingInformation`: these are
    // permanent caveats, not questions anyone can answer. Filed as missing
    // information they would make every Dossier a draft forever and every
    // relieur's "Informations manquantes" section read as noise.
    alwaysIncludeLines: [
      {
        section: "constraints",
        label: "Diagnostic physique",
        value: "L'état réel de l'ouvrage ne peut être confirmé qu'après examen en atelier.",
        category: "Réserves",
      },
      {
        section: "constraints",
        label: "Prix Ma Reliure",
        value:
          "Le périmètre pourra être confirmé après inspection physique de l'ouvrage en atelier.",
        category: "Réserves",
      },
    ],
    suggestedNextActions: [
      {
        when: {
          all: [{ fieldKey: "valeurFinanciere", operator: "equals", value: "gt_1000" }],
        },
        label: "Suggested next action",
        value:
          "Revue manuelle obligatoire : faire valider l'ouvrage par un relieur spécialisé avant toute diffusion du dossier.",
      },
      {
        when: {
          any: [
            { fieldKey: "nature", operator: "equals", value: "manuscrit" },
            { fieldKey: "nature", operator: "equals", value: "ouvrage_rare" },
            { fieldKey: "nature", operator: "equals", value: "livre_ancien" },
          ],
        },
        label: "Suggested next action",
        value:
          "Orienter vers un atelier de restauration et conservation avant d'envisager une reliure neuve.",
      },
      {
        when: { all: [{ fieldKey: "etat", operator: "includes", value: "moisissure" }] },
        label: "Suggested next action",
        value:
          "Faire confirmer la présence de moisissure avant tout transport, et n'inviter que des ateliers équipés pour ce traitement.",
      },
      {
        label: "Suggested next action",
        value:
          "Calculer puis valider le prix Ma Reliure avant de solliciter jusqu'à trois ateliers avec une rémunération fixe.",
      },
    ],
  },
};
