import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { BuildPublicShell } from "@/build/pages/public/BuildPublicShell";
import {
  deckDemoOptions,
  deckDemoSteps,
  emptyDeckDemoAnswers,
  generateDeckProjectBrief,
  validateDeckDemoStep,
  validateDeckPhoto,
  type DeckDemoAnswerMap,
  type DeckDemoStepId,
  type DeckProjectBrief,
} from "@/build/services/deckProjectBrief";

const ANSWERS_KEY = "metre_build_deck_demo_answers";
const BRIEF_KEY = "metre_build_deck_demo_brief";

export function BuildDeckProjectDemoPage() {
  const [answers, setAnswers] = useState<DeckDemoAnswerMap>(emptyDeckDemoAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [brief, setBrief] = useState<DeckProjectBrief | null>(null);

  // Hydrate from localStorage after mount to keep SSR happy.
  useEffect(() => {
    try {
      const rawAnswers = window.localStorage.getItem(ANSWERS_KEY);
      if (rawAnswers) setAnswers({ ...emptyDeckDemoAnswers, ...JSON.parse(rawAnswers) });
      const rawBrief = window.localStorage.getItem(BRIEF_KEY);
      if (rawBrief) setBrief(JSON.parse(rawBrief) as DeckProjectBrief);
    } catch {
      /* ignore */
    }
  }, []);

  const step = deckDemoSteps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / deckDemoSteps.length) * 100);

  function patch(next: Partial<DeckDemoAnswerMap>) {
    const updated = { ...answers, ...next };
    setAnswers(updated);
    try { window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  function toggle(key: "heightAccess" | "features", value: string) {
    const current = answers[key];
    patch({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] } as Partial<DeckDemoAnswerMap>);
  }

  function goNext() {
    const nextErrors = validateDeckDemoStep(step.id, answers);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setStepIndex((current) => Math.min(current + 1, deckDemoSteps.length - 1));
  }

  function finish() {
    const nextErrors = validateDeckDemoStep("contact", answers);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    const generated = generateDeckProjectBrief(answers);
    try { window.localStorage.setItem(BRIEF_KEY, JSON.stringify(generated)); } catch { /* ignore */ }
    setBrief(generated);
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, 6);
    const invalid = selected.map(validateDeckPhoto).find(Boolean);
    if (invalid) {
      setErrors([invalid]);
      return;
    }
    patch({ photos: selected.map((file) => file.name) });
    setErrors([]);
  }

  if (brief) {
    return (
      <BuildPublicShell>
        <main className="bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Demo complete</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">Your Example Project Brief</h1>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setBrief(null);
                  try { window.localStorage.removeItem(BRIEF_KEY); } catch { /* ignore */ }
                }}
              >
                Edit answers
              </Button>
            </div>
            <BriefPreview brief={brief} />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/free-inquiry-audit"><Button>Request a Free Inquiry Audit</Button></Link>
              <Link to="/private-beta"><Button variant="outline">Join the private beta</Button></Link>
            </div>
          </div>
        </main>
      </BuildPublicShell>
    );
  }

  return (
    <BuildPublicShell>
      <main className="bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Deck Project Intake Demo</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">{step.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{step.why}</p>
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">Step {stepIndex + 1} of {deckDemoSteps.length} · {progress}% complete</p>
          </div>
          <div className="p-6">
            {errors.length > 0 && (
              <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {errors.map((error) => <p key={error}>{error}</p>)}
              </div>
            )}
            <DeckStep stepId={step.id} answers={answers} patch={patch} toggle={toggle} onFiles={onFiles} />
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>Back</Button>
              {stepIndex < deckDemoSteps.length - 1 ? (
                <Button onClick={goNext}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
              ) : (
                <Button onClick={finish}>Generate Project Brief<FileText className="ml-2 h-4 w-4" /></Button>
              )}
              <p className="text-xs text-slate-500">Demo answers are stored locally in this browser only.</p>
            </div>
          </div>
        </section>
      </main>
    </BuildPublicShell>
  );
}

