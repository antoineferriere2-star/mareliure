/**
 * Textes du parcours d'acheminement côté client. Ma Reliure en français, Fine Bindery en anglais.
 * Aucune promesse d'assurance : le forfait couvre deux trajets, l'indemnisation éventuelle reste
 * celle du transporteur, dans ses conditions et plafonds.
 */
import type { CustomerLocale } from "./customerPresentation";
import type { CustomerNext } from "@/marketplace/services/caseLogistics.server";
import type { BookKind, LogisticsMode, RoundTripBlock } from "@/marketplace/shipping/logisticsPlan";

export interface LogisticsCustomerCopy {
  title: string;
  intro: string;
  loading: string;
  loadError: string;
  retry: string;
  modeLegend: string;
  modes: Record<LogisticsMode, { label: string; detail: string }>;
  roundTripUnavailableBrand: string;
  contactLegend: string;
  name: string; phone: string; line1: string; line2: string; postalCode: string; city: string; country: string;
  returnSame: string;
  returnLegend: string;
  parcelLegend: string;
  parcelHelp: string;
  weight: string; length: string; width: string; height: string;
  bookLegend: string;
  bookDescription: string;
  bookKind: string;
  bookKinds: Record<BookKind, string>;
  declaredValue: string;
  declaredValueHelp: string;
  conditionsTitle: string;
  conditions: string[];
  acceptConditions: string;
  save: string;
  saving: string;
  saved: string;
  edit: string;
  cancel: string;
  summaryTitle: string;
  locked: string;
  blocks: Record<RoundTripBlock, string>;
  eligiblePending: string;
  eligible: string;
  workshopDeclined: string;
  next: Record<CustomerNext, string>;
  packagingTitle: string;
  packaging: string[];
  downloadLabel: string;
  labelExpires: string;
  labelError: string;
  outboundTitle: string;
  returnTitle: string;
  preparing: string;
  cancelledLeg: string;
  method: string;
  tracking: string;
  carrierEventsTitle: string;
  carrierEventNote: string;
  receptionAddressTitle: string;
  confirmReturnTitle: string;
  confirmReturnBody: string;
  confirmReturn: string;
  returnConfirmed: string;
  errors: Record<string, string>;
  genericError: string;
  grams: string;
  centimetres: string;
}

