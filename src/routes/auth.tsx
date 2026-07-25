import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { requireWorkspaceAccess } from "@/build/services/workspace.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Métré Build AI" },
      { name: "description", content: "Connexion Métré Build AI." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [audience, setAudience] = useState<"team" | "client">("team");
  const checkAdmin = useServerFn(requireBuildAdmin);
  const checkWorkspace = useServerFn(requireWorkspaceAccess);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Admin and workspace-member are mutually exclusive roles in this app —
  // check admin first since the internal team is the more privileged case.
  async function goToHomeRoute() {
    try {
      await checkAdmin();
      navigate({ to: "/build", replace: true });
      return;
    } catch {
      // not admin — fall through to workspace check
    }
    try {
      await checkWorkspace();
      navigate({ to: "/portal", replace: true });
      return;
    } catch {
      // not a workspace member either
    }
    setAccessError(
      "Ce compte n'a accès ni à l'admin ni à un Espace Client. Contacte l'équipe Métré Build AI.",
    );
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToHomeRoute();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Retour au site
        </Link>

        <div className="mt-8 flex rounded-md border border-input bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setAudience("team");
              setAccessError(null);
            }}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              audience === "team"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Équipe Métré Build AI
          </button>
          <button
            type="button"
            onClick={() => {
              setAudience("client");
              setAccessError(null);
            }}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              audience === "client"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Espace Client
          </button>
        </div>

        {accessError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {accessError}
          </p>
        )}

        {audience === "team" ? (
          <TeamSignIn onSignedIn={goToHomeRoute} onRouterInvalidate={() => router.invalidate()} />
        ) : (
          <ClientSignIn onSignedIn={goToHomeRoute} onRouterInvalidate={() => router.invalidate()} />
        )}
      </div>
    </div>
  );
}

function TeamSignIn({
  onSignedIn,
  onRouterInvalidate,
}: {
  onSignedIn: () => Promise<void>;
  onRouterInvalidate: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        await onRouterInvalidate();
        await onSignedIn();
      } else {
        setInfo(
          "Compte créé. Si un email de confirmation est requis, vérifie ta boîte mail, sinon tu peux te connecter directement.",
        );
        setMode("signin");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    await onRouterInvalidate();
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="mt-4 text-xl font-semibold text-foreground">
        {mode === "signin" ? "Connexion" : "Créer un compte"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Accès réservé à l'équipe Métré Build AI.</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="team-email">
            Email
          </label>
          <input
            id="team-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="team-password">
            Mot de passe
          </label>
          <input
            id="team-password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {info ? <p className="mt-4 text-sm text-muted-foreground">{info}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
      </button>

      <button
        type="button"
        onClick={() => {
          setError(null);
          setInfo(null);
          setMode(mode === "signin" ? "signup" : "signin");
        }}
        className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signin"
          ? "Pas encore de compte ? Créer un compte"
          : "Déjà un compte ? Se connecter"}
      </button>
    </form>
  );
}

function ClientSignIn({
  onSignedIn,
  onRouterInvalidate,
}: {
  onSignedIn: () => Promise<void>;
  onRouterInvalidate: () => Promise<unknown>;
}) {
  const [step, setStep] = useState<"request" | "sent">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    setLoading(false);
    if (otpError) {
      setError(
        "Aucun Espace Client n'est associé à cet email, ou l'envoi a échoué. Contacte l'équipe Métré Build AI si tu penses que c'est une erreur.",
      );
      return;
    }
    setStep("sent");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (verifyError) {
      setError("Code invalide ou expiré.");
      return;
    }
    await onRouterInvalidate();
    await onSignedIn();
  }

  if (step === "sent") {
    return (
      <div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Vérifie ta boîte mail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Un lien de connexion a été envoyé à{" "}
          <span className="font-medium text-foreground">{email}</span>. Clique dessus pour accéder à
          ton Espace Client, ou saisis le code reçu ci-dessous.
        </p>

        <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="client-code">
              Code reçu par email (optionnel)
            </label>
            <input
              id="client-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || code.length === 0}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "…" : "Se connecter avec le code"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setStep("request");
            setError(null);
          }}
          className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Renvoyer à une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleRequestLink}>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Espace Client</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reçois un lien de connexion par email — aucun mot de passe nécessaire.
      </p>

      <div className="mt-6">
        <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="client-email">
          Email
        </label>
        <input
          id="client-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "…" : "Recevoir un lien de connexion"}
      </button>
    </form>
  );
}
