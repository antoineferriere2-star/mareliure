/* eslint-disable react-refresh/only-export-components -- localizeField is exported for unit testing */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_COMPONENTS, type InspirationPhotoAnalysis } from "@/build/engine/fields";
import { computeVisibleSteps, validateField, type VisibleStep } from "@/build/engine/validation";
import {
  evaluatePlaybookConsistency,
  evaluateStepConsistency,
  gateOnConsistency,
  type TriggeredConsistency,
} from "@/build/engine/consistency";
import { formatAnswerForDisplay } from "@/build/engine/brief";
import type { Answers, AnswerValue } from "@/build/schema/answers";
import type { ProjectBrief } from "@/build/schema/brief";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import type { PlaybookSchema } from "@/build/schema/playbook";
import type { PlaybookField } from "@/build/schema/playbook";
import {
  clearStoredAuth,
  loadStoredAuth,
  storeAuth,
  type SessionAuth,
} from "./publicSessionStorage";
import { VisitorProjectSummaryView } from "./VisitorProjectSummaryView";
import { BuildPublicShell } from "./BuildPublicShell";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";
import { MissionRuntimeSkeleton } from "./MissionRuntimeStates";

/** How long the initial load can run before we tell the visitor it's taking
 * longer than usual — long enough to not fire on a normal cold start, short
 * enough that nobody stares at a silent skeleton for a full minute. */
const SLOW_LOAD_MS = 8000;

type PublicMission = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  playbook_id: string | null;
  playbook_name: string | null;
  proposal: { intro?: string } | null;
  /** The business publishing this intake — what the visitor should see. */
  workspace_name: string | null;
};

type DossierResult = {
  id: string;
  status: string;
  summary: string | null;
  content: ProjectBrief;
  next_questions: string[];
  visitor_summary: VisitorProjectSummary;
  emailSent?: boolean;
  summaryUrl?: string | null;
};

type CopyFn = (text: string) => string;

export function localizeField(field: PlaybookField, copy: CopyFn): PlaybookField {
  const localized = { ...field } as PlaybookField & Record<string, unknown>;
  localized.label = copy(field.label);
  if (typeof localized.helpText === "string") localized.helpText = copy(localized.helpText);
  if (Array.isArray(localized.options)) {
    localized.options = localized.options.map((option) => {
      if (typeof option === "string") return copy(option);
      if (option && typeof option === "object" && "label" in option) {
        return { ...option, label: copy(String(option.label)) };
      }
      return option;
    });
  }
  // Address fields carry their sub-labels (ZIP code, City / State) in
  // `components`, not `options` — missed by the block above.
  if (Array.isArray(localized.components)) {
    localized.components = localized.components.map((component) =>
      component && typeof component === "object" && "label" in component
        ? { ...component, label: copy(String(component.label)) }
        : component,
    );
  }
  // Budget fields in "ranges" mode carry their choices in `ranges`, a
  // separate array from `options` used by every other choice-style field.
  if (Array.isArray(localized.ranges)) {
    localized.ranges = localized.ranges.map((range) =>
      range && typeof range === "object" && "label" in range
        ? { ...range, label: copy(String(range.label)) }
        : range,
    );
  }
  // Consent fields show their own copy of the agreement text separately
  // from `label`.
  if (typeof localized.consentText === "string") {
    localized.consentText = copy(localized.consentText);
  }
  return localized as PlaybookField;
}

/**
 * `validateField` (engine/validation.ts) is deliberately i18n-free — it
 * returns an English sentence with the field's (or, for address fields, a
 * component's) English label quoted inside, e.g. `"ZIP code" is not valid.`.
 * The dictionary can't translate that whole sentence directly since the
 * quoted label and any counts vary per field. Instead: mask the label and
 * any numbers out into placeholders, translate the resulting fixed template
 * via `copy()`, then splice the (separately localized) label and numbers
 * back in.
 */
