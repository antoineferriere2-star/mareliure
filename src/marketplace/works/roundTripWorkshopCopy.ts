/**
 * Textes atelier du parcours aller-retour, dans les cinq langues de l'espace atelier (comme le
 * journal logistique). La fiche dossier Ma Reliure reste en français.
 */
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import type { BookKind, LogisticsMode } from "@/marketplace/shipping/logisticsPlan";

export interface RoundTripWorkshopCopy {
  receptionTitle: string;
  noPlan: string;
  modes: Record<LogisticsMode, string>;
  bookKinds: Record<BookKind, string>;
  declaredValue: string;
  parcel: string;
  customerArea: string;
  receptionIntro: string;
  receptionAddress: string;
  name: string; line1: string; line2: string; postalCode: string; city: string; country: string; phone: string;
  accept: string;
  decline: string;
  accepted: string;
  declined: string;
  otherWorkshop: string;
  lockedDecision: string;
  roundTripTitle: string;
  outbound: string;
  return: string;
  preparing: string;
  cancelled: string;
  notStarted: string;
  method: string;
  tracking: string;
  journalHint: string;
  readyTitle: string;
  readyIntro: string;
  readyNeedsReceipt: string;
  weight: string; length: string; width: string; height: string;
  declareReady: string;
  readyDeclared: string;
  parcelOutOfLimits: string;
  awaitingCustomerConfirmation: string;
  customerConfirmed: string;
  downloadReturn: string;
  linkExpires: string;
  labelError: string;
  errors: Record<string, string>;
  genericError: string;
  saving: string;
  openJournal: string;
}

const fr: RoundTripWorkshopCopy = {
  receptionTitle: "Réception du livre",
  noPlan: "Le client n'a pas encore choisi l'acheminement de son livre.",
  modes: { organized_round_trip: "Expédition organisée (étiquettes fournies)", customer_arranged: "Transport organisé par le client", hand_delivery: "Remise en main propre" },
  bookKinds: { ordinary: "Livre courant", old_or_rare: "Livre ancien ou rare", unique_or_heritage: "Exemplaire unique ou patrimonial" },
  declaredValue: "Valeur déclarée par le client",
  parcel: "Colis emballé annoncé",
  customerArea: "Départ",
  receptionIntro: "Confirmez que vous pouvez recevoir ce livre de cette façon. L'adresse de réception figurera sur l'étiquette aller ; elle n'est communiquée au client qu'après sa commande.",
  receptionAddress: "Adresse de réception",
  name: "Nom de l'atelier ou du destinataire", line1: "Adresse", line2: "Complément (facultatif)", postalCode: "Code postal", city: "Ville", country: "Pays", phone: "Téléphone (facultatif)",
  accept: "J'accepte de recevoir ce livre",
  decline: "Je ne peux pas le recevoir ainsi",
  accepted: "Vous avez accepté la réception.",
  declined: "Vous avez indiqué ne pas pouvoir recevoir ce livre ainsi.",
  otherWorkshop: "Un autre atelier a répondu pour ce plan.",
  lockedDecision: "Votre réponse est figée par la proposition faite au client.",
  roundTripTitle: "Transport aller-retour",
  outbound: "Aller (client → atelier)",
  return: "Retour (atelier → client)",
  preparing: "Étiquette en préparation",
  cancelled: "Étiquette annulée",
  notStarted: "Pas encore commencé",
  method: "Méthode",
  tracking: "Suivi",
  journalHint: "À l'arrivée, confirmez la réception physique et l'état du livre dans le journal ci-dessous : « livré » selon le transporteur ne suffit pas.",
  readyTitle: "Travaux terminés, retour prêt",
  readyIntro: "Emballez le livre, pesez et mesurez le colis retour. Ma Reliure prépare alors l'étiquette retour après confirmation de l'adresse par le client.",
  readyNeedsReceipt: "Le retour se déclare après la réception physique confirmée dans le journal.",
  weight: "Poids (g)", length: "Longueur (cm)", width: "Largeur (cm)", height: "Épaisseur (cm)",
  declareReady: "Déclarer le retour prêt",
  readyDeclared: "Retour déclaré prêt.",
  parcelOutOfLimits: "Colis retour hors forfait (500 g, 35 × 25 × 8 cm) : Ma Reliure traitera ce retour manuellement.",
  awaitingCustomerConfirmation: "En attente de la confirmation de l'adresse de retour par le client.",
  customerConfirmed: "Adresse de retour confirmée par le client.",
  downloadReturn: "Télécharger l'étiquette retour (PDF)",
  linkExpires: "Lien valable une minute ; redemandez-en un si besoin.",
  labelError: "L'étiquette n'a pas pu être ouverte. Réessayez dans un instant.",
  errors: {
    logistics_plan_locked: "Le plan est figé par la proposition faite au client.",
    logistics_plan_version_stale: "Le client vient de modifier son plan : relisez-le avant de répondre.",
    physical_receipt_required: "Confirmez d'abord la réception physique dans le journal.",
    return_label_in_progress: "Une étiquette retour est déjà en cours : contactez Ma Reliure pour la modifier.",
    invalid_input: "Vérifiez l'adresse (code postal à 5 chiffres en France) et les mesures.",
    forbidden: "Ce dossier ne vous est pas confié.",
  },
  genericError: "L'enregistrement n'a pas abouti. Réessayez.",
  saving: "Enregistrement…",
  openJournal: "Ouvrir la fiche ouvrage et le journal de réception",
};

