export type BuildPublicRequestType = "audit" | "private_beta";

export interface AuditRequestInput {
  firstName: string;
  lastName: string;
  company: string;
  websiteUrl: string;
  email: string;
  role: string;
  message: string;
  consent: boolean;
  website?: string;
}

export interface BetaRequestInput {
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
  if (!input.lastName.trim()) errors.push("Last name is required.");
  if (!input.company.trim()) errors.push("Company is required.");
  if (!isValidWebsiteUrl(input.websiteUrl)) errors.push("Enter a valid website URL.");
  if (!isValidEmail(input.email)) errors.push("Enter a valid email.");
  if (!input.consent) errors.push("Consent is required.");
  return errors;
}

export function validateBetaRequest(input: BetaRequestInput): string[] {
  const errors: string[] = [];
  if (input.website) errors.push("Spam check failed.");
  if (!input.name.trim()) errors.push("Name is required.");
  if (!input.company.trim()) errors.push("Company is required.");
  if (!isValidWebsiteUrl(input.websiteUrl)) errors.push("Enter a valid website URL.");
  if (!input.role.trim()) errors.push("Role is required.");
  if (!input.businessType.trim()) errors.push("Business type is required.");
  if (!input.monthlyInquiries.trim()) errors.push("Choose a monthly inquiry range.");
  if (!input.mainQualificationProblem.trim()) errors.push("Describe the main qualification problem.");
  if (!isValidEmail(input.email)) errors.push("Enter a valid email.");
  if (!input.consent) errors.push("Consent is required.");
  return errors;
}

export async function submitBuildPublicRequest(
  type: BuildPublicRequestType,
  payload: AuditRequestInput | BetaRequestInput,
): Promise<{ id: string; stored: "local" }> {
  const errors = type === "audit"
    ? validateAuditRequest(payload as AuditRequestInput)
    : validateBetaRequest(payload as BetaRequestInput);
  if (errors.length > 0) throw new Error(errors[0]);
  const id = `local_${Date.now()}`;
  if (typeof window !== "undefined") {
    const key = "metre_build_public_requests";
    const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown[];
    window.localStorage.setItem(
      key,
      JSON.stringify([{ id, type, payload, createdAt: new Date().toISOString() }, ...current]),
    );
  }
  return { id, stored: "local" };
}
