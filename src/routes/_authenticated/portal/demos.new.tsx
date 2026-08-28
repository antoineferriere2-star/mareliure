// One screen, one demo — the internal Sales agent's creation surface.
//
// /portal/setup walks a customer through six screens with a step bar, back
// buttons and a resume point. That shape is right for someone configuring their
// own business once. It is wrong for an agent building the twentieth
// demonstration of the week: every navigation is a place for a remote browser
// session to drop, and the prospect's name could only be recorded afterwards,
// from a different page.
//
// So this is the same flow with the ceremony removed. Four sections stacked on
// one page, each revealing the next as it completes; nothing to navigate, and
// the whole state visible at once. It calls exactly the same server functions
// as the wizard — analyse, confirm, generate, brand, publish — so there is one
// engine and one set of guards, not two.
//
// Internal Sales workspaces only. A customer never sees this route: the nav
// does not link it, and every server function it calls is owner-gated on a
// workspace the caller must already belong to.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { listMyWorkspaces } from "@/build/services/portal.data.functions";
import {
  analyzeMySite,
  confirmMyDeckProduct,
  generateMyDeckDraft,
  getMySetup,
  publishMyDraft,
  updateMyBranding,
  type PortalOnboardingState,
} from "@/build/services/portalOnboarding.data.functions";
import { checkSiteUrl, defaultBranding, DEFAULT_ACCENT } from "@/build/onboarding/portalOnboarding";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import { DemoLink } from "@/build/pages/portal/DemoLink";