const en: RoundTripWorkshopCopy = {
  ...fr,
  receptionTitle: "Receiving the book",
  noPlan: "The customer has not chosen how the book will travel yet.",
  modes: { organized_round_trip: "Organised shipping (labels provided)", customer_arranged: "Shipping arranged by the customer", hand_delivery: "Hand delivery" },
  bookKinds: { ordinary: "Ordinary book", old_or_rare: "Antiquarian or rare book", unique_or_heritage: "Unique or heritage item" },
  declaredValue: "Value declared by the customer",
  parcel: "Announced packed parcel",
  customerArea: "From",
  receptionIntro: "Confirm you can receive this book this way. The receiving address goes on the outbound label; the customer only sees it after ordering.",
  receptionAddress: "Receiving address",
  name: "Workshop or recipient name", line1: "Address", line2: "Address line 2 (optional)", postalCode: "Postcode", city: "City", country: "Country", phone: "Phone (optional)",
  accept: "I agree to receive this book",
  decline: "I cannot receive it this way",
  accepted: "You agreed to receive the book.",
  declined: "You said you cannot receive the book this way.",
  otherWorkshop: "Another workshop answered for this plan.",
  lockedDecision: "Your answer is fixed by the proposal sent to the customer.",
  roundTripTitle: "Round-trip shipping",
  outbound: "Outbound (customer → workshop)",
  return: "Return (workshop → customer)",
  preparing: "Label being prepared",
  cancelled: "Label cancelled",
  notStarted: "Not started",
  method: "Method",
  tracking: "Tracking",
  journalHint: "On arrival, confirm physical receipt and the book's condition in the log below: a carrier \"delivered\" scan is not enough.",
  readyTitle: "Work finished, return ready",
  readyIntro: "Pack the book, then weigh and measure the return parcel. The return label is prepared once the customer confirms the address.",
  readyNeedsReceipt: "Declare the return after physical receipt is confirmed in the log.",
  weight: "Weight (g)", length: "Length (cm)", width: "Width (cm)", height: "Thickness (cm)",
  declareReady: "Declare return ready",
  readyDeclared: "Return declared ready.",
  parcelOutOfLimits: "Return parcel outside the flat fee (500 g, 35 × 25 × 8 cm): this return will be handled manually.",
  awaitingCustomerConfirmation: "Waiting for the customer to confirm the return address.",
  customerConfirmed: "Return address confirmed by the customer.",
  downloadReturn: "Download the return label (PDF)",
  linkExpires: "Link valid for one minute; request a new one if needed.",
  labelError: "The label could not be opened. Please try again shortly.",
  errors: {
    logistics_plan_locked: "The plan is fixed by the proposal sent to the customer.",
    logistics_plan_version_stale: "The customer just changed the plan: read it again before answering.",
    physical_receipt_required: "Confirm physical receipt in the log first.",
    return_label_in_progress: "A return label is already in progress: contact us to change it.",
    invalid_input: "Check the address and the measurements.",
    forbidden: "This project is not assigned to you.",
  },
  genericError: "Saving did not go through. Please try again.",
  saving: "Saving…",
  openJournal: "Open the work record and receipt log",
};

