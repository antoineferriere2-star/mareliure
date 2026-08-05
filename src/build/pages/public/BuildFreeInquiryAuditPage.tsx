// /free-inquiry-audit — paste a URL, see the analysis, then decide.
//
// This page used to be a contact form: name, email, consent, and a promise
// that someone would review the site later. The product can already analyse
// any public page in a few seconds, so asking for an email first put the
// only worthwhile moment behind a form. Here the analysis runs for anyone,
// with no account and no email, and the account CTA comes after the value.
//
// The analysis is not a verdict: every fact carries its provenance, proved
// (quoted from the page) or assumed (inferred), exactly as /portal/setup
// shows it. The visitor corrects it during setup — the AI proposes.
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuildPublicShell, SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

interface AnalysisFact {
  claim: string;
  status: "proved" | "assumed";
  sourceQuote?: string;
}

interface SiteAnalysisResult {
  finalUrl: string;
  businessType: string;
  products: string[];
  facts: AnalysisFact[];
}

type Status = "idle" | "analyzing" | "done" | "error";

const GENERIC_ERROR = "We could not analyze that address. Check it and try again.";

/** New id per attempt: a retry is a new analysis, a double-click is not. */
function newRequestId(): string {
  return `pub-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function BuildFreeInquiryAuditPage() {
  return (
    <BuildPublicShell>
      <FreeInquiryAuditContent />
    </BuildPublicShell>
  );
}

function FreeInquiryAuditContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<SiteAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(newRequestId());

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (trimmed.length === 0 || status === "analyzing") return;

    setStatus("analyzing");
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/public/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, requestId: requestId.current }),
      });
      const body = (await res.json()) as { data?: SiteAnalysisResult; error?: string };
      if (!res.ok || !body.data) {
        // The endpoint's messages are already visitor-facing (unreachable
        // site, hourly limit); only an unexpected shape falls back.
        setError(copy(body.error ?? GENERIC_ERROR));
        setStatus("error");
        requestId.current = newRequestId();
        return;
      }
      setAnalysis(body.data);
      setStatus("done");
      requestId.current = newRequestId();
    } catch {
      setError(copy(GENERIC_ERROR));
      setStatus("error");
      requestId.current = newRequestId();
    }
  }

  function startOver() {
    setStatus("idle");
    setAnalysis(null);
    setError(null);
  }

  return (
    <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          as="h1"
          eyebrow={copy("Free website analysis")}
          title={copy("See what Métré Build finds on your website.")}
          description={copy(
            "Enter your website URL. We'll analyze what your business offers and suggest a project intake. No account, no email address.",
          )}
        />

        {status !== "done" && (
          <form
            onSubmit={analyze}
            className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <Label htmlFor="site-url" className="text-sm font-medium text-slate-900">
              {copy("Your website address")}
            </Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="site-url"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="yourcompany.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={status === "analyzing"}
                className="flex-1"
              />
              <Button type="submit" disabled={status === "analyzing" || url.trim().length === 0}>
                {status === "analyzing" ? copy("Analyzing…") : copy("Analyze my site")}
              </Button>
            </div>

            {status === "analyzing" && (
              <p role="status" className="mt-4 text-sm text-slate-600">
                {copy("Analyzing your website… this takes a few seconds.")}
              </p>
            )}

            {status === "error" && error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              >
                <p>{error}</p>
                <button
                  type="submit"
                  className="mt-2 font-medium text-rose-900 underline underline-offset-2"
                >
                  {copy("Try again")}
                </button>
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              {copy(
                "We read the public page at that address. Nothing is published and nothing is sent to anyone.",
              )}
            </p>
          </form>
        )}

        {status === "done" && analysis && (
          <AnalysisResult analysis={analysis} copy={copy} onStartOver={startOver} />
        )}
      </div>
    </main>
  );
}

function AnalysisResult({
  analysis,
  copy,
  onStartOver,
}: {
  analysis: SiteAnalysisResult;
  copy: (text: string) => string;
  onStartOver: () => void;
}) {
  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
          {copy("Analyzed page")}
        </p>
        <p className="mt-1 break-all text-sm text-slate-700">{analysis.finalUrl}</p>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {copy("Business type")}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-slate-950">{analysis.businessType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {copy("Services detected")}
            </dt>
            <dd className="mt-2">
              {analysis.products.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {copy("No specific service was named on this page.")}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {analysis.products.map((product) => (
                    <li
                      key={product}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800"
                    >
                      {product}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">{copy("What we found")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {copy(
            "Proved means the page says it. Assumed means we inferred it — you correct those during setup.",
          )}
        </p>
        <ul className="mt-4 space-y-2">
          {analysis.facts.length === 0 && (
            <li className="text-sm text-slate-600">{copy("Nothing conclusive on this page.")}</li>
          )}
          {analysis.facts.map((fact, index) => (
            <li
              key={`${fact.claim}-${index}`}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    fact.status === "proved"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  {fact.status === "proved" ? copy("Proved") : copy("Assumed")}
                </span>
                <span className="text-sm text-slate-900">{fact.claim}</span>
              </div>
              {fact.sourceQuote && (
                <p className="mt-1 border-l-2 border-slate-300 pl-2 text-xs italic text-slate-600">
                  “{fact.sourceQuote}”
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-base font-semibold text-emerald-950">
          {copy("Create your account to publish this on your website")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-emerald-900">
          {copy(
            "We turn this into a guided project intake your customers fill in, and you get a structured brief instead of a name and a phone number. You confirm everything before anything goes live.",
          )}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/auth" search={{ redirect: "/portal/setup" }}>
              {copy("Create my account")}
            </Link>
          </Button>
          <Button variant="outline" type="button" onClick={onStartOver}>
            {copy("Analyze another address")}
          </Button>
        </div>
      </section>
    </div>
  );
}
