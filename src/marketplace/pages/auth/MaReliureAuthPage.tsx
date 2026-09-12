/**
 * La porte d'entrée des espaces Ma Reliure.
 *
 * `/auth` servait sur les deux marques la page de Métré Build : « Create your
 * account », un nom d'entreprise, un mot de passe de huit caractères — pour
 * une personne venue confier un livre. C'est la même route, sous la marque
 * Ma Reliure.
 *
 * Deux publics, choisis explicitement en haut de la page plutôt que devinés :
 *
 * - **Client** : un lien de connexion par e-mail — pas de compte à créer, pas
 *   de mot de passe à retenir, et le premier lien ouvre l'espace. Un mot de
 *   passe reste possible en repli, replié sous « Vous préférez un mot de
 *   passe ? » — jamais la méthode par défaut, mais jamais bloqué non plus
 *   pour qui ne veut plus repasser par sa boîte mail à chaque connexion ;
 * - **Atelier partenaire** : un mot de passe pour se connecter, et candidater
 *   pour rejoindre le réseau si aucun compte n'existe encore — un atelier ne
 *   s'auto-déclare jamais partenaire actif, l'admin invite après avoir
 *   approuvé (`src/marketplace/services/binderMembership.server.ts`).
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

type Audience = "customer" | "binder";
/** Repliée sous le lien de connexion — la méthode recommandée reste sans mot de passe (§3). */
type CustomerMethod = "link" | "password-signin" | "password-signup";

const tabClass = (active: boolean) =>
  `mr-tap flex-1 rounded-[2px] border px-4 py-3 text-center text-[0.9375rem] font-semibold transition-colors duration-200 ${
    active
      ? "border-mr-ink bg-mr-ink text-mr-paper"
      : "border-mr-rule-strong bg-white text-mr-ink hover:border-mr-ink"
  }`;

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
  const [audience, setAudience] = useState<Audience>("customer");
  const [customerMethod, setCustomerMethod] = useState<CustomerMethod>("link");
  const alert = accessError ?? linkProblem;

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">Votre espace</p>
        <h1 className="mr-title mt-4 text-mr-ink">Accéder à mon espace Ma Reliure</h1>

        <div className="mt-6 flex gap-2" role="tablist" aria-label="Vous êtes">
          <button
            type="button"
            role="tab"
            aria-selected={audience === "customer"}
            className={tabClass(audience === "customer")}
            onClick={() => setAudience("customer")}
          >
            Client
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={audience === "binder"}
            className={tabClass(audience === "binder")}
            onClick={() => setAudience("binder")}
          >
            Atelier partenaire
          </button>
        </div>

        <p className="mr-lead mt-6">
          {audience === "customer"
            ? customerMethod === "link"
              ? "Indiquez l'adresse e-mail donnée en présentant votre livre. Nous vous envoyons un lien de connexion : pas de compte à créer, pas de mot de passe à retenir."
              : customerMethod === "password-signin"
                ? "Connectez-vous avec le mot de passe de votre espace."
                : "Créez un mot de passe : vous n'aurez plus à passer par votre boîte mail à chaque connexion."
            : "Connectez-vous avec le mot de passe de votre atelier, ou candidatez pour rejoindre le réseau si vous n'avez pas encore de compte."}
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
          {audience === "customer" ? (
            customerMethod === "link" ? (
              <>
                <LinkSignIn onSent={() => setLinkProblem(null)} />
                <p className="mt-8 border-t border-mr-rule pt-6">
                  <button
                    type="button"
                    className={textButtonClass}
                    onClick={() => setCustomerMethod("password-signin")}
                  >
                    Vous préférez un mot de passe ?
                  </button>
                </p>
              </>
            ) : (
              <>
                {customerMethod === "password-signin" ? (
                  <PasswordSignIn onSignedIn={onSignedIn} />
                ) : (
                  <PasswordSignUp onSignedIn={onSignedIn} />
                )}
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-mr-rule pt-6">
                  <button
                    type="button"
                    className={textButtonClass}
                    onClick={() =>
                      setCustomerMethod(
                        customerMethod === "password-signin" ? "password-signup" : "password-signin",
                      )
                    }
                  >
                    {customerMethod === "password-signin"
                      ? "Pas encore de mot de passe ? En créer un"
                      : "Déjà un mot de passe ? Se connecter"}
                  </button>
                  <button
                    type="button"
                    className={textButtonClass}
                    onClick={() => setCustomerMethod("link")}
                  >
                    Revenir au lien de connexion par e-mail
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <h2 className="mr-heading text-mr-ink">Se connecter</h2>
              <div className="mt-4">
                <PasswordSignIn onSignedIn={onSignedIn} />
              </div>

              <div className="mt-10 border-t border-mr-rule pt-6">
                <h2 className="mr-heading text-mr-ink">S'inscrire</h2>
                <p className="mr-body mt-3">
                  Un atelier ne devient partenaire qu'après validation par Ma Reliure — nous ne
                  créons pas de compte immédiatement. Présentez votre atelier, nous revenons vers
                  vous.
                </p>
                <a href="/candidature-atelier" className={`mt-4 ${submitClass}`}>
                  Candidater pour devenir atelier partenaire
                </a>
              </div>
            </>
          )}
        </div>
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

/**
 * Créer un mot de passe sur le compte — pour un client qui a déjà reçu un
 * lien de connexion au moins une fois (le compte existe) et ne veut plus
 * repasser par sa boîte mail à chaque visite. N'importe entre-temps rien du
 * flux principal : le lien de connexion reste la méthode recommandée (§3),
 * celle-ci n'est jamais poussée par défaut.
 */
function PasswordSignUp({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      const detail =
        signUpError.message && signUpError.message.trim() && signUpError.message !== "{}"
          ? signUpError.message
          : "Vérifiez l'adresse indiquée et réessayez.";
      setError(detail);
      return;
    }
    if (!data.session) {
      // Confirmation requise avant l'ouverture d'une session — l'e-mail
      // envoyé porte le même lien que la connexion habituelle.
      setAwaitingConfirmation(true);
      return;
    }
    await onSignedIn();
  }

  if (awaitingConfirmation) {
    return (
      <p role="status" className="mr-body">
        Confirmez votre adresse depuis l'e-mail que nous venons d'envoyer, puis revenez vous
        connecter avec ce mot de passe.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="mr-auth-signup-email" className={labelClass}>
            Adresse e-mail
          </label>
          <input
            id="mr-auth-signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="mr-auth-signup-password" className={labelClass}>
            Mot de passe
          </label>
          <input
            id="mr-auth-signup-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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
        {loading ? "Création…" : "Créer mon mot de passe"}
      </button>
    </form>
  );
}
