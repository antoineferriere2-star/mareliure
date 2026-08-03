// Client-facing self-service setup for a deck business (/portal/setup).
// Five steps: website -> review the analysis -> confirm the deck product ->
// light customization -> preview. Nothing here publishes anything and no
// payment is involved; the flow ends on an explicit "Draft ready" state.
//
// Every AI-backed action carries a client-generated requestId so a double
// click is treated server-side as the same run instead of a second billed
// call. No localStorage, no mock data.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { listMyWorkspaces } from "@/build/services/portal.data.functions";
import {
  analyzeMySite,
  confirmMyDeckProduct,
  generateMyDeckDraft,
  getMyDraftPreview,
  getMySetup,
  publishMyDraft,
  updateMyBranding,
  type PortalOnboardingState,
} from "@/build/services/portalOnboarding.data.functions";
import {
  checkBusinessType,
  checkDeckProduct,
  checkSiteUrl,
  defaultBranding,
  resolveDeckEligibility,
  resumeStep,
  type Branding,
  type SetupStep,
} from "@/build/onboarding/portalOnboarding";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import { IntegrationSnippetsPanel } from "@/build/pages/integration/IntegrationSnippetsPanel";

export const Route = createFileRoute("/_authenticated/portal/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your project intake — Métré Build" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: SetupPage,
});

const STEP_LABELS: Record<SetupStep, string> = {
  website: "Website",
  review: "What we found",
  product: "Your product",
  customize: "Customize",
  preview: "Preview",
  publish: "Publish",
};
const STEP_ORDER: SetupStep[] = ["website", "review", "product", "customize", "preview", "publish"];

function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Server functions throw a Response; surface its body, never a generic message. */
/**
 * Recognises the plan's active-Mission limit refusal raised by
 * publish_workspace_onboarding, so the banner can offer the two actions that
 * resolve it. Matching on the message keeps this presentational — no
 * entitlement or quota logic is duplicated here.
 */
function isActiveMissionLimitError(message: string): boolean {
  return /active (Mission|Project Intake) limit/i.test(message);
}

