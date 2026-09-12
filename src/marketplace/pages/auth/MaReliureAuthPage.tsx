/**
 * La porte d'entrée des espaces Ma Reliure — et, depuis cette session,
 * de Fine Bindery : même moteur (Supabase Auth, accessLink.ts), même mise en
 * page, un texte différent par marque plutôt qu'une seconde page.
 *
 * `/auth` servait sur les deux marques la page de Métré Build : « Create your
 * account », un nom d'entreprise, un mot de passe de huit caractères — pour
 * une personne venue confier un livre. C'est la même route, sous la marque
 * marketplace résolue par le Host (routes/auth.tsx).
 *
 * Deux publics sur Ma Reliure, choisis explicitement en haut de la page
 * plutôt que devinés :
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
 * Fine Bindery n'a qu'un seul public ici : un atelier Fine Bindery reste un
 * atelier Ma Reliure côté compte (§43 du brief international — "l'artisan
 * n'a pas besoin d'un autre compte Fine Bindery") et se connecte toujours
 * sur mareliure.fr, jamais sur finebindery.com. Pas d'onglet à choisir.
 *
 * La destination ne se décide pas ici. Une fois la session ouverte, la route
 * la demande au serveur (`resolveMarketplacePostAuthDestination`).
 */
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_CODE_LENGTH,
  ACCESS_LINK_RESEND_DELAY_SECONDS,
  ACCESS_LINK_VALIDITY,
  linkErrorFromUrl,
  requestAccessLink,
  verifyAccessCode,
} from "@/marketplace/auth/accessLink";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";
import {
  FineBinderyFooter,
  FineBinderyHeader,
} from "@/marketplace/pages/fineBindery/FineBinderyChrome";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

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

/** Tout le texte qui diffère entre les deux marques — jamais deux copies de la logique au-dessus. */
interface AuthCopy {
  eyebrow: string;
  heading: string;
  showBinderTab: boolean;
  tabClient: string;
  tabBinder: string;
  leadLink: string;
  leadPasswordSignin: string;
  leadPasswordSignup: string;
  leadBinder: string;
  routingStatus: string;
  preferPassword: string;
  noPasswordYet: string;
  alreadyHavePassword: string;
  backToLink: string;
  binderSignInHeading: string;
  binderSignUpHeading: string;
  binderSignUpBody: string;
  binderSignUpCta: string;
  emailLabel: string;
  requestButton: (sending: boolean) => string;
  emailSentHeading: string;
  emailSentBody: (email: string) => string;
  resendButton: (sending: boolean, wait: number) => string;
  useAnotherAddress: string;
  codeLabel: string;
  validateCodeButton: (verifying: boolean) => string;
  passwordEmailLabel: string;
  passwordLabel: string;
  signInButton: (loading: boolean) => string;
  wrongCredentials: string;
  createPasswordButton: (loading: boolean) => string;
  confirmEmailMessage: string;
  signUpErrorFallback: string;
}

const MA_RELIURE_COPY: AuthCopy = {
  eyebrow: "Votre espace",
  heading: "Accéder à mon espace Ma Reliure",
  showBinderTab: true,
  tabClient: "Client",
  tabBinder: "Atelier partenaire",
  leadLink:
    "Indiquez l'adresse e-mail donnée en présentant votre livre. Nous vous envoyons un lien et un code de connexion : pas de compte à créer, pas de mot de passe à retenir.",
  leadPasswordSignin: "Connectez-vous avec le mot de passe de votre espace.",
  leadPasswordSignup:
    "Créez un mot de passe : vous n'aurez plus à passer par votre boîte mail à chaque connexion.",
  leadBinder:
    "Connectez-vous avec le mot de passe de votre atelier, ou candidatez pour rejoindre le réseau si vous n'avez pas encore de compte.",
  routingStatus: "Ouverture de votre espace…",
  preferPassword: "Vous préférez un mot de passe ?",
  noPasswordYet: "Pas encore de mot de passe ? En créer un",
  alreadyHavePassword: "Déjà un mot de passe ? Se connecter",
  backToLink: "Revenir au lien de connexion par e-mail",
  binderSignInHeading: "Se connecter",
  binderSignUpHeading: "S'inscrire",
  binderSignUpBody:
    "Un atelier ne devient partenaire qu'après validation par Ma Reliure — nous ne créons pas de compte immédiatement. Présentez votre atelier, nous revenons vers vous.",
  binderSignUpCta: "Candidater pour devenir atelier partenaire",
  emailLabel: "Adresse e-mail",
  requestButton: (sending) => (sending ? "Envoi…" : "Recevoir mon lien et mon code de connexion"),
  emailSentHeading: "E-mail envoyé",
  emailSentBody: (email) =>
    `Un lien et un code de connexion sont partis vers ${email}. Cliquez le lien, ou saisissez le code ci-dessous — les deux sont valables ${ACCESS_LINK_VALIDITY}. S'il n'arrive pas d'ici quelques minutes, regardez dans les courriers indésirables.`,
  resendButton: (sending, wait) =>
    wait > 0 ? `Renvoyer (dans ${wait} s)` : sending ? "Envoi…" : "Renvoyer l'e-mail",
  useAnotherAddress: "Utiliser une autre adresse",
  codeLabel: "Ou saisissez le code reçu par e-mail",
  validateCodeButton: (verifying) => (verifying ? "Vérification…" : "Valider le code"),
  passwordEmailLabel: "Adresse e-mail",
  passwordLabel: "Mot de passe",
  signInButton: (loading) => (loading ? "Connexion…" : "Se connecter"),
  wrongCredentials: "Adresse e-mail ou mot de passe incorrect.",
  createPasswordButton: (loading) => (loading ? "Création…" : "Créer mon mot de passe"),
  confirmEmailMessage:
    "Confirmez votre adresse depuis l'e-mail que nous venons d'envoyer, puis revenez vous connecter avec ce mot de passe.",
  signUpErrorFallback: "Vérifiez l'adresse indiquée et réessayez.",
};

