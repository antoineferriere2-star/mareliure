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
 * Rendu par la route de la Mission, sur Ma Reliure seulement : le runtime
 * offre l'emplacement, il ne connaît pas la marketplace.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_LINK_RESEND_DELAY_SECONDS,
  ACCESS_LINK_VALIDITY,
  requestAccessLink,
} from "@/marketplace/auth/accessLink";

const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-60";

export function CustomerSpaceOffer({ email }: { email: string | null }) {
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
      setProblem(result.message);
      return;
    }
    setSent(true);
    setWait(ACCESS_LINK_RESEND_DELAY_SECONDS);
  }

  const address = <span className="font-medium text-stone-950">{email}</span>;

  return (
    <section
      aria-labelledby="customer-space-title"
      className="rounded-md border border-stone-300 bg-stone-50 p-4 sm:p-5"
    >
      <h2 id="customer-space-title" className="text-base font-semibold text-stone-950">
        Suivre votre livre
      </h2>

      {!email ? (
        <>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Retrouvez votre projet et son avancement dans votre espace Ma Reliure, avec l'adresse
            e-mail indiquée dans votre projet.
          </p>
          <Link to="/auth" className={`mt-4 ${primaryButton}`}>
            Accéder à mon espace
          </Link>
        </>
      ) : sent ? (
        <>
          <p role="status" className="mt-2 text-sm leading-6 text-stone-700">
            Lien envoyé à {address}. Il est valable {ACCESS_LINK_VALIDITY} et s'ouvre sur
            l'appareil de votre choix. S'il n'arrive pas, regardez dans les courriers indésirables.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={sending || wait > 0}
            className="mt-3 text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-950 disabled:no-underline disabled:opacity-60"
          >
            {wait > 0
              ? `Renvoyer le lien (possible dans ${wait} s)`
              : sending
                ? "Envoi…"
                : "Renvoyer le lien"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Retrouvez votre projet et son avancement dans votre espace Ma Reliure. Pas de mot de
            passe à créer : nous envoyons un lien de connexion à {address}.
          </p>
          <button type="button" onClick={send} disabled={sending} className={`mt-4 ${primaryButton}`}>
            {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
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
