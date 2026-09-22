/**
 * Ce que l'écran lit d'un ouvrage et d'un contact — des formes de présentation, sans accès
 * aux données. Un ouvrage se lit en une ligne : « Les Misérables · Mme Martin · 220 × 145 × 32 mm ».
 */
import type { DocumentSummary } from "@/marketplace/quotes/quoteViews";
import { formatDimensions } from "@/marketplace/quotes/quoteLines";

export type WorkSource = "mon_client" | "ma_reliure";
export type WorkStatus = "active" | "archived";
export type ContactOrigin = "mon_client" | "ma_reliure";

export interface ContactView {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  origin: ContactOrigin;
  archived: boolean;
}

export interface ContactSummary extends ContactView {
  workCount: number;
  documentCount: number;
}

export interface WorkView {
  id: string;
  reference: string;
  contactId: string | null;
  title: string;
  author: string | null;
  editionNote: string | null;
  description: string | null;
  heightMm: number | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightGrams: number | null;
  declaredValueCents: number | null;
  conditionNotes: string | null;
  internalNotes: string | null;
  status: WorkStatus;
  source: WorkSource;
  caseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSummary {
  id: string;
  reference: string;
  title: string;
  author: string | null;
  contactId: string | null;
  contactName: string | null;
  heightMm: number | null;
  widthMm: number | null;
  thicknessMm: number | null;
  conditionNotes: string | null;
  status: WorkStatus;
  source: WorkSource;
  caseId?: string | null;
  quoteCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkDetail {
  work: WorkView;
  contact: ContactView | null;
  quotes: DocumentSummary[];
  invoices: DocumentSummary[];
}

export interface ContactDetail {
  contact: ContactView;
  works: WorkSummary[];
  quotes: DocumentSummary[];
  invoices: DocumentSummary[];
}

/** « 220 × 145 × 32 mm » — ou `null` si aucune dimension n'est connue. */
export function formatWorkDimensions(work: Pick<WorkView, "heightMm" | "widthMm" | "thicknessMm">): string | null {
  return formatDimensions({ heightMm: work.heightMm, widthMm: work.widthMm, spineMm: work.thicknessMm });
}

/** Le poids à l'écran : « 900 g », ou « 1,2 kg » à partir d'un kilo. */
export function formatWeight(grams: number | null): string | null {
  if (grams === null) return null;
  if (grams < 1000) return `${grams} g`;
  return `${(grams / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}

/**
 * La ligne qui fait reconnaître un ouvrage en cinq secondes :
 * « Les Misérables — Victor Hugo · Mme Martin · 220 × 145 × 32 mm · Dos détaché ».
 */
export function workOneLiner(work: WorkSummary): string {
  const title = work.author ? `${work.title} — ${work.author}` : work.title;
  return [title, work.contactName, formatWorkDimensions(work), work.conditionNotes]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