const fr: LogisticsCustomerCopy = {
  title: "Acheminement du livre",
  intro: "Choisissez comment votre livre rejoint l'atelier et vous revient. L'atelier confirme qu'il peut le recevoir avant toute proposition.",
  loading: "Chargement de l'acheminement…",
  loadError: "L'acheminement n'a pas pu être chargé.",
  retry: "Réessayer",
  modeLegend: "Mode d'acheminement",
  modes: {
    organized_round_trip: {
      label: "Expédition organisée — Transport aller-retour 15 € TTC",
      detail: "Deux trajets inclus en France métropolitaine : nous vous fournissons l'étiquette aller, l'atelier reçoit l'étiquette retour. Ligne distincte sur la proposition, avant votre accord.",
    },
    customer_arranged: {
      label: "Je m'occupe du transport",
      detail: "Vous expédiez le livre à l'atelier et organisez son retour, avec le transporteur de votre choix et à vos frais. Aucun forfait transport.",
    },
    hand_delivery: {
      label: "Remise en main propre",
      detail: "Vous déposez et reprenez le livre à l'atelier, sur rendez-vous. Aucun transport, aucune étiquette.",
    },
  },
  roundTripUnavailableBrand: "L'expédition organisée n'est pas proposée pour ce projet.",
  contactLegend: "Votre adresse d'expédition",
  name: "Nom et prénom",
  phone: "Téléphone (pour le transporteur)",
  line1: "Adresse",
  line2: "Complément d'adresse (facultatif)",
  postalCode: "Code postal",
  city: "Ville",
  country: "Pays",
  returnSame: "Le livre me revient à la même adresse",
  returnLegend: "Adresse de retour",
  parcelLegend: "Colis emballé",
  parcelHelp: "Pesez et mesurez le colis une fois le livre emballé. Le forfait couvre un colis jusqu'à 500 g et 35 × 25 × 8 cm ; au-delà, nous vous proposerons une solution adaptée.",
  weight: "Poids (g)",
  length: "Longueur (cm)",
  width: "Largeur (cm)",
  height: "Épaisseur (cm)",
  bookLegend: "Le livre confié",
  bookDescription: "Description (titre, édition, état)",
  bookKind: "Nature du livre",
  bookKinds: {
    ordinary: "Livre courant, remplaçable",
    old_or_rare: "Livre ancien ou rare",
    unique_or_heritage: "Exemplaire unique, manuscrit ou patrimonial",
  },
  declaredValue: "Valeur déclarée (€)",
  declaredValueHelp: "Votre estimation. Ce n'est ni une assurance ni une valeur acceptée par un transporteur.",
  conditionsTitle: "Conditions du transport",
  conditions: [
    "Le forfait couvre les deux trajets, aller vers l'atelier et retour vers vous. Il n'inclut aucune assurance.",
    "En cas de perte ou d'avarie, seule l'indemnisation du transporteur peut s'appliquer : 25 € par colis au plus chez Mondial Relay, sur justificatif de valeur. Pour un livre confié pour travaux, aucune indemnisation n'est garantie.",
    "Les livres anciens, rares, uniques ou d'une valeur déclarée de 100 € ou plus ne voyagent pas par ce forfait : nous vous proposons une solution adaptée.",
    "La livraison annoncée par le transporteur ne vaut pas réception : l'atelier confirme lui-même la réception et l'état du livre.",
  ],
  acceptConditions: "J'ai lu ces conditions et je confirme les informations ci-dessus.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "Enregistré.",
  edit: "Modifier",
  cancel: "Annuler",
  summaryTitle: "Votre choix",
  locked: "Ces informations sont figées par la proposition en cours. Pour les modifier, écrivez-nous.",
  blocks: {
    brand_unsupported: "L'expédition organisée n'est pas proposée pour ce projet : nous vous contacterons pour une solution adaptée.",
    mode_not_organized: "",
    valuable_book: "Livre ancien, unique ou de valeur ≥ 100 € : pas de forfait, nous vous proposerons une solution adaptée.",
    workshop_acceptance_required: "En attente de l'accord de l'atelier pour recevoir votre livre.",
    outside_mainland: "Une adresse est hors France métropolitaine (Corse, outre-mer, étranger) : le forfait ne s'applique pas, nous vous ferons une proposition distincte.",
    parcel_review: "Colis au-delà de 500 g ou 35 × 25 × 8 cm : le forfait ne s'applique pas, nous vous proposerons une solution adaptée.",
  },
  eligiblePending: "Votre envoi correspond au forfait, sous réserve de l'accord de l'atelier.",
  eligible: "L'atelier peut recevoir votre livre : le transport aller-retour figurera sur la proposition.",
  workshopDeclined: "L'atelier ne peut pas recevoir ce livre de cette façon. Nous revenons vers vous.",
  next: {
    choose_mode: "Choisissez comment votre livre rejoindra l'atelier.",
    await_workshop: "L'atelier vérifie qu'il peut recevoir votre livre.",
    workshop_declined: "L'atelier ne peut pas recevoir le livre ainsi : nous vous proposons une autre solution.",
    await_proposal: "L'atelier a accepté la réception. La proposition arrive.",
    pay: "Réglez la proposition pour lancer l'acheminement.",
    await_outbound_label: "Votre étiquette aller est en préparation. Vous serez prévenu ici dès qu'elle est prête.",
    drop_parcel: "Imprimez l'étiquette aller, collez-la sur le colis et déposez-le selon la méthode indiquée.",
    send_or_bring: "Envoyez ou apportez le livre à l'atelier, à l'adresse indiquée ci-dessous.",
    outbound_in_transit: "Votre livre est en route. L'atelier confirmera lui-même sa réception.",
    in_workshop: "L'atelier a reçu votre livre et y travaille.",
    confirm_return_address: "Les travaux sont terminés : confirmez votre adresse de retour.",
    await_return: "Le retour est en préparation.",
    return_in_transit: "Votre livre est sur le chemin du retour.",
    completed: "L'atelier a déclaré la remise de votre livre.",
  },
  packagingTitle: "Bien emballer un livre",
  packaging: [
    "Glissez le livre dans un sachet plastique fermé pour le protéger de l'humidité.",
    "Calez-le dans un carton rigide un peu plus grand, avec du papier froissé ou du carton ondulé sur chaque face : il ne doit pas bouger.",
    "Protégez les coins et n'utilisez ni enveloppe souple ni papier kraft seul.",
    "Fermez avec un ruban adhésif solide et collez l'étiquette à plat sur la plus grande face.",
  ],
  downloadLabel: "Télécharger l'étiquette aller (PDF)",
  labelExpires: "Le lien de téléchargement expire au bout d'une minute ; vous pouvez en redemander un.",
  labelError: "L'étiquette n'a pas pu être ouverte. Réessayez dans un instant.",
  outboundTitle: "Aller vers l'atelier",
  returnTitle: "Retour vers vous",
  preparing: "En préparation",
  cancelledLeg: "Étiquette annulée ; une nouvelle est en préparation.",
  method: "Méthode",
  tracking: "Suivi",
  carrierEventsTitle: "Selon le transporteur",
  carrierEventNote: "Informations transmises par le transporteur. La réception est confirmée séparément par l'atelier.",
  receptionAddressTitle: "Adresse de réception de l'atelier",
  confirmReturnTitle: "Confirmez votre adresse de retour",
  confirmReturnBody: "Le livre vous sera renvoyé à cette adresse. Si elle a changé, écrivez-nous avant de confirmer.",
  confirmReturn: "Je confirme cette adresse",
  returnConfirmed: "Adresse de retour confirmée.",
  errors: {
    logistics_plan_locked: "Ces informations sont figées par la proposition en cours. Écrivez-nous pour les modifier.",
    invalid_input: "Vérifiez les champs : adresse, code postal à 5 chiffres, mesures et conditions.",
    forbidden: "Ce projet n'est pas le vôtre.",
    return_not_ready: "Le retour n'est pas encore prêt.",
  },
  genericError: "L'enregistrement n'a pas abouti. Réessayez ; si le problème persiste, écrivez-nous.",
  grams: "g",
  centimetres: "cm",
};