function DeckStep({
  stepId,
  answers,
  patch,
  toggle,
  onFiles,
}: {
  stepId: DeckDemoStepId;
  answers: DeckDemoAnswerMap;
  patch: (next: Partial<DeckDemoAnswerMap>) => void;
  toggle: (key: "heightAccess" | "features", value: string) => void;
  onFiles: (files: FileList | null) => void;
}) {
  if (stepId === "projectType") return <ChoiceGrid options={deckDemoOptions.projectType} value={answers.projectType} onSelect={(value) => patch({ projectType: value })} />;
  if (stepId === "property") return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChoiceGroup title="Property type" options={deckDemoOptions.propertyType} value={answers.propertyType} onSelect={(value) => patch({ propertyType: value })} />
      <ChoiceGroup title="Existing situation" options={deckDemoOptions.existingSituation} value={answers.existingSituation} onSelect={(value) => patch({ existingSituation: value })} />
    </div>
  );
  if (stepId === "dimensions") return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Length (ft)" value={answers.length} onChange={(value) => patch({ length: value })} />
      <Field label="Width (ft)" value={answers.width} onChange={(value) => patch({ width: value })} />
      <Field label="Approx. total area" value={answers.totalArea} onChange={(value) => patch({ totalArea: value })} placeholder="I'm not sure" />
    </div>
  );
  if (stepId === "heightAccess") return <MultiChoiceGrid options={deckDemoOptions.heightAccess} values={answers.heightAccess} onToggle={(value) => toggle("heightAccess", value)} />;
  if (stepId === "materials") return <ChoiceGrid options={deckDemoOptions.desiredMaterial} value={answers.desiredMaterial} onSelect={(value) => patch({ desiredMaterial: value })} />;
  if (stepId === "features") return <MultiChoiceGrid options={deckDemoOptions.features} values={answers.features} onToggle={(value) => toggle("features", value)} />;
  if (stepId === "photos") return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
      <Upload className="h-6 w-6 text-emerald-700" />
      <Label htmlFor="deck-photos" className="mt-4 block font-semibold">Upload up to 6 photos</Label>
      <p className="mt-2 text-sm text-slate-600">JPG, PNG, WEBP or HEIC. 8 MB max each. Demo filenames stay in this browser.</p>
      <Input id="deck-photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="mt-4" onChange={(event) => onFiles(event.target.files)} />
      <div className="mt-4 flex flex-wrap gap-2">
        {answers.photos.map((photo) => (
          <span key={photo} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{photo}</span>
        ))}
      </div>
    </div>
  );
  if (stepId === "budgetTimeline") return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChoiceGroup title="Budget range" options={deckDemoOptions.budgetRange} value={answers.budgetRange} onSelect={(value) => patch({ budgetRange: value })} />
      <ChoiceGroup title="Timeline" options={deckDemoOptions.timeline} value={answers.timeline} onSelect={(value) => patch({ timeline: value })} />
    </div>
  );
  if (stepId === "location") return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="ZIP code" value={answers.zipCode} onChange={(value) => patch({ zipCode: value })} />
      <Field label="City / State" value={answers.cityState} onChange={(value) => patch({ cityState: value })} />
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name" value={answers.name} onChange={(value) => patch({ name: value })} />
      <Field label="Email" value={answers.email} onChange={(value) => patch({ email: value })} />
      <Field label="Phone" value={answers.phone} onChange={(value) => patch({ phone: value })} />
      <ChoiceGroup title="Preferred contact" options={deckDemoOptions.preferredContact} value={answers.preferredContact} onSelect={(value) => patch({ preferredContact: value })} />
      <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm md:col-span-2">
        <input type="checkbox" checked={answers.consent} onChange={(event) => patch({ consent: event.target.checked })} />
        <span>I consent to sharing this demo request for review and follow-up.</span>
      </label>
    </div>
  );
}

function ChoiceGrid({ options, value, onSelect }: { options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`rounded-md border p-4 text-left text-sm font-medium ${value === option ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ChoiceGroup(props: { title: string; options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-950">{props.title}</h2>
      <ChoiceGrid options={props.options} value={props.value} onSelect={props.onSelect} />
    </div>
  );
}

function MultiChoiceGrid({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(option)}
          className={`rounded-md border p-4 text-left text-sm font-medium ${values.includes(option) ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1" />
    </div>
  );
}