/** Pas d'onglet atelier (§43 : un atelier Fine Bindery se connecte sur mareliure.fr, jamais ici). */
const FINE_BINDERY_COPY: AuthCopy = {
  eyebrow: "Your space",
  heading: "Access your Fine Bindery space",
  showBinderTab: false,
  tabClient: "Client",
  tabBinder: "",
  leadLink:
    "Enter the email address you used to present your book. We'll send you a sign-in link and code — no account to create, no password to remember.",
  leadPasswordSignin: "Sign in with your space's password.",
  leadPasswordSignup: "Create a password so you don't have to check your inbox every time.",
  leadBinder: "",
  routingStatus: "Opening your space…",
  preferPassword: "Prefer a password?",
  noPasswordYet: "Don't have a password yet? Create one",
  alreadyHavePassword: "Already have a password? Sign in",
  backToLink: "Back to the email sign-in link",
  binderSignInHeading: "",
  binderSignUpHeading: "",
  binderSignUpBody: "",
  binderSignUpCta: "",
  emailLabel: "Email address",
  requestButton: (sending) => (sending ? "Sending…" : "Send my sign-in link and code"),
  emailSentHeading: "Email sent",
  emailSentBody: (email) =>
    `A sign-in link and code were sent to ${email}. Click the link, or enter the code below — both are valid for ${ACCESS_LINK_VALIDITY === "une heure" ? "one hour" : ACCESS_LINK_VALIDITY}. If it doesn't arrive within a few minutes, check your spam folder.`,
  resendButton: (sending, wait) =>
    wait > 0 ? `Resend (in ${wait}s)` : sending ? "Sending…" : "Resend the email",
  useAnotherAddress: "Use a different address",
  codeLabel: "Or enter the code from the email",
  validateCodeButton: (verifying) => (verifying ? "Verifying…" : "Verify the code"),
  passwordEmailLabel: "Email address",
  passwordLabel: "Password",
  signInButton: (loading) => (loading ? "Signing in…" : "Sign in"),
  wrongCredentials: "Incorrect email or password.",
  createPasswordButton: (loading) => (loading ? "Creating…" : "Create my password"),
  confirmEmailMessage:
    "Confirm your address from the email we just sent, then come back here to sign in with this password.",
  signUpErrorFallback: "Check the address you entered and try again.",
};

const AUTH_COPY: Record<MarketplaceBrand, AuthCopy> = {
  MA_RELIURE: MA_RELIURE_COPY,
  FINE_BINDERY: FINE_BINDERY_COPY,
};