const en: LogisticsCustomerCopy = {
  title: "Getting your book there and back",
  intro: "Choose how your book reaches the workshop and comes back to you. The workshop confirms it can receive it before any proposal.",
  loading: "Loading shipping…",
  loadError: "Shipping details could not be loaded.",
  retry: "Try again",
  modeLegend: "How your book travels",
  modes: {
    organized_round_trip: {
      label: "Organised shipping — Round-trip shipping €15 incl. VAT",
      detail: "Both journeys within mainland France: we provide the outbound label, the workshop receives the return label. Shown as a separate line on the proposal, before you accept.",
    },
    customer_arranged: {
      label: "I'll arrange shipping",
      detail: "You send the book to the workshop and arrange its return, with the carrier of your choice and at your own cost. No shipping fee from us.",
    },
    hand_delivery: {
      label: "Hand delivery",
      detail: "You drop off and collect the book at the workshop by appointment. No shipping, no label.",
    },
  },
  roundTripUnavailableBrand: "Organised shipping is not available for this project.",
  contactLegend: "Your shipping address",
  name: "Full name",
  phone: "Phone (for the carrier)",
  line1: "Address",
  line2: "Address line 2 (optional)",
  postalCode: "Postcode",
  city: "City",
  country: "Country",
  returnSame: "Return the book to the same address",
  returnLegend: "Return address",
  parcelLegend: "Packed parcel",
  parcelHelp: "Weigh and measure the parcel once the book is packed. The fee covers a parcel up to 500 g and 35 × 25 × 8 cm; beyond that we will suggest a suitable option.",
  weight: "Weight (g)",
  length: "Length (cm)",
  width: "Width (cm)",
  height: "Thickness (cm)",
  bookLegend: "The book",
  bookDescription: "Description (title, edition, condition)",
  bookKind: "Type of book",
  bookKinds: {
    ordinary: "Ordinary, replaceable book",
    old_or_rare: "Antiquarian or rare book",
    unique_or_heritage: "Unique copy, manuscript or heritage item",
  },
  declaredValue: "Declared value (€)",
  declaredValueHelp: "Your own estimate. It is neither insurance nor a value accepted by a carrier.",
  conditionsTitle: "Shipping terms",
  conditions: [
    "The fee covers both journeys, to the workshop and back to you. No insurance is included.",
    "If the parcel is lost or damaged, only the carrier's own compensation may apply: at most €25 per parcel with Mondial Relay, against proof of value. For a book entrusted for work, no compensation is guaranteed.",
    "Antiquarian, rare or unique books, or books declared at €100 or more, do not travel under this fee: we will suggest a suitable option.",
    "A carrier's delivery scan is not receipt: the workshop itself confirms receiving the book and its condition.",
  ],
  acceptConditions: "I have read these terms and confirm the information above.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  edit: "Edit",
  cancel: "Cancel",
  summaryTitle: "Your choice",
  locked: "These details are fixed by the current proposal. Message us to change them.",
  blocks: {
    brand_unsupported: "Organised shipping is not available for this project: we will contact you with a suitable option.",
    mode_not_organized: "",
    valuable_book: "Antiquarian, unique or valued at €100 or more: no flat fee, we will suggest a suitable option.",
    workshop_acceptance_required: "Waiting for the workshop to confirm it can receive your book.",
    outside_mainland: "An address is outside mainland France (Corsica, overseas, abroad): the flat fee does not apply, we will send a separate quote.",
    parcel_review: "Parcel over 500 g or 35 × 25 × 8 cm: the flat fee does not apply, we will suggest a suitable option.",
  },
  eligiblePending: "Your parcel fits the flat fee, subject to the workshop's agreement.",
  eligible: "The workshop can receive your book: round-trip shipping will appear on the proposal.",
  workshopDeclined: "The workshop cannot receive this book this way. We will get back to you.",
  next: {
    choose_mode: "Choose how your book will reach the workshop.",
    await_workshop: "The workshop is checking it can receive your book.",
    workshop_declined: "The workshop cannot receive the book this way: we will suggest another option.",
    await_proposal: "The workshop has agreed to receive the book. Your proposal is on its way.",
    pay: "Pay the proposal to start shipping.",
    await_outbound_label: "Your outbound label is being prepared. It will appear here as soon as it is ready.",
    drop_parcel: "Print the outbound label, stick it on the parcel and drop it off as indicated.",
    send_or_bring: "Send or bring the book to the workshop at the address below.",
    outbound_in_transit: "Your book is on its way. The workshop will confirm receipt itself.",
    in_workshop: "The workshop has received your book and is working on it.",
    confirm_return_address: "The work is finished: please confirm your return address.",
    await_return: "The return is being prepared.",
    return_in_transit: "Your book is on its way back.",
    completed: "The workshop has declared your book handed back.",
  },
  packagingTitle: "Packing a book safely",
  packaging: [
    "Slip the book into a sealed plastic bag to protect it from moisture.",
    "Wedge it in a rigid box slightly larger than the book, with crumpled paper or corrugated card on every side: it must not move.",
    "Protect the corners; do not use a soft envelope or kraft paper alone.",
    "Seal with strong tape and stick the label flat on the largest side.",
  ],
  downloadLabel: "Download the outbound label (PDF)",
  labelExpires: "The download link expires after one minute; you can request a new one.",
  labelError: "The label could not be opened. Please try again shortly.",
  outboundTitle: "To the workshop",
  returnTitle: "Back to you",
  preparing: "Being prepared",
  cancelledLeg: "Label cancelled; a new one is being prepared.",
  method: "Method",
  tracking: "Tracking",
  carrierEventsTitle: "According to the carrier",
  carrierEventNote: "Information from the carrier. Receipt is confirmed separately by the workshop.",
  receptionAddressTitle: "Workshop receiving address",
  confirmReturnTitle: "Confirm your return address",
  confirmReturnBody: "The book will be sent back to this address. If it has changed, message us before confirming.",
  confirmReturn: "I confirm this address",
  returnConfirmed: "Return address confirmed.",
  errors: {
    logistics_plan_locked: "These details are fixed by the current proposal. Message us to change them.",
    invalid_input: "Please check the fields: address, postcode, measurements and terms.",
    forbidden: "This project is not yours.",
    return_not_ready: "The return is not ready yet.",
  },
  genericError: "Saving did not go through. Please try again; if it persists, message us.",
  grams: "g",
  centimetres: "cm",
};

export function logisticsCustomerCopy(locale: CustomerLocale): LogisticsCustomerCopy {
  return locale === "en-US" ? en : fr;
}

/** Codes transporteur relus chez le fournisseur : jamais affichés bruts. */
export function carrierEventLabel(code: string, locale: CustomerLocale): string {
  const known: Record<string, [string, string]> = {
    announced: ["Étiquette annoncée", "Label created"],
    en_route_to_sorting_center: ["Pris en charge", "Picked up"],
    being_sorted: ["En cours d'acheminement", "In transit"],
    out_for_delivery: ["En cours de livraison", "Out for delivery"],
    delivered: ["Livré selon le transporteur", "Delivered according to the carrier"],
    awaiting_customer_pickup: ["Disponible en point de retrait", "Ready for pickup"],
    delivery_attempt_failed: ["Tentative de livraison échouée", "Delivery attempt failed"],
  };
  const label = known[code];
  if (label) return locale === "en-US" ? label[1] : label[0];
  return locale === "en-US" ? "Carrier update" : "Information du transporteur";
}
