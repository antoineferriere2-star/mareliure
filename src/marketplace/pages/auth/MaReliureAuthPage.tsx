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
 * - **Atelier partenaire** : un lien et un code de connexion créent aussi le
 *   compte à la première utilisation. L'atelier est créé en attente de
 *   validation ; seul l'admin l'autorise ensuite à recevoir des leads.
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
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

const labelClass = "mr-small block font-semibold text-mr-ink";
const inputClass =
  "mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink";
const submitClass =
  "mt-6 inline-flex w-full items-center justify-center rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-graphite disabled:opacity-60 sm:w-auto";
const textButtonClass =
  "mr-link mr-small mr-tap text-left disabled:no-underline disabled:opacity-60";

type Audience = "customer" | "binder";
/**
 * Plus de "password-signup" ici : créer un mot de passe pour un e-mail
 * arbitraire, avant toute preuve qu'on en est le titulaire, permettait
 * d'attacher un mot de passe au compte de n'importe quel client déjà connu
 * (constaté sur un compte réel — voir CODEX_HANDOFF). La création d'un mot
 * de passe se fait maintenant uniquement juste après une vérification par
 * code (CodeSignIn), sur la session que cette vérification vient d'ouvrir —
 * jamais sur un e-mail saisi à froid.
 */
type CustomerMethod = "link" | "password-signin";

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
  leadBinder: string;
  routingStatus: string;
  preferPassword: string;
  backToLink: string;
  binderSignInHeading: string;
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
  /** Proposé juste après une connexion par code réussie — jamais avant. */
  offerPasswordHeading: string;
  offerPasswordBody: string;
  createPasswordAfterVerifyButton: (loading: boolean) => string;
  skipPasswordButton: string;
  passwordSetError: string;
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
  leadBinder:
    "Indiquez votre adresse e-mail pour créer votre espace atelier ou vous reconnecter. Le lien et le code reçus vérifient cette adresse. Vous créez ensuite votre atelier ; l'accès aux leads reste soumis à la validation de Ma Reliure.",
  routingStatus: "Ouverture de votre espace…",
  preferPassword: "Vous avez déjà un mot de passe ?",
  backToLink: "Revenir au lien de connexion par e-mail",
  binderSignInHeading: "Créer mon espace atelier ou me connecter",
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
  offerPasswordHeading: "Créer un mot de passe pour la prochaine fois ?",
  offerPasswordBody:
    "Facultatif : vous n'aurez alors plus besoin de repasser par votre boîte mail à chaque connexion.",
  createPasswordAfterVerifyButton: (loading) => (loading ? "Création…" : "Créer mon mot de passe"),
  skipPasswordButton: "Continuer sans mot de passe",
  passwordSetError: "Le mot de passe n'a pas pu être enregistré. Réessayez dans un instant.",
};

/** Pas d'onglet atelier (§43 : un atelier Fine Bindery se connecte sur mareliure.fr, jamais ici). */
const FINE_BINDERY_COPY_EN: AuthCopy = {
  eyebrow: "Your space",
  heading: "Access your Fine Bindery space",
  showBinderTab: true,
  tabClient: "Client",
  tabBinder: "Workshop",
  leadLink:
    "Enter the email address you used to present your book. We'll send you a sign-in link and code — no account to create, no password to remember.",
  leadPasswordSignin: "Sign in with your space's password.",
  leadBinder:
    "Enter your email address to create or reopen your workshop space. Fine Bindery verifies the address first; access to new projects is approved separately.",
  routingStatus: "Opening your space…",
  preferPassword: "Already have a password?",
  backToLink: "Back to the email sign-in link",
  binderSignInHeading: "Create or access my workshop space",
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
  offerPasswordHeading: "Create a password for next time?",
  offerPasswordBody: "Optional — you won't need to check your inbox again to sign in.",
  createPasswordAfterVerifyButton: (loading) => (loading ? "Creating…" : "Create my password"),
  skipPasswordButton: "Continue without a password",
  passwordSetError: "The password could not be saved. Please try again in a moment.",
};

