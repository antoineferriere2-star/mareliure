import { emptyDeckDemoAnswers, generateDeckProjectBrief } from "@/build/services/deckProjectBrief";

export const defaultDeckBrief = generateDeckProjectBrief({
  ...emptyDeckDemoAnswers,
  projectType: "Deck replacement",
  propertyType: "Single-family home",
  existingSituation: "Existing wood deck",
  length: "18",
  width: "14",
  heightAccess: ["Elevated", "Stairs required", "Access limitations"],
  desiredMaterial: "Composite",
  features: ["Railing", "Lighting", "Privacy screen"],
  photos: ["backyard-current-deck.jpg", "stairs-access.png"],
  budgetRange: "$25k-$50k",
  timeline: "Within 3 months",
  zipCode: "78704",
  cityState: "Austin, TX",
  name: "Fictional homeowner",
  email: "demo@example.com",
  phone: "(555) 010-0198",
  preferredContact: "Phone",
  consent: true,
}, "2026-07-23T00:00:00.000Z");