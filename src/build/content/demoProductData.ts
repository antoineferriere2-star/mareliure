/**
 * Fictional demo data for the marketing "product shots" (homepage). Every
 * value here is invented for illustration — never a real visitor, never a
 * real workspace. The Project Brief is computed by the same generic engine
 * the live runtime uses (see pages/public/defaultDeckBrief.ts for the
 * established pattern) so marketing copy can never drift from real product
 * output.
 */
import { generateProjectBrief } from "@/build/engine/brief";
import type { Answers } from "@/build/schema/answers";
import type { InspirationPhotoAnswer } from "@/build/schema/answers";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import type { PlaybookMatch } from "@/build/onboarding/matchPlaybook";
import type {
  SingleChoiceField,
  BudgetField,
  TimelineField,
  InspirationPhotoField,
} from "@/build/schema/playbook";
import type { PlaybookField } from "@/build/schema/playbook";

/** Finds a real field definition by key inside the real Deck Playbook, instead of hand-writing one. */
function findField(key: string): PlaybookField {
  for (const section of deckPlaybookSchema.sections) {
    for (const step of section.steps) {
      const field = step.fields.find((f) => f.key === key);
      if (field) return field;
    }
  }
  throw new Error(`Demo data: no field "${key}" in deckPlaybookSchema.`);
}

export const demoProjectTypeField = findField("projectType") as SingleChoiceField;
export const demoBudgetField = findField("budgetRange") as BudgetField;
export const demoTimelineField = findField("timeline") as TimelineField;
export const demoInspirationPhotoField = findField("inspirationPhoto") as InspirationPhotoField;

const janeMillerAnswers: Answers = {
  projectType: "New deck",
  propertyType: "Single-family home",
  existingSituation: "No existing deck",
  length: 20,
  width: 16,
  heightAccess: ["Ground-level", "Access limitations"],
  desiredMaterial: "Composite",
  features: ["Railing", "Stairs", "Lighting"],
  photos: [],
  budgetRange: "$25k-$50k",
  timeline: "Within 3 months",
  location: { zip: "33901", city_state: "Fort Myers, FL" },
  name: "Jane Miller",
  email: "jane.miller@example.com",
  phone: "(239) 555-0134",
  preferredContact: "Email",
  consent: true,
};

export const demoJaneMillerBrief = generateProjectBrief(
  deckPlaybookSchema,
  janeMillerAnswers,
  { name: "Deck Project — Jane Miller" },
  "2026-07-20T00:00:00.000Z",
);

/**
 * An inspiration photo already "analyzed" — some hypotheses confirmed by the
 * visitor, others still open. Demonstrates that AI hypotheses are always
 * shown as hypotheses, never presented as fact until confirmed.
 */
export const demoInspirationAnswer: InspirationPhotoAnswer = {
  photoPath: "demo/inspiration-placeholder.jpg",
  hypotheses: {
    style: "Modern minimalist",
    materials: ["Composite decking", "Black aluminum railing"],
    shape: "Rectangular, multi-level",
    elements: ["Built-in bench", "Recessed lighting", "Privacy screen"],
  },
  confirmed: { style: true, materials: true },
  suggestedQuestions: [
    "Confirm whether the multi-level layout follows the yard's slope or is a design preference.",
    "Ask if recessed lighting needs a dedicated electrical run.",
  ],
};

export interface DemoMissionRow {
  id: string;
  name: string;
  objective: string | null;
  status: "draft" | "active" | "paused" | "archived";
  playbook_name: string | null;
  created_at: string;
}

export const demoMissionsRows: DemoMissionRow[] = [
  {
    id: "demo-1",
    name: "Deck Project Journey",
    objective: "Qualify inbound deck requests before the first call",
    status: "active",
    playbook_name: "Deck Projects",
    created_at: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "demo-2",
    name: "Pool & Spa Intake",
    objective: "Early-access Playbook for pool builders",
    status: "draft",
    playbook_name: "Pools & Spas",
    created_at: "2026-06-18T00:00:00.000Z",
  },
  {
    id: "demo-3",
    name: "Window Replacement — Spring promo",
    objective: null,
    status: "paused",
    playbook_name: "Windows & Doors",
    created_at: "2026-05-11T00:00:00.000Z",
  },
];

export interface DemoDossierRow {
  id: string;
  summary: string;
  status: string;
  mission_name: string;
  confidence: "low" | "medium" | "high";
  missing_count: number;
  created_at: string;
}

export const demoDossiersRows: DemoDossierRow[] = [
  {
    id: "demo-d1",
    summary: "New deck for Jane Miller — Fort Myers, FL",
    status: "nouveau",
    mission_name: "Deck Project Journey",
    confidence: "high",
    missing_count: 1,
    created_at: "2026-07-20T14:05:00.000Z",
  },
  {
    id: "demo-d2",
    summary: "Deck resurfacing — exact dimensions unclear",
    status: "contacte",
    mission_name: "Deck Project Journey",
    confidence: "medium",
    missing_count: 3,
    created_at: "2026-07-19T09:22:00.000Z",
  },
  {
    id: "demo-d3",
    summary: "Pool inquiry — budget not confirmed",
    status: "nouveau",
    mission_name: "Pool & Spa Intake",
    confidence: "low",
    missing_count: 4,
    created_at: "2026-07-18T17:40:00.000Z",
  },
];

/** The onboarding example from the marketing brief: sanibeldecks.com / Deck Builder / New Deck. */
export const demoOnboarding = {
  websiteUrl: "sanibeldecks.com",
  businessType: {
    candidates: ["Deck Builder", "General Contractor"],
    value: "Deck Builder",
  },
  product: {
    candidates: ["New Deck", "Deck Replacement", "Deck Resurfacing"],
    value: "New Deck",
  },
  match: {
    playbook: { id: "demo-playbook", name: "Deck Project Journey", project_type: "New deck" },
    score: 0.92,
  } satisfies PlaybookMatch,
};
