import type { FineBinderyLocale } from "./fineBinderyLocale";

/**
 * Compte connecté sans atelier actif (code serveur `no_binder`) : l'accès reste refusé, l'écran
 * explique pourquoi et oriente (audit #53, C4).
 */
export const NO_WORKSHOP_COPY: Record<FineBinderyLocale, { title: string; body: string; link: string }> = {
  fr: {
    title: "Aucun atelier n'est associé à ce compte.",
    body: "Ces outils sont réservés aux membres actifs d'un atelier. Si votre atelier vous a invité, ouvrez le lien d'invitation reçu par e-mail ; sinon, présentez votre atelier.",
    link: "Présenter mon atelier",
  },
  en: {
    title: "No workshop is linked to this account.",
    body: "These tools are reserved for active members of a workshop. If your workshop invited you, open the invitation link you received by email; otherwise, apply as a workshop.",
    link: "Apply as a workshop",
  },
  de: {
    title: "Mit diesem Konto ist keine Werkstatt verknüpft.",
    body: "Diese Werkzeuge stehen nur aktiven Mitgliedern einer Werkstatt zur Verfügung. Wenn Ihre Werkstatt Sie eingeladen hat, öffnen Sie den Einladungslink aus der E-Mail; andernfalls stellen Sie Ihre Werkstatt vor.",
    link: "Werkstatt vorstellen",
  },
  it: {
    title: "Nessun laboratorio è associato a questo account.",
    body: "Questi strumenti sono riservati ai membri attivi di un laboratorio. Se il tuo laboratorio ti ha invitato, apri il link di invito ricevuto via e-mail; altrimenti presenta il tuo laboratorio.",
    link: "Presenta il mio laboratorio",
  },
  es: {
    title: "No hay ningún taller asociado a esta cuenta.",
    body: "Estas herramientas están reservadas a los miembros activos de un taller. Si tu taller te ha invitado, abre el enlace de invitación recibido por correo; si no, presenta tu taller.",
    link: "Presentar mi taller",
  },
};

export function isNoWorkshopError(error: unknown): boolean {
  return (error instanceof Error ? error.message : String(error ?? "")) === "no_binder";
}
