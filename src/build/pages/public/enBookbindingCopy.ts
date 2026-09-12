/**
 * French → English, whole-string, for the Bookbinding Playbook only.
 *
 * Every other dictionary in this directory (`ES_PUBLIC_COPY`, `FR_PUBLIC_COPY`)
 * translates FROM the engine's English base strings. This one runs the other
 * way: `bookbindingPlaybookSchema.ts` is authored in French (§ its own
 * docstring — "this vertical's visitors are French"), and Fine Bindery's
 * Mission renders the same Playbook at `en-US`. `publicCopy("en-US", text)`
 * already looks a source string up here before falling back to it unchanged
 * — nothing about the lookup mechanism is Playbook-specific, only its
 * content is.
 *
 * Covers exactly what `localizeField`/`localizeValidationMessage`
 * (MissionRuntime.tsx) actually route through `copy()` during the live
 * intake: step titles and "why" text, field labels/helpText, option labels
 * and reassurance, address component labels, budget range labels, consent
 * text, and the Vérificateur's messages. Deliberately does NOT cover
 * `briefMapping`/`calculatedFields`/`derivedLines`/`alwaysIncludeLines`/
 * `suggestedNextActions`/`missingMessage` — those feed the internal Project
 * Brief that an atelier reads (engine/brief.ts), never the live runtime, and
 * staying French there is correct (§44 — the atelier gets French, Fine
 * Bindery translates for the customer, not the reverse). Placeholders
 * (`field.placeholder`, e.g. "Le Comte de Monte-Cristo") are also out of
 * scope: no field type's placeholder is localized anywhere in the engine
 * today, for any Playbook — not a gap introduced here.
 *
 * Two validation-rule messages contain a number and are translated as the
 * *template* `localizeValidationMessage` actually produces (digits already
 * masked to `{n0}`/`{n1}`), not as the raw French sentence — verified against
 * that function's own regex rather than guessed.
 */