const de: RoundTripWorkshopCopy = {
  ...en,
  receptionTitle: "Annahme des Buches",
  noPlan: "Der Kunde hat den Versandweg noch nicht gewählt.",
  modes: { organized_round_trip: "Organisierter Versand (Etiketten gestellt)", customer_arranged: "Versand durch den Kunden", hand_delivery: "Persönliche Übergabe" },
  bookKinds: { ordinary: "Gewöhnliches Buch", old_or_rare: "Antiquarisches oder seltenes Buch", unique_or_heritage: "Unikat oder Kulturgut" },
  declaredValue: "Vom Kunden angegebener Wert",
  parcel: "Angekündigtes Paket",
  customerArea: "Abgang",
  receptionIntro: "Bestätigen Sie, dass Sie dieses Buch auf diesem Weg annehmen können. Die Empfangsadresse steht auf dem Hinversand-Etikett; der Kunde sieht sie erst nach der Bestellung.",
  receptionAddress: "Empfangsadresse",
  accept: "Ich nehme dieses Buch an",
  decline: "Auf diesem Weg nicht möglich",
  accepted: "Sie haben die Annahme bestätigt.",
  declined: "Sie haben angegeben, das Buch so nicht annehmen zu können.",
  roundTripTitle: "Hin- und Rückversand",
  outbound: "Hinweg (Kunde → Werkstatt)",
  return: "Rückweg (Werkstatt → Kunde)",
  preparing: "Etikett in Vorbereitung",
  cancelled: "Etikett storniert",
  notStarted: "Noch nicht begonnen",
  method: "Methode",
  tracking: "Sendungsverfolgung",
  journalHint: "Bestätigen Sie bei Ankunft den physischen Empfang und den Zustand im Protokoll unten: Ein „zugestellt“ des Transporteurs genügt nicht.",
  readyTitle: "Arbeit beendet, Rückversand bereit",
  readyIntro: "Verpacken Sie das Buch, wiegen und messen Sie das Rückpaket.",
  readyNeedsReceipt: "Der Rückversand wird nach bestätigtem physischen Empfang gemeldet.",
  weight: "Gewicht (g)", length: "Länge (cm)", width: "Breite (cm)", height: "Dicke (cm)",
  declareReady: "Rückversand bereit melden",
  readyDeclared: "Rückversand als bereit gemeldet.",
  downloadReturn: "Rückversand-Etikett herunterladen (PDF)",
  genericError: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
  saving: "Wird gespeichert…",
};

