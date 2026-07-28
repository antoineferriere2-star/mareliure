export type BuildPublicRequestType = "audit" | "private_beta";

export interface AuditRequestInput {
  firstName: string;
  // Kept for backward compatibility with historical submissions and admin
  // enrichment — no longer collected on the first screen (see AuditFields).
  lastName: string;
  company: string;
  websiteUrl: string;
  email: string;
  role: string;
  message: string;
  biggestIssue: string;
  consent: boolean;
  website?: string;
}

export interface BetaRequestInput {
  // Kept for backward compatibility with historical submissions and admin
  // enrichment — no longer collected in the 4-screen guided intake below
  // (see BetaIntakeSteps), deferred to a follow-up call instead.
  name: string;
  company: string;
  websiteUrl: string;
  role: string;
  businessType: string;
  monthlyInquiries: string;
  currentTools: string;
  mainQualificationProblem: string;
  email: string;
  consent: boolean;
  website?: string;
}

export interface ContactRequestInput {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  consent: boolean;
  website?: string;
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function isValidWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validateAuditRequest(input: AuditRequestInput): string[] {
  const errors: string[] = [];
  if (input.website) errors.push("Spam check failed.");
  if (!input.firstName.trim()) errors.push("First name is required.");
  if (!isValidWebsiteUrl(input.websiteUrl)) errors.push("Enter a valid website URL.");
  if (!isValidEmail(input.email)) errors.push("Enter a valid email.");
  if (!input.consent) errors.push("Consent is required.");
  return errors;
}

export function validateBetaRequest(input: BetaRequestInput): string[] {
  const errors: string[] = [];
  if (input.website) errors.push("Spam check failed.");
  if (!isValidWebsiteUrl(input.websiteUrl)) errors.push("Enter a valid website URL.");
  if (!input.businessType.trim()) errors.push("Business type is required.");
  if (!input.monthlyInquiries.trim()) errors.push("Choose a monthly inquiry range.");
  if (!isValidEmail(input.email)) errors.push("Enter a valid email.");
  if (!input.consent) errors.push("Consent is required.");
  return errors;
}

export function validateContactRequest(input: ContactRequestInput): string[] {
  const errors: string[] = [];
  if (input.website) errors.push("Spam check failed.");
  if (!input.name.trim()) errors.push("Name is required.");
  if (!isValidEmail(input.email)) errors.push("Enter a valid email.");
  if (!input.subject.trim()) errors.push("Subject is required.");
  if (!input.message.trim()) errors.push("Message is required.");
  if (!input.consent) errors.push("Consent is required.");
  return errors;
}

export async function submitBuildPublicRequest(
  type: BuildPublicRequestType,
  payload: AuditRequestInput | BetaRequestInput,
): Promise<{ id: string }> {
  const errors =
    type === "audit"
      ? validateAuditRequest(payload as AuditRequestInput)
      : validateBetaRequest(payload as BetaRequestInput);
  if (errors.length > 0) throw new Error(errors[0]);

  const { website, ...cleanPayload } = payload as AuditRequestInput & BetaRequestInput;
  const sourcePath =
    typeof window !== "undefined"
      ? window.location.pathname
      : type === "audit"
        ? "/free-inquiry-audit"
        : "/private-beta";

  const response = await fetch("/api/public/build-public-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      sourcePath,
      website: website ?? "",
      payload: cleanPayload,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Unable to submit this request.");
  }
  const body = (await response.json()) as { id: string };
  return { id: body.id };
}

export async function submitPublicContactRequest(
  payload: ContactRequestInput,
): Promise<{ ok: true }> {
  const errors = validateContactRequest(payload);
  if (errors.length > 0) throw new Error(errors[0]);

  const { website, ...cleanPayload } = payload;
  const sourcePath = typeof window !== "undefined" ? window.location.pathname : "/contact";

  const response = await fetch("/api/public/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourcePath,
      website: website ?? "",
      payload: cleanPayload,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Unable to send this message.");
  }
  return { ok: true };
}
