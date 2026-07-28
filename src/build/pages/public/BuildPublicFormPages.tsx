import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuildPublicShell, SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { CHOICE_BUTTON_CLASS } from "@/build/engine/fields/types";
import {
  submitBuildPublicRequest,
  isValidEmail,
  isValidWebsiteUrl,
  type AuditRequestInput,
  type BetaRequestInput,
} from "@/build/services/buildPublicForms";
import {
  publicCopy,
  usePublicLocale,
  type SupportedLocale,
} from "@/build/pages/public/publicLocaleContext";

export function BuildFreeInquiryAuditPage() {
  const [form, setForm] = useState<AuditRequestInput>({
    firstName: "",
    lastName: "",
    company: "",
    websiteUrl: "",
    email: "",
    role: "",
    message: "",
    biggestIssue: "",
    consent: false,
    website: "",
  });
  return (
    <PublicFormPage
      eyebrow="Free audit"
      title="Free Website Inquiry Audit for Deck Builders"
      description="Send us your website. We'll review your current inquiry flow, identify what project context it misses and recommend a clearer Guided Project Intake."
      submitLabel="Audit My Website"
      reassurance="We review your public website and send a short, practical audit with the biggest gaps, recommended intake path and a lightweight preview. No obligation."
      form={form}
      setForm={setForm}
    />
  );
}

function PublicFormPage({
  eyebrow,
  title,
  description,
  submitLabel,
  reassurance,
  form,
  setForm,
}: {
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  reassurance?: string;
  form: AuditRequestInput;
  setForm: Dispatch<SetStateAction<AuditRequestInput>>;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await submitBuildPublicRequest("audit", form);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit this request.");
      setStatus("idle");
    }
  }

  return (
    <BuildPublicShell>
      <PublicFormPageContent
        eyebrow={eyebrow}
        title={title}
        description={description}
        submitLabel={submitLabel}
        reassurance={reassurance}
        form={form}
        setForm={setForm}
        submit={submit}
        status={status}
        error={error}
      />
    </BuildPublicShell>
  );
}

