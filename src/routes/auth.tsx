import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireBuildAdmin } from "@/build/services/admin.functions";
import { requireWorkspaceAccess } from "@/build/services/workspace.functions";
import { ensureMyWorkspace } from "@/build/services/provisionWorkspace.functions";
import { resolvePostAuthDestination } from "@/build/services/postAuthRoute";

export const Route = createFileRoute("/auth")({
  ssr: false,
  // `?redirect=` lets /free-inquiry-audit send a visitor straight into setup
  // after they create an account. The value is never trusted as a
  // destination — resolvePostAuthDestination matches it against an
  // allow-list, so an attacker-crafted link cannot redirect anyone off-site.
  // The return type keeps `redirect` optional, so every other link to /auth
  // stays valid without passing a search object.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [
      { title: "Sign in or create your account — Métré Build" },
      {
        name: "description",
        content:
          "Create your Métré Build account and get your own workspace to turn website visitors into structured project briefs.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-xs font-medium text-foreground";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60";

type Audience = "client" | "team";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("client");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);

  const checkAdmin = useServerFn(requireBuildAdmin);
  const checkWorkspace = useServerFn(requireWorkspaceAccess);
  const provision = useServerFn(ensureMyWorkspace);

  // Privileges are always decided server-side: admin check, then workspace
  // membership, then safe idempotent provisioning. Nothing from the browser.
  const goToHomeRoute = useCallback(
    async (company?: string) => {
      setRouting(true);
      setAccessError(null);
      const destination = await resolvePostAuthDestination(
        {
          checkAdmin: () => checkAdmin(),
          checkWorkspace: () => checkWorkspace(),
          provision: () => provision({ data: { company } }),
        },
        redirect,
      );
      setRouting(false);
      if (destination.to === null) {
        setAccessError(destination.error);
        return;
      }
      navigate({ to: destination.to, replace: true });
    },
    [checkAdmin, checkWorkspace, provision, navigate, redirect],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToHomeRoute();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Back to site
        </Link>

        <div className="mt-10">
          {accessError && (
            <p
              className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {accessError}
            </p>
          )}
          {routing && (
            <p className="mb-4 text-sm text-muted-foreground" role="status">
              Setting up your workspace…
            </p>
          )}

          {audience === "client" ? (
            <ClientAuth
              onSignedIn={goToHomeRoute}
              onRouterInvalidate={() => router.invalidate()}
              onError={setAccessError}
            />
          ) : (
            <TeamSignIn
              onSignedIn={() => goToHomeRoute()}
              onRouterInvalidate={() => router.invalidate()}
            />
          )}
        </div>

        <div className="mt-8 border-t border-border pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setAudience(audience === "client" ? "team" : "client");
              setAccessError(null);
            }}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {audience === "client" ? "Métré team access" : "Back to customer sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientAuth({
  onSignedIn,
  onRouterInvalidate,
  onError,
}: {
  onSignedIn: (company?: string) => Promise<void>;
  onRouterInvalidate: () => Promise<unknown>;
  onError: (msg: string | null) => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    onError(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { company: company.trim() || undefined },
        },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        await onRouterInvalidate();
        await onSignedIn(company.trim() || undefined);
      } else {
        setConfirmSent(true);
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      return;
    }
    await onRouterInvalidate();
    await onSignedIn();
  }

  if (confirmSent) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-foreground">Confirm your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click it to activate your
          account, then come back here to sign in — your workspace is created automatically.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmSent(false);
            setMode("signin");
          }}
          className="mt-6 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          I already confirmed — sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false}>
      <h1 className="text-xl font-semibold text-foreground">
        {mode === "signup" ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "signup"
          ? "For project-based businesses. You get your own workspace right away — no setup call needed."
          : "Welcome back. Sign in to your workspace."}
      </p>

      <div className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label className={labelClass} htmlFor="client-company">
              Company name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="client-company"
              type="text"
              autoComplete="organization"
              placeholder="Sunrise Decks"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used to name your workspace. You can rename it later.
            </p>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="client-email">
            Work email
          </label>
          <input
            id="client-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="client-password">
            Password
          </label>
          <input
            id="client-password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-describedby={mode === "signup" ? "client-password-hint" : undefined}
          />
          {mode === "signup" && (
            <p id="client-password-hint" className="mt-1 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className={`mt-6 ${primaryButtonClass}`}>
        {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={() => {
          setError(null);
          onError(null);
          setMode(mode === "signup" ? "signin" : "signup");
        }}
        className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
}

function TeamSignIn({
  onSignedIn,
  onRouterInvalidate,
}: {
  onSignedIn: () => Promise<void>;
  onRouterInvalidate: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("We couldn't sign you in. Check your credentials and try again.");
      return;
    }
    await onRouterInvalidate();
    await onSignedIn();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-xl font-semibold text-foreground">Métré team access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Internal sign in for the Métré Build team.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelClass} htmlFor="team-email">
            Email
          </label>
          <input
            id="team-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="team-password">
            Password
          </label>
          <input
            id="team-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className={`mt-6 ${primaryButtonClass}`}>
        {loading ? "Please wait…" : "Sign in"}
      </button>
    </form>
  );
}
