import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuildPublicShell, SectionHeader } from "@/build/pages/public/BuildPublicShell";
import {
  submitBuildPublicRequest,
  type AuditRequestInput,
  type BetaRequestInput,
} from "@/build/services/buildPublicForms";

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
      kind="audit"
      eyebrow="Free audit"
      title="Free Website Inquiry Audit for Deck Builders"
      description="Send us your website. We'll review how your current inquiry flow captures project details and identify the biggest gaps before the first sales call."
      submitLabel="Audit My Website"
      reassurance="We review your public website and send you a short, practical inquiry audit. No obligation."
      form={form}
      setForm={setForm}
    />
  );
}

export function BuildPrivateBetaPage() {
  const [form, setForm] = useState<BetaRequestInput>({
    name: "",
    company: "",
    websiteUrl: "",
    role: "",
    businessType: "Deck builder",
    monthlyInquiries: "",
    currentTools: "",
    mainQualificationProblem: "",
    email: "",
    consent: false,
    website: "",
  });
  return (
    <PublicFormPage
      kind="private_beta"
      eyebrow="Setup review"
      title="Request a setup review"
      description="Tell us about your business and we'll get back to you about setting up a guided Project Intake for your website."
      submitLabel="Submit request"
      form={form}
      setForm={setForm}
    />
  );
}

type FormShape = AuditRequestInput | BetaRequestInput;

function PublicFormPage<T extends FormShape>({
  kind,
  eyebrow,
  title,
  description,
  submitLabel,
  reassurance,
  form,
  setForm,
}: {
  kind: "audit" | "private_beta";
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  reassurance?: string;
  form: T;
  setForm: Dispatch<SetStateAction<T>>;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await submitBuildPublicRequest(kind, form);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit this request.");
      setStatus("idle");
    }
  }

  return (
    <BuildPublicShell>
      <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[420px_1fr]">
          <SectionHeader as="h1" eyebrow={eyebrow} title={title} description={description} />
          <form
            onSubmit={submit}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              value={form.website ?? ""}
              onChange={(event) => setForm({ ...form, website: event.target.value } as T)}
            />
            {kind === "audit" ? (
              <AuditFields
                form={form as AuditRequestInput}
                setForm={setForm as unknown as Dispatch<SetStateAction<AuditRequestInput>>}
              />
            ) : (
              <BetaFields
                form={form as BetaRequestInput}
                setForm={setForm as unknown as Dispatch<SetStateAction<BetaRequestInput>>}
              />
            )}
            {error && (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </p>
            )}
            {status === "success" ? (
              <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Request received. We will review it internally before any follow-up.
              </div>
            ) : (
              <>
                <Button className="mt-5" disabled={status === "submitting"}>
                  {status === "submitting" ? "Submitting" : submitLabel}
                </Button>
                {reassurance && (
                  <p className="mt-3 text-xs leading-5 text-slate-500">{reassurance}</p>
                )}
              </>
            )}
          </form>
        </div>
      </main>
    </BuildPublicShell>
  );
}

function AuditFields({
  form,
  setForm,
}: {
  form: AuditRequestInput;
  setForm: Dispatch<SetStateAction<AuditRequestInput>>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label="Website URL"
        value={form.websiteUrl}
        onChange={(value) => setForm({ ...form, websiteUrl: value })}
      />
      <Field
        label="Work email"
        value={form.email}
        onChange={(value) => setForm({ ...form, email: value })}
      />
      <Field
        label="First name"
        value={form.firstName}
        onChange={(value) => setForm({ ...form, firstName: value })}
      />
      <div className="md:col-span-2">
        <Label>What is your biggest issue with website inquiries? (optional)</Label>
        <Textarea
          className="mt-1"
          value={form.biggestIssue}
          onChange={(event) => setForm({ ...form, biggestIssue: event.target.value })}
        />
      </div>
      <Consent checked={form.consent} onChange={(consent) => setForm({ ...form, consent })} />
    </div>
  );
}

function BetaFields({
  form,
  setForm,
}: {
  form: BetaRequestInput;
  setForm: Dispatch<SetStateAction<BetaRequestInput>>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label="Name"
        value={form.name}
        onChange={(value) => setForm({ ...form, name: value })}
      />
      <Field
        label="Company"
        value={form.company}
        onChange={(value) => setForm({ ...form, company: value })}
      />
      <Field
        label="Website URL"
        value={form.websiteUrl}
        onChange={(value) => setForm({ ...form, websiteUrl: value })}
      />
      <Field
        label="Role"
        value={form.role}
        onChange={(value) => setForm({ ...form, role: value })}
      />
      <Field
        label="Business type"
        value={form.businessType}
        onChange={(value) => setForm({ ...form, businessType: value })}
      />
      <Field
        label="Monthly website inquiries"
        value={form.monthlyInquiries}
        onChange={(value) => setForm({ ...form, monthlyInquiries: value })}
        placeholder="0-10, 11-50, 51-200..."
      />
      <Field
        label="Current tools"
        value={form.currentTools}
        onChange={(value) => setForm({ ...form, currentTools: value })}
      />
      <Field
        label="Email"
        value={form.email}
        onChange={(value) => setForm({ ...form, email: value })}
      />
      <div className="md:col-span-2">
        <Label>Main qualification problem</Label>
        <Textarea
          className="mt-1"
          value={form.mainQualificationProblem}
          onChange={(event) => setForm({ ...form, mainQualificationProblem: event.target.value })}
        />
      </div>
      <Consent checked={form.consent} onChange={(consent) => setForm({ ...form, consent })} />
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
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm md:col-span-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>I consent to Métré Build processing this request for review and follow-up.</span>
    </label>
  );
}