async function readError(err: unknown): Promise<string> {
  if (err instanceof Response) {
    try {
      const text = await err.text();
      if (text.trim().length > 0) return text;
    } catch {
      /* fall through */
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

function SetupPage() {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces, isPending } = useQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );

  if (isPending) return <PortalPending />;
  const workspace = workspaces?.[0];
  if (!workspace) {
    return (
      <p className="text-sm text-muted-foreground">
        No workspace is attached to your account yet. Reload this page, or contact the Métré Build
        team.
      </p>
    );
  }
  return <SetupFlow workspaceId={workspace.id} />;
}

function SetupFlow({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const fetchSetup = useServerFn(getMySetup);
  const setupKey = ["portal", "setup", workspaceId] as const;

  const {
    data: setup,
    isPending,
    error,
  } = useQuery({
    queryKey: setupKey,
    queryFn: () => fetchSetup({ data: { workspaceId } }),
  });

  const [step, setStep] = useState<SetupStep | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Resume where the client left off, once, when the state first loads.
  useEffect(() => {
    if (!setup || step !== null) return;
    setStep(
      resumeStep({
        status: setup.status,
        hasAnalysis: setup.analysis !== null,
        hasConfirmedProduct: setup.confirmedProduct !== null,
        hasDraft: setup.draftPlaybookId !== null,
      }),
    );
  }, [setup, step]);

  function applyState(next: PortalOnboardingState, goTo: SetupStep) {
    queryClient.setQueryData(setupKey, next);
    setStep(goTo);
  }

  if (isPending || step === null) return <PortalPending />;
  if (error || !setup) return <PortalError error={error as Error} />;

  const readOnly = !setup.isOwner;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
          Set up your project intake
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          We analyze your website, propose a deck project intake, and you confirm it. Nothing goes
          live until you decide to publish it.
        </p>
      </header>

      {readOnly ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          You can follow this setup, but only the workspace owner can run it.
        </p>
      ) : null}

      <StepBar current={step} setup={setup} onNavigate={setStep} />

      {banner ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <p>{banner}</p>
          {/* The plan's active-Mission limit is the one error a visitor can
              actually resolve themselves — but only if told where to go. The
              limit itself is unchanged and still enforced server-side. */}
          {isActiveMissionLimitError(banner) && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/portal/missions" className="font-medium underline underline-offset-4">
                Manage Missions
              </Link>
              <Link to="/portal/billing" className="font-medium underline underline-offset-4">
                View plans
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {step === "website" ? (
        <WebsiteStep
          workspaceId={workspaceId}
          setup={setup}
          readOnly={readOnly}
          onError={setBanner}
          onDone={(next) => applyState(next, "review")}
        />
      ) : null}

      {step === "review" ? (
        <ReviewStep
          setup={setup}
          onBack={() => setStep("website")}
          onContinue={() => setStep("product")}
        />
      ) : null}

      {step === "product" ? (
        <ProductStep
          workspaceId={workspaceId}
          setup={setup}
          readOnly={readOnly}
          onError={setBanner}
          onBack={() => setStep("review")}
          onDone={(next) => applyState(next, "customize")}
        />
      ) : null}

      {step === "customize" ? (
        <CustomizeStep
          workspaceId={workspaceId}
          setup={setup}
          readOnly={readOnly}
          onError={setBanner}
          onBack={() => setStep("product")}
          onDone={(next) => applyState(next, "preview")}
        />
      ) : null}

      {step === "preview" ? (
        <PreviewStep
          workspaceId={workspaceId}
          setup={setup}
          onBack={() => setStep("customize")}
          onContinue={() => setStep("publish")}
        />
      ) : null}

      {step === "publish" ? (
        <PublishStep
          workspaceId={workspaceId}
          setup={setup}
          readOnly={readOnly}
          onError={setBanner}
          onBack={() => setStep("preview")}
          onDone={(next) => applyState(next, "publish")}
          onStartAnother={() => {
            setBanner(null);
            setStep("website");
          }}
        />
      ) : null}
    </div>
  );
}

function StepBar({
  current,
  setup,
  onNavigate,
}: {
  current: SetupStep;
  setup: PortalOnboardingState;
  onNavigate: (step: SetupStep) => void;
}) {
  const reachable: Record<SetupStep, boolean> = {
    website: true,
    review: setup.analysis !== null,
    product: setup.analysis !== null,
    customize: setup.confirmedProduct !== null,
    preview: setup.draftPlaybookId !== null,
    publish: setup.draftPlaybookId !== null,
  };
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEP_ORDER.map((s, i) => {
        const active = s === current;
        const enabled = reachable[s];
        return (
          <li key={s}>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => onNavigate(s)}
              className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : enabled
                    ? "border-input bg-background text-foreground hover:bg-accent"
                    : "border-border bg-muted text-muted-foreground"
              }`}
            >
              <span className="tabular-nums">{i + 1}.</span> {STEP_LABELS[s]}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6">{children}</section>
  );
}

// ------------------------------------------------------------------ Step 1

function WebsiteStep({
  workspaceId,
  setup,
  readOnly,
  onError,
  onDone,
}: {
  workspaceId: string;
  setup: PortalOnboardingState;
  readOnly: boolean;
  onError: (message: string | null) => void;
  onDone: (next: PortalOnboardingState) => void;
}) {
  const analyze = useServerFn(analyzeMySite);
  const [url, setUrl] = useState(setup.siteUrl ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Stable across retries of the SAME submit (double click), regenerated for
  // a deliberate new run.
  const requestId = useRef(newRequestId());

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    onError(null);
    const checked = checkSiteUrl(url);
    if (!checked.ok) {
      setLocalError(checked.error);
      return;
    }
    setLocalError(null);
    setRunning(true);
    setElapsed(0);
    try {
      const next = await analyze({
        data: { workspaceId, url: checked.url, requestId: requestId.current },
      });
      requestId.current = newRequestId();
      onDone(next);
    } catch (err) {
      onError(await readError(err));
      // A failed run may be retried safely: same id would be read as a
      // duplicate, so start a fresh one.
      requestId.current = newRequestId();
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <h2 className="text-base font-semibold text-foreground">Your website</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We read one public page of your site to understand what you build. We never sign in, and
          we never store your page content.
        </p>

        <label className="mt-5 block text-xs font-medium text-foreground" htmlFor="site-url">
          Website address
        </label>
        <input
          id="site-url"
          type="text"
          inputMode="url"
          placeholder="yourcompany.com"
          value={url}
          disabled={readOnly || running}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={localError ? true : undefined}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        {localError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={readOnly || running}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
        >
          {running ? `Analyzing your website… ${elapsed}s` : "Analyze my website"}
        </button>
        {running ? (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            This usually takes 10 to 30 seconds. Keep this page open.
          </p>
        ) : null}
      </form>
    </Card>
  );
}

// ------------------------------------------------------------------ Step 2

function ReviewStep({
  setup,
  onBack,
  onContinue,
}: {
  setup: PortalOnboardingState;
  onBack: () => void;
  onContinue: () => void;
}) {
  const analysis = setup.analysis;
  if (!analysis) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Analyze your website first.</p>
      </Card>
    );
  }
  const eligibility = resolveDeckEligibility(analysis);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-foreground">What we found</h2>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          Source: <span className="font-medium text-foreground">{analysis.finalUrl}</span> ·
          analyzed {new Date(analysis.analyzedAt).toLocaleString("en-US")}
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Business type
            </dt>
            <dd className="mt-1 text-sm text-foreground">{analysis.businessType}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Products we detected
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {analysis.products.length > 0 ? (
                <ul className="list-inside list-disc">
                  {analysis.products.map((product) => (
                    <li key={product}>{product}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">None found on this page.</span>
              )}
            </dd>
          </div>
        </dl>

        <h3 className="mt-6 text-sm font-semibold text-foreground">Proved vs assumed</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Proved means we found it word for word on your page. Assumed means we inferred it —
          correct us if it is wrong.
        </p>
        <ul className="mt-3 space-y-2">
          {analysis.facts.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nothing conclusive on this page.</li>
          ) : null}
          {analysis.facts.map((fact, i) => (
            <li
              key={`${fact.claim}-${i}`}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    fact.status === "proved"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  {fact.status === "proved" ? "Proved" : "Assumed"}
                </span>
                <span className="text-sm text-foreground">{fact.claim}</span>
              </div>
              {fact.sourceQuote ? (
                <p className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                  “{fact.sourceQuote}”
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {eligibility.eligible ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Looks right — continue
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Analyze a different address
          </button>
        </div>
      ) : (
        <Card>
          <h3 className="text-sm font-semibold text-foreground">We can&apos;t set this up yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">{eligibility.reason}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Try another page of my site
            </button>
            <Link
              to="/portal"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Back to my workspace
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Step 3

function ProductStep({
  workspaceId,
  setup,
  readOnly,
  onError,
  onBack,
  onDone,
}: {
  workspaceId: string;
  setup: PortalOnboardingState;
  readOnly: boolean;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: (next: PortalOnboardingState) => void;
}) {
  const confirmProduct = useServerFn(confirmMyDeckProduct);
  const generateDraft = useServerFn(generateMyDeckDraft);
  const analysis = setup.analysis;
  const eligibility = useMemo(
    () => (analysis ? resolveDeckEligibility(analysis) : null),
    [analysis],
  );
  const suggested = eligibility?.eligible ? eligibility.suggestedProducts : [];
  const [businessType, setBusinessType] = useState(
    setup.confirmedBusinessType ?? analysis?.businessType ?? "Deck builder",
  );
  const [product, setProduct] = useState(setup.confirmedProduct ?? suggested[0] ?? "Deck");
  const [localError, setLocalError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const requestId = useRef(newRequestId());

  if (!eligibility?.eligible) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          The current version of Métré Build supports deck businesses only.
        </p>
      </Card>
    );
  }

  async function handleConfirm() {
    if (running) return;
    onError(null);
    const checkedBusinessType = checkBusinessType(businessType);
    if (!checkedBusinessType.ok) {
      setLocalError(checkedBusinessType.error);
      return;
    }
    const checkedProduct = checkDeckProduct(product);
    if (!checkedProduct.ok) {
      setLocalError(checkedProduct.error);
      return;
    }
    setLocalError(null);
    setRunning(true);
    try {
      await confirmProduct({
        data: {
          workspaceId,
          businessType: checkedBusinessType.value,
          product: checkedProduct.value,
        },
      });
      const next = await generateDraft({ data: { workspaceId, requestId: requestId.current } });
      requestId.current = newRequestId();
      onDone(next);
    } catch (err) {
      onError(await readError(err));
      requestId.current = newRequestId();
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">Confirm your product</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Version 1 of Métré Build is built for deck builders, so the intake we generate is a deck
        intake. Pick the wording your customers use.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="mb-1 block text-xs font-medium text-foreground"
            htmlFor="confirmed-business-type"
          >
            Business type
          </label>
          <input
            id="confirmed-business-type"
            value={businessType}
            disabled={readOnly || running}
            onChange={(e) => setBusinessType(e.target.value)}
            aria-invalid={localError ? true : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-foreground"
            htmlFor="confirmed-product"
          >
            Product wording
          </label>
          <input
            id="confirmed-product"
            value={product}
            disabled={readOnly || running}
            onChange={(e) => setProduct(e.target.value)}
            aria-invalid={localError ? true : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </div>
      </div>
      {localError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {suggested.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="deck-product"
              value={option}
              checked={product === option}
              disabled={readOnly || running}
              onChange={() => setProduct(option)}
            />
            {option}
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={readOnly || running}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {running ? "Building your draft intake…" : "Confirm and build my draft"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={running}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
        >
          Back
        </button>
      </div>
      {running ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          Writing the questions for your {product.toLowerCase()} intake. This takes up to a minute.
        </p>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------ Step 4

function CustomizeStep({
  workspaceId,
  setup,
  readOnly,
  onError,
  onBack,
  onDone,
}: {
  workspaceId: string;
  setup: PortalOnboardingState;
  readOnly: boolean;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: (next: PortalOnboardingState) => void;
}) {
  const save = useServerFn(updateMyBranding);
  const base: Branding =
    setup.branding ?? defaultBranding(setup.workspaceName, setup.confirmedProduct ?? "Deck");
  const [form, setForm] = useState<Branding>(base);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Branding>(key: K, value: Branding[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (saving) return;
    onError(null);
    setSaving(true);
    try {
      const next = await save({
        data: {
          workspaceId,
          displayName: form.displayName,
          accentColor: form.accentColor,
          introTitle: form.introTitle,
          introText: form.introText,
          ctaLabel: form.ctaLabel,
        },
      });
      onDone(next);
    } catch (err) {
      onError(await readError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">Make it yours</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Light touches only — the questions themselves stay under our care so your intake keeps
        producing usable project briefs.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="b-name">
            Business name
          </label>
          <input
            id="b-name"
            value={form.displayName}
            disabled={readOnly}
            onChange={(e) => set("displayName", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="b-accent">
            Accent color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="b-accent"
              type="color"
              value={form.accentColor}
              disabled={readOnly}
              onChange={(e) => set("accentColor", e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
            />
            <span className="text-xs text-muted-foreground">{form.accentColor}</span>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="b-title">
            Title
          </label>
          <input
            id="b-title"
            value={form.introTitle}
            disabled={readOnly}
            onChange={(e) => set("introTitle", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="b-intro">
            Introduction
          </label>
          <textarea
            id="b-intro"
            rows={3}
            value={form.introText}
            disabled={readOnly}
            onChange={(e) => set("introText", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="b-cta">
            Button label
          </label>
          <input
            id="b-cta"
            value={form.ctaLabel}
            disabled={readOnly}
            onChange={(e) => set("ctaLabel", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleSave}
          disabled={readOnly || saving}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save and preview"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Back
        </button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Step 5

function PreviewStep({
  workspaceId,
  setup,
  onBack,
  onContinue,
}: {
  workspaceId: string;
  setup: PortalOnboardingState;
  onBack: () => void;
  onContinue: () => void;
}) {
  const fetchPreview = useServerFn(getMyDraftPreview);
  const { data, isPending, error } = useQuery({
    queryKey: ["portal", "setup-preview", workspaceId, setup.draftVersion] as const,
    queryFn: () => fetchPreview({ data: { workspaceId } }),
    enabled: setup.draftPlaybookId !== null,
  });

  const branding =
    setup.branding ?? defaultBranding(setup.workspaceName, setup.confirmedProduct ?? "Deck");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">
          Draft ready — version {setup.draftVersion}
        </p>
        <p className="mt-1 text-sm text-emerald-900/80">
          This intake is a private draft in your workspace. It is not live and no visitor can reach
          it yet. When you're happy with the questions, you can publish it yourself on the next
          screen — no one else needs to approve it.
        </p>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Preview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Read-only preview of what a visitor would see.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div
            className="px-4 py-4 text-white sm:px-6"
            style={{ backgroundColor: branding.accentColor }}
          >
            <p className="text-xs uppercase tracking-wide opacity-80">{branding.displayName}</p>
            <p className="mt-1 text-lg font-semibold">{branding.introTitle}</p>
            {branding.introText ? (
              <p className="mt-1 max-w-xl text-sm opacity-90">{branding.introText}</p>
            ) : null}
            <span className="mt-3 inline-flex rounded-md bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900">
              {branding.ctaLabel}
            </span>
          </div>

          <div className="divide-y divide-border bg-background">
            {isPending ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Loading the draft…</p>
            ) : null}
            {error ? (
              <p className="px-4 py-4 text-sm text-destructive" role="alert">
                We could not load this draft. Go back and generate it again.
              </p>
            ) : null}
            {data?.schema.sections.flatMap((section) =>
              section.steps.map((step, index) => (
                <div key={step.id} className="px-4 py-4 sm:px-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{step.title}</p>
                  {step.why ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.why}</p>
                  ) : null}
                  <ul className="mt-2 space-y-1">
                    {step.fields.map((field) => (
                      <li key={field.key} className="text-sm text-foreground">
                        <span className="text-muted-foreground">•</span> {field.label}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({field.type.replace(/_/g, " ")}
                          {field.desirability === "required" ? ", required" : ""})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )),
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continue to publish
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Adjust the wording
        </button>
        <Link
          to="/portal"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Back to my workspace
        </Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Step 6

function PublishStep({
  workspaceId,
  setup,
  readOnly,
  onError,
  onBack,
  onDone,
  onStartAnother,
}: {
  workspaceId: string;
  setup: PortalOnboardingState;
  readOnly: boolean;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: (next: PortalOnboardingState) => void;
  /** Sends the wizard back to step one so the next Intake can be configured. */
  onStartAnother: () => void;
}) {
  const publish = useServerFn(publishMyDraft);
  const [publishing, setPublishing] = useState(false);
  const requestId = useRef(newRequestId());
  const branding =
    setup.branding ?? defaultBranding(setup.workspaceName, setup.confirmedProduct ?? "Deck");

  async function handlePublish() {
    if (publishing) return;
    onError(null);
    setPublishing(true);
    try {
      const next = await publish({ data: { workspaceId, requestId: requestId.current } });
      requestId.current = newRequestId();
      onDone(next);
    } catch (err) {
      onError(await readError(err));
      requestId.current = newRequestId();
    } finally {
      setPublishing(false);
    }
  }

  if (setup.draftPublished && setup.publicUrl) {
    return (
      <Card>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">Published</p>
          <p className="mt-1 text-sm text-emerald-900/80">
            Your project intake is live. Anyone who follows the link below can submit a project —
            you'll see it in your Missions as soon as they do.
          </p>
        </div>
        <div className="mt-4">
          <IntegrationSnippetsPanel
            publicUrl={setup.publicUrl}
            ctaLabel={branding.ctaLabel || "Start your project"}
            missionName={branding.displayName}
          />
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/portal/missions"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Manage my Missions
          </Link>
          {!readOnly && (
            <button
              type="button"
              onClick={onStartAnother}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Set up another Project Intake
            </button>
          )}
        </div>
        {setup.publishedIntakeCount > 1 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {setup.publishedIntakeCount} Project Intakes published for this workspace. How many can
            be live at once depends on your plan.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-foreground">Ready to publish</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This makes your project intake live on the web. Anyone with the link can submit a project.
        You can pause it again at any time from your Missions — pausing never deletes the project
        briefs you've already received.
      </p>

      <dl className="mt-4 grid gap-3 rounded-md border border-border bg-muted/20 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Business name</dt>
          <dd className="text-foreground">{branding.displayName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Product</dt>
          <dd className="text-foreground">{setup.confirmedProduct ?? "Deck"}</dd>
        </div>
      </dl>

      {readOnly ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Only the workspace owner can publish this intake.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {publishing ? "Publishing…" : "Publish my project intake"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to preview
          </button>
        </div>
      )}
    </Card>
  );
}