export const Route = createFileRoute("/_authenticated/portal/demos/new")({
  ssr: false,
  head: () => ({
    meta: [{ title: "New demo — Métré Sales" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: NewDemoPage,
});

function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** A numbered section. Dimmed until its turn, so the page reads as a sequence without being one. */
function Section({
  index,
  title,
  hint,
  active,
  done,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-current={active ? "step" : undefined}
      className={`rounded-lg border bg-card p-5 ${
        active ? "border-primary/40" : "border-border"
      } ${!active && !done ? "opacity-55" : ""}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
            done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? "✓" : index}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="mt-1 pl-7 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 pl-7">{children}</div>
    </section>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

function NewDemoPage() {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useSuspenseQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );
  const salesWorkspace = workspaces.find((w) => w.isInternalSales && w.role === "owner");

  if (!salesWorkspace) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This account is not an owner of an internal Sales workspace.
        </p>
      </div>
    );
  }
  return <NewDemoFlow workspaceId={salesWorkspace.id} />;
}

function NewDemoFlow({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();

  const analyze = useServerFn(analyzeMySite);
  const confirmProduct = useServerFn(confirmMyDeckProduct);
  const generateDraft = useServerFn(generateMyDeckDraft);
  const saveBranding = useServerFn(updateMyBranding);
  const publish = useServerFn(publishMyDraft);
  const readSetup = useServerFn(getMySetup);

  const [setup, setSetup] = useState<PortalOnboardingState | null>(null);
  const [busy, setBusy] = useState<null | "analyze" | "generate" | "brand" | "publish">(null);
  const [error, setError] = useState<string | null>(null);

  // Section 1
  const [prospectName, setProspectName] = useState("");
  const [url, setUrl] = useState("");
  const analyzeRequestId = useRef(newRequestId());

  // Section 2 — seeded from the analysis once it lands
  const [businessType, setBusinessType] = useState("");
  const [product, setProduct] = useState("");
  const generateRequestId = useRef(newRequestId());

  // Section 3
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [introTitle, setIntroTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");

  const analysis = setup?.analysis ?? null;
  const hasDraft = Boolean(setup?.draftPlaybookId);
  const published = Boolean(setup?.draftPublished && setup?.publicUrl);

  /**
   * If a setup is already in flight, this page would otherwise start by
   * failing: only one may exist per workspace at a time. Loading it instead
   * turns a dead end into a resume — which is the whole point when a remote
   * browser session drops mid-demo.
   */
  const resumeRef = useRef(false);
  if (!resumeRef.current) {
    resumeRef.current = true;
    void readSetup({ data: { workspaceId } })
      .then((state) => {
        if (!state.analysis && !state.draftPlaybookId) return;
        if (state.draftPublished) return; // finished demo: start a fresh one
        applyState(state);
      })
      .catch(() => {
        // No setup to resume is the normal case, not an error worth showing.
      });
  }

  function applyState(state: PortalOnboardingState) {
    setSetup(state);
    if (state.prospectCompanyName) setProspectName(state.prospectCompanyName);
    if (state.siteUrl) setUrl(state.siteUrl);
    if (state.analysis) {
      setBusinessType(
        (current) => current || state.confirmedBusinessType || state.analysis!.businessType,
      );
      setProduct(
        (current) => current || state.confirmedProduct || state.analysis!.products[0] || "",
      );
    }
    const branding =
      state.branding ??
      (state.confirmedProduct
        ? defaultBranding(state.prospectCompanyName ?? state.workspaceName, state.confirmedProduct)
        : null);
    if (branding) {
      setDisplayName((current) => current || branding.displayName);
      setAccent((current) => (current === DEFAULT_ACCENT ? branding.accentColor : current));
      setIntroTitle((current) => current || branding.introTitle);
      setIntroText((current) => current || branding.introText);
      setCtaLabel((current) => current || branding.ctaLabel);
    }
  }

  async function run<T>(kind: NonNullable<typeof busy>, fn: () => Promise<T>) {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Nothing was lost — try again."));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function onAnalyze() {
    const checked = checkSiteUrl(url);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    analyzeRequestId.current = newRequestId();
    const state = await run("analyze", () =>
      analyze({
        data: {
          workspaceId,
          url,
          requestId: analyzeRequestId.current,
          prospectCompanyName: prospectName.trim() || undefined,
        },
      }),
    );
    if (state) {
      applyState(state);
      if (!displayName && prospectName.trim()) setDisplayName(prospectName.trim());
    }
  }

  async function onGenerate() {
    generateRequestId.current = newRequestId();
    const state = await run("generate", async () => {
      await confirmProduct({ data: { workspaceId, businessType, product } });
      return generateDraft({ data: { workspaceId, requestId: generateRequestId.current } });
    });
    if (state) applyState(state);
  }

  async function onSaveBranding() {
    const state = await run("brand", () =>
      saveBranding({
        data: { workspaceId, displayName, accentColor: accent, introTitle, introText, ctaLabel },
      }),
    );
    if (state) setSetup(state);
  }

  async function onPublish() {
    // publishMyDraft validates a requestId for idempotency: a fresh id per
    // click, so a lost response retried by the user is not a second publish.
    publishRequestId.current = newRequestId();
    const state = await run("publish", () =>
      publish({ data: { workspaceId, requestId: publishRequestId.current } }),
    );
    if (state) setSetup(state);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">New prospect demo</h1>
          <p className="text-sm text-muted-foreground">
            Everything on one screen. Each step saves as it completes — if you lose the page, come
            back and it resumes here.
          </p>
        </div>
        <Link
          to="/portal/demos"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          All demos
        </Link>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Section
        index={1}
        title="Prospect and website"
        hint="The name is stored with the demo — no need to fill it in afterwards."
        active={!analysis}
        done={Boolean(analysis)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Prospect company
            </span>
            <input
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="Denver Decks"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Website</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.denverdecks.com"
              inputMode="url"
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={busy !== null || url.trim().length === 0}
          className={`${buttonClass} mt-3`}
        >
          {busy === "analyze" ? "Analyzing…" : analysis ? "Analyze again" : "Analyze website"}
        </button>
      </Section>

      <Section
        index={2}
        title="What we detected — correct it before generating"
        hint="The analysis proposes. You decide. A wrong trade here produces a demo that misses."
        active={Boolean(analysis) && !hasDraft}
        done={hasDraft}
      >
        {!analysis ? (
          <p className="text-sm text-muted-foreground">Run the analysis first.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Business type
                </span>
                <input
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Product
                </span>
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  list="detected-products"
                  className={inputClass}
                />
                <datalist id="detected-products">
                  {analysis.products.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
            </div>
            {analysis.products.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Also detected: {analysis.products.join(" · ")}
              </p>
            )}
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy !== null || product.trim().length === 0}
              className={`${buttonClass} mt-3`}
            >
              {busy === "generate" ? "Generating…" : hasDraft ? "Generate again" : "Generate draft"}
            </button>
          </>
        )}
      </Section>

      <Section
        index={3}
        title="Branding"
        active={hasDraft && !published}
        done={Boolean(setup?.branding)}
      >
        {!hasDraft ? (
          <p className="text-sm text-muted-foreground">Generate the draft first.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Accent color
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value.toUpperCase())}
                    aria-label="Accent color"
                    className="h-9 w-12 rounded-md border border-input bg-background"
                  />
                  <input
                    value={accent}
                    onChange={(e) => setAccent(e.target.value.toUpperCase())}
                    aria-label="Accent color hex"
                    className={inputClass}
                  />
                </div>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Intro title
                </span>
                <input
                  value={introTitle}
                  onChange={(e) => setIntroTitle(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Intro text
                </span>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Button label
                </span>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={onSaveBranding}
              disabled={busy !== null}
              className={`${buttonClass} mt-3`}
            >
              {busy === "brand" ? "Saving…" : "Save branding"}
            </button>
          </>
        )}
      </Section>

      <Section index={4} title="Preview and publish" active={hasDraft} done={published}>
        {!hasDraft ? (
          <p className="text-sm text-muted-foreground">Generate the draft first.</p>
        ) : published && setup?.publicUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Published. This is the link to send to the prospect.
            </p>
            <DemoLink path={setup.publicUrl} />
            <div className="flex flex-wrap gap-2">
              <Link to="/portal/demos" className={buttonClass}>
                Back to all demos
              </Link>
              <button
                type="button"
                onClick={() => navigate({ to: "/portal/demos/new", reloadDocument: true })}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Start the next demo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Walk the demo yourself before sending it. You are the first person to see what the
              prospect will see.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/portal/setup"
                className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Open preview
              </Link>
              <button
                type="button"
                onClick={onPublish}
                disabled={busy !== null}
                className={buttonClass}
              >
                {busy === "publish" ? "Publishing…" : "Publish demo"}
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
