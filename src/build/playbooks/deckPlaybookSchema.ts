/**
 * The Deck Playbook, expressed entirely as data for the generic engine.
 * This replaces the old hand-written `deckProjectBrief.ts` — every rule that
 * used to be TypeScript (validation, area calculation, conditional
 * constraints, always-injected caveats, the suggested next action) is now
 * Playbook data interpreted by `src/build/engine/*`. See
 * `scripts/seedDeckPlaybook.ts` for how this gets published as a real
 * Mission through the ordinary admin server functions — no parallel route
 * or business logic exists outside of this file.
 */
import type { PlaybookSchema } from "@/build/schema/playbook";

function choice(value: string) {
  return { value, label: value };
}

export const deckPlaybookSchema: PlaybookSchema = {
  schemaVersion: 1,
  sections: [
    {
      id: "deck-intake",
      title: "Deck project intake",
      steps: [
        {
          id: "entryMode",
          title: "How would you like to start?",
          why: "Some visitors already know exactly what they want; others prefer to start from an inspiration photo.",
          fields: [
            {
              key: "entryMode",
              label: "How would you like to start?",
              type: "single_choice",
              desirability: "optional",
              options: [
                { value: "project_type_known", label: "I know what I want" },
                { value: "inspiration_photo", label: "Start from a photo" },
                { value: "not_sure", label: "I'm not sure yet" },
              ],
            },
          ],
        },
        {
          id: "inspiration",
          title: "Show us what inspired your project",
          why: "We'll help you turn that inspiration into a project your contractor can understand.",
          displayWhen: {
            all: [{ fieldKey: "entryMode", operator: "equals", value: "inspiration_photo" }],
          },
          fields: [
            {
              key: "inspirationPhoto",
              label: "Upload an inspiration photo",
              type: "inspiration_photo",
              desirability: "optional",
              helpText:
                "A photo of your own space, a Pinterest/Instagram screenshot, or a catalog picture — whatever inspired your project.",
              maxFileSizeMb: 8,
              acceptMimeTypes: ["image/jpeg", "image/png", "image/webp"],
            },
          ],
        },
        {
          id: "projectType",
          title: "What kind of deck project is this?",
          why: "The project type changes the questions a builder needs before the first call.",
          fields: [
            {
              key: "projectType",
              label: "Project type",
              type: "single_choice",
              desirability: "required",
              options: [
                "New deck",
                "Deck replacement",
                "Deck extension",
                "Deck resurfacing",
                "Not sure",
              ].map(choice),
              briefMapping: {
                section: "confirmedInformation",
                label: "Project type",
                category: "Project details",
                format: "raw",
              },
            },
          ],
        },
        {
          id: "property",
          title: "Tell us about the property and current site",
          why: "Existing conditions help separate a simple resurfacing request from a structural project.",
          fields: [
            {
              key: "propertyType",
              label: "Property type",
              type: "single_choice",
              desirability: "required",
              options: ["Single-family home", "Townhouse", "Commercial property", "Other"].map(
                choice,
              ),
              briefMapping: {
                section: "confirmedInformation",
                label: "Property type",
                category: "Project details",
                format: "raw",
              },
            },
            {
              key: "existingSituation",
              label: "Existing situation",
              type: "single_choice",
              desirability: "required",
              options: [
                "No existing deck",
                "Existing wood deck",
                "Existing composite deck",
                "Patio or concrete slab",
                "Other",
              ].map(choice),
              briefMapping: {
                section: "confirmedInformation",
                label: "Existing situation",
                category: "Project details",
                format: "raw",
              },
            },
          ],
        },
        {
          id: "dimensions",
          title: "Approximate dimensions",
          why: "Rough measurements are enough for a first qualification brief. Exact dimensions can be confirmed later.",
          fields: [
            {
              key: "length",
              label: "Length (ft)",
              type: "measurement",
              unit: "ft",
              desirability: "optional",
            },
            {
              key: "width",
              label: "Width (ft)",
              type: "measurement",
              unit: "ft",
              desirability: "optional",
            },
            {
              key: "totalArea",
              label: "Approx. total area",
              type: "text",
              desirability: "optional",
              placeholder: "I'm not sure",
              allowNotSure: true,
            },
          ],
        },
        {
          id: "heightAccess",
          title: "Height and access",
          why: "Elevation, stairs and access constraints can change feasibility and the next sales step.",
          fields: [
            {
              key: "heightAccess",
              label: "Height/access",
              type: "multi_choice",
              desirability: "required",
              minSelected: 1,
              options: [
                "Ground-level",
                "Elevated",
                "Second-story",
                "Stairs required",
                "Access limitations",
              ].map(choice),
              briefMapping: {
                section: "constraints",
                label: "Height/access",
                category: "Site",
                format: "join_comma",
              },
            },
          ],
        },
        {
          id: "materials",
          title: "Material preference",
          why: "Material preference helps sales prepare the right conversation without treating it as a final estimate.",
          fields: [
            {
              key: "desiredMaterial",
              label: "Desired material",
              type: "single_choice",
              desirability: "required",
              options: [
                "Pressure-treated wood",
                "Cedar or hardwood",
                "Composite",
                "PVC",
                "Not sure",
              ].map(choice),
              briefMapping: {
                section: "confirmedInformation",
                label: "Desired material",
                category: "Project details",
                format: "raw",
              },
            },
          ],
        },
        {
          id: "features",
          title: "Desired features",
          why: "Features often reveal complexity that a free-text form misses.",
          fields: [
            {
              key: "features",
              label: "Features",
              type: "multi_choice",
              desirability: "optional",
              options: [
                "Stairs",
                "Railing",
                "Lighting",
                "Privacy screen",
                "Pergola",
                "Built-in seating",
                "Other",
              ].map(choice),
              briefMapping: {
                section: "confirmedInformation",
                label: "Features",
                category: "Project details",
                format: "join_comma",
              },
            },
          ],
        },
        {
          id: "photos",
          title: "Photos or plans",
          why: "Photos reduce back-and-forth and help the team spot visible constraints.",
          fields: [
            {
              key: "photos",
              label: "Upload up to 6 photos",
              type: "photo",
              desirability: "recommended",
              missingMessage: "No photos were attached in this demo session.",
              helpText: "JPG, PNG, WEBP or HEIC. 8 MB max each.",
              maxFiles: 6,
              maxFileSizeMb: 8,
              acceptMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
              storage: "filename_only",
              briefMapping: {
                section: "confirmedInformation",
                label: "Photos",
                category: "Attachments",
                format: "join_comma",
              },
            },
          ],
        },
        {
          id: "budgetTimeline",
          title: "Budget and timeline",
          why: "Ranges help prioritize follow-up without making a contractual estimate.",
          fields: [
            {
              key: "budgetRange",
              label: "Budget range",
              type: "budget",
              desirability: "required",
              currency: "USD",
              mode: "ranges",
              ranges: ["Under $10k", "$10k-$25k", "$25k-$50k", "$50k+", "Not sure yet"].map(choice),
              briefMapping: { section: "budgetAndTiming", label: "Budget range", format: "raw" },
            },
            {
              key: "timeline",
              label: "Timeline",
              type: "timeline",
              desirability: "required",
              options: [
                "As soon as possible",
                "Within 3 months",
                "3-6 months",
                "6-12 months",
                "Just exploring",
              ].map(choice),
              briefMapping: { section: "budgetAndTiming", label: "Timeline", format: "raw" },
            },
          ],
        },
        {
          id: "location",
          title: "Project location",
          why: "ZIP code and city/state help route the request and prepare local questions.",
          fields: [
            {
              key: "location",
              label: "Project location",
              type: "address",
              desirability: "required",
              requireAtLeastOne: true,
              components: [
                { key: "zip", label: "ZIP code", pattern: "^\\d{5}(-\\d{4})?$" },
                { key: "city_state", label: "City / State" },
              ],
              briefMapping: {
                section: "confirmedInformation",
                label: "Location",
                category: "Prospect",
                format: "raw",
              },
            },
          ],
        },
        {
          id: "contact",
          title: "Contact details and consent",
          why: "The business needs permission to review and respond to the project request.",
          fields: [
            {
              key: "name",
              label: "Name",
              type: "text",
              desirability: "required",
              briefMapping: {
                section: "confirmedInformation",
                label: "Name",
                category: "Prospect",
                format: "raw",
              },
            },
            {
              key: "email",
              label: "Email",
              type: "text",
              desirability: "required",
              pattern: "^\\S+@\\S+\\.\\S+$",
              briefMapping: {
                section: "confirmedInformation",
                label: "Email",
                category: "Prospect",
                format: "raw",
              },
            },
            {
              key: "phone",
              label: "Phone",
              type: "text",
              desirability: "recommended",
              missingMessage: "Phone number was not provided.",
              briefMapping: {
                section: "confirmedInformation",
                label: "Phone",
                category: "Prospect",
                format: "raw",
              },
            },
            {
              key: "preferredContact",
              label: "Preferred contact",
              type: "single_choice",
              desirability: "optional",
              options: ["Email", "Phone", "Text", "No preference"].map(choice),
              briefMapping: {
                section: "confirmedInformation",
                label: "Preferred contact",
                category: "Prospect",
                format: "raw",
              },
            },
            {
              key: "consent",
              label: "I consent to sharing this demo request for review and follow-up.",
              type: "consent",
              desirability: "required",
              consentText: "I consent to sharing this demo request for review and follow-up.",
            },
          ],
        },
      ],
    },
  ],
  validationRules: [],
  briefConfig: {
    statusLabel: "Deck project brief",
    summaryFragments: [
      { template: "{{projectType}}" },
      {
        template: "for a {{propertyType|lower}}",
        when: { all: [{ fieldKey: "propertyType", operator: "is_not_empty" }] },
      },
      {
        template: "around {{computedArea}}",
        when: {
          any: [
            { fieldKey: "length", operator: "is_not_empty" },
            { fieldKey: "totalArea", operator: "is_not_empty" },
          ],
        },
      },
      {
        template: "with dimensions still unclear",
        when: {
          all: [
            { fieldKey: "length", operator: "is_empty" },
            { fieldKey: "totalArea", operator: "is_empty" },
          ],
        },
      },
      {
        template: "with interest in {{desiredMaterial|lower}}",
        when: { all: [{ fieldKey: "desiredMaterial", operator: "is_not_empty" }] },
      },
    ],
    emptySummaryFallback: "Deck project inquiry with limited information.",
    calculatedFields: [
      {
        key: "computedArea",
        section: "assumptionsAndCalculated",
        label: "Approximate area",
        category: "Project details",
        compute: { op: "multiply", inputs: ["length", "width"], unit: "sq ft" },
        fallbackFieldKey: "totalArea",
        onMissingLabel: "Exact dimensions",
        onMissingValue: "Approximate dimensions were not confirmed.",
      },
    ],
    derivedLines: [
      {
        id: "access-limitations",
        section: "constraints",
        when: {
          all: [{ fieldKey: "heightAccess", operator: "includes", value: "Access limitations" }],
        },
        label: "Access",
        value: "Visitor reported access limitations.",
        source: "deterministic_rule",
      },
      {
        id: "project-scope-unsure",
        section: "constraints",
        when: { all: [{ fieldKey: "projectType", operator: "equals", value: "Not sure" }] },
        label: "Project scope",
        value: "Visitor is unsure which deck project type fits.",
        source: "deterministic_rule",
      },
      {
        id: "fast-timeline",
        section: "constraints",
        when: { all: [{ fieldKey: "timeline", operator: "equals", value: "As soon as possible" }] },
        label: "Timing",
        value: "Fast timeline should be confirmed before promising availability.",
        source: "deterministic_rule",
      },
    ],
    alwaysIncludeLines: [
      {
        section: "missingInformation",
        label: "Permits",
        value: "Permit requirements were not assessed in this demo.",
      },
      {
        section: "missingInformation",
        label: "Structural condition",
        value: "Existing structure condition requires human review.",
      },
    ],
    suggestedNextActions: [
      {
        label: "Suggested next action",
        value:
          "Confirm dimensions and site constraints, then schedule a site visit before preparing a detailed estimate.",
      },
    ],
  },
};