function PublicFormPageContent({
  eyebrow,
  title,
  description,
  submitLabel,
  reassurance,
  form,
  setForm,
  submit,
  status,
  error,
}: {
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  reassurance?: string;
  form: AuditRequestInput;
  setForm: Dispatch<SetStateAction<AuditRequestInput>>;
  submit: (event: React.FormEvent) => Promise<void>;
  status: "idle" | "submitting" | "success";
  error: string | null;
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[420px_1fr]">
        <SectionHeader
          as="h1"
          eyebrow={copy(eyebrow)}
          title={copy(title)}
          description={copy(description)}
        />
        <form
          onSubmit={submit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={form.website ?? ""}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
          <AuditFields form={form} setForm={setForm} locale={locale} />
          {error && (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {copy(error)}
            </p>
          )}
          {status === "success" ? (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {copy("Request received. We will review it internally before any follow-up.")}
            </div>
          ) : (
            <>
              <Button className="mt-5" disabled={status === "submitting"}>
                {status === "submitting" ? copy("Submitting") : copy(submitLabel)}
              </Button>
              {reassurance && (
                <p className="mt-3 text-xs leading-5 text-slate-500">{copy(reassurance)}</p>
              )}
            </>
          )}
        </form>
      </div>
    </main>
  );
}

function AuditFields({
  form,
  setForm,
  locale,
}: {
  form: AuditRequestInput;
  setForm: Dispatch<SetStateAction<AuditRequestInput>>;
  locale: SupportedLocale;
}) {
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label={copy("Website URL")}
        value={form.websiteUrl}
        onChange={(value) => setForm({ ...form, websiteUrl: value })}
      />
      <Field
        label={copy("Work email")}
        value={form.email}
        onChange={(value) => setForm({ ...form, email: value })}
      />
      <Field
        label={copy("First name")}
        value={form.firstName}
        onChange={(value) => setForm({ ...form, firstName: value })}
      />
      <div className="md:col-span-2">
        <Label>{copy("What is your biggest issue with website inquiries? (optional)")}</Label>
        <Textarea
          className="mt-1"
          value={form.biggestIssue}
          onChange={(event) => setForm({ ...form, biggestIssue: event.target.value })}
        />
      </div>
      <Consent
        checked={form.consent}
        onChange={(consent) => setForm({ ...form, consent })}
        className="md:col-span-2"
        locale={locale}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function Consent({
  checked,
  onChange,
  className = "",
  locale = "en-US",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  locale?: SupportedLocale;
}) {
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <label
      className={`flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {copy("I consent to Métré Build processing this request for review and follow-up.")}
      </span>
    </label>
  );
}

/**
 * `/private-beta`: a 4-screen Guided Project Intake, deliberately mirroring
 * the real product it sells — one decision per screen instead of a 9-field
 * contact form. Only websiteUrl and email are free-text; business type and
 * monthly inquiries are clickable choices, styled with the same
 * CHOICE_BUTTON_CLASS used by the real runtime's SingleChoiceField, so the
 * page demonstrates the product rather than contradicting it.
 */
const BETA_STEP_LABELS = ["Website", "Business type", "Monthly inquiries", "Contact"] as const;
const BUSINESS_TYPE_OPTIONS = ["Deck builder", "General contractor", "Other"] as const;
const MONTHLY_INQUIRY_OPTIONS = ["Not sure", "0-10", "11-50", "51-200", "200+"] as const;
const BETA_DRAFT_KEY = "metre_private_beta_draft";

function emptyBetaForm(): BetaRequestInput {
  return {
    name: "",
    company: "",
    websiteUrl: "",
    role: "",
    businessType: "",
    monthlyInquiries: "",
    currentTools: "",
    mainQualificationProblem: "",
    email: "",
    consent: false,
    website: "",
  };
}

function loadBetaDraft(): BetaRequestInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BETA_DRAFT_KEY);
    if (!raw) return null;
    return { ...emptyBetaForm(), ...(JSON.parse(raw) as Partial<BetaRequestInput>) };
  } catch {
    return null;
  }
}

function businessChoiceFor(value: string): (typeof BUSINESS_TYPE_OPTIONS)[number] | null {
  if (value === "Deck builder" || value === "General contractor") return value;
  if (value.trim().length > 0) return "Other";
  return null;
}

export function BuildPrivateBetaPage() {
  return (
    <BuildPublicShell>
      <BuildPrivateBetaPageContent />
    </BuildPublicShell>
  );
}

function BuildPrivateBetaPageContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const initialDraft = loadBetaDraft();
  const [form, setForm] = useState<BetaRequestInput>(() => initialDraft ?? emptyBetaForm());
  const [step, setStep] = useState(0);
  const [businessTypeChoice, setBusinessTypeChoice] = useState<
    (typeof BUSINESS_TYPE_OPTIONS)[number] | null
  >(() => businessChoiceFor(initialDraft?.businessType ?? ""));
  const [businessTypeOther, setBusinessTypeOther] = useState(() =>
    businessChoiceFor(initialDraft?.businessType ?? "") === "Other"
      ? (initialDraft?.businessType ?? "")
      : "",
  );
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || status === "success") return;
    window.sessionStorage.setItem(BETA_DRAFT_KEY, JSON.stringify(form));
  }, [form, status]);

  function updateForm(patch: Partial<BetaRequestInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function selectBusinessType(option: (typeof BUSINESS_TYPE_OPTIONS)[number]) {
    setBusinessTypeChoice(option);
    updateForm({ businessType: option === "Other" ? businessTypeOther : option });
  }

  function canContinue(): boolean {
    if (step === 0) return isValidWebsiteUrl(form.websiteUrl);
    if (step === 1) return businessTypeChoice !== null && form.businessType.trim().length > 0;
    if (step === 2) return form.monthlyInquiries.trim().length > 0;
    return true;
  }

  const canSubmit = isValidEmail(form.email) && form.consent && status !== "submitting";

  async function submit() {
    setStatus("submitting");
    setError(null);
    try {
      await submitBuildPublicRequest("private_beta", form);
      setStatus("success");
      if (typeof window !== "undefined") window.sessionStorage.removeItem(BETA_DRAFT_KEY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit this request.");
      setStatus("idle");
    }
  }

  const progress = Math.round(((step + 1) / BETA_STEP_LABELS.length) * 100);

  return (
    <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[420px_1fr]">
        <SectionHeader
          eyebrow={copy("Setup review")}
          title={copy("Request a setup review")}
          description={copy(
            "Tell us about your business and we'll get back to you about setting up a guided Project Intake for your website.",
          )}
        />
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={form.website ?? ""}
            onChange={(event) => updateForm({ website: event.target.value })}
          />
          {status === "success" ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {copy("Request received. We will review it internally before any follow-up.")}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {locale === "es-US" ? "Paso" : "Step"} {step + 1}{" "}
                  {locale === "es-US" ? "de" : "of"} {BETA_STEP_LABELS.length} ·{" "}
                  {copy(BETA_STEP_LABELS[step])}
                </p>
              </div>

              {step === 0 && (
                <div>
                  <Label htmlFor="beta-website">{copy("Website URL")}</Label>
                  <Input
                    id="beta-website"
                    className="mt-1"
                    value={form.websiteUrl}
                    onChange={(event) => updateForm({ websiteUrl: event.target.value })}
                    placeholder="https://yourbusiness.com"
                  />
                </div>
              )}

              {step === 1 && (
                <div>
                  <Label>{copy("What best describes your business?")}</Label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {BUSINESS_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={CHOICE_BUTTON_CLASS(businessTypeChoice === option)}
                        onClick={() => selectBusinessType(option)}
                      >
                        {copy(option)}
                      </button>
                    ))}
                  </div>
                  {businessTypeChoice === "Other" && (
                    <Input
                      className="mt-3"
                      placeholder={copy("Tell us what your business does")}
                      value={businessTypeOther}
                      onChange={(event) => {
                        setBusinessTypeOther(event.target.value);
                        updateForm({ businessType: event.target.value });
                      }}
                    />
                  )}
                </div>
              )}

              {step === 2 && (
                <div>
                  <Label>{copy("How many website inquiries do you get per month?")}</Label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {MONTHLY_INQUIRY_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={CHOICE_BUTTON_CLASS(form.monthlyInquiries === option)}
                        onClick={() => updateForm({ monthlyInquiries: option })}
                      >
                        {copy(option)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="beta-email">{copy("Email")}</Label>
                    <Input
                      id="beta-email"
                      type="email"
                      className="mt-1"
                      value={form.email}
                      onChange={(event) => updateForm({ email: event.target.value })}
                      placeholder="you@yourbusiness.com"
                    />
                  </div>
                  <Consent
                    checked={form.consent}
                    onChange={(consent) => updateForm({ consent })}
                    locale={locale}
                  />
                </div>
              )}

              {error && (
                <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {copy(error)}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  {copy("Back")}
                </Button>
                {step < BETA_STEP_LABELS.length - 1 ? (
                  <Button
                    type="button"
                    disabled={!canContinue()}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    {copy("Continue")}
                  </Button>
                ) : (
                  <Button type="button" disabled={!canSubmit} onClick={submit}>
                    {status === "submitting" ? copy("Submitting") : copy("Submit request")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
