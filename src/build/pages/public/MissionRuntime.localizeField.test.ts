import { describe, expect, it } from "vitest";
import type {
  AddressField,
  BudgetField,
  ConsentField,
  SingleChoiceField,
} from "@/build/schema/playbook";
import { localizeField } from "./MissionRuntime";

const upper = (text: string) => text.toUpperCase();

describe("localizeField", () => {
  it("localizes an option's reassurance, not just its label", () => {
    const field: SingleChoiceField = {
      key: "intent",
      label: "What do you want to do?",
      type: "single_choice",
      desirability: "required",
      options: [
        { value: "repair", label: "Repair it", reassurance: "The book is tired." },
        { value: "other", label: "Other" },
      ],
    };
    const localized = localizeField(field, upper) as SingleChoiceField;
    expect(localized.options[0].reassurance).toBe("THE BOOK IS TIRED.");
    expect(localized.options[0].label).toBe("REPAIR IT");
    // An option with no reassurance stays exactly that — no stray key added.
    expect(localized.options[1]).not.toHaveProperty("reassurance");
  });
  it("localizes address components (ZIP code / City-State sub-labels)", () => {
    const field: AddressField = {
      key: "address",
      label: "Address",
      type: "address",
      desirability: "required",
      components: [
        { key: "zip", label: "ZIP code" },
        { key: "city_state", label: "City, State" },
      ],
    };
    const localized = localizeField(field, upper) as AddressField;
    expect(localized.components.map((c) => c.label)).toEqual(["ZIP CODE", "CITY, STATE"]);
  });

  it("localizes budget ranges (ranges mode, not options)", () => {
    const field: BudgetField = {
      key: "budget",
      label: "Budget",
      type: "budget",
      desirability: "required",
      currency: "USD",
      mode: "ranges",
      ranges: [{ value: "low", label: "Under $5,000" }],
    };
    const localized = localizeField(field, upper) as BudgetField;
    expect(localized.ranges?.[0].label).toBe("UNDER $5,000");
  });

  it("localizes consent field agreement text", () => {
    const field: ConsentField = {
      key: "consent",
      label: "Consent",
      type: "consent",
      consentText: "I agree to be contacted",
      desirability: "required",
    };
    const localized = localizeField(field, upper) as ConsentField;
    expect(localized.consentText).toBe("I AGREE TO BE CONTACTED");
  });
});
