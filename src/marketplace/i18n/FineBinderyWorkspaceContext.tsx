import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FINE_BINDERY_LOCALE_STORAGE_KEY, resolveFineBinderyLocale, type FineBinderyLocale } from "./fineBinderyLocale";

const Context = createContext<{ isFineBindery: boolean; locale: FineBinderyLocale }>({ isFineBindery: false, locale: "fr" });

export const PROFESSIONAL_COPY = {
  en: { today: "Today", projects: "Projects", messages: "Messages", quotes: "Quotes", books: "Books", contacts: "Contacts", invoices: "Invoices", settings: "Settings", profile: "Public profile", work: "To handle", workshop: "My workshop", space: "Workshop space", signOut: "Sign out", signedIn: "Signed in as", more: "More", pending: "Project access awaiting approval", pendingBody: "You can already prepare services, contacts and quotes. An administrator enables project access.", language: "Language" },
  fr: { today: "Aujourd’hui", projects: "Projets", messages: "Messages", quotes: "Devis", books: "Ouvrages", contacts: "Contacts", invoices: "Factures", settings: "Paramètres", profile: "Profil public", work: "À traiter", workshop: "Mon atelier", space: "Espace atelier", signOut: "Se déconnecter", signedIn: "Connecté en tant que", more: "Plus", pending: "Accès aux projets en attente d’autorisation", pendingBody: "Vous pouvez déjà préparer prestations, contacts et devis. L’administration active l’accès aux projets.", language: "Langue" },
  de: { today: "Heute", projects: "Projekte", messages: "Nachrichten", quotes: "Angebote", books: "Bücher", contacts: "Kontakte", invoices: "Rechnungen", settings: "Einstellungen", profile: "Öffentliches Profil", work: "Zu bearbeiten", workshop: "Meine Werkstatt", space: "Werkstattbereich", signOut: "Abmelden", signedIn: "Angemeldet als", more: "Mehr", pending: "Projektzugang wartet auf Freigabe", pendingBody: "Leistungen, Kontakte und Angebote können Sie bereits vorbereiten. Die Verwaltung schaltet den Projektzugang frei.", language: "Sprache" },
  it: { today: "Oggi", projects: "Progetti", messages: "Messaggi", quotes: "Preventivi", books: "Libri", contacts: "Contatti", invoices: "Fatture", settings: "Impostazioni", profile: "Profilo pubblico", work: "Da gestire", workshop: "Il mio laboratorio", space: "Area laboratorio", signOut: "Esci", signedIn: "Accesso come", more: "Altro", pending: "Accesso ai progetti in attesa di approvazione", pendingBody: "Puoi già preparare servizi, contatti e preventivi. L’amministrazione abilita l’accesso ai progetti.", language: "Lingua" },
  es: { today: "Hoy", projects: "Proyectos", messages: "Mensajes", quotes: "Presupuestos", books: "Libros", contacts: "Contactos", invoices: "Facturas", settings: "Ajustes", profile: "Perfil público", work: "Por atender", workshop: "Mi taller", space: "Espacio del taller", signOut: "Cerrar sesión", signedIn: "Sesión iniciada como", more: "Más", pending: "Acceso a proyectos pendiente de aprobación", pendingBody: "Ya puedes preparar servicios, contactos y presupuestos. La administración habilita el acceso a proyectos.", language: "Idioma" },
} as const;

export function FineBinderyWorkspaceProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState({ isFineBindery: false, locale: "fr" as FineBinderyLocale });
  useEffect(() => {
    const isFineBindery = window.location.hostname === "finebindery.com" || window.location.hostname.endsWith(".finebindery.com") || window.localStorage.getItem("marketplace-brand") === "FINE_BINDERY";
    const locale = isFineBindery ? resolveFineBinderyLocale(window.localStorage.getItem(FINE_BINDERY_LOCALE_STORAGE_KEY)) : "fr";
    setValue({ isFineBindery, locale });
    document.documentElement.lang = locale;
  }, []);
  return <Context.Provider value={useMemo(() => value, [value])}>{children}</Context.Provider>;
}

export function useFineBinderyWorkspace() { return useContext(Context); }
