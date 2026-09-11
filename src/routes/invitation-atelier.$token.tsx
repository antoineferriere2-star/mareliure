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
import { acceptBinderInvitation } from "@/marketplace/services/marketplace.data.functions";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";

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

type Step = "checking" | "signed-out" | "accepting" | "done" | "error";

function InvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptBinderInvitation);
  const [step, setStep] = useState<Step>("checking");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void tryAccept();
      else setStep("signed-out");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError("Impossible de créer ce compte. " + signUpError.message);
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
          <p role="alert" className="mr-small mt-6 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux">
            {error}
          </p>
        )}

        {step === "signed-out" && (
          <>
            {awaitingConfirmation ? (
              <p role="status" className="mr-body mt-6">
                Compte créé. Confirmez votre adresse e-mail, puis revenez sur ce même lien pour
                terminer l'activation.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <p className="mr-body">
                  {mode === "signup"
                    ? "Créez votre mot de passe pour activer cet accès."
                    : "Connectez-vous avec le compte lié à cette invitation."}
                </p>
                <div>
                  <label htmlFor="invite-email" className="mr-small block font-semibold text-mr-ink">
                    Adresse e-mail
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink"
                  />
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
                    onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  >
                    {mode === "signup"
                      ? "J'ai déjà un compte Ma Reliure"
                      : "Je n'ai pas encore de compte"}
                  </button>
                </p>
              </form>
            )}
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