export function localizeValidationMessage(
  message: string,
  field: PlaybookField,
  copy: CopyFn,
): string {
  const labelCandidates =
    field.type === "address" ? field.components.map((c) => c.label) : [field.label];

  let template = message;
  let localizedLabel: string | null = null;
  for (const label of labelCandidates) {
    const quoted = `"${label}"`;
    if (template.includes(quoted)) {
      template = template.replace(quoted, '"{field}"');
      localizedLabel = copy(label);
      break;
    }
  }

  const numbers: string[] = [];
  template = template.replace(/\d+/g, (match) => {
    numbers.push(match);
    return `{n${numbers.length - 1}}`;
  });

  let translated = copy(template);
  if (localizedLabel) translated = translated.replace("{field}", localizedLabel);
  numbers.forEach((n, i) => {
    translated = translated.replace(`{n${i}}`, n);
  });
  return translated;
}

async function callRuntime<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/public/build-runtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Runtime error");
  }
  return payload as T;
}

/** A triggered consistency rule, reduced to what the visitor is shown. */
type ConsistencyNotice = { id: string; message: string };

function toNotices(rules: { id: string; message: string }[]): ConsistencyNotice[] {
  return rules.map((rule) => ({ id: rule.id, message: rule.message }));
}

/**
 * Generic Mission runtime: given a public_token, drives the hardened public
 * API (start/resume/save/submit) and renders whatever PlaybookSchema comes
 * back via the generic field component registry. No business logic lives
 * here — every question, option, validation rule and brief mapping comes
 * from the Playbook itself.
 */
export function MissionRuntime({ publicToken }: { publicToken: string }) {
  // The header needs the business's name, which only arrives with the mission
  // fetched by the content below — so it is lifted here rather than fetched
  // twice.
  const [businessName, setBusinessName] = useState<string | null>(null);
  return (
    // No FAQ launcher here — this is the actual Guided Project Intake a
    // visitor is completing; a persistent "Questions?" button would
    // dilute the product demo itself.
    //
    // `embedded` chrome: this page is normally an iframe inside the
    // business's own website. Métré Build's marketing nav has no business
    // being there.
    <BuildPublicShell showFaqLauncher={false} chrome="embedded" businessName={businessName}>
      <MissionRuntimeContent publicToken={publicToken} onBusinessName={setBusinessName} />
    </BuildPublicShell>
  );
}

