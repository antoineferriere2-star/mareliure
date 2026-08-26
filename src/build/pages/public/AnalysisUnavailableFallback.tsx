// What /free-inquiry-audit offers when the analysis cannot run.
//
// The analyser is the site's main call to action: it is in the navigation, it
// closes every marketing page, and it is the answer the pricing FAQ gives to
// "is there a free trial". When it is down, the most interested visitor —
// the one who typed their address and pressed the button — met a red error box
// and a "Try again" that failed again. The outage cost the lead as well as the
// analysis.
//
// So an outage that is ours to own asks for an address instead. It goes through
// /api/public/build-public-intake with type "audit", the same request the site
// already accepts — a different table from the analysis ledger, which is what
// makes it a usable fallback rather than a second thing to break.
//
// Deliberately NOT offered when the visitor's own URL is unreachable, or when
// they have used their hourly allowance: those are not outages, and asking for
// an email to fix someone's typo is a dark pattern.
import { useState } from "react";
import { checkSiteUrl } from "@/build/onboarding/portalOnboarding";

type Phase = "form" | "sending" | "sent";

export function AnalysisUnavailableFallback({
  websiteUrl,
  copy,
  onRetry,
}: {
  /** What the visitor already typed. Never asked for a second time. */
  websiteUrl: string;
  copy: (text: string) => string;
  onRetry: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (phase === "sent") {
    return (
      <div
        role="status"
        className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
      >
        <p className="font-medium">{copy("Thank you — we have your request.")}</p>
        <p className="mt-1">
          {copy("We will run the analysis by hand and email it to you within one business day.")}
        </p>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (phase === "sending") return;

    // The endpoint requires an absolute URL; the visitor may well have typed
    // "acme.com". Normalised with the same helper the analyser uses, so both
    // paths accept exactly the same addresses.
    const checked = checkSiteUrl(websiteUrl);
    if (!checked.ok) {
      setError(copy(checked.error));
      return;
    }

    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/public/build-public-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "audit",
          sourcePath: "/free-inquiry-audit",
          website: honeypot,
          payload: {
            firstName,
            email,
            websiteUrl: checked.url,
            consent,
            biggestIssue: "Requested after the automated analysis was unavailable.",
          },
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(copy(body.error ?? "We could not send that. Please try again."));
        setPhase("form");
        return;
      }
      setPhase("sent");
    } catch {
      setError(copy("We could not send that. Please try again."));
      setPhase("form");
    }
  }

  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {/* Not framed as the visitor's problem, because it is not. */}
      <p className="font-medium">{copy("The automated analysis is down right now.")}</p>
      <p className="mt-1">
        {copy(
          "Leave your name and email and we will run it by hand, then send you the result within one business day.",
        )}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        {copy("Website to analyze:")} <span className="font-mono">{websiteUrl}</span>
      </p>

      <form onSubmit={submit} className="mt-3 space-y-3">
        {/* Honeypot: same field name the other public forms use. */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{copy("First name")}</span>
            <input
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{copy("Email")}</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5"
          />
          <span>{copy("I agree to be contacted about this analysis.")}</span>
        </label>

        {error && (
          <p role="alert" className="text-xs font-medium text-rose-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={phase === "sending"}
            className="rounded-md bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950 disabled:opacity-50"
          >
            {phase === "sending" ? copy("Sending…") : copy("Send me the analysis")}
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium underline underline-offset-2"
          >
            {copy("Try the automated analysis again")}
          </button>
        </div>
      </form>
    </div>
  );
}
