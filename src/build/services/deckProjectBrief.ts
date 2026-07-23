export type DeckDemoStepId =
  | "projectType"
  | "property"
  | "site"
  | "dimensions"
  | "heightAccess"
  | "materials"
  | "features"
  | "photos"
  | "budgetTimeline"
  | "location"
  | "contact";

export interface DeckDemoAnswerMap {
  projectType: string;
  propertyType: string;
  existingSituation: string;
  length: string;
  width: string;
  totalArea: string;
  heightAccess: string[];
  desiredMaterial: string;
  features: string[];
  photos: string[];
  budgetRange: string;
  timeline: string;
  zipCode: string;
  cityState: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  consent: boolean;
}

export type ProjectBriefSource = "visitor_answer" | "deterministic_rule" | "demo_analysis" | "calculated_value";

export interface ProjectBriefLine {
  label: string;
  value: string;
  source: ProjectBriefSource;
}

export interface DeckProjectBrief {
  generatedAt: string;
  missionName: string;
  demoStatus: string;
  prospect: ProjectBriefLine[];
  projectSummary: string;
  confirmedInformation: ProjectBriefLine[];
  constraints: ProjectBriefLine[];
  budgetAndTimeline: ProjectBriefLine[];
  photos: ProjectBriefLine[];
  missingInformation: ProjectBriefLine[];
  checks: ProjectBriefLine[];
  suggestedNextAction: ProjectBriefLine;
}

export const emptyDeckDemoAnswers: DeckDemoAnswerMap = {
  projectType: "",
  propertyType: "",
  existingSituation: "",
  length: "",
  width: "",
  totalArea: "",
  heightAccess: [],
  desiredMaterial: "",
  features: [],
  photos: [],
  budgetRange: "",
  timeline: "",
  zipCode: "",
  cityState: "",
  name: "",
  email: "",
  phone: "",
  preferredContact: "",
  consent: false,
};

export const deckDemoOptions = {
  projectType: ["New deck", "Deck replacement", "Deck extension", "Deck resurfacing", "Not sure"],
  propertyType: ["Single-family home", "Townhouse", "Commercial property", "Other"],
  existingSituation: ["No existing deck", "Existing wood deck", "Existing composite deck", "Patio or concrete slab", "Other"],
  heightAccess: ["Ground-level", "Elevated", "Second-story", "Stairs required", "Access limitations"],
  desiredMaterial: ["Pressure-treated wood", "Cedar or hardwood", "Composite", "PVC", "Not sure"],
  features: ["Stairs", "Railing", "Lighting", "Privacy screen", "Pergola", "Built-in seating", "Other"],
  budgetRange: ["Under $10k", "$10k-$25k", "$25k-$50k", "$50k+", "Not sure yet"],
  timeline: ["As soon as possible", "Within 3 months", "3-6 months", "6-12 months", "Just exploring"],
  preferredContact: ["Email", "Phone", "Text", "No preference"],
};

export const deckDemoSteps: { id: DeckDemoStepId; title: string; why: string }[] = [
  { id: "projectType", title: "What kind of deck project is this?", why: "The project type changes the questions a builder needs before the first call." },
  { id: "property", title: "Tell us about the property and current site", why: "Existing conditions help separate a simple resurfacing request from a structural project." },
  { id: "dimensions", title: "Approximate dimensions", why: "Rough measurements are enough for a first qualification brief. Exact dimensions can be confirmed later." },
  { id: "heightAccess", title: "Height and access", why: "Elevation, stairs and access constraints can change feasibility and the next sales step." },
  { id: "materials", title: "Material preference", why: "Material preference helps sales prepare the right conversation without treating it as a final estimate." },
  { id: "features", title: "Desired features", why: "Features often reveal complexity that a free-text form misses." },
  { id: "photos", title: "Photos or plans", why: "Photos reduce back-and-forth and help the team spot visible constraints." },
  { id: "budgetTimeline", title: "Budget and timeline", why: "Ranges help prioritize follow-up without making a contractual estimate." },
  { id: "location", title: "Project location", why: "ZIP code and city/state help route the request and prepare local questions." },
  { id: "contact", title: "Contact details and consent", why: "The business needs permission to review and respond to the project request." },
];

function valueLine(label: string, value: string | undefined, source: ProjectBriefSource = "visitor_answer"): ProjectBriefLine | null {
  const clean = String(value ?? "").trim();
  return clean ? { label, value: clean, source } : null;
}

function listLine(label: string, values: string[], source: ProjectBriefSource = "visitor_answer"): ProjectBriefLine | null {
  return values.length > 0 ? { label, value: values.join(", "), source } : null;
}

function compact(lines: Array<ProjectBriefLine | null>): ProjectBriefLine[] {
  return lines.filter((line): line is ProjectBriefLine => Boolean(line));
}

export function calculateApproximateArea(answers: DeckDemoAnswerMap): string {
  const length = Number.parseFloat(answers.length);
  const width = Number.parseFloat(answers.width);
  if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
    return `${Math.round(length * width)} sq ft`;
  }
  return answers.totalArea.trim();
}

