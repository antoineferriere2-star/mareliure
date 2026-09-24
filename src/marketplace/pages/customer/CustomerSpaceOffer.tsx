/**
 * Après l'envoi d'un projet : proposer de le suivre.
 *
 * La personne vient de décrire son livre et de donner son adresse. C'est le
 * moment où elle se demande « et maintenant ? » — et la page ne lui offrait
 * que de présenter un autre projet. Ce bloc lui ouvre son espace en un geste :
 * un lien de connexion envoyé à l'adresse qu'elle vient d'écrire, sans compte
 * à créer ni mot de passe.
 *
 * L'adresse est celle du projet, affichée telle quelle : rien ne part vers une
 * adresse que la personne ne voit pas. Le livre se rattache à l'espace côté
 * serveur, par l'adresse que le lien aura vérifiée.
 *
 * Rendu par la route de la Mission, sur Ma Reliure et Fine Bindery
 * seulement : le runtime offre l'emplacement, il ne connaît pas la
 * marketplace. `publicToken` dit laquelle des deux Missions vient de
 * soumettre — la même distinction que le titre de l'onglet dans
 * routes/m.$publicToken.tsx, pas une résolution par Host séparée.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import { usePublicLocale } from "@/build/pages/public/publicLocaleContext";
import {
  ACCESS_LINK_RESEND_DELAY_SECONDS,
  ACCESS_LINK_VALIDITY,
  requestAccessLink,
} from "@/marketplace/auth/accessLink";

const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-60";

interface Copy {
  title: string;
  noEmailBody: string;
  accessSpace: string;
  sentBody: (email: string) => string;
  resend: (sending: boolean, wait: number) => string;
  pitchBody: (email: string) => string;
  sendButton: (sending: boolean) => string;
  problem: string;
}

const FR: Copy = {
  title: "Suivre votre livre",
  noEmailBody:
    "Retrouvez votre projet et son avancement dans votre espace Ma Reliure, avec l'adresse e-mail indiquée dans votre projet.",
  accessSpace: "Accéder à mon espace",
  sentBody: (email) =>
    `Lien envoyé à ${email}. Il est valable ${ACCESS_LINK_VALIDITY} et s'ouvre sur l'appareil de votre choix. S'il n'arrive pas, regardez dans les courriers indésirables.`,
  resend: (sending, wait) =>
    wait > 0 ? `Renvoyer le lien (possible dans ${wait} s)` : sending ? "Envoi…" : "Renvoyer le lien",
  pitchBody: (email) =>
    `Retrouvez votre projet et son avancement dans votre espace Ma Reliure. Pas de mot de passe à créer : nous envoyons un lien de connexion à ${email}.`,
  sendButton: (sending) => (sending ? "Envoi…" : "Recevoir mon lien de connexion"),
  problem: "Le lien n’a pas pu être envoyé. Réessayez dans quelques instants.",
};

const EN: Copy = {
  title: "Follow your book",
  noEmailBody:
    "Find your project and its progress in your Fine Bindery space, using the email address given in your project.",
  accessSpace: "Access my space",
  sentBody: (email) =>
    `Link sent to ${email}. It's valid for one hour and opens on any device. If it doesn't arrive, check your spam folder.`,
  resend: (sending, wait) =>
    wait > 0 ? `Resend the link (in ${wait}s)` : sending ? "Sending…" : "Resend the link",
  pitchBody: (email) =>
    `Find your project and its progress in your Fine Bindery space. No password to create: we'll send a sign-in link to ${email}.`,
  sendButton: (sending) => (sending ? "Sending…" : "Send my sign-in link"),
  problem: "The link could not be sent. Please try again in a moment.",
};

const DE: Copy = {
  title: "Ihr Buch verfolgen",
  noEmailBody: "Verfolgen Sie Ihr Projekt und seinen Fortschritt in Ihrem Fine-Bindery-Bereich mit der im Projekt angegebenen E-Mail-Adresse.",
  accessSpace: "Meinen Bereich öffnen",
  sentBody: (email) => `Link an ${email} gesendet. Er ist eine Stunde gültig und kann auf jedem Gerät geöffnet werden. Prüfen Sie auch Ihren Spam-Ordner.`,
  resend: (sending, wait) => wait > 0 ? `Link erneut senden (in ${wait} s)` : sending ? "Wird gesendet…" : "Link erneut senden",
  pitchBody: (email) => `Verfolgen Sie Ihr Projekt in Ihrem Fine-Bindery-Bereich. Sie benötigen kein Passwort: Wir senden einen Anmeldelink an ${email}.`,
  sendButton: (sending) => sending ? "Wird gesendet…" : "Anmeldelink senden",
  problem: "Der Link konnte nicht gesendet werden. Versuchen Sie es in Kürze erneut.",
};

const IT: Copy = {
  title: "Segui il tuo libro",
  noEmailBody: "Segui il progetto e il suo avanzamento nel tuo spazio Fine Bindery con l’indirizzo e-mail indicato nel progetto.",
  accessSpace: "Accedi al mio spazio",
  sentBody: (email) => `Link inviato a ${email}. È valido per un’ora e si apre su qualsiasi dispositivo. Controlla anche la cartella spam.`,
  resend: (sending, wait) => wait > 0 ? `Invia di nuovo il link (tra ${wait} s)` : sending ? "Invio…" : "Invia di nuovo il link",
  pitchBody: (email) => `Segui il progetto nel tuo spazio Fine Bindery. Non serve creare una password: invieremo un link di accesso a ${email}.`,
  sendButton: (sending) => sending ? "Invio…" : "Invia il link di accesso",
  problem: "Non è stato possibile inviare il link. Riprova tra poco.",
};

const ES: Copy = {
  title: "Sigue tu libro",
  noEmailBody: "Consulta tu proyecto y su avance en tu espacio Fine Bindery con el correo electrónico indicado en el proyecto.",
  accessSpace: "Acceder a mi espacio",
  sentBody: (email) => `Enlace enviado a ${email}. Es válido durante una hora y se abre en cualquier dispositivo. Revisa también la carpeta de correo no deseado.`,
  resend: (sending, wait) => wait > 0 ? `Volver a enviar el enlace (en ${wait} s)` : sending ? "Enviando…" : "Volver a enviar el enlace",
  pitchBody: (email) => `Consulta tu proyecto en tu espacio Fine Bindery. No necesitas crear una contraseña: enviaremos un enlace de acceso a ${email}.`,
  sendButton: (sending) => sending ? "Enviando…" : "Enviar mi enlace de acceso",
  problem: "No se ha podido enviar el enlace. Inténtalo de nuevo en unos instantes.",
};

const FINE_BINDERY_COPY: Record<string, Copy> = {
  "en-US": EN,
  "fr-FR": FR,
  "de-DE": DE,
  "it-IT": IT,
  "es-ES": ES,
};

export function CustomerSpaceOffer({
  email,
  publicToken,
}: {
  email: string | null;
  publicToken: string;
}) {
  const { locale } = usePublicLocale();
  const t = publicToken === FINE_BINDERY_PUBLIC_TOKEN ? (FINE_BINDERY_COPY[locale] ?? EN) : FR;
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send() {
    if (!email) return;
    setSending(true);
    setProblem(null);
    const result = await requestAccessLink(supabase.auth, email, window.location.origin);
    setSending(false);
    if (!result.ok) {
      setProblem(t.problem);
      return;
    }
    setSent(true);
    setWait(ACCESS_LINK_RESEND_DELAY_SECONDS);
  }

  return (
    <section
      aria-labelledby="customer-space-title"
      className="rounded-md border border-stone-300 bg-stone-50 p-4 sm:p-5"
    >
      <h2 id="customer-space-title" className="text-base font-semibold text-stone-950">
        {t.title}
      </h2>

      {!email ? (
        <>
          <p className="mt-2 text-sm leading-6 text-stone-700">{t.noEmailBody}</p>
          <Link to="/auth" className={`mt-4 ${primaryButton}`}>
            {t.accessSpace}
          </Link>
        </>
      ) : sent ? (
        <>
          <p role="status" className="mt-2 text-sm leading-6 text-stone-700">
            {t.sentBody(email)}
          </p>
          <button
            type="button"
            onClick={send}
            disabled={sending || wait > 0}
            className="mt-3 text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-950 disabled:no-underline disabled:opacity-60"
          >
            {t.resend(sending, wait)}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-stone-700">{t.pitchBody(email)}</p>
          <button type="button" onClick={send} disabled={sending} className={`mt-4 ${primaryButton}`}>
            {t.sendButton(sending)}
          </button>
        </>
      )}

      {problem && (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {problem}
        </p>
      )}
    </section>
  );
}
