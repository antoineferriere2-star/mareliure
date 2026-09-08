/**
 * French public copy.
 *
 * Same mechanism as ES_PUBLIC_COPY in publicLocaleContext.ts — a whole-string
 * dictionary keyed by the English source, with the source itself as the
 * fallback — but kept in its own module because that file is already 960 lines
 * and a second dictionary of this size inside it would bury the context and the
 * hooks it exists for.
 *
 * Its scope is deliberately narrower than the Spanish one: the Guided Project
 * Intake and the Project Summary, which is the whole surface a French visitor
 * can reach. Métré's own marketing pages are not translated into French and
 * never select this locale (fr-FR is absent from PUBLIC_LANGUAGE_OPTIONS).
 * `runtimeChrome.test.ts` asserts this dictionary covers every string the
 * runtime can emit, listed in src/build/i18n/runtimeChrome.ts.
 */
export const FR_PUBLIC_COPY: Record<string, string> = {
  // ---- Loading and failure ----
  "Preparing your project intake…": "Préparation de votre projet…",
  "This is taking longer than usual.": "Cela prend plus de temps que d'habitude.",
  "Try again": "Réessayer",
  "Loading…": "Chargement…",
  "Working…": "En cours…",
  "This mission has no questions yet.": "Ce parcours ne comporte pas encore de questions.",
  "This summary link is not available.": "Ce lien de récapitulatif n'est plus disponible.",

  // ---- Navigation ----
  Back: "Retour",
  Continue: "Continuer",
  Steps: "Étapes",
  "current step": "étape en cours",
  complete: "terminé",
  "Review my answers": "Revoir mes réponses",
  "Send my project": "Envoyer mon projet",
  "Last look before sending": "Un dernier coup d'œil avant l'envoi",
  "Nothing has been sent yet. Change anything that is not right.":
    "Rien n'a encore été envoyé. Vous pouvez modifier ce qui ne va pas.",
  "Your answers are saved as you go — you can close this tab and come back.":
    "Vos réponses sont enregistrées au fur et à mesure : vous pouvez fermer cet onglet et revenir.",
  "Please check the following before continuing:":
    "Merci de vérifier ces points avant de continuer :",

  // ---- The Vérificateur ----
  "These answers don't seem to work together": "Ces réponses semblent se contredire",
  "Worth checking": "À vérifier",

  // ---- Project Canvas ----
  "Your project": "Votre projet",
  "Project canvas": "Votre projet",
  "Live project canvas": "Votre projet, en direct",
  "The project details Métré has captured so far.":
    "Ce qui a été retenu de votre projet jusqu'ici.",
  "Your project will take shape as you answer.":
    "Votre projet prendra forme au fil de vos réponses.",
  "detail captured": "élément retenu",
  "details captured": "éléments retenus",
  Project: "Projet",
  Derived: "Déduit",
  "Budget & timing": "Budget et délai",
  "To clarify": "À préciser",
  Confirmed: "Confirmé",
  "Not answered": "Sans réponse",
  Captured: "Enregistré",

  // ---- Fields ----
  "Add photos that help the team understand the site before the first call.":
    "Ajoutez des photos qui aideront l'atelier à comprendre votre projet avant tout échange.",
  "Choose photos or use your camera": "Choisissez des photos ou utilisez votre appareil",
  "Photo limit reached": "Nombre maximum de photos atteint",
  slot: "emplacement",
  slots: "emplacements",
  available: "disponible(s)",
  "Maximum of": "Maximum de",
  "reached. Remove one to add another.": "atteint. Retirez-en une pour en ajouter une autre.",
  "Uploading…": "Envoi en cours…",
  "photo attached": "photo jointe",
  "photos attached": "photos jointes",
  "I'm not sure yet": "Je ne sais pas encore",
  "Marked to clarify": "À préciser",
  Edit: "Modifier",

  // ---- Inspiration photo ----
  "Choose an inspiration image": "Choisissez une image d'inspiration",
  "Looking at your inspiration…": "Analyse de votre inspiration…",
  "Here's what we noticed — review and confirm":
    "Voici ce que nous avons remarqué — vérifiez et confirmez",
  "Métré will suggest what it notices, then you confirm or adjust it.":
    "Nous vous proposons ce que nous observons ; à vous de confirmer ou de corriger.",
  "Image notes captured": "Observations enregistrées",
  Style: "Style",
  Materials: "Matériaux",
  Shape: "Forme",
  Elements: "Éléments",
  "Detected from the provided information": "Déduit des informations fournies",
  "Not detected — add details if needed": "Non détecté — précisez si nécessaire",

  // ---- Project Summary ----
  "Project sent": "Projet envoyé",
  "Project summary": "Récapitulatif du projet",
  "Your project summary is ready": "Le récapitulatif de votre projet est prêt",
  "Your information has been sent to": "Vos informations ont été transmises à",
  "Review your summary": "Consulter mon récapitulatif",
  "Still to confirm": "Reste à préciser",
  "What happens next": "La suite",
  "The team will review your project information and contact you to discuss the next step.":
    "Votre projet va être examiné, puis nous vous recontacterons pour la suite.",
  "We sent a copy of this summary to your email.":
    "Nous vous avons envoyé une copie de ce récapitulatif par e-mail.",
  "No details were provided yet.": "Aucun détail n'a encore été fourni.",
  "Topics to review with the sales team:": "Points à revoir ensemble :",
  "The visual preview couldn't be shown.": "L'aperçu visuel n'a pas pu être affiché.",

  // ---- Validation ----
  // These are the exact templates localizeValidationMessage asks for, after it
  // has masked the field label and any numbers out.
  '"{field}" is required.': '"{field}" est obligatoire.',
  '"{field}" requires a specific answer.': '"{field}" demande une réponse précise.',
  '"{field}" has an invalid option.': '"{field}" contient un choix invalide.',
  '"{field}" must be a list.': '"{field}" doit être une liste.',
  '"{field}" requires at least {n0} selection(s).': '"{field}" demande au moins {n0} choix.',
  '"{field}" allows at most {n0} selection(s).': '"{field}" accepte au plus {n0} choix.',
  '"{field}" must be text.': '"{field}" doit être du texte.',
  '"{field}" is too short.': '"{field}" est trop court.',
  '"{field}" is too long.': '"{field}" est trop long.',
  '"{field}" is not valid.': '"{field}" n\'est pas valide.',
  '"{field}" must be a number.': '"{field}" doit être un nombre.',
  '"{field}" is below the minimum.': '"{field}" est en dessous du minimum.',
  '"{field}" is above the maximum.': '"{field}" dépasse le maximum.',
  '"{field}" has an invalid range.': '"{field}" contient une tranche invalide.',
  '"{field}" is invalid.': '"{field}" est invalide.',
  '"{field}" requires at least one value.': '"{field}" demande au moins une valeur.',
  '"{field}" must be a list of photos.': '"{field}" doit être une liste de photos.',
  '"{field}" allows at most {n0} photo(s).': '"{field}" accepte au plus {n0} photo(s).',
  '"{field}" has an unsupported photo.': '"{field}" contient une photo non prise en charge.',
  '"{field}" must be accepted.': '"{field}" doit être accepté.',

  // ---- Runtime API errors, shown verbatim ----
  "Some required information is missing or invalid.":
    "Des informations obligatoires manquent ou sont invalides.",
  "Some answers contradict each other.": "Certaines réponses se contredisent.",
  "Mission not found or not published": "Ce parcours est introuvable ou n'est pas publié.",
  "Mission not available": "Ce parcours n'est pas disponible.",
  "Session not found": "Session introuvable.",
  "Session already submitted": "Cette session a déjà été envoyée.",
  "Runtime error": "Une erreur est survenue.",
  "Too many requests. Please try again later.":
    "Trop de requêtes. Merci de réessayer dans un moment.",
};