export function validateDeckDemoStep(stepId: DeckDemoStepId, answers: DeckDemoAnswerMap): string[] {
  const errors: string[] = [];
  if (stepId === "projectType" && !answers.projectType) errors.push("Choose a project type, or select Not sure.");
  if (stepId === "property") {
    if (!answers.propertyType) errors.push("Choose the property type.");
    if (!answers.existingSituation) errors.push("Choose the current site condition.");
  }
  if (stepId === "heightAccess" && answers.heightAccess.length === 0) errors.push("Choose at least one height or access condition.");
  if (stepId === "materials" && !answers.desiredMaterial) errors.push("Choose a material preference, or select Not sure.");
  if (stepId === "budgetTimeline") {
    if (!answers.budgetRange) errors.push("Choose a budget range, or select Not sure yet.");
    if (!answers.timeline) errors.push("Choose a timeline.");
  }
  if (stepId === "location" && !answers.zipCode.trim() && !answers.cityState.trim()) errors.push("Add a ZIP code or city/state.");
  if (stepId === "contact") {
    if (!answers.name.trim()) errors.push("Add a name.");
    if (!/^\S+@\S+\.\S+$/.test(answers.email.trim())) errors.push("Add a valid email.");
    if (!answers.consent) errors.push("Consent is required to send the demo request.");
  }
  return errors;
}

export function validateDeckPhoto(file: File): string | null {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type)) return "Use JPG, PNG, WEBP or HEIC images.";
  if (file.size > 8 * 1024 * 1024) return "Each photo must be 8 MB or less.";
  return null;
}

export function generateDeckProjectBrief(answers: DeckDemoAnswerMap, generatedAt = new Date().toISOString()): DeckProjectBrief {
  const area = calculateApproximateArea(answers);
  const missing = compact([
    !area ? { label: "Exact dimensions", value: "Approximate dimensions were not confirmed.", source: "deterministic_rule" } : null,
    answers.photos.length === 0 ? { label: "Photos", value: "No photos were attached in this demo session.", source: "deterministic_rule" } : null,
    !answers.phone.trim() ? { label: "Phone", value: "Phone number was not provided.", source: "deterministic_rule" } : null,
    { label: "Permits", value: "Permit requirements were not assessed in this demo.", source: "demo_analysis" },
    { label: "Structural condition", value: "Existing structure condition requires human review.", source: "demo_analysis" },
  ]);

  const constraints = compact([
    listLine("Height/access", answers.heightAccess),
    answers.existingSituation && answers.existingSituation !== "No existing deck"
      ? { label: "Existing structure", value: answers.existingSituation, source: "visitor_answer" }
      : null,
    answers.heightAccess.includes("Access limitations")
      ? { label: "Access", value: "Visitor reported access limitations.", source: "deterministic_rule" }
      : null,
    answers.projectType === "Not sure"
      ? { label: "Project scope", value: "Visitor is unsure which deck project type fits.", source: "deterministic_rule" }
      : null,
  ]);

  const summaryBits = [
    answers.projectType || "Deck project",
    answers.propertyType ? `for a ${answers.propertyType.toLowerCase()}` : "",
    area ? `around ${area}` : "with dimensions still unclear",
    answers.desiredMaterial ? `with interest in ${answers.desiredMaterial.toLowerCase()}` : "",
  ].filter(Boolean);

  return {
    generatedAt,
    missionName: "Deck Project Intake Demo",
    demoStatus: "Example Project Brief - demonstration only",
    prospect: compact([
      valueLine("Name", answers.name),
      valueLine("Email", answers.email),
      valueLine("Phone", answers.phone),
      valueLine("Preferred contact", answers.preferredContact),
      valueLine("Location", [answers.zipCode, answers.cityState].filter(Boolean).join(" ")),
    ]),
    projectSummary: summaryBits.join(" ") || "Deck project inquiry with limited information.",
    confirmedInformation: compact([
      valueLine("Project type", answers.projectType),
      valueLine("Property type", answers.propertyType),
      valueLine("Existing situation", answers.existingSituation),
      valueLine("Approximate area", area, area === answers.totalArea ? "visitor_answer" : "calculated_value"),
      valueLine("Desired material", answers.desiredMaterial),
      listLine("Features", answers.features),
    ]),
    constraints,
    budgetAndTimeline: compact([
      valueLine("Budget range", answers.budgetRange),
      valueLine("Timeline", answers.timeline),
    ]),
    photos: answers.photos.map((name) => ({ label: "Uploaded photo", value: name, source: "visitor_answer" as const })),
    missingInformation: missing,
    checks: compact([
      area && answers.totalArea && area !== answers.totalArea
        ? { label: "Area check", value: `Calculated ${area} from length and width; visitor also entered ${answers.totalArea}.`, source: "calculated_value" }
        : null,
      answers.timeline === "As soon as possible"
        ? { label: "Timing", value: "Fast timeline should be confirmed before promising availability.", source: "deterministic_rule" }
        : null,
    ]),
    suggestedNextAction: {
      label: "Suggested next action",
      value: "Confirm dimensions and site constraints, then schedule a site visit before preparing a detailed estimate.",
      source: "demo_analysis",
    },
  };
}