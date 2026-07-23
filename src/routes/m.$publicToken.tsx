import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BuildPublicShell, SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/m/$publicToken")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Métré Build AI — Mission runtime" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RuntimePage,
});

type PublicMission = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  playbook_id: string | null;
  playbook_name: string | null;
  proposal: {
    qualificationQuestions?: string[];
    intro?: string;
  } | null;
};

type Session = { id: string; answers: Record<string, string>; status: string };
type Dossier = {
  id: string;
  status: string;
  summary: string | null;
  next_questions: string[];
};

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

function RuntimePage() {
  const { publicToken } = Route.useParams();
  const [mission, setMission] = useState<PublicMission | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await callRuntime<{ mission: PublicMission; session: Session }>({
          action: "start_session",
          public_token: publicToken,
        });
        if (cancelled) return;
        setMission(data.mission);
        setSession(data.session);
        setAnswers({});
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load mission");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicToken]);

  const questions = mission?.proposal?.qualificationQuestions ?? [];

  async function save(next: Record<string, string>) {
    if (!session) return;
    setSaving(true);
    try {
      await callRuntime({ action: "save_session", session_id: session.id, answers: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save answers");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const data = await callRuntime<{ dossier: Dossier }>({
        action: "submit_session",
        session_id: session.id,
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
      <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {loading && <p className="text-slate-600">Loading mission…</p>}

          {!loading && error && !mission && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {mission && !dossier && (
            <>
              <SectionHeader
                eyebrow="Mission runtime"
                title={mission.name}
                description={mission.objective ?? "Answer the questions below to generate a project brief."}
              />

              {mission.proposal?.intro && (
                <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  {mission.proposal.intro}
                </p>
              )}

              <form
                className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {questions.length === 0 && (
                  <p className="text-sm text-slate-600">
                    This mission has no qualification questions yet.
                  </p>
                )}
                {questions.map((q, i) => {
                  const key = `q${i}`;
                  return (
                    <div key={key}>
                      <Label htmlFor={key}>{q}</Label>
                      <Textarea
                        id={key}
                        className="mt-1"
                        value={answers[key] ?? ""}
                        onChange={(e) => {
                          const next = { ...answers, [key]: e.target.value };
                          setAnswers(next);
                        }}
                        onBlur={() => void save(answers)}
                      />
                    </div>
                  );
                })}
                {error && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={saving}>
                  {saving ? "Working…" : "Generate project brief"}
                </Button>
              </form>
            </>
          )}

          {dossier && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
              <h2 className="text-lg font-semibold">Project brief generated</h2>
              <p className="mt-2 text-sm">{dossier.summary}</p>
              {dossier.next_questions.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Follow-up questions</p>
                  <ul className="mt-2 list-disc pl-6 text-sm">
                    {dossier.next_questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-4 text-xs">Reference: {dossier.id}</p>
            </div>
          )}
        </div>
      </main>
    </BuildPublicShell>
  );
}
