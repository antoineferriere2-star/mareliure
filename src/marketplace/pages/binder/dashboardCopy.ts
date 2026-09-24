/**
 * Les mots du tableau de bord « Aujourd'hui », dans les cinq langues de l'espace
 * atelier. Ma Reliure reste en français ; un atelier FineBindery lit sa langue.
 * `todayAgenda.ts` fournit des faits, ce module les formule.
 */
import type { AgendaItem, AgendaKind } from "@/marketplace/binders/todayAgenda";
import { HTML_LOCALE, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

type Count = (n: number | null) => string;
type SourceKey = "cases" | "quotes" | "invoices" | "works";

export interface DashboardCopy {
  title: string;
  description: string;
  newQuote: string;
  newWork: string;
  overview: string;
  tiles: {
    requests: Count; requestsHint: (n: number) => string;
    messages: Count; messagesHint: (n: number) => string;
    sent: Count; sentHint: (followUps: number) => string;
    works: Count; worksHint: string;
    payments: Count; paymentsHint: (overdue: number) => string;
    unavailable: string; loading: string;
  };
  now: {
    title: string; loading: string; summary: (count: number, late: number) => string;
    failed: (sources: string) => string; sources: Record<SourceKey, string>;
    retry: string; retrying: string;
    emptyTitle: string; emptyBody: string; emptyLink: string;
    less: string; more: (hidden: number) => string; late: string;
  };
  kinds: Record<AgendaKind, { label: (item: AgendaItem) => string; action: string }>;
  detail: {
    untitled: string; draft: string; toCreateWork: string; invoiceToPrepare: string;
    expiredOn: (date: string) => string; validUntil: (date: string) => string; dueOn: (date: string) => string;
  };
  setup: {
    title: string;
    access: string; active: string; waiting: string; accessOn: (brand: string) => string; accessOff: (brand: string) => string;
    billing: string; ready: string; invoicesBlocked: string; toComplete: string; billingReady: string; completeLink: string;
    publicProfile: string; published: string; notPublished: string; publishedBody: string;
    readyToPublish: string; readyAfterApproval: string; editProfile: string; finishProfile: string;
    missing: (items: string) => string; unavailable: string; retry: string;
  };
  /** Les champs manquants arrivent en français depuis le serveur ; ils sont traduits ici, sinon laissés tels quels. */
  missingTerms: Record<string, string>;
}

/** Le français accorde 0 au singulier ; l'anglais, l'allemand, l'italien et l'espagnol, au pluriel. */
const plural = (locale: FineBinderyLocale) => (n: number | null, one: string, many: string) =>
  locale === "fr" ? (n !== null && n > 1 ? many : one) : n === 1 ? one : many;

function copyFor(locale: FineBinderyLocale): DashboardCopy {
  const p = plural(locale);
  switch (locale) {
    case "fr":
      return {
        title: "Aujourd'hui",
        description: "Ce qui attend une réponse, une décision ou un document, dans l'ordre où le traiter.",
        newQuote: "Nouveau devis", newWork: "Nouvel ouvrage", overview: "Vue d'ensemble",
        tiles: {
          requests: (n) => p(n, "nouvelle demande", "nouvelles demandes"), requestsHint: (n) => (n ? "à examiner" : "aucune en attente"),
          messages: (n) => p(n, "message non lu", "messages non lus"), messagesHint: (n) => (n ? "réponse attendue" : "vous êtes à jour"),
          sent: (n) => p(n, "devis envoyé", "devis envoyés"), sentHint: (n) => (n ? `${n} à relancer` : "aucune relance nécessaire"),
          works: (n) => p(n, "ouvrage en cours", "ouvrages en cours"), worksHint: "fiches actives à l'atelier",
          payments: (n) => p(n, "paiement attendu", "paiements attendus"), paymentsHint: (n) => (n ? `dont ${n} en retard` : "aucun retard"),
          unavailable: "donnée indisponible", loading: "Chargement…",
        },
        now: {
          title: "À traiter maintenant", loading: "Chargement de vos priorités…",
          summary: (n, late) => `${n} action${n > 1 ? "s" : ""}${late ? `, dont ${late} en retard` : ""} — les clients qui attendent une réponse d'abord.`,
          failed: (s) => `Impossible de charger : ${s}. La liste peut être incomplète.`,
          sources: { cases: "demandes et messages", quotes: "devis", invoices: "factures", works: "ouvrages" },
          retry: "Réessayer", retrying: "Nouvel essai…",
          emptyTitle: "Rien ne vous attend",
          emptyBody: "Aucune demande nouvelle, aucun message non lu, aucun devis à relancer ni facture à émettre.",
          emptyLink: "Voir les ouvrages en cours",
          less: "Afficher moins", more: (n) => (n > 1 ? `Afficher les ${n} autres actions` : "Afficher l'action suivante"), late: "En retard",
        },
        kinds: {
          message: { label: (i) => ((i.unreadCount ?? 0) > 1 ? `${i.unreadCount} messages non lus` : "Message non lu"), action: "Répondre" },
          request: { label: () => "Nouvelle demande", action: "Examiner" },
          payment_overdue: { label: () => "Paiement en retard", action: "Voir la facture" },
          case_work: { label: () => "Atelier retenu", action: "Ouvrir le dossier" },
          case_quote: { label: () => "Devis à établir", action: "Ouvrir le dossier" },
          quote_expired: { label: () => "Validité dépassée", action: "Voir le devis" },
          quote_expiring: { label: () => "Devis à relancer", action: "Relancer" },
          quote_draft: { label: () => "Devis à terminer", action: "Continuer" },
          quote_to_invoice: { label: () => "Devis accepté", action: "Facturer" },
          invoice_draft: { label: () => "Facture à émettre", action: "Émettre" },
        },
        detail: {
          untitled: "Sans titre", draft: "Brouillon", toCreateWork: "fiche ouvrage à créer", invoiceToPrepare: "facture à préparer",
          expiredOn: (d) => `expiré le ${d}`, validUntil: (d) => `valable jusqu'au ${d}`, dueOn: (d) => `échéance du ${d}`,
        },
        setup: {
          title: "Votre atelier",
          access: "Accès aux demandes", active: "Actif", waiting: "En attente",
          accessOn: (b) => `${b} peut vous confier des projets.`,
          accessOff: (b) => `${b} active l'accès depuis l'administration. Devis, ouvrages et contacts restent disponibles.`,
          billing: "Devis et factures", ready: "Prêt", invoicesBlocked: "Factures bloquées", toComplete: "À compléter",
          billingReady: "Vos informations légales permettent d'émettre devis et factures.", completeLink: "Compléter mes informations",
          publicProfile: "Profil public", published: "Publié", notPublished: "Non publié", publishedBody: "Votre page présente votre savoir-faire.",
          readyToPublish: "Votre profil est prêt : il ne reste qu'à le publier.",
          readyAfterApproval: "Votre profil est prêt ; il pourra être publié une fois l'atelier approuvé.",
          editProfile: "Modifier mon profil", finishProfile: "Terminer mon profil",
          missing: (s) => `Manquant : ${s}.`, unavailable: "Information indisponible.", retry: "Réessayer",
        },
        missingTerms: {},
      };
    case "en":
      return {
        title: "Today",
        description: "What is waiting for a reply, a decision or a document, in the order to handle it.",
        newQuote: "New quote", newWork: "New book", overview: "Overview",
        tiles: {
          requests: (n) => p(n, "new request", "new requests"), requestsHint: (n) => (n ? "to review" : "none waiting"),
          messages: (n) => p(n, "unread message", "unread messages"), messagesHint: (n) => (n ? "awaiting your reply" : "you are up to date"),
          sent: (n) => p(n, "quote sent", "quotes sent"), sentHint: (n) => (n ? `${n} to follow up` : "no follow-up needed"),
          works: (n) => p(n, "book in progress", "books in progress"), worksHint: "active records in the workshop",
          payments: (n) => p(n, "payment due", "payments due"), paymentsHint: (n) => (n ? `including ${n} overdue` : "nothing overdue"),
          unavailable: "data unavailable", loading: "Loading…",
        },
        now: {
          title: "To handle now", loading: "Loading your priorities…",
          summary: (n, late) => `${n} action${n === 1 ? "" : "s"}${late ? `, ${late} overdue` : ""} — clients awaiting a reply come first.`,
          failed: (s) => `Could not load: ${s}. The list may be incomplete.`,
          sources: { cases: "requests and messages", quotes: "quotes", invoices: "invoices", works: "books" },
          retry: "Try again", retrying: "Retrying…",
          emptyTitle: "Nothing is waiting for you",
          emptyBody: "No new request, no unread message, no quote to follow up and no invoice to issue.",
          emptyLink: "See books in progress",
          less: "Show less", more: (n) => (n > 1 ? `Show the ${n} other actions` : "Show the next action"), late: "Overdue",
        },
        kinds: {
          message: { label: (i) => ((i.unreadCount ?? 0) > 1 ? `${i.unreadCount} unread messages` : "Unread message"), action: "Reply" },
          request: { label: () => "New request", action: "Review" },
          payment_overdue: { label: () => "Payment overdue", action: "View invoice" },
          case_work: { label: () => "Workshop selected", action: "Open project" },
          case_quote: { label: () => "Quote to prepare", action: "Open project" },
          quote_expired: { label: () => "Validity passed", action: "View quote" },
          quote_expiring: { label: () => "Quote to follow up", action: "Follow up" },
          quote_draft: { label: () => "Quote to finish", action: "Continue" },
          quote_to_invoice: { label: () => "Quote accepted", action: "Invoice" },
          invoice_draft: { label: () => "Invoice to issue", action: "Issue" },
        },
        detail: {
          untitled: "Untitled", draft: "Draft", toCreateWork: "book record to create", invoiceToPrepare: "invoice to prepare",
          expiredOn: (d) => `expired on ${d}`, validUntil: (d) => `valid until ${d}`, dueOn: (d) => `due ${d}`,
        },
        setup: {
          title: "Your workshop",
          access: "Project access", active: "Active", waiting: "Pending",
          accessOn: (b) => `${b} can entrust you with projects.`,
          accessOff: (b) => `${b} enables access from its administration. Quotes, books and contacts remain available.`,
          billing: "Quotes and invoices", ready: "Ready", invoicesBlocked: "Invoices blocked", toComplete: "To complete",
          billingReady: "Your legal details allow you to issue quotes and invoices.", completeLink: "Complete my details",
          publicProfile: "Public profile", published: "Published", notPublished: "Not published", publishedBody: "Your page presents your craftsmanship.",
          readyToPublish: "Your profile is ready: all that is left is to publish it.",
          readyAfterApproval: "Your profile is ready; it can be published once the workshop is approved.",
          editProfile: "Edit my profile", finishProfile: "Finish my profile",
          missing: (s) => `Missing: ${s}.`, unavailable: "Information unavailable.", retry: "Try again",
        },
        missingTerms: {
          "Nom de l'atelier": "Workshop name", "Régime de TVA": "VAT regime", Adresse: "Address", "Numéro de TVA": "VAT number", "Mention de TVA": "VAT statement",
          "nom de l’atelier": "workshop name", ville: "city", présentation: "introduction", "au moins une spécialité": "at least one specialty",
        },
      };
    case "de":
      return {
        title: "Heute",
        description: "Was auf eine Antwort, eine Entscheidung oder ein Dokument wartet – in der Reihenfolge der Bearbeitung.",
        newQuote: "Neues Angebot", newWork: "Neues Buch", overview: "Überblick",
        tiles: {
          requests: (n) => p(n, "neue Anfrage", "neue Anfragen"), requestsHint: (n) => (n ? "zu prüfen" : "keine offen"),
          messages: (n) => p(n, "ungelesene Nachricht", "ungelesene Nachrichten"), messagesHint: (n) => (n ? "Antwort erwartet" : "alles gelesen"),
          sent: (n) => p(n, "Angebot gesendet", "Angebote gesendet"), sentHint: (n) => (n ? `${n} nachzufassen` : "keine Nachfrage nötig"),
          works: (n) => p(n, "Buch in Arbeit", "Bücher in Arbeit"), worksHint: "aktive Einträge in der Werkstatt",
          payments: (n) => p(n, "Zahlung ausstehend", "Zahlungen ausstehend"), paymentsHint: (n) => (n ? `davon ${n} überfällig` : "nichts überfällig"),
          unavailable: "Daten nicht verfügbar", loading: "Wird geladen…",
        },
        now: {
          title: "Jetzt zu bearbeiten", loading: "Ihre Prioritäten werden geladen…",
          summary: (n, late) => `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"}${late ? `, davon ${late} überfällig` : ""} – Kunden, die auf eine Antwort warten, zuerst.`,
          failed: (s) => `Nicht geladen: ${s}. Die Liste ist möglicherweise unvollständig.`,
          sources: { cases: "Anfragen und Nachrichten", quotes: "Angebote", invoices: "Rechnungen", works: "Bücher" },
          retry: "Erneut versuchen", retrying: "Neuer Versuch…",
          emptyTitle: "Nichts wartet auf Sie",
          emptyBody: "Keine neue Anfrage, keine ungelesene Nachricht, kein Angebot zum Nachfassen und keine Rechnung auszustellen.",
          emptyLink: "Bücher in Arbeit ansehen",
          less: "Weniger anzeigen", more: (n) => (n > 1 ? `Die ${n} weiteren Aufgaben anzeigen` : "Nächste Aufgabe anzeigen"), late: "Überfällig",
        },
        kinds: {
          message: { label: (i) => ((i.unreadCount ?? 0) > 1 ? `${i.unreadCount} ungelesene Nachrichten` : "Ungelesene Nachricht"), action: "Antworten" },
          request: { label: () => "Neue Anfrage", action: "Prüfen" },
          payment_overdue: { label: () => "Zahlung überfällig", action: "Rechnung ansehen" },
          case_work: { label: () => "Werkstatt ausgewählt", action: "Projekt öffnen" },
          case_quote: { label: () => "Angebot zu erstellen", action: "Projekt öffnen" },
          quote_expired: { label: () => "Gültigkeit abgelaufen", action: "Angebot ansehen" },
          quote_expiring: { label: () => "Angebot nachfassen", action: "Nachfassen" },
          quote_draft: { label: () => "Angebot fertigstellen", action: "Fortsetzen" },
          quote_to_invoice: { label: () => "Angebot angenommen", action: "Abrechnen" },
          invoice_draft: { label: () => "Rechnung auszustellen", action: "Ausstellen" },
        },
        detail: {
          untitled: "Ohne Titel", draft: "Entwurf", toCreateWork: "Bucheintrag anzulegen", invoiceToPrepare: "Rechnung vorzubereiten",
          expiredOn: (d) => `abgelaufen am ${d}`, validUntil: (d) => `gültig bis ${d}`, dueOn: (d) => `fällig am ${d}`,
        },
        setup: {
          title: "Ihre Werkstatt",
          access: "Projektzugang", active: "Aktiv", waiting: "Ausstehend",
          accessOn: (b) => `${b} kann Ihnen Projekte anvertrauen.`,
          accessOff: (b) => `${b} schaltet den Zugang über die Verwaltung frei. Angebote, Bücher und Kontakte bleiben verfügbar.`,
          billing: "Angebote und Rechnungen", ready: "Bereit", invoicesBlocked: "Rechnungen gesperrt", toComplete: "Zu vervollständigen",
          billingReady: "Ihre rechtlichen Angaben erlauben Angebote und Rechnungen.", completeLink: "Angaben vervollständigen",
          publicProfile: "Öffentliches Profil", published: "Veröffentlicht", notPublished: "Nicht veröffentlicht", publishedBody: "Ihre Seite zeigt Ihr handwerkliches Können.",
          readyToPublish: "Ihr Profil ist bereit: Sie müssen es nur noch veröffentlichen.",
          readyAfterApproval: "Ihr Profil ist bereit; es kann veröffentlicht werden, sobald die Werkstatt freigegeben ist.",
          editProfile: "Profil bearbeiten", finishProfile: "Profil fertigstellen",
          missing: (s) => `Fehlt: ${s}.`, unavailable: "Information nicht verfügbar.", retry: "Erneut versuchen",
        },
        missingTerms: {
          "Nom de l'atelier": "Name der Werkstatt", "Régime de TVA": "Umsatzsteuerregelung", Adresse: "Adresse", "Numéro de TVA": "USt-IdNr.", "Mention de TVA": "Umsatzsteuerhinweis",
          "nom de l’atelier": "Name der Werkstatt", ville: "Ort", présentation: "Vorstellung", "au moins une spécialité": "mindestens eine Spezialisierung",
        },
      };
    case "it":
      return {
        title: "Oggi",
        description: "Ciò che attende una risposta, una decisione o un documento, nell'ordine in cui gestirlo.",
        newQuote: "Nuovo preventivo", newWork: "Nuovo libro", overview: "Panoramica",
        tiles: {
          requests: (n) => p(n, "nuova richiesta", "nuove richieste"), requestsHint: (n) => (n ? "da esaminare" : "nessuna in attesa"),
          messages: (n) => p(n, "messaggio non letto", "messaggi non letti"), messagesHint: (n) => (n ? "risposta attesa" : "sei in pari"),
          sent: (n) => p(n, "preventivo inviato", "preventivi inviati"), sentHint: (n) => (n ? `${n} da sollecitare` : "nessun sollecito necessario"),
          works: (n) => p(n, "libro in lavorazione", "libri in lavorazione"), worksHint: "schede attive in laboratorio",
          payments: (n) => p(n, "pagamento atteso", "pagamenti attesi"), paymentsHint: (n) => (n ? `di cui ${n} in ritardo` : "nessun ritardo"),
          unavailable: "dato non disponibile", loading: "Caricamento…",
        },
        now: {
          title: "Da gestire ora", loading: "Caricamento delle tue priorità…",
          summary: (n, late) => `${n} ${n === 1 ? "azione" : "azioni"}${late ? `, di cui ${late} in ritardo` : ""} — prima i clienti che attendono una risposta.`,
          failed: (s) => `Impossibile caricare: ${s}. L'elenco potrebbe essere incompleto.`,
          sources: { cases: "richieste e messaggi", quotes: "preventivi", invoices: "fatture", works: "libri" },
          retry: "Riprova", retrying: "Nuovo tentativo…",
          emptyTitle: "Nulla ti attende",
          emptyBody: "Nessuna nuova richiesta, nessun messaggio non letto, nessun preventivo da sollecitare né fattura da emettere.",
          emptyLink: "Vedi i libri in lavorazione",
          less: "Mostra meno", more: (n) => (n > 1 ? `Mostra le altre ${n} azioni` : "Mostra l'azione successiva"), late: "In ritardo",
        },
        kinds: {
          message: { label: (i) => ((i.unreadCount ?? 0) > 1 ? `${i.unreadCount} messaggi non letti` : "Messaggio non letto"), action: "Rispondi" },
          request: { label: () => "Nuova richiesta", action: "Esamina" },
          payment_overdue: { label: () => "Pagamento in ritardo", action: "Vedi la fattura" },
          case_work: { label: () => "Laboratorio scelto", action: "Apri il progetto" },
          case_quote: { label: () => "Preventivo da preparare", action: "Apri il progetto" },
          quote_expired: { label: () => "Validità scaduta", action: "Vedi il preventivo" },
          quote_expiring: { label: () => "Preventivo da sollecitare", action: "Sollecita" },
          quote_draft: { label: () => "Preventivo da completare", action: "Continua" },
          quote_to_invoice: { label: () => "Preventivo accettato", action: "Fattura" },
          invoice_draft: { label: () => "Fattura da emettere", action: "Emetti" },
        },
        detail: {
          untitled: "Senza titolo", draft: "Bozza", toCreateWork: "scheda libro da creare", invoiceToPrepare: "fattura da preparare",
          expiredOn: (d) => `scaduto il ${d}`, validUntil: (d) => `valido fino al ${d}`, dueOn: (d) => `scadenza il ${d}`,
        },
        setup: {
          title: "Il tuo laboratorio",
          access: "Accesso ai progetti", active: "Attivo", waiting: "In attesa",
          accessOn: (b) => `${b} può affidarti dei progetti.`,
          accessOff: (b) => `${b} abilita l'accesso dall'amministrazione. Preventivi, libri e contatti restano disponibili.`,
          billing: "Preventivi e fatture", ready: "Pronto", invoicesBlocked: "Fatture bloccate", toComplete: "Da completare",
          billingReady: "I tuoi dati legali consentono di emettere preventivi e fatture.", completeLink: "Completa i miei dati",
          publicProfile: "Profilo pubblico", published: "Pubblicato", notPublished: "Non pubblicato", publishedBody: "La tua pagina presenta il tuo saper fare.",
          readyToPublish: "Il tuo profilo è pronto: resta solo da pubblicarlo.",
          readyAfterApproval: "Il tuo profilo è pronto; potrà essere pubblicato una volta approvato il laboratorio.",
          editProfile: "Modifica il mio profilo", finishProfile: "Completa il mio profilo",
          missing: (s) => `Mancante: ${s}.`, unavailable: "Informazione non disponibile.", retry: "Riprova",
        },
        missingTerms: {
          "Nom de l'atelier": "Nome del laboratorio", "Régime de TVA": "Regime IVA", Adresse: "Indirizzo", "Numéro de TVA": "Partita IVA", "Mention de TVA": "Dicitura IVA",
          "nom de l’atelier": "nome del laboratorio", ville: "città", présentation: "presentazione", "au moins une spécialité": "almeno una specialità",
        },
      };
    case "es":
      return {
        title: "Hoy",
        description: "Lo que espera una respuesta, una decisión o un documento, en el orden en que atenderlo.",
        newQuote: "Nuevo presupuesto", newWork: "Nuevo libro", overview: "Resumen",
        tiles: {
          requests: (n) => p(n, "nueva solicitud", "nuevas solicitudes"), requestsHint: (n) => (n ? "por revisar" : "ninguna pendiente"),
          messages: (n) => p(n, "mensaje sin leer", "mensajes sin leer"), messagesHint: (n) => (n ? "respuesta pendiente" : "estás al día"),
          sent: (n) => p(n, "presupuesto enviado", "presupuestos enviados"), sentHint: (n) => (n ? `${n} por recordar` : "ningún recordatorio necesario"),
          works: (n) => p(n, "libro en curso", "libros en curso"), worksHint: "fichas activas en el taller",
          payments: (n) => p(n, "pago pendiente", "pagos pendientes"), paymentsHint: (n) => (n ? `${n} con retraso` : "ningún retraso"),
          unavailable: "dato no disponible", loading: "Cargando…",
        },
        now: {
          title: "Por atender ahora", loading: "Cargando tus prioridades…",
          summary: (n, late) => `${n} ${n === 1 ? "acción" : "acciones"}${late ? `, ${late} con retraso` : ""} — primero los clientes que esperan respuesta.`,
          failed: (s) => `No se pudo cargar: ${s}. La lista puede estar incompleta.`,
          sources: { cases: "solicitudes y mensajes", quotes: "presupuestos", invoices: "facturas", works: "libros" },
          retry: "Reintentar", retrying: "Reintentando…",
          emptyTitle: "Nada te espera",
          emptyBody: "Ninguna solicitud nueva, ningún mensaje sin leer, ningún presupuesto por recordar ni factura por emitir.",
          emptyLink: "Ver los libros en curso",
          less: "Mostrar menos", more: (n) => (n > 1 ? `Mostrar las otras ${n} acciones` : "Mostrar la siguiente acción"), late: "Con retraso",
        },
        kinds: {
          message: { label: (i) => ((i.unreadCount ?? 0) > 1 ? `${i.unreadCount} mensajes sin leer` : "Mensaje sin leer"), action: "Responder" },
          request: { label: () => "Nueva solicitud", action: "Revisar" },
          payment_overdue: { label: () => "Pago vencido", action: "Ver la factura" },
          case_work: { label: () => "Taller seleccionado", action: "Abrir el proyecto" },
          case_quote: { label: () => "Presupuesto por preparar", action: "Abrir el proyecto" },
          quote_expired: { label: () => "Validez vencida", action: "Ver el presupuesto" },
          quote_expiring: { label: () => "Presupuesto por recordar", action: "Recordar" },
          quote_draft: { label: () => "Presupuesto por terminar", action: "Continuar" },
          quote_to_invoice: { label: () => "Presupuesto aceptado", action: "Facturar" },
          invoice_draft: { label: () => "Factura por emitir", action: "Emitir" },
        },
        detail: {
          untitled: "Sin título", draft: "Borrador", toCreateWork: "ficha del libro por crear", invoiceToPrepare: "factura por preparar",
          expiredOn: (d) => `venció el ${d}`, validUntil: (d) => `válido hasta el ${d}`, dueOn: (d) => `vencimiento el ${d}`,
        },
        setup: {
          title: "Tu taller",
          access: "Acceso a proyectos", active: "Activo", waiting: "Pendiente",
          accessOn: (b) => `${b} puede confiarte proyectos.`,
          accessOff: (b) => `${b} habilita el acceso desde la administración. Presupuestos, libros y contactos siguen disponibles.`,
          billing: "Presupuestos y facturas", ready: "Listo", invoicesBlocked: "Facturas bloqueadas", toComplete: "Por completar",
          billingReady: "Tus datos legales permiten emitir presupuestos y facturas.", completeLink: "Completar mis datos",
          publicProfile: "Perfil público", published: "Publicado", notPublished: "No publicado", publishedBody: "Tu página presenta tu saber hacer.",
          readyToPublish: "Tu perfil está listo: solo falta publicarlo.",
          readyAfterApproval: "Tu perfil está listo; podrá publicarse cuando se apruebe el taller.",
          editProfile: "Editar mi perfil", finishProfile: "Terminar mi perfil",
          missing: (s) => `Falta: ${s}.`, unavailable: "Información no disponible.", retry: "Reintentar",
        },
        missingTerms: {
          "Nom de l'atelier": "Nombre del taller", "Régime de TVA": "Régimen de IVA", Adresse: "Dirección", "Numéro de TVA": "Número de IVA", "Mention de TVA": "Mención de IVA",
          "nom de l’atelier": "nombre del taller", ville: "ciudad", présentation: "presentación", "au moins une spécialité": "al menos una especialidad",
        },
      };
  }
}

const CACHE = new Map<FineBinderyLocale, DashboardCopy>();
export function dashboardCopy(locale: FineBinderyLocale): DashboardCopy {
  if (!CACHE.has(locale)) CACHE.set(locale, copyFor(locale));
  return CACHE.get(locale)!;
}

/** « jeudi 24 septembre », « Thursday 24 September »… — à Paris, première lettre en capitale. */
export function longDate(now: Date, locale: FineBinderyLocale): string {
  const text = new Intl.DateTimeFormat(HTML_LOCALE[locale], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Une date AAAA-MM-JJ sans heure : lue en UTC pour ne jamais glisser d'un jour. */
export function shortDate(iso: string, locale: FineBinderyLocale): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(HTML_LOCALE[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function translateMissing(items: readonly string[], copy: DashboardCopy): string {
  return items.map((item) => copy.missingTerms[item] ?? item).join(", ");
}

/** Ce qu'une ligne de l'agenda affiche : étiquette, titre, détail, verbe. */
export function agendaTexts(item: AgendaItem, locale: FineBinderyLocale) {
  const copy = dashboardCopy(locale);
  const d = copy.detail;
  const who = item.clientName ? `${item.clientName} · ${item.reference}` : item.reference ?? "";
  const date = item.date ? shortDate(item.date, locale) : "";
  const client = item.clientName ?? "";
  const detail = {
    message: who,
    request: who,
    case_quote: who,
    case_work: `${who} · ${d.toCreateWork}`,
    quote_expired: `${item.documentNumber} · ${client} · ${d.expiredOn(date)}`,
    quote_expiring: `${item.documentNumber} · ${client} · ${d.validUntil(date)}`,
    quote_draft: `${item.documentNumber} · ${client}`,
    quote_to_invoice: `${item.documentNumber} · ${d.invoiceToPrepare}`,
    invoice_draft: `${d.draft} · ${client}`,
    payment_overdue: `${item.documentNumber} · ${d.dueOn(date)}`,
  }[item.kind];
  return { label: copy.kinds[item.kind].label(item), title: item.title || d.untitled, detail, action: copy.kinds[item.kind].action };
}