const FINE_BINDERY_COPY: Record<FineBinderyLocale, AuthCopy> = {
  en: FINE_BINDERY_COPY_EN,
  fr: {
    ...FINE_BINDERY_COPY_EN,
    eyebrow: "Votre espace",
    heading: "Accéder à votre espace Fine Bindery",
    tabClient: "Client",
    tabBinder: "Atelier",
    leadLink: "Indiquez l’adresse e-mail utilisée pour présenter votre livre. Nous vous envoyons un lien et un code de connexion.",
    leadPasswordSignin: "Connectez-vous avec le mot de passe de votre espace.",
    leadBinder: "Indiquez votre adresse e-mail pour créer ou retrouver votre espace atelier. Fine Bindery vérifie d’abord l’adresse ; l’accès aux nouveaux projets est autorisé séparément.",
    routingStatus: "Ouverture de votre espace…",
    preferPassword: "Vous avez déjà un mot de passe ?",
    backToLink: "Revenir au lien de connexion par e-mail",
    binderSignInHeading: "Créer ou retrouver mon espace atelier",
    emailLabel: "Adresse e-mail",
    requestButton: (sending) => (sending ? "Envoi…" : "Recevoir mon lien et mon code"),
    emailSentHeading: "E-mail envoyé",
    emailSentBody: (email) => `Un lien et un code ont été envoyés à ${email}. Ils restent valables une heure. Pensez à vérifier les courriers indésirables.`,
    resendButton: (sending, wait) => wait > 0 ? `Renvoyer (dans ${wait} s)` : sending ? "Envoi…" : "Renvoyer l’e-mail",
    useAnotherAddress: "Utiliser une autre adresse",
    codeLabel: "Ou saisissez le code reçu par e-mail",
    validateCodeButton: (verifying) => (verifying ? "Vérification…" : "Valider le code"),
    passwordEmailLabel: "Adresse e-mail",
    passwordLabel: "Mot de passe",
    signInButton: (loading) => (loading ? "Connexion…" : "Se connecter"),
    wrongCredentials: "Adresse e-mail ou mot de passe incorrect.",
    offerPasswordHeading: "Créer un mot de passe pour la prochaine fois ?",
    offerPasswordBody: "Facultatif : vous pourrez ensuite vous connecter sans ouvrir votre boîte mail.",
    createPasswordAfterVerifyButton: (loading) => (loading ? "Création…" : "Créer mon mot de passe"),
    skipPasswordButton: "Continuer sans mot de passe",
    passwordSetError: "Le mot de passe n’a pas pu être enregistré. Réessayez dans un instant.",
  },
  de: {
    ...FINE_BINDERY_COPY_EN,
    eyebrow: "Ihr Bereich", heading: "Fine-Bindery-Bereich öffnen", tabClient: "Kundschaft", tabBinder: "Werkstatt",
    leadLink: "Geben Sie die E-Mail-Adresse an, mit der Sie Ihr Buch vorgestellt haben. Wir senden Ihnen einen Anmeldelink und einen Code.",
    leadPasswordSignin: "Melden Sie sich mit dem Passwort Ihres Bereichs an.",
    leadBinder: "Geben Sie Ihre E-Mail-Adresse ein, um Ihren Werkstattbereich anzulegen oder erneut zu öffnen. Fine Bindery prüft zuerst die Adresse; der Zugang zu neuen Projekten wird separat freigegeben.",
    routingStatus: "Ihr Bereich wird geöffnet…", preferPassword: "Sie haben bereits ein Passwort?", backToLink: "Zurück zum Anmeldelink per E-Mail",
    binderSignInHeading: "Werkstattbereich anlegen oder öffnen", emailLabel: "E-Mail-Adresse",
    requestButton: (sending) => sending ? "Wird gesendet…" : "Anmeldelink und Code senden", emailSentHeading: "E-Mail gesendet",
    emailSentBody: (email) => `Ein Anmeldelink und ein Code wurden an ${email} gesendet. Beide sind eine Stunde gültig. Prüfen Sie auch den Spam-Ordner.`,
    resendButton: (sending, wait) => wait > 0 ? `Erneut senden (in ${wait} s)` : sending ? "Wird gesendet…" : "E-Mail erneut senden",
    useAnotherAddress: "Andere Adresse verwenden", codeLabel: "Oder den Code aus der E-Mail eingeben",
    validateCodeButton: (verifying) => verifying ? "Wird geprüft…" : "Code bestätigen", passwordEmailLabel: "E-Mail-Adresse", passwordLabel: "Passwort",
    signInButton: (loading) => loading ? "Anmeldung…" : "Anmelden", wrongCredentials: "E-Mail-Adresse oder Passwort ist falsch.",
    offerPasswordHeading: "Passwort für die nächste Anmeldung erstellen?", offerPasswordBody: "Optional: Danach müssen Sie zum Anmelden nicht mehr Ihr Postfach öffnen.",
    createPasswordAfterVerifyButton: (loading) => loading ? "Wird erstellt…" : "Passwort erstellen", skipPasswordButton: "Ohne Passwort fortfahren",
    passwordSetError: "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  },
  it: {
    ...FINE_BINDERY_COPY_EN,
    eyebrow: "Il tuo spazio", heading: "Accedi al tuo spazio Fine Bindery", tabClient: "Cliente", tabBinder: "Laboratorio",
    leadLink: "Inserisci l’indirizzo e-mail usato per presentare il libro. Ti invieremo un link e un codice di accesso.", leadPasswordSignin: "Accedi con la password del tuo spazio.",
    leadBinder: "Inserisci l’indirizzo e-mail per creare o riaprire lo spazio del laboratorio. Fine Bindery verifica prima l’indirizzo; l’accesso ai nuovi progetti viene approvato separatamente.",
    routingStatus: "Apertura dello spazio…", preferPassword: "Hai già una password?", backToLink: "Torna al link di accesso via e-mail", binderSignInHeading: "Crea o apri lo spazio del laboratorio",
    emailLabel: "Indirizzo e-mail", requestButton: (sending) => sending ? "Invio…" : "Invia link e codice", emailSentHeading: "E-mail inviata",
    emailSentBody: (email) => `Un link e un codice sono stati inviati a ${email}. Sono validi per un’ora. Controlla anche la cartella spam.`,
    resendButton: (sending, wait) => wait > 0 ? `Reinvia (tra ${wait} s)` : sending ? "Invio…" : "Reinvia l’e-mail", useAnotherAddress: "Usa un altro indirizzo",
    codeLabel: "Oppure inserisci il codice ricevuto", validateCodeButton: (verifying) => verifying ? "Verifica…" : "Conferma il codice", passwordEmailLabel: "Indirizzo e-mail", passwordLabel: "Password",
    signInButton: (loading) => loading ? "Accesso…" : "Accedi", wrongCredentials: "E-mail o password errata.", offerPasswordHeading: "Creare una password per il prossimo accesso?",
    offerPasswordBody: "Facoltativo: non dovrai più aprire la posta per accedere.", createPasswordAfterVerifyButton: (loading) => loading ? "Creazione…" : "Crea la password",
    skipPasswordButton: "Continua senza password", passwordSetError: "Impossibile salvare la password. Riprova tra poco.",
  },
  es: {
    ...FINE_BINDERY_COPY_EN,
    eyebrow: "Tu espacio", heading: "Accede a tu espacio Fine Bindery", tabClient: "Cliente", tabBinder: "Taller",
    leadLink: "Introduce el correo utilizado para presentar tu libro. Te enviaremos un enlace y un código de acceso.", leadPasswordSignin: "Accede con la contraseña de tu espacio.",
    leadBinder: "Introduce tu correo para crear o volver a abrir el espacio del taller. Fine Bindery verifica primero la dirección; el acceso a nuevos proyectos se aprueba por separado.",
    routingStatus: "Abriendo tu espacio…", preferPassword: "¿Ya tienes contraseña?", backToLink: "Volver al enlace por correo", binderSignInHeading: "Crear o abrir mi espacio de taller",
    emailLabel: "Correo electrónico", requestButton: (sending) => sending ? "Enviando…" : "Enviar enlace y código", emailSentHeading: "Correo enviado",
    emailSentBody: (email) => `Se han enviado un enlace y un código a ${email}. Son válidos durante una hora. Revisa también la carpeta de spam.`,
    resendButton: (sending, wait) => wait > 0 ? `Reenviar (en ${wait} s)` : sending ? "Enviando…" : "Reenviar correo", useAnotherAddress: "Usar otra dirección",
    codeLabel: "O introduce el código recibido", validateCodeButton: (verifying) => verifying ? "Verificando…" : "Confirmar código", passwordEmailLabel: "Correo electrónico", passwordLabel: "Contraseña",
    signInButton: (loading) => loading ? "Accediendo…" : "Acceder", wrongCredentials: "Correo o contraseña incorrectos.", offerPasswordHeading: "¿Crear una contraseña para la próxima vez?",
    offerPasswordBody: "Opcional: después no tendrás que abrir el correo para acceder.", createPasswordAfterVerifyButton: (loading) => loading ? "Creando…" : "Crear contraseña",
    skipPasswordButton: "Continuar sin contraseña", passwordSetError: "No se pudo guardar la contraseña. Inténtalo de nuevo.",
  },
};

export function MaReliureAuthPage({
  brand,
  fineBinderyLocale = "en",
  initialAudience,
  accessError,
  routing,
  onSignedIn,
}: {
  brand: MarketplaceBrand;
  fineBinderyLocale?: FineBinderyLocale;
  initialAudience: Audience;
  accessError: string | null;
  routing: boolean;
  onSignedIn: (audience: Audience) => Promise<void>;
}) {
  const t = brand === "FINE_BINDERY" ? FINE_BINDERY_COPY[fineBinderyLocale] : MA_RELIURE_COPY;

  // Lu une fois, avant que le client Supabase ne nettoie l'adresse.
  const [linkProblem, setLinkProblem] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : linkErrorFromUrl(window.location.hash, window.location.search),
  );
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const [customerMethod, setCustomerMethod] = useState<CustomerMethod>("link");
  const [binderMethod, setBinderMethod] = useState<CustomerMethod>("link");
  const alert = accessError ?? linkProblem;

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      {brand === "FINE_BINDERY" ? <FineBinderyHeader locale={fineBinderyLocale} /> : <LandingHeader />}
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
              : t.leadPasswordSignin
            : t.leadBinder}
        </p>

        {alert && (
          <p
            role="alert"
            className="mr-small mt-8 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux"
          >
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
                <LinkSignIn t={t} onSent={() => setLinkProblem(null)} onSignedIn={() => onSignedIn("customer")} />
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
                <PasswordSignIn t={t} onSignedIn={() => onSignedIn("customer")} />
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-mr-rule pt-6">
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
                {binderMethod === "link" ? (
                  <LinkSignIn t={t} space="atelier" onSent={() => setLinkProblem(null)} onSignedIn={() => onSignedIn("binder")} />
                ) : (
                  <PasswordSignIn t={t} onSignedIn={() => onSignedIn("binder")} />
                )}
              </div>
              <p className="mt-6">
                <button
                  type="button"
                  className={textButtonClass}
                  onClick={() =>
                    setBinderMethod(binderMethod === "link" ? "password-signin" : "link")
                  }
                >
                  {binderMethod === "link"
                    ? "Se connecter avec un mot de passe"
                    : "Recevoir un lien de connexion par e-mail"}
                </button>
              </p>

              <p className="mr-small mt-10 border-t border-mr-rule pt-6 text-mr-muted">
                Votre espace atelier est disponible dès la création du compte.
                Ma Reliure valide séparément l'accès aux nouveaux projets.
              </p>
            </>
          )}
        </div>
      </main>
      {brand === "FINE_BINDERY" ? <FineBinderyFooter locale={fineBinderyLocale} /> : <LandingFooter />}
    </div>
  );
}