const it: RoundTripWorkshopCopy = {
  ...en,
  receptionTitle: "Ricezione del libro",
  noPlan: "Il cliente non ha ancora scelto come spedire il libro.",
  modes: { organized_round_trip: "Spedizione organizzata (etichette fornite)", customer_arranged: "Trasporto a cura del cliente", hand_delivery: "Consegna a mano" },
  bookKinds: { ordinary: "Libro comune", old_or_rare: "Libro antico o raro", unique_or_heritage: "Esemplare unico o patrimoniale" },
  declaredValue: "Valore dichiarato dal cliente",
  parcel: "Pacco annunciato",
  customerArea: "Partenza",
  receptionIntro: "Confermi di poter ricevere questo libro in questo modo. L'indirizzo di ricezione compare sull'etichetta di andata; il cliente lo vede solo dopo l'ordine.",
  receptionAddress: "Indirizzo di ricezione",
  accept: "Accetto di ricevere questo libro",
  decline: "Non posso riceverlo così",
  accepted: "Ha accettato la ricezione.",
  declined: "Ha indicato di non poter ricevere il libro così.",
  roundTripTitle: "Trasporto andata e ritorno",
  outbound: "Andata (cliente → laboratorio)",
  return: "Ritorno (laboratorio → cliente)",
  preparing: "Etichetta in preparazione",
  cancelled: "Etichetta annullata",
  notStarted: "Non ancora iniziato",
  method: "Metodo",
  tracking: "Tracciamento",
  journalHint: "All'arrivo confermi la ricezione fisica e lo stato nel registro qui sotto: il «consegnato» del corriere non basta.",
  readyTitle: "Lavoro terminato, ritorno pronto",
  readyIntro: "Imballi il libro, pesi e misuri il pacco di ritorno.",
  readyNeedsReceipt: "Il ritorno si dichiara dopo la ricezione fisica confermata nel registro.",
  weight: "Peso (g)", length: "Lunghezza (cm)", width: "Larghezza (cm)", height: "Spessore (cm)",
  declareReady: "Dichiarare il ritorno pronto",
  readyDeclared: "Ritorno dichiarato pronto.",
  downloadReturn: "Scaricare l'etichetta di ritorno (PDF)",
  genericError: "Salvataggio non riuscito. Riprovi.",
  saving: "Salvataggio…",
};

const es: RoundTripWorkshopCopy = {
  ...en,
  receptionTitle: "Recepción del libro",
  noPlan: "El cliente aún no ha elegido cómo enviar el libro.",
  modes: { organized_round_trip: "Envío organizado (etiquetas incluidas)", customer_arranged: "Transporte a cargo del cliente", hand_delivery: "Entrega en mano" },
  bookKinds: { ordinary: "Libro corriente", old_or_rare: "Libro antiguo o raro", unique_or_heritage: "Ejemplar único o patrimonial" },
  declaredValue: "Valor declarado por el cliente",
  parcel: "Paquete anunciado",
  customerArea: "Origen",
  receptionIntro: "Confirme que puede recibir este libro de esta forma. La dirección de recepción figura en la etiqueta de ida; el cliente solo la ve tras su pedido.",
  receptionAddress: "Dirección de recepción",
  accept: "Acepto recibir este libro",
  decline: "No puedo recibirlo así",
  accepted: "Ha aceptado la recepción.",
  declined: "Ha indicado que no puede recibir el libro así.",
  roundTripTitle: "Transporte de ida y vuelta",
  outbound: "Ida (cliente → taller)",
  return: "Vuelta (taller → cliente)",
  preparing: "Etiqueta en preparación",
  cancelled: "Etiqueta cancelada",
  notStarted: "Aún no iniciado",
  method: "Método",
  tracking: "Seguimiento",
  journalHint: "A la llegada, confirme la recepción física y el estado en el registro de abajo: el «entregado» del transportista no basta.",
  readyTitle: "Trabajo terminado, vuelta lista",
  readyIntro: "Embale el libro, pese y mida el paquete de vuelta.",
  readyNeedsReceipt: "La vuelta se declara tras la recepción física confirmada en el registro.",
  weight: "Peso (g)", length: "Largo (cm)", width: "Ancho (cm)", height: "Grosor (cm)",
  declareReady: "Declarar la vuelta lista",
  readyDeclared: "Vuelta declarada lista.",
  downloadReturn: "Descargar la etiqueta de vuelta (PDF)",
  genericError: "No se pudo guardar. Inténtelo de nuevo.",
  saving: "Guardando…",
};

export const roundTripWorkshopCopy: Record<FineBinderyLocale, RoundTripWorkshopCopy> = { fr, en, de, it, es };