export const EN_BOOKBINDING_COPY: Record<string, string> = {
  // ---- Step 1: intention ----
  "Que souhaitez-vous faire de votre livre ?": "What would you like to do with your book?",
  "Réparer un livre abîmé et créer une édition unique ne demandent ni les mêmes informations, ni les mêmes savoir-faire.":
    "Repairing a damaged book and creating a one-of-a-kind edition call for different information, and different skills.",
  "Que souhaitez-vous faire ?": "What would you like to do?",
  "Le réparer": "Repair it",
  "Le livre est fatigué et vous voulez pouvoir le manipuler à nouveau.":
    "The book is worn and you would like to be able to handle it again.",
  "Le restaurer": "Restore it",
  "L'objectif est de conserver l'ouvrage au plus près de son état d'origine.":
    "The goal is to keep the book as close as possible to its original condition.",
  "Le faire relier": "Have it rebound",
  "Lui donner une couverture durable : toile, demi-cuir ou plein cuir.":
    "Give it a durable cover: cloth, half-leather or full leather.",
  "Le personnaliser": "Personalise it",
  "Dorure, titrage, décor, matières, couleurs ou gardes choisies.":
    "Gilding, lettering, decoration, chosen materials, colours or endpapers.",
  "Le transformer": "Transform it",
  "En faire une pièce unique : matières choisies, dorure, étui.":
    "Turn it into a one-of-a-kind piece: chosen materials, gilding, a slipcase.",
  "Le protéger": "Protect it",
  "Un étui, une chemise, une boîte ou un coffret sur mesure.":
    "A bespoke slipcase, folder, box or case.",
  "Je ne sais pas encore": "I'm not sure yet",
  "Décrivez le livre, un relieur vous dira ce qui est possible.":
    "Describe the book, and a bookbinder will tell you what's possible.",

  // ---- Step 2: ouvrage (the book itself) ----
  "De quel ouvrage s'agit-il ?": "What book is this?",
  "Ce qu'est le livre, bien plus que le budget, détermine l'atelier à qui nous le confierons.":
    "What the book is — far more than the budget — determines which workshop we entrust it to.",
  "Titre de l'ouvrage": "Title of the book",
  Auteur: "Author",
  "Année d'édition": "Year of publication",
  "Souvent imprimée sur la page de titre ou juste après. Une approximation suffit.":
    "Often printed on the title page or just after it. An approximation is fine.",
  "Comment décririez-vous cet ouvrage ?": "How would you describe this book?",
  "Un livre courant": "An ordinary book",
  "Un livre ancien": "An old book",
  "Antérieur au XXᵉ siècle, ou dont le papier et la reliure sont d'époque.":
    "Predates the 20th century, or its paper and binding are period-original.",
  "Une bible ou un livre de famille": "A bible or family book",
  "Un manuscrit": "A manuscript",
  "Une édition rare ou numérotée": "A rare or numbered edition",
  "Tirage limité, exemplaire numéroté, envoi ou dédicace de l'auteur.":
    "Limited print run, numbered copy, an inscription or the author's dedication.",
  "Un album ou un livre de photos": "A photo album or picture book",
  Autre: "Other",

  // ---- Step 3: dimensions ----
  "Les dimensions du livre": "The book's dimensions",
  "Le format détermine la quantité de matière et le temps d'atelier. Une mesure au centimètre près suffit.":
    "The size determines how much material and workshop time is needed. A measurement to the nearest centimetre is enough.",
  Hauteur: "Height",
  "Le côté le plus long de la couverture, dos compris.":
    "The longest side of the cover, spine included.",
  Largeur: "Width",
  Épaisseur: "Thickness",
  "L'épaisseur du dos, couverture comprise.": "The thickness of the spine, cover included.",

  // ---- Step 4: état (condition) ----
  "Dans quel état est le livre aujourd'hui ?": "What condition is the book in today?",
  "L'état conditionne ce qu'un relieur peut promettre. Ne cochez que ce que vous voyez.":
    "Condition shapes what a bookbinder can promise. Only tick what you can actually see.",
  "État du livre": "Condition of the book",
  "Plusieurs réponses possibles.": "You can select more than one.",
  "Le livre est en bon état": "The book is in good condition",
  "Couverture usée": "Worn cover",
  "Couverture détachée": "Detached cover",
  "Dos abîmé": "Damaged spine",
  "Pages détachées": "Detached pages",
  "Pages déchirées": "Torn pages",
  "Pages manquantes": "Missing pages",
  "Traces d'humidité": "Signs of moisture",
  "Suspicion de moisissure": "Suspected mould",
  "Taches duveteuses, odeur de cave, points noirs ou violacés.":
    "Fuzzy spots, a musty smell, black or purplish dots.",
  "Je ne sais pas": "I'm not sure",

  // ---- Step 5: diagnostic ----
  "Regardons le livre de plus près": "Let's take a closer look at the book",
  "Ces trois points séparent une réparation d'une heure d'une restauration complète.":
    "These three points are what separates an hour-long repair from a full restoration.",
  "Le dos du livre": "The spine of the book",
  "Le dos est la tranche sur laquelle on lit le titre quand le livre est rangé.":
    "The spine is the edge you read the title on when the book is on a shelf.",
  Intact: "Intact",
  "Fragilisé, mais en place": "Weakened, but still in place",
  "Fendu ou décollé": "Split or detached",
  Absent: "Missing",
  "Les plats (les deux faces de la couverture)": "The boards (the two faces of the cover)",
  Intacts: "Intact",
  "Usés aux coins": "Worn at the corners",
  "Tachés ou marqués": "Stained or marked",
  "Détachés du corps du livre": "Detached from the body of the book",
  "Les cahiers tiennent-ils encore ensemble ?": "Are the sections still holding together?",
  "Un livre est cousu par petits groupes de pages appelés cahiers. Ouvrez le livre au milieu : voyez-vous des fils ou de la colle ?":
    "A book is sewn in small groups of pages called sections. Open the book in the middle: can you see thread or glue?",
  "Oui, le bloc est solide": "Yes, the book block is solid",
  "Un ou deux cahiers se détachent": "One or two sections are coming loose",
  "Non, le bloc se défait": "No, the book block is coming apart",

  // ---- Step 6: photos ----
  "Photographiez votre livre": "Photograph your book",
  "Un relieur lit une photo bien mieux qu'une description. C'est ce qui permet d'estimer le travail sans que vous ayez à vous déplacer.":
    "A bookbinder reads a photo far better than a description. It's what lets us assess the work without you having to travel anywhere.",
  "Photos du livre": "Photos of the book",
  "Idéalement : couverture avant, couverture arrière, dos, tranche, et le livre ouvert. JPG, PNG, WEBP ou HEIC, 8 Mo maximum par photo.":
    "Ideally: front cover, back cover, spine, edge, and the book open. JPG, PNG, WEBP or HEIC, 8 MB maximum per photo.",
  "Photos des dommages": "Photos of the damage",
  "Un gros plan sur chaque zone abîmée : mors, coiffes, coins, pages atteintes.":
    "A close-up of every damaged area: joints, headbands, corners, affected pages.",

  // ---- Step 7: style ----
  "Quel aspect souhaitez-vous ?": "What look are you after?",
  "Le style et la matière décident du savoir-faire à mobiliser, et donc de l'atelier.":
    "Style and material decide which skills are needed, and so which workshop.",
  "Style souhaité": "Desired style",
  "Traditionnel, esprit bibliothèque": "Traditional, library style",
  "Cuir, nerfs au dos, titrage doré. Ce qu'on imagine en disant « beau livre ».":
    "Leather, raised bands on the spine, gilt lettering. What comes to mind when someone says \"a fine book\".",
  "Classique et sobre": "Classic and understated",
  "Toile ou papier, titrage discret, sans ornement.":
    "Cloth or paper, discreet lettering, no ornamentation.",
  Contemporain: "Contemporary",
  "Lignes nettes, matières actuelles, contrastes assumés.":
    "Clean lines, modern materials, bold contrasts.",
  "Reliure d'art": "Fine binding as art",
  "Une création originale, pensée pour cet ouvrage. Compter un budget et un délai plus élevés.":
    "An original creation, designed for this book specifically. Expect a higher budget and a longer timeline.",
  "Matière de couverture": "Cover material",
  "Aucune connaissance technique attendue : choisissez ce qui vous plaît.":
    "No technical knowledge required: choose what you like.",
  Toile: "Cloth",
  "Solide et sobre, la solution la plus courante et la plus abordable.":
    "Sturdy and understated, the most common and most affordable option.",
  "Papier décoré": "Decorated paper",
  "Papiers marbrés ou imprimés, souvent associés à un dos en toile ou en cuir.":
    "Marbled or printed papers, often paired with a cloth or leather spine.",
  "Demi-cuir": "Half-leather",
  "Le dos et les coins en cuir, les plats en papier ou en toile. Le meilleur rapport allure / prix.":
    "Leather spine and corners, paper or cloth boards. The best look-to-price ratio.",
  "Plein cuir": "Full leather",
  "Tout l'extérieur en cuir. La solution la plus noble, et la plus coûteuse.":
    "Leather all over. The most prestigious option, and the most expensive.",
  "Autre / à discuter": "Other / to discuss",
  "Couleur souhaitée": "Desired colour",

  // ---- Step 8: finitions ----
  "Les finitions": "Finishing touches",
  "Chaque finition est un geste d'atelier qui compte dans le prix. Les nommer maintenant permet de vous annoncer un prix juste du premier coup.":
    "Every finishing touch is workshop time that counts toward the price. Naming them now means we can give you an accurate price the first time.",
  "Finitions souhaitées": "Desired finishing touches",
  "Plusieurs réponses possibles. Rien de cela n'est obligatoire.":
    "You can select more than one. None of this is required.",
  Dorure: "Gilding",
  "Motifs ou filets posés à l'or sur le cuir.": "Patterns or lines laid in gold on the leather.",
  "Titre au dos": "Title on the spine",
  "Nom de l'auteur au dos": "Author's name on the spine",
  Nerfs: "Raised bands",
  "Les reliefs horizontaux qui barrent le dos des livres anciens.":
    "The horizontal ridges that cross the spine of older books.",
  "Coins renforcés": "Reinforced corners",
  "Gardes décorées": "Decorated endpapers",
  "Les pages de couleur collées à l'intérieur des plats.":
    "The coloured pages glued to the inside of the boards.",
  "Tranche décorée ou dorée": "Decorated or gilt edges",
  "Étui de protection": "Protective slipcase",
  "Un boîtier sur mesure pour ranger et protéger l'ouvrage.":
    "A bespoke case to store and protect the book.",
  "Nombre de nerfs": "Number of raised bands",
  "Cinq nerfs est le choix classique. Laissez vide si vous préférez laisser le relieur décider.":
    "Five raised bands is the classic choice. Leave this blank if you'd rather let the bookbinder decide.",

  // ---- Step 9: inspiration ----
  "Une reliure qui vous plaît ?": "A binding you like the look of?",
  "Une image vaut mieux qu'un adjectif. Elle sera transmise au relieur comme une intention, pas comme un modèle à copier.":
    "An image says more than an adjective. It will be passed to the bookbinder as an intention, not as a model to copy exactly.",
  "Photo d'inspiration": "Inspiration photo",
  "Une photo prise en librairie, une capture Pinterest, une reliure vue chez quelqu'un : « j'aimerais une reliure dans cet esprit ».":
    "A photo taken in a bookshop, a Pinterest screenshot, a binding you saw somewhere: \"I'd like something in this spirit\".",
  "Autres références visuelles": "Other visual references",
  "Jusqu'à quatre images supplémentaires. Elles seront transmises telles quelles au relieur.":
    "Up to four additional images. They will be passed to the bookbinder exactly as they are.",

  // ---- Step 10: valeur ----
  "Ce que ce livre représente": "What this book means to you",
  "Un livre auquel on tient et un livre qui vaut cher n'appellent pas les mêmes précautions, ni le même artisan.":
    "A book you're attached to and a book that's worth money don't call for the same precautions, or the same artisan.",
  "Qu'est-ce qui rend ce livre important pour vous ?": "What makes this book matter to you?",
  "Valeur sentimentale": "Sentimental value",
  "Souvenir familial": "Family keepsake",
  "Il fait partie d'une collection": "It's part of a collection",
  "Valeur financière": "Financial value",
  "Valeur historique": "Historical value",
  Décoration: "Decoration",
  "Connaissez-vous sa valeur financière approximative ?":
    "Do you know its approximate financial value?",
  "Une estimation suffit. Elle sert à décider du niveau de précaution, pas du prix.":
    "An estimate is enough. It's used to decide the level of care needed, not the price.",
  "Moins de 100 €": "Under €100",
  "Entre 100 et 500 €": "Between €100 and €500",
  "Entre 500 et 1 000 €": "Between €500 and €1,000",
  "Plus de 1 000 €": "Over €1,000",

  // ---- Step 11: budget-delai ----
  "Budget et délai": "Budget and timing",
  "Cette fourchette aide Ma Reliure à comprendre vos attentes. Le prix sera fixé après étude du projet.":
    "This range helps us understand your expectations. The price will be set once the project has been reviewed.",
  "Budget envisagé": "Budget in mind",
  "Indicatif. Ma Reliure fixera le prix après étude du travail demandé.":
    "Indicative only. The price will be set after the requested work has been reviewed.",
  "Moins de 150 €": "Under €150",
  "150 – 250 €": "€150 – €250",
  "250 – 400 €": "€250 – €400",
  "400 – 700 €": "€400 – €700",
  "Plus de 700 €": "Over €700",
  "Sous quel délai souhaitez-vous récupérer le livre ?":
    "How soon would you like the book back?",
  "Moins d'un mois": "Under a month",
  "1 à 2 mois": "1 to 2 months",
  "2 à 3 mois": "2 to 3 months",
  "Pas d'urgence": "No rush",

  // ---- Step 12: contact ----
  "Pour vous répondre": "So we can reach you",
  "C'est à cette adresse que Ma Reliure vous présentera le travail proposé et son prix. Vos coordonnées ne sont communiquées qu'à l'atelier retenu pour votre projet.":
    "This is the address we'll use to present the proposed work and its price. Your details are only shared with the workshop selected for your project.",
  "Votre nom": "Your name",
  "Votre e-mail": "Your email",
  Téléphone: "Phone number",
  "Où se trouve le livre ?": "Where is the book?",
  "La ville suffit. L'adresse d'enlèvement sera demandée plus tard, une fois votre relieur choisi.":
    "The town or city is enough. The pickup address will be requested later, once your bookbinder is chosen.",
  "Code postal": "ZIP / postal code",
  Ville: "City",
  "J'accepte que Ma Reliure étudie ma demande et en partage le descriptif avec des ateliers partenaires. Mes coordonnées ne sont communiquées qu'à l'atelier retenu.":
    "I agree that Fine Bindery may review my request and share its description with partner workshops. My contact details are only shared with the workshop selected.",

  // ---- The Vérificateur's messages, straightforward (no embedded number) ----
  "Vous avez indiqué que le livre est en bon état tout en signalant un dommage. Gardez seulement ce qui décrit votre exemplaire.":
    "You've indicated the book is in good condition while also reporting damage. Keep only what actually describes your copy.",
  "« Je ne sais pas » ne peut pas être coché en même temps qu'un état précis. Choisissez l'un ou l'autre.":
    "\"I'm not sure\" cannot be selected alongside a specific condition. Choose one or the other.",
  "Suspicion de moisissure : isolez l'ouvrage dans un sac non fermé hermétiquement, dans un endroit sec, et évitez de le manipuler. Tous les ateliers ne prennent pas ces livres en charge.":
    "Suspected mould: isolate the book in a bag that isn't sealed airtight, somewhere dry, and avoid handling it. Not every workshop can take on books like this.",

  // ---- The Vérificateur's messages with an embedded number — translated as
  // the *template* localizeValidationMessage actually produces, digits
  // already masked out, not as the raw French sentence. ----
  "Un ouvrage estimé à plus de {n0} {n1} € demande un examen préalable qui tient rarement dans un mois. Indiquez un délai plus large si vous le pouvez.":
    "An item valued above {n0} {n1} € usually needs an inspection that rarely fits within a month. Please allow more time if you can.",
  "Une édition collector demande plusieurs jours d'atelier et des matières choisies. En dessous de {n0} €, très peu d'ateliers pourront répondre.":
    "A collector's binding takes several days of workshop time and carefully chosen materials. Under {n0} €, very few workshops will be able to take it on.",
};
