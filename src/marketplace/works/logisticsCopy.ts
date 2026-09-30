import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import type { LogisticsKind } from "./logistics";

export interface LogisticsCopy {
  region: string;
  title: string;
  introduction: string;
  loading: string;
  loadError: string;
  retry: string;
  saveError: string;
  photoRequirements: string;
  history: string;
  parcel: string;
  hand: string;
  difference: string;
  consistent: string;
  proof: string;
  finalDeclaration: string;
  privatePhoto: string;
  photoUnavailable: string;
  addPhoto: string;
  choosePhoto: string;
  uploading: string;
  empty: string;
  addEvent: string;
  action: string;
  mode: string;
  carrier: string;
  tracking: string;
  condition: string;
  expected: string;
  differenceRequired: string;
  description: string;
  optional: string;
  completionHint: string;
  saving: string;
  save: string;
  invalid: string;
  actionUnconfirmed: string;
  photoUnconfirmed: string;
  kinds: Record<LogisticsKind, string>;
}

export const logisticsCopy: Record<FineBinderyLocale, LogisticsCopy> = {
  fr: {
    region: "Logistique de l’ouvrage",
    title: "Trajet et réception de l’ouvrage",
    introduction:
      "Suivi manuel déclaré par l’atelier. Aucun achat de transport ni paiement. « Livré » selon le transporteur ne vaut pas réception physique à l’atelier.",
    loading: "Chargement du suivi…",
    loadError: "Impossible de charger le suivi.",
    retry: "Réessayer",
    saveError:
      "Enregistrement non confirmé. Rechargez le suivi avant de réessayer. Vérifiez le constat, la preuve et les photos (JPEG/PNG/WebP, 5 Mo maximum).",
    photoRequirements: "Photo JPEG, PNG ou WebP de 5 Mo maximum requise.",
    history: "Historique logistique",
    parcel: "Colis suivi",
    hand: "Remise en main propre",
    difference: "Écart constaté à la réception",
    consistent: "État conforme au constat attendu",
    proof: "Référence de preuve",
    finalDeclaration:
      "Déclaration de l’atelier ; ce n’est pas une confirmation donnée par le client.",
    privatePhoto: "Photo privée",
    photoUnavailable: "Photo temporairement indisponible",
    addPhoto: "Ajouter une photo privée (5 Mo max., 8 par constat)",
    choosePhoto: "Choisir une photo",
    uploading: "Envoi de la photo…",
    empty: "Aucun trajet enregistré.",
    addEvent: "Ajouter un événement — l’historique est conservé",
    action: "Action",
    mode: "Mode",
    carrier: "Transporteur",
    tracking: "Numéro de suivi",
    condition: "État à la réception",
    expected: "Conforme au constat attendu",
    differenceRequired: "Écart constaté — description obligatoire",
    description: "Description",
    optional: "facultative",
    completionHint:
      "Vous déclarez la remise au client avec votre référence de preuve. Le client ne confirme rien sur cet écran.",
    saving: "Enregistrement…",
    save: "Enregistrer la déclaration",
    invalid: "Renseignez les champs obligatoires (description et preuve : 8 caractères minimum).",
    actionUnconfirmed: "Action non confirmée. Relisez l’historique avant de réessayer.",
    photoUnconfirmed: "Photo non confirmée. Vérifiez l’historique avant un nouvel envoi.",
    kinds: {
      outbound: "Aller vers l’atelier",
      carrier_delivered: "Livré selon le transporteur — déclaration atelier",
      received: "Réception physique constatée à l’atelier",
      return: "Retour vers le client",
      completed: "Remise finale déclarée par l’atelier",
      incident: "Incident",
      note: "Note complémentaire / correction",
    },
  },
  en: {
    region: "Book logistics",
    title: "Book transport and receipt",
    introduction:
      "Manual tracking recorded by the workshop. No shipping purchase or payment. A carrier’s delivery report does not confirm physical receipt at the workshop.",
    loading: "Loading tracking…",
    loadError: "Tracking could not be loaded.",
    retry: "Try again",
    saveError:
      "Record not confirmed. Reload tracking before trying again. Check the condition report, evidence and photos (JPEG/PNG/WebP, up to 5 MB).",
    photoRequirements: "A JPEG, PNG or WebP photo up to 5 MB is required.",
    history: "Logistics history",
    parcel: "Tracked parcel",
    hand: "In-person handover",
    difference: "Discrepancy recorded on receipt",
    consistent: "Condition matches the expected report",
    proof: "Evidence reference",
    finalDeclaration: "Recorded by the workshop; this is not confirmation from the client.",
    privatePhoto: "Private photo",
    photoUnavailable: "Photo temporarily unavailable",
    addPhoto: "Add a private photo (up to 5 MB, 8 per report)",
    choosePhoto: "Choose a photo",
    uploading: "Uploading photo…",
    empty: "No transport recorded.",
    addEvent: "Add an event — previous records are retained",
    action: "Action",
    mode: "Method",
    carrier: "Carrier",
    tracking: "Tracking number",
    condition: "Condition on receipt",
    expected: "Matches the expected condition",
    differenceRequired: "Discrepancy — description required",
    description: "Description",
    optional: "optional",
    completionHint:
      "You are recording handover to the client with your evidence reference. The client is not confirming anything on this screen.",
    saving: "Saving…",
    save: "Save the declaration",
    invalid:
      "Complete the required fields (description and evidence reference: at least 8 characters).",
    actionUnconfirmed: "Action not confirmed. Review the history before trying again.",
    photoUnconfirmed: "Photo not confirmed. Check the history before uploading again.",
    kinds: {
      outbound: "Transport to the workshop",
      carrier_delivered: "Delivered according to the carrier — recorded by the workshop",
      received: "Physical receipt confirmed at the workshop",
      return: "Return to the client",
      completed: "Final handover recorded by the workshop",
      incident: "Incident",
      note: "Additional note / correction",
    },
  },
  de: {
    region: "Buchlogistik",
    title: "Transport und Eingang des Buches",
    introduction:
      "Manuelle Erfassung durch die Werkstatt. Kein Kauf von Versandleistungen und keine Zahlung. Eine Zustellmeldung des Transportdienstes bestätigt nicht den tatsächlichen Eingang in der Werkstatt.",
    loading: "Verlauf wird geladen…",
    loadError: "Der Verlauf konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    saveError:
      "Eintrag nicht bestätigt. Laden Sie den Verlauf vor einem erneuten Versuch neu. Prüfen Sie Zustandsbericht, Nachweis und Fotos (JPEG/PNG/WebP, maximal 5 MB).",
    photoRequirements: "Ein Foto im Format JPEG, PNG oder WebP mit maximal 5 MB ist erforderlich.",
    history: "Logistikverlauf",
    parcel: "Paket mit Sendungsverfolgung",
    hand: "Persönliche Übergabe",
    difference: "Abweichung beim Eingang festgestellt",
    consistent: "Zustand entspricht dem erwarteten Bericht",
    proof: "Nachweisreferenz",
    finalDeclaration: "Angabe der Werkstatt; keine Bestätigung durch den Kunden.",
    privatePhoto: "Privates Foto",
    photoUnavailable: "Foto vorübergehend nicht verfügbar",
    addPhoto: "Privates Foto hinzufügen (max. 5 MB, 8 je Bericht)",
    choosePhoto: "Foto auswählen",
    uploading: "Foto wird hochgeladen…",
    empty: "Noch kein Transport erfasst.",
    addEvent: "Ereignis hinzufügen — bisherige Einträge bleiben erhalten",
    action: "Aktion",
    mode: "Transportart",
    carrier: "Transportdienst",
    tracking: "Sendungsnummer",
    condition: "Zustand beim Eingang",
    expected: "Entspricht dem erwarteten Zustand",
    differenceRequired: "Abweichung — Beschreibung erforderlich",
    description: "Beschreibung",
    optional: "optional",
    completionHint:
      "Sie erfassen die Übergabe an den Kunden mit Ihrer Nachweisreferenz. Der Kunde bestätigt auf dieser Seite nichts.",
    saving: "Wird gespeichert…",
    save: "Angabe speichern",
    invalid:
      "Füllen Sie die Pflichtfelder aus (Beschreibung und Nachweisreferenz: mindestens 8 Zeichen).",
    actionUnconfirmed: "Aktion nicht bestätigt. Prüfen Sie den Verlauf vor einem erneuten Versuch.",
    photoUnconfirmed: "Foto nicht bestätigt. Prüfen Sie den Verlauf vor einem erneuten Hochladen.",
    kinds: {
      outbound: "Transport zur Werkstatt",
      carrier_delivered: "Laut Transportdienst zugestellt — von der Werkstatt erfasst",
      received: "Tatsächlicher Eingang in der Werkstatt bestätigt",
      return: "Rücktransport zum Kunden",
      completed: "Abschließende Übergabe von der Werkstatt erfasst",
      incident: "Vorfall",
      note: "Ergänzende Notiz / Korrektur",
    },
  },
  it: {
    region: "Logistica del libro",
    title: "Trasporto e ricezione del libro",
    introduction:
      "Tracciamento manuale registrato dal laboratorio. Nessun acquisto di spedizioni né pagamento. La consegna segnalata dal corriere non conferma la ricezione fisica nel laboratorio.",
    loading: "Caricamento del tracciamento…",
    loadError: "Impossibile caricare il tracciamento.",
    retry: "Riprova",
    saveError:
      "Registrazione non confermata. Ricarica il tracciamento prima di riprovare. Verifica il rapporto sullo stato, la prova e le foto (JPEG/PNG/WebP, massimo 5 MB).",
    photoRequirements: "È richiesta una foto JPEG, PNG o WebP di massimo 5 MB.",
    history: "Cronologia logistica",
    parcel: "Pacco tracciato",
    hand: "Consegna a mano",
    difference: "Difformità riscontrata alla ricezione",
    consistent: "Stato conforme al rapporto atteso",
    proof: "Riferimento della prova",
    finalDeclaration: "Dichiarazione del laboratorio; non è una conferma del cliente.",
    privatePhoto: "Foto privata",
    photoUnavailable: "Foto temporaneamente non disponibile",
    addPhoto: "Aggiungi una foto privata (massimo 5 MB, 8 per rapporto)",
    choosePhoto: "Scegli una foto",
    uploading: "Caricamento della foto…",
    empty: "Nessun trasporto registrato.",
    addEvent: "Aggiungi un evento — la cronologia viene conservata",
    action: "Azione",
    mode: "Modalità",
    carrier: "Corriere",
    tracking: "Numero di tracciamento",
    condition: "Stato alla ricezione",
    expected: "Conforme allo stato atteso",
    differenceRequired: "Difformità — descrizione obbligatoria",
    description: "Descrizione",
    optional: "facoltativa",
    completionHint:
      "Stai dichiarando la consegna al cliente con il riferimento della tua prova. Il cliente non conferma nulla in questa schermata.",
    saving: "Salvataggio…",
    save: "Salva la dichiarazione",
    invalid:
      "Compila i campi obbligatori (descrizione e riferimento della prova: almeno 8 caratteri).",
    actionUnconfirmed: "Azione non confermata. Rileggi la cronologia prima di riprovare.",
    photoUnconfirmed: "Foto non confermata. Verifica la cronologia prima di caricarla di nuovo.",
    kinds: {
      outbound: "Trasporto al laboratorio",
      carrier_delivered: "Consegnato secondo il corriere — dichiarazione del laboratorio",
      received: "Ricezione fisica confermata nel laboratorio",
      return: "Restituzione al cliente",
      completed: "Consegna finale dichiarata dal laboratorio",
      incident: "Incidente",
      note: "Nota aggiuntiva / correzione",
    },
  },
  es: {
    region: "Logística del libro",
    title: "Transporte y recepción del libro",
    introduction:
      "Seguimiento manual registrado por el taller. Sin compra de envíos ni pagos. La entrega indicada por el transportista no confirma la recepción física en el taller.",
    loading: "Cargando el seguimiento…",
    loadError: "No se pudo cargar el seguimiento.",
    retry: "Volver a intentar",
    saveError:
      "Registro no confirmado. Recarga el seguimiento antes de intentarlo de nuevo. Revisa el informe del estado, la prueba y las fotos (JPEG/PNG/WebP, máximo 5 MB).",
    photoRequirements: "Se requiere una foto JPEG, PNG o WebP de un máximo de 5 MB.",
    history: "Historial logístico",
    parcel: "Paquete con seguimiento",
    hand: "Entrega en mano",
    difference: "Diferencia observada en la recepción",
    consistent: "Estado conforme al informe previsto",
    proof: "Referencia de la prueba",
    finalDeclaration: "Declaración del taller; no es una confirmación del cliente.",
    privatePhoto: "Foto privada",
    photoUnavailable: "Foto temporalmente no disponible",
    addPhoto: "Añadir una foto privada (máximo 5 MB, 8 por informe)",
    choosePhoto: "Elegir una foto",
    uploading: "Subiendo la foto…",
    empty: "No hay transportes registrados.",
    addEvent: "Añadir un evento — se conserva el historial",
    action: "Acción",
    mode: "Modalidad",
    carrier: "Transportista",
    tracking: "Número de seguimiento",
    condition: "Estado en la recepción",
    expected: "Conforme al estado previsto",
    differenceRequired: "Diferencia — descripción obligatoria",
    description: "Descripción",
    optional: "opcional",
    completionHint:
      "Estás declarando la entrega al cliente con la referencia de tu prueba. El cliente no confirma nada en esta pantalla.",
    saving: "Guardando…",
    save: "Guardar la declaración",
    invalid:
      "Completa los campos obligatorios (descripción y referencia de la prueba: al menos 8 caracteres).",
    actionUnconfirmed: "Acción no confirmada. Revisa el historial antes de intentarlo de nuevo.",
    photoUnconfirmed: "Foto no confirmada. Comprueba el historial antes de volver a subirla.",
    kinds: {
      outbound: "Transporte al taller",
      carrier_delivered: "Entregado según el transportista — declaración del taller",
      received: "Recepción física confirmada en el taller",
      return: "Devolución al cliente",
      completed: "Entrega final declarada por el taller",
      incident: "Incidente",
      note: "Nota adicional / corrección",
    },
  },
};
