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
      { name: "description", content: "Espace admin Métré Build AI." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const checkAdmin = useServerFn(requireBuildAdmin);
  const checkWorkspace = useServerFn(requireWorkspaceAccess);

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
    setError("Ce compte n'a accès ni à l'admin ni à un Espace Client. Contacte l'équipe Métré Build AI.");
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToHomeRoute();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        await router.invalidate();
        await goToHomeRoute();
      } else {
        setInfo("Compte créé. Si un email de confirmation est requis, vérifie ta boîte mail, sinon tu peux te connecter directement.");
        setMode("signin");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    await router.invalidate();
    await goToHomeRoute();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Retour au site
        </Link>

        <h1 className="mt-8 text-xl font-semibold text-foreground">
          {mode === "signin" ? "Connexion admin" : "Créer un compte admin"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accès réservé à l'équipe Métré Build AI.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
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
        {info ? (
          <p className="mt-4 text-sm text-muted-foreground">{info}</p>
        ) : null}

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
    </div>
  );
}
