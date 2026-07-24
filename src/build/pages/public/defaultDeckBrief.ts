/**
 * Static example Project Brief used only by marketing pages (homepage,
 * "Deck builders", "Example project brief"). Computed at build/import time
 * via the same generic engine the live runtime uses — not a hand-rolled
 * object — so marketing copy can never drift from what the real engine
 * actually produces.
 */
import { generateProjectBrief } from "@/build/engine/brief";
import type { Answers } from "@/build/schema/answers";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";

const exampleAnswers: Answers = {
  projectType: "Deck replacement",
  propertyType: "Single-family home",
  existingSituation: "Existing wood deck",
  length: 18,
  width: 14,
  heightAccess: ["Elevated", "Stairs required", "Access limitations"],
  desiredMaterial: "Composite",
  features: ["Railing", "Lighting", "Privacy screen"],
  photos: [
    { filename: "backyard-current-deck.jpg", sizeBytes: 480_000, mimeType: "image/jpeg" },
    { filename: "stairs-access.png", sizeBytes: 410_000, mimeType: "image/png" },
  ],
  budgetRange: "$25k-$50k",
  timeline: "Within 3 months",
  location: { zip: "78704", city_state: "Austin, TX" },
  name: "Fictional homeowner",
  email: "demo@example.com",
  phone: "(555) 010-0198",
  preferredContact: "Phone",
  consent: true,
};

export const defaultDeckBrief = generateProjectBrief(
  deckPlaybookSchema,
  exampleAnswers,
  { name: "Deck Project Intake Demo" },
  "2026-07-23T00:00:00.000Z",
);
