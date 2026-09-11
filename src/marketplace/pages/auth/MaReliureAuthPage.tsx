/**
 * La porte d'entrée des espaces Ma Reliure.
 *
 * `/auth` servait sur les deux marques la page de Métré Build : « Create your
 * account », un nom d'entreprise, un mot de passe de huit caractères — pour
 * une personne venue confier un livre. C'est la même route, sous la marque
 * Ma Reliure.
 *
 * Deux chemins, dans l'ordre de ceux qui les empruntent :
 *
 * - un lien de connexion par e-mail, pour les clients : pas de compte à créer,
 *   pas de mot de passe à retenir, et le premier lien ouvre l'espace ;
 * - un mot de passe, en retrait, pour les ateliers partenaires et l'équipe.
 *
 * La destination ne se décide pas ici. Une fois la session ouverte, la route
 * la demande au serveur (`resolveMarketplacePostAuthDestination`).
 */
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_LINK_RESEND_DELAY_SECONDS,
  ACCESS_LINK_VALIDITY,
  linkErrorFromUrl,
  requestAccessLink,
} from "@/marketplace/auth/accessLink";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";

const labelClass = "mr-small block font-semibold text-mr-ink";
const inputClass =
  "mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink";
const submitClass =
  "mt-6 inline-flex w-full items-center justify-center rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-graphite disabled:opacity-60 sm:w-auto";
const textButtonClass = "mr-link mr-small mr-tap text-left disabled:no-underline disabled:opacity-60";

export function MaReliureAuthPage({
  accessError,
  routing,
  onSignedIn,
}: {
  accessError: string | null;
  routing: boolean;
  onSignedIn: () => Promise<void>;
}) {
  // Lu une fois, avant que le client Supabase ne nettoie l'adresse.
  const [linkProblem, setLinkProblem] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : linkErrorFromUrl(window.location.hash, window.location.search),
  );
  const [withPassword, setWithPassword] = useState(false);
  const alert = accessError ?? linkProblem;

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">{withPassword ? "Ateliers et équipe" : "Votre espace"}</p>
        <h1 className="mr-title mt-4 text-mr-ink">
          {withPassword ? "Connexion avec mot de passe" : "Retrouver mes livres"}
        </h1>
        <p className="mr-lead mt-5">
          {withPassword
            ? "Pour les ateliers partenaires et l'équipe Ma Reliure, avec le mot de passe de votre compte."
            : "Indiquez l'adresse e-mail donnée en présentant votre livre. Nous vous envoyons un lien de connexion : pas de compte à créer, pas de mot de passe à retenir."}
        </p>

        {alert && (
          <p role="alert" className="mr-small mt-8 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux">
            {alert}
          </p>
        )}
        {routing && (
          <p role="status" className="mr-small mt-8 text-mr-muted">
            Ouverture de votre espace…
          </p>
        )}

        <div className="mt-10">
          {withPassword ? (
            <PasswordSignIn onSignedIn={onSignedIn} />
          ) : (
            <LinkSignIn onSent={() => setLinkProblem(null)} />
          )}
        </div>

        <p className="mt-12 border-t border-mr-rule pt-6">
          <button
            type="button"
            className={textButtonClass}
            onClick={() => setWithPassword((current) => !current)}
          >
            {withPassword
              ? "Recevoir plutôt un lien de connexion par e-mail"
              : "Atelier partenaire ou équipe Ma Reliure : se connecter avec un mot de passe"}
          </button>
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}

function LinkSignIn({ onSent }: { onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send(address: string) {
    setSending(true);
    setProblem(null);
    const result = await requestAccessLink(supabase.auth, address, window.location.origin);
    setSending(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setSentTo(address.trim());
    setWait(ACCESS_LINK_RESEND_DELAY_SECONDS);
    onSent();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(email);
  }

  if (sentTo) {
    return (
      <div>
        <h2 className="mr-heading text-mr-ink">Lien envoyé</h2>
        <p role="status" className="mr-body mt-3">
          Un lien de connexion est parti vers{" "}
          <span className="font-semibold text-mr-ink">{sentTo}</span>. Il est valable{" "}
          {ACCESS_LINK_VALIDITY} et s'ouvre sur l'appareil de votre choix. S'il n'arrive pas d'ici
          quelques minutes, regardez dans les courriers indésirables.
        </p>
        {problem && (
          <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
            {problem}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
          <button
            type="button"
            className={textButtonClass}
            disabled={sending || wait > 0}
            onClick={() => void send(sentTo)}
          >
            {wait > 0 ? `Renvoyer le lien (dans ${wait} s)` : sending ? "Envoi…" : "Renvoyer le lien"}
          </button>
          <button
            type="button"
            className={textButtonClass}
            onClick={() => {
              setSentTo(null);
              setProblem(null);
            }}
          >
            Utiliser une autre adresse
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="mr-auth-email" className={labelClass}>
        Adresse e-mail
      </label>
      <input
        id="mr-auth-email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={inputClass}
      />
      {problem && (
        <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
          {problem}
        </p>
      )}
      <button type="submit" disabled={sending} className={submitClass}>
        {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
    </form>
  );
}

function PasswordSignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      return;
    }
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="mr-auth-password-email" className={labelClass}>
            Adresse e-mail
          </label>
          <input
            id="mr-auth-password-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="mr-auth-password" className={labelClass}>
            Mot de passe
          </label>
          <input
            id="mr-auth-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className={submitClass}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
