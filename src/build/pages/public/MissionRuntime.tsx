import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_COMPONENTS, type InspirationPhotoAnalysis } from "@/build/engine/fields";
import { computeVisibleSteps, validateField, type VisibleStep } from "@/build/engine/validation";
import type { Answers, AnswerValue } from "@/build/schema/answers";
import type { ProjectBrief } from "@/build/schema/brief";
import type { PlaybookSchema } from "@/build/schema/playbook";
import { BriefPreview } from "./BriefPreview";
import { BuildPublicShell, SectionHeader } from "./BuildPublicShell";

type PublicMission = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  playbook_id: string | null;
  playbook_name: string | null;
  proposal: { intro?: string } | null;
};

type SessionAuth = { sessionId: string; secret: string };
type DossierResult = { id: string; status: string; summary: string | null; content: ProjectBrief; next_questions: string[] };

function storageKey(publicToken: string) {
  return `metre_build_session_${publicToken}`;
}

function loadStoredAuth(publicToken: string): SessionAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(publicToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionAuth>;
    if (typeof parsed.sessionId === "string" && typeof parsed.secret === "string") {
      return { sessionId: parsed.sessionId, secret: parsed.secret };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return null;
}

function storeAuth(publicToken: string, auth: SessionAuth) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(publicToken), JSON.stringify(auth));
  } catch {
    /* ignore (private browsing, quota...) */
  }
}

function clearStoredAuth(publicToken: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(publicToken));
  } catch {
    /* ignore */
  }
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

/**
 * Generic Mission runtime: given a public_token, drives the hardened public
 * API (start/resume/save/submit) and renders whatever PlaybookSchema comes
 * back via the generic field component registry. No business logic lives
 * here — every question, option, validation rule and brief mapping comes
 * from the Playbook itself.
 */
export function MissionRuntime({ publicToken }: { publicToken: string }) {
  const [mission, setMission] = useState<PublicMission | null>(null);
  const [schema, setSchema] = useState<PlaybookSchema | null>(null);
  const [sessionAuth, setSessionAuth] = useState<SessionAuth | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<DossierResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

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
        }>({ action: "resume_session", session_id: stored.sessionId, session_secret: stored.secret });
        if (cancelled) return;
        setMission(data.mission);
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
    };
  }, [publicToken]);

  const visibleSteps = useMemo<VisibleStep[]>(
    () => (schema ? computeVisibleSteps(schema, answers) : []),
    [schema, answers],
  );
  const clampedStepIndex = Math.min(stepIndex, Math.max(visibleSteps.length - 1, 0));
  const currentStep = visibleSteps[clampedStepIndex];
  const progress = visibleSteps.length > 0 ? Math.round(((clampedStepIndex + 1) / visibleSteps.length) * 100) : 0;
  const isLastStep = clampedStepIndex >= visibleSteps.length - 1;

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

  async function goNext() {
    if (!currentStep) return;
    const errors: Record<string, string> = {};
    for (const field of currentStep.visibleFields) {
      const message = validateField(field, answers[field.key]);
      if (message) errors[field.key] = message;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return;
    }
    setSaving(true);
    await persist(answers);
    setSaving(false);
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
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

  async function submit() {
    if (!sessionAuth) return;
    setSaving(true);
    setError(null);
    try {
      const data = await callRuntime<{ dossier: DossierResult }>({
        action: "submit_session",
        session_id: sessionAuth.sessionId,
        session_secret: sessionAuth.secret,
        answers,
      });
      setDossier(data.dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BuildPublicShell>
      <main className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        {loading && <p className="mx-auto max-w-3xl text-slate-600">Loading mission…</p>}

        {!loading && error && !mission && (
          <div className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        )}

        {mission && dossier && (
          <div className="mx-auto max-w-5xl space-y-6">
            <SectionHeader eyebrow="Mission complete" title="Project brief generated" description={mission.name} />
            <BriefPreview brief={dossier.content} />
          </div>
        )}

        {mission && schema && !dossier && (
          <section className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{mission.playbook_name ?? mission.name}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal">{currentStep?.step.title ?? mission.name}</h1>
              {mission.proposal?.intro && !currentStep?.step.why && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{mission.proposal.intro}</p>
              )}
              {currentStep?.step.why && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{currentStep.step.why}</p>}
              {visibleSteps.length > 0 && (
                <>
                  <div className="mt-5 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Step {clampedStepIndex + 1} of {visibleSteps.length} · {progress}% complete
                  </p>
                </>
              )}
            </div>
            <div className="p-6">
              {error && <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
              {currentStep ? (
                <div className="grid gap-6">
                  {currentStep.visibleFields.map((field) => {
                    const FieldComponent = FIELD_COMPONENTS[field.type];
                    return (
                      <FieldComponent
                        key={field.key}
                        field={field}
                        value={answers[field.key]}
                        onChange={(value) => setAnswer(field.key, value)}
                        error={fieldErrors[field.key]}
                        analyzeInspirationPhoto={(image) => analyzeInspirationPhoto(field.key, image)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-600">This mission has no questions yet.</p>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button variant="outline" disabled={clampedStepIndex === 0} onClick={goBack}>
                  Back
                </Button>
                {!isLastStep ? (
                  <Button onClick={goNext} disabled={saving}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={submit} disabled={saving}>
                    {saving ? "Working…" : "Generate project brief"}
                    <FileText className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <p className="text-xs text-slate-500">Your answers are saved as you go — you can close this tab and come back.</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </BuildPublicShell>
  );
}