function MissionRuntimeContent({
  publicToken,
  onBusinessName,
}: {
  publicToken: string;
  onBusinessName: (name: string | null) => void;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const [mission, setMission] = useState<PublicMission | null>(null);
  const [schema, setSchema] = useState<PlaybookSchema | null>(null);
  const [sessionAuth, setSessionAuth] = useState<SessionAuth | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  // The last screen before submitting. Not a step in the Playbook — the
  // homepage has promised visitors "a clear recap before submission" all
  // along, and there was none.
  const [reviewing, setReviewing] = useState(false);
  // Triggered consistency rules. Errors block; a warning is shown once and may
  // then be moved past — acknowledgement is sticky for the session so a
  // visitor who has read one is never asked to dismiss it again.
  const [consistencyErrors, setConsistencyErrors] = useState<ConsistencyNotice[]>([]);
  const [consistencyWarnings, setConsistencyWarnings] = useState<ConsistencyNotice[]>([]);
  const [acknowledgedRuleIds, setAcknowledgedRuleIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<DossierResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSlowLoad(false);
    setError(null);
    const slowLoadTimer = window.setTimeout(() => {
      if (!cancelled) setSlowLoad(true);
    }, SLOW_LOAD_MS);

    async function startFresh() {
      const data = await callRuntime<{
        mission: PublicMission;
        playbook_schema: PlaybookSchema;
        session: { id: string; answers: Answers; status: string };
        session_secret: string;
      }>({ action: "start_session", public_token: publicToken });
      if (cancelled) return;
      const auth = { sessionId: data.session.id, secret: data.session_secret };
      storeAuth(publicToken, auth);
      setMission(data.mission);
      onBusinessName(data.mission.workspace_name);
      setSchema(data.playbook_schema);
      setSessionAuth(auth);
      setAnswers(data.session.answers ?? {});
    }

    (async () => {
      const stored = loadStoredAuth(publicToken);
      try {
        if (!stored) {
          await startFresh();
          return;
        }
        const data = await callRuntime<{
          mission: PublicMission;
          playbook_schema: PlaybookSchema;
          session: { id: string; answers: Answers; status: string };
          dossier?: DossierResult;
        }>({
          action: "resume_session",
          session_id: stored.sessionId,
          session_secret: stored.secret,
        });
        if (cancelled) return;
        setMission(data.mission);
        onBusinessName(data.mission.workspace_name);
        setSchema(data.playbook_schema);
        setSessionAuth(stored);
        setAnswers(data.session.answers ?? {});
        if (data.dossier) setDossier(data.dossier);
      } catch {
        // Stored session is gone/invalid — fall back to a fresh one.
        clearStoredAuth(publicToken);
        try {
          await startFresh();
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load mission");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowLoadTimer);
    };
    // onBusinessName is a setState setter, so its identity is stable and
    // listing it never re-runs the load.
  }, [publicToken, reloadKey, onBusinessName]);

  function retryLoad() {
    // Bump the effect's dependency rather than clearing storage first — a
    // stored session might still be valid and this was just a transient
    // network failure; the effect's own catch already falls back to a
    // fresh session if the stored one turns out to be genuinely invalid.
    setReloadKey((key) => key + 1);
  }

  const visibleSteps = useMemo<VisibleStep[]>(
    () => (schema ? computeVisibleSteps(schema, answers) : []),
    [schema, answers],
  );
  const clampedStepIndex = Math.min(stepIndex, Math.max(visibleSteps.length - 1, 0));
  const currentStep = visibleSteps[clampedStepIndex];
  const progress =
    visibleSteps.length > 0 ? Math.round(((clampedStepIndex + 1) / visibleSteps.length) * 100) : 0;
  const isLastStep = clampedStepIndex >= visibleSteps.length - 1;

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // A consistency notice describes a combination of answers, so any edit may
    // have resolved it. Clear and let the next Continue re-evaluate.
    setConsistencyErrors([]);
    setConsistencyWarnings([]);
  }

  async function persist(next: Answers) {
    if (!sessionAuth) return;
    try {
      await callRuntime({
        action: "save_session",
        session_id: sessionAuth.sessionId,
        session_secret: sessionAuth.secret,
        answers: next,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save answers");
    }
  }

  /** Shows what the Vérificateur found and reports whether the visitor may move on — the policy itself lives in the engine. */
  function clearsConsistency(rules: TriggeredConsistency) {
    const gate = gateOnConsistency(rules, acknowledgedRuleIds);
    setConsistencyErrors(toNotices(gate.errors));
    setConsistencyWarnings(toNotices(gate.newWarnings));
    if (gate.newWarnings.length > 0) {
      setAcknowledgedRuleIds((prev) => [...prev, ...gate.newWarnings.map((rule) => rule.id)]);
    }
    return gate.proceed;
  }

  async function goNext() {
    if (!currentStep) return;
    const errors: Record<string, string> = {};
    for (const field of currentStep.visibleFields) {
      const message = validateField(field, answers[field.key]);
      if (message) errors[field.key] = localizeValidationMessage(message, field, copy);
    }
    const blockingKeys = Object.keys(errors);
    if (blockingKeys.length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      // Per-field messages are the primary signal, but they only help if the
      // field renders them. A Playbook can put the blocking field somewhere a
      // visitor does not connect with the button — and a component that drops
      // the `error` prop would make Continue look simply dead. Naming the
      // fields at the top guarantees the visitor always learns *why* nothing
      // happened, whatever the field is.
      const labels = currentStep.visibleFields
        .filter((field) => blockingKeys.includes(field.key))
        .map((field) => copy(field.label));
      setError(`${copy("Please check the following before continuing:")} ${labels.join(", ")}.`);
      return;
    }

    // Every field on this step is individually valid — now ask the Playbook
    // whether they hold together, and whether they contradict an earlier step.
    // Only steps the visitor has actually seen count as answered.
    if (schema) {
      const reached = visibleSteps.slice(0, clampedStepIndex + 1).map((s) => s.step.id);
      const stepRules = evaluateStepConsistency(schema, answers, currentStep.step.id, reached);
      if (!clearsConsistency(stepRules)) {
        setError(null);
        return;
      }
    }

    setError(null);
    setSaving(true);
    await persist(answers);
    setSaving(false);
    if (isLastStep) {
      // Playbook-scoped rules span the whole journey, so the recap is the
      // first moment they can be judged — and the right place to show them:
      // the visitor is already looking at everything they are about to send.
      if (schema) clearsConsistency(evaluatePlaybookConsistency(schema, answers));
      setReviewing(true);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  }

  function goBack() {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /** Jump straight back to the step that holds a given answer, from the review. */
  function editStep(index: number) {
    setReviewing(false);
    setError(null);
    setStepIndex(index);
  }

  async function analyzeInspirationPhoto(
    fieldKey: string,
    image: { base64: string; mediaType: string },
  ): Promise<InspirationPhotoAnalysis> {
    if (!sessionAuth) throw new Error("Session not ready.");
    return callRuntime<InspirationPhotoAnalysis>({
      action: "analyze_inspiration_photo",
      session_id: sessionAuth.sessionId,
      session_secret: sessionAuth.secret,
      field_key: fieldKey,
      image_base64: image.base64,
      media_type: image.mediaType,
    });
  }

  async function uploadProjectPhoto(
    fieldKey: string,
    file: { base64: string; mediaType: string; filename: string },
  ) {
    if (!sessionAuth) throw new Error("Session not ready.");
    return callRuntime<{
      storagePath: string;
      filename: string;
      sizeBytes: number;
      mimeType: string;
    }>({
      action: "upload_project_photo",
      session_id: sessionAuth.sessionId,
      session_secret: sessionAuth.secret,
      field_key: fieldKey,
      image_base64: file.base64,
      media_type: file.mediaType,
      filename: file.filename,
    });
  }

  async function submit() {
    if (!sessionAuth) return;
    // Last gate before the server sees it. The recap already showed these when
    // it opened; this catches an answer edited from the recap since.
    if (schema && !clearsConsistency(evaluatePlaybookConsistency(schema, answers))) {
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await callRuntime<{ dossier: DossierResult }>({
        action: "submit_session",
        session_id: sessionAuth.sessionId,
        session_secret: sessionAuth.secret,
        answers,
        locale,
      });
      setDossier(data.dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      {loading && (
        <div className="mx-auto max-w-5xl">
          <MissionRuntimeSkeleton label={copy("Preparing your project intake…")} />
          {slowLoad && (
            <p className="mt-4 text-center text-sm text-slate-500">
              {copy("This is taking longer than usual.")}
            </p>
          )}
        </div>
      )}

      {!loading && error && !mission && (
        <div className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{copy(error)}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            {copy("Try again")}
          </button>
        </div>
      )}

      {mission && dossier && (
        <VisitorProjectSummaryView
          summary={dossier.visitor_summary}
          emailSent={dossier.emailSent}
          summaryUrl={dossier.summaryUrl}
        />
      )}

      {mission && schema && !dossier && (
        <section className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {copy(mission.playbook_name ?? mission.name)}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              {reviewing
                ? copy("Check your answers before sending")
                : copy(currentStep?.step.title ?? mission.name)}
            </h1>
            {mission.proposal?.intro && !currentStep?.step.why && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {copy(mission.proposal.intro)}
              </p>
            )}
            {currentStep?.step.why && (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {copy(currentStep.step.why)}
              </p>
            )}
            {visibleSteps.length > 0 && (
              <>
                {/* Segments, not one bar: a visitor who wants to fix an
                    earlier answer had to press Back once per step, eight
                    times on an eleven-step Playbook. Only steps already
                    reached are clickable — jumping ahead would skip the
                    validation that gates each one. */}
                <ol className="mt-5 flex gap-1" aria-label={copy("Steps")}>
                  {visibleSteps.map((step, index) => {
                    const reached = index <= clampedStepIndex || reviewing;
                    const current = !reviewing && index === clampedStepIndex;
                    return (
                      <li key={step.step.id} className="h-2 flex-1">
                        <button
                          type="button"
                          disabled={!reached}
                          aria-current={current ? "step" : undefined}
                          aria-label={`${copy(step.step.title)}${current ? ` — ${copy("current step")}` : ""}`}
                          onClick={() => editStep(index)}
                          className={`h-2 w-full rounded-full transition-colors ${
                            reached
                              ? "cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                              : "cursor-default bg-slate-100"
                          }`}
                        />
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {reviewing ? (
                    copy("Last look before sending")
                  ) : (
                    <>
                      {locale === "es-US" ? "Paso" : "Step"} {clampedStepIndex + 1}{" "}
                      {locale === "es-US" ? "de" : "of"} {visibleSteps.length} · {progress}%{" "}
                      {copy("complete")}
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <div className="p-6">
            {error && (
              <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {copy(error)}
              </div>
            )}
            {consistencyErrors.length > 0 && (
              <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-medium">{copy("This combination does not work:")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {consistencyErrors.map((notice) => (
                    <li key={notice.id}>{copy(notice.message)}</li>
                  ))}
                </ul>
              </div>
            )}
            {consistencyWarnings.length > 0 && (
              <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">{copy("Worth checking before you continue:")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {consistencyWarnings.map((notice) => (
                    <li key={notice.id}>{copy(notice.message)}</li>
                  ))}
                </ul>
                {/* A warning informs, it never decides — say plainly how to
                    keep the answer as it stands. */}
                <p className="mt-3 text-xs text-amber-800">
                  {copy(
                    reviewing
                      ? "Select Generate project brief again to send your answers as they are."
                      : "Select Continue again to keep your answers as they are.",
                  )}
                </p>
              </div>
            )}
            {reviewing ? (
              <ReviewAnswers steps={visibleSteps} answers={answers} copy={copy} onEdit={editStep} />
            ) : currentStep ? (
              <div className="grid gap-6">
                {currentStep.visibleFields.map((field) => {
                  const FieldComponent = FIELD_COMPONENTS[field.type];
                  return (
                    <FieldComponent
                      key={field.key}
                      field={localizeField(field, copy)}
                      value={answers[field.key]}
                      onChange={(value) => setAnswer(field.key, value)}
                      error={fieldErrors[field.key]}
                      analyzeInspirationPhoto={(image) => analyzeInspirationPhoto(field.key, image)}
                      uploadProjectPhoto={(file) => uploadProjectPhoto(field.key, file)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">{copy("This mission has no questions yet.")}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={clampedStepIndex === 0 && !reviewing}
                onClick={goBack}
              >
                {copy("Back")}
              </Button>
              {reviewing ? (
                <Button onClick={submit} disabled={saving}>
                  {saving ? copy("Working…") : copy("Generate project brief")}
                  <FileText className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={goNext} disabled={saving}>
                  {isLastStep ? copy("Review my answers") : copy("Continue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              <p className="text-xs text-slate-500">
                {copy("Your answers are saved as you go — you can close this tab and come back.")}
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * The recap the marketing site has been promising: every answer the visitor
 * is about to send, grouped by the step it came from, each group with a way
 * straight back to it.
 *
 * Editing jumps to the step rather than opening the field inline, so there is
 * only ever one place a question is answered — the visitor sees the same
 * screen, the same help text and the same validation they saw the first time.
 *
 * Unanswered optional fields are listed as such instead of being hidden: on an
 * eleven-step intake, "you left this blank" is exactly what a recap is for.
 */
function ReviewAnswers({
  steps,
  answers,
  copy,
  onEdit,
}: {
  steps: VisibleStep[];
  answers: Answers;
  copy: CopyFn;
  onEdit: (index: number) => void;
}) {
  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-slate-600">
        {copy("Nothing has been sent yet. Change anything that is not right.")}
      </p>
      {steps.map((step, index) => (
        <section key={step.step.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{copy(step.step.title)}</h2>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
            >
              {copy("Edit")}
            </button>
          </div>
          <dl className="mt-3 grid gap-2">
            {step.visibleFields.map((field) => {
              const text = formatAnswerForDisplay(field, answers[field.key] as AnswerValue);
              return (
                <div key={field.key} className="grid gap-0.5 sm:grid-cols-[220px_1fr] sm:gap-3">
                  <dt className="text-xs text-slate-500">{copy(field.label)}</dt>
                  <dd className={text ? "text-sm text-slate-900" : "text-sm italic text-slate-400"}>
                    {text || copy("Not answered")}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