function LinkSignIn({
  t,
  space,
  onSent,
  onSignedIn,
}: {
  t: AuthCopy;
  space?: "atelier";
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
    const result = await requestAccessLink(supabase.auth, address, window.location.origin, space);
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
  // Le code vient de vérifier que cette personne tient bien la boîte mail —
  // c'est le seul instant où proposer un mot de passe est sûr : la session
  // qui vient de s'ouvrir est celle de cet e-mail précis, jamais un autre
  // saisi à froid (voir la note sur CustomerMethod plus haut).
  const [verified, setVerified] = useState(false);

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
    setVerified(true);
  }

  if (verified) {
    return <SetPasswordAfterVerification t={t} onSignedIn={onSignedIn} />;
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

/**
 * `updateUser` agit uniquement sur la session déjà ouverte par le code
 * qu'on vient de vérifier — contrairement à `signUp`, aucun e-mail n'est
 * pris en entrée, donc aucun compte tiers ne peut jamais être ciblé.
 * Facultatif : « Continuer sans mot de passe » garde le lien magique comme
 * seule méthode, ce qui reste très bien.
 */
function SetPasswordAfterVerification({
  t,
  onSignedIn,
}: {
  t: AuthCopy;
  onSignedIn: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(t.passwordSetError);
      return;
    }
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mr-heading text-mr-ink">{t.offerPasswordHeading}</h2>
      <p className="mr-body mt-2">{t.offerPasswordBody}</p>
      <div className="mt-5">
        <label htmlFor="mr-auth-new-password" className={labelClass}>
          {t.passwordLabel}
        </label>
        <input
          id="mr-auth-new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <button type="submit" disabled={loading} className={submitClass}>
          {t.createPasswordAfterVerifyButton(loading)}
        </button>
        <button
          type="button"
          className={textButtonClass}
          disabled={loading}
          onClick={() => void onSignedIn()}
        >
          {t.skipPasswordButton}
        </button>
      </div>
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