export function MaReliureAuthPage({
  brand,
  accessError,
  routing,
  onSignedIn,
}: {
  brand: MarketplaceBrand;
  accessError: string | null;
  routing: boolean;
  onSignedIn: () => Promise<void>;
}) {
  const t = AUTH_COPY[brand];
  const Header = brand === "FINE_BINDERY" ? FineBinderyHeader : LandingHeader;
  const Footer = brand === "FINE_BINDERY" ? FineBinderyFooter : LandingFooter;

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
      <Header />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">{t.eyebrow}</p>
        <h1 className="mr-title mt-4 text-mr-ink">{t.heading}</h1>

        {t.showBinderTab && (
          <div className="mt-6 flex gap-2" role="tablist" aria-label="Vous êtes">
            <button
              type="button"
              role="tab"
              aria-selected={audience === "customer"}
              className={tabClass(audience === "customer")}
              onClick={() => setAudience("customer")}
            >
              {t.tabClient}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={audience === "binder"}
              className={tabClass(audience === "binder")}
              onClick={() => setAudience("binder")}
            >
              {t.tabBinder}
            </button>
          </div>
        )}

        <p className="mr-lead mt-6">
          {audience === "customer"
            ? customerMethod === "link"
              ? t.leadLink
              : customerMethod === "password-signin"
                ? t.leadPasswordSignin
                : t.leadPasswordSignup
            : t.leadBinder}
        </p>

        {alert && (
          <p role="alert" className="mr-small mt-8 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux">
            {alert}
          </p>
        )}
        {routing && (
          <p role="status" className="mr-small mt-8 text-mr-muted">
            {t.routingStatus}
          </p>
        )}

        <div className="mt-10">
          {audience === "customer" ? (
            customerMethod === "link" ? (
              <>
                <LinkSignIn t={t} onSent={() => setLinkProblem(null)} onSignedIn={onSignedIn} />
                <p className="mt-8 border-t border-mr-rule pt-6">
                  <button
                    type="button"
                    className={textButtonClass}
                    onClick={() => setCustomerMethod("password-signin")}
                  >
                    {t.preferPassword}
                  </button>
                </p>
              </>
            ) : (
              <>
                {customerMethod === "password-signin" ? (
                  <PasswordSignIn t={t} onSignedIn={onSignedIn} />
                ) : (
                  <PasswordSignUp t={t} onSignedIn={onSignedIn} />
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
                    {customerMethod === "password-signin" ? t.noPasswordYet : t.alreadyHavePassword}
                  </button>
                  <button
                    type="button"
                    className={textButtonClass}
                    onClick={() => setCustomerMethod("link")}
                  >
                    {t.backToLink}
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <h2 className="mr-heading text-mr-ink">{t.binderSignInHeading}</h2>
              <div className="mt-4">
                <PasswordSignIn t={t} onSignedIn={onSignedIn} />
              </div>

              <div className="mt-10 border-t border-mr-rule pt-6">
                <h2 className="mr-heading text-mr-ink">{t.binderSignUpHeading}</h2>
                <p className="mr-body mt-3">{t.binderSignUpBody}</p>
                <a href="/candidature-atelier" className={`mt-4 ${submitClass}`}>
                  {t.binderSignUpCta}
                </a>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function LinkSignIn({
  t,
  onSent,
  onSignedIn,
}: {
  t: AuthCopy;
  onSent: () => void;
  onSignedIn: () => Promise<void>;
}) {
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
        <h2 className="mr-heading text-mr-ink">{t.emailSentHeading}</h2>
        <p role="status" className="mr-body mt-3">
          {t.emailSentBody(sentTo)}
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
            {t.resendButton(sending, wait)}
          </button>
          <button
            type="button"
            className={textButtonClass}
            onClick={() => {
              setSentTo(null);
              setProblem(null);
            }}
          >
            {t.useAnotherAddress}
          </button>
        </div>

        <div className="mt-8 border-t border-mr-rule pt-6">
          <CodeSignIn t={t} email={sentTo} onSignedIn={onSignedIn} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="mr-auth-email" className={labelClass}>
        {t.emailLabel}
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
        {t.requestButton(sending)}
      </button>
    </form>
  );
}

/**
 * Le code vit dans le même e-mail que le lien (§ accessLink.ts) — jamais un
 * second envoi. Il sert quand le lien n'ouvre rien : messagerie qui
 * pré-visite les liens, redirection vers une autre application sur mobile,
 * client mail qui bloque l'ouverture.
 */
function CodeSignIn({
  t,
  email,
  onSignedIn,
}: {
  t: AuthCopy;
  email: string;
  onSignedIn: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setProblem(null);
    const result = await verifyAccessCode(supabase.auth, email, code);
    setVerifying(false);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="mr-auth-code" className={labelClass}>
        {t.codeLabel}
      </label>
      <input
        id="mr-auth-code"
        type="text"
        required
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={ACCESS_CODE_LENGTH}
        placeholder={"•".repeat(ACCESS_CODE_LENGTH)}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
        className={`${inputClass} tracking-[0.3em]`}
      />
      {problem && (
        <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
          {problem}
        </p>
      )}
      <button type="submit" disabled={verifying || code.trim() === ""} className={submitClass}>
        {t.validateCodeButton(verifying)}
      </button>
    </form>
  );
}

function PasswordSignIn({ t, onSignedIn }: { t: AuthCopy; onSignedIn: () => Promise<void> }) {
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
      setError(t.wrongCredentials);
      return;
    }
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="mr-auth-password-email" className={labelClass}>
            {t.passwordEmailLabel}
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
            {t.passwordLabel}
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
        {t.signInButton(loading)}
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
function PasswordSignUp({ t, onSignedIn }: { t: AuthCopy; onSignedIn: () => Promise<void> }) {
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
          : t.signUpErrorFallback;
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
        {t.confirmEmailMessage}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5">
        <div>
          <label htmlFor="mr-auth-signup-email" className={labelClass}>
            {t.passwordEmailLabel}
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
            {t.passwordLabel}
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
        {t.createPasswordButton(loading)}
      </button>
    </form>
  );
}
