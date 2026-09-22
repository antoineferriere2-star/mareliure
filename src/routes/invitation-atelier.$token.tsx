/**
 * Activer une invitation d'atelier (§7).
 *
 * Route publique, volontairement hors de `/atelier` (qui vit sous
 * `_authenticated` et redirigerait vers `/auth` en perdant le jeton — le même
 * piège que le lien de rattachement client documenté dans
 * docs/reliure-marketplace-architecture.md). Elle gère elle-même les deux cas :
 * un compte existe déjà (connexion), ou non (création). Dans les deux cas,
 * `acceptBinderInvitation` côté serveur est ce qui décide réellement — cette
 * page ne fait que réunir une session et un jeton.
 */
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptBinderInvitation,
  getBinderInvitationEmail,
} from "@/marketplace/services/marketplace.data.functions";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";
import { canSubmitInvitationSignup } from "@/marketplace/binders/membership";

export const Route = createFileRoute("/invitation-atelier/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activer mon accès atelier — Ma Reliure" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvitationPage,
});

type Step = "checking" | "signed-out" | "wrong-account" | "accepting" | "done" | "error";

function InvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptBinderInvitation);
  const getInvitationEmail = useServerFn(getBinderInvitationEmail);
  const [step, setStep] = useState<Step>("checking");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [accessLinkSent, setAccessLinkSent] = useState(false);
  const [sendingAccessLink, setSendingAccessLink] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  // Verrouillé sur l'adresse réelle de l'invitation dès qu'elle est connue —
  // avant cela, ce formulaire ne doit jamais pouvoir créer ou mettre à jour
  // un compte pour une adresse différente de celle invitée (voir
  // resolvePendingInvitationEmail : un test de ce flux a un jour attaché un
  // mot de passe au compte d'une cliente réelle plutôt qu'à celui invité).
  // `undefined` = pas encore résolue, `null` = invitation invalide/expirée.
  const [invitedEmail, setInvitedEmail] = useState<string | null | undefined>(undefined);

  async function tryAccept() {
    setStep("accepting");
    setError(null);
    try {
      await accept({ data: { token } });
      setStep("done");
      window.setTimeout(() => void navigate({ to: "/atelier" }), 1200);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Cette invitation n'a pas pu être activée.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getInvitationEmail({ data: { token } }), supabase.auth.getSession()])
      .then(([invitation, session]) => {
        if (cancelled) return;
        setInvitedEmail(invitation.email);
        if (!invitation.email) {
          setStep("signed-out");
          return;
        }
        setEmail(invitation.email);
        const accountEmail = session.data.session?.user.email ?? null;
        if (!session.data.session) {
          setStep("signed-out");
        } else if (accountEmail?.toLowerCase() === invitation.email.toLowerCase()) {
          void tryAccept();
        } else {
          setSignedInEmail(accountEmail);
          setStep("wrong-account");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Impossible de vérifier cette invitation. Réessayez dans un instant.");
        setStep("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!canSubmitInvitationSignup(invitedEmail ?? null, email)) {
      setError(
        "Cette invitation n'est plus valable, ou l'adresse ne correspond pas à celle invitée.",
      );
      return;
    }
    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/invitation-atelier/${encodeURIComponent(token)}`,
        },
      });
      if (signUpError) {
        // Un domaine que Supabase rejette d'office (ex. example.com, non
        // routable) renvoie parfois un message vide ou non exploitable
        // ("{}") plutôt qu'une phrase — constaté en test. Un message
        // générique vaut mieux qu'un message illisible.
        const detail =
          signUpError.message && signUpError.message.trim() && signUpError.message !== "{}"
            ? signUpError.message
            : "Vérifiez l'adresse indiquée et réessayez.";
        setError(`Impossible de créer ce compte. ${detail}`);
        return;
      }
      if (data.user?.identities?.length === 0) {
        setMode("signin");
        setError(
          "Cette adresse possède déjà un compte Ma Reliure. Connectez-vous ou demandez un lien de connexion ci-dessous.",
        );
        return;
      }
      if (!data.session) {
        // Confirmation d'e-mail requise avant l'ouverture d'une session : le
        // compte existe, l'invitation reste `pending` jusqu'au retour ici.
        setAwaitingConfirmation(true);
        return;
      }
      await tryAccept();
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Adresse e-mail ou mot de passe incorrect.");
      return;
    }
    await tryAccept();
  }

  async function sendAccessLink() {
    if (!invitedEmail || sendingAccessLink) return;
    setError(null);
    setSendingAccessLink(true);
    try {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: invitedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/invitation-atelier/${encodeURIComponent(token)}`,
          shouldCreateUser: false,
        },
      });
      if (linkError) throw linkError;
      setAccessLinkSent(true);
    } catch {
      setError("Le lien de connexion n'a pas pu être envoyé. Réessayez dans un instant.");
    } finally {
      setSendingAccessLink(false);
    }
  }

  async function switchAccount() {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError("Impossible de changer de compte. Réessayez dans un instant.");
      return;
    }
    setSignedInEmail(null);
    setStep("signed-out");
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[32rem] flex-1 px-5 py-16 sm:px-8">
        <p className="mr-eyebrow">Atelier partenaire</p>
        <h1 className="mr-title mt-4 text-mr-ink">Activer mon accès</h1>

        {step === "checking" && <p className="mr-body mt-6">Vérification…</p>}
        {step === "accepting" && <p className="mr-body mt-6">Activation en cours…</p>}
        {step === "done" && (
          <p role="status" className="mr-body mt-6">
            Votre accès est activé. Direction votre espace atelier…
          </p>
        )}

        {step === "error" && (
          <p
            role="alert"
            className="mr-small mt-6 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux"
          >
            {error}
          </p>
        )}

        {step === "wrong-account" && (
          <div className="mt-6">
            <p role="alert" className="mr-body">
              Vous êtes connecté avec {signedInEmail ?? "un autre compte"}. Cette invitation est
              adressée à {invitedEmail}. Utilisez le compte invité pour l'activer.
            </p>
            {error && (
              <p role="alert" className="mr-small mt-3 text-mr-bordeaux">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void switchAccount()}
              className="mr-link mr-small mt-4"
            >
              Changer de compte
            </button>
          </div>
        )}

        {step === "signed-out" && invitedEmail === undefined && (
          <p className="mr-body mt-6">Vérification de l'invitation…</p>
        )}

        {step === "signed-out" && invitedEmail === null && (
          <p
            role="alert"
            className="mr-small mt-6 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux"
          >
            Cette invitation n'est plus valable. Demandez-en une nouvelle à Ma Reliure.
          </p>
        )}

        {step === "signed-out" && invitedEmail && (
          <>
            {awaitingConfirmation ? (
              <div className="mt-6">
                <p role="status" className="mr-body">
                  Si cette adresse est nouvelle, confirmez-la avec l'e-mail reçu : son lien vous
                  ramènera ici pour terminer l'activation.
                </p>
                <button
                  type="button"
                  className="mr-link mr-small mt-4"
                  onClick={() => {
                    setAwaitingConfirmation(false);
                    setMode("signin");
                  }}
                >
                  J'ai déjà un compte Ma Reliure
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <p className="mr-body">
                  {mode === "signup"
                    ? "Créez votre mot de passe pour activer cet accès."
                    : "Connectez-vous avec le compte lié à cette invitation."}
                </p>
                <div>
                  <label
                    htmlFor="invite-email"
                    className="mr-small block font-semibold text-mr-ink"
                  >
                    Adresse e-mail
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    readOnly
                    autoComplete="email"
                    value={email}
                    className="mt-2 w-full cursor-not-allowed rounded-[2px] border border-mr-rule-strong bg-mr-paper px-3.5 py-3 text-[1rem] text-mr-ink"
                  />
                  <p className="mr-small mt-1 text-mr-muted">
                    L'adresse à laquelle cette invitation a été envoyée — elle ne peut pas être
                    changée ici.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="invite-password"
                    className="mr-small block font-semibold text-mr-ink"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="invite-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink"
                  />
                </div>
                {error && (
                  <p role="alert" className="mr-small text-mr-bordeaux">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold text-mr-paper transition-colors duration-200 hover:bg-mr-graphite sm:w-auto"
                >
                  {mode === "signup" ? "Créer mon accès" : "Se connecter"}
                </button>
                <p>
                  <button
                    type="button"
                    className="mr-link mr-small"
                    onClick={() => {
                      setError(null);
                      setMode(mode === "signup" ? "signin" : "signup");
                    }}
                  >
                    {mode === "signup"
                      ? "J'ai déjà un compte Ma Reliure"
                      : "Je n'ai pas encore de compte"}
                  </button>
                </p>
                {mode === "signin" && (
                  <p>
                    {accessLinkSent ? (
                      <span role="status" className="mr-small">
                        Lien envoyé à {invitedEmail}. Ouvrez-le pour activer l'accès atelier.
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="mr-link mr-small"
                        disabled={sendingAccessLink}
                        onClick={() => void sendAccessLink()}
                      >
                        {sendingAccessLink
                          ? "Envoi…"
                          : "Recevoir un lien de connexion si je n'ai pas de mot de passe"}
                      </button>
                    )}
                  </p>
                )}
              </form>
            )}
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
