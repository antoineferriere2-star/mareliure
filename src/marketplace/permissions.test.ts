import { describe, expect, it } from "vitest";
import { canViewCase, caseDisclosure, type CaseAccessFacts, type Viewer } from "./permissions";

const FACTS: CaseAccessFacts = {
  invitedBinderIds: ["binder-a", "binder-b"],
  selectedBinderId: null,
  customerEmail: "Marie@Example.com",
};

const ADMIN: Viewer = { role: "admin" };
const INVITED: Viewer = { role: "binder", binderId: "binder-a" };
const STRANGER: Viewer = { role: "binder", binderId: "binder-z" };
const CUSTOMER: Viewer = { role: "customer", email: "marie@example.com" };

describe("who may open a case", () => {
  it("lets the admin in", () => {
    expect(canViewCase(ADMIN, FACTS)).toBe(true);
  });

  it("lets in a relieur who was invited to this case", () => {
    expect(canViewCase(INVITED, FACTS)).toBe(true);
  });

  it("keeps out a relieur who was not", () => {
    // The whole reason build_dossiers stays service-role only: guessing a case
    // id must get you nothing.
    expect(canViewCase(STRANGER, FACTS)).toBe(false);
  });

  it("lets in the customer, matching the address case-insensitively", () => {
    expect(canViewCase(CUSTOMER, FACTS)).toBe(true);
    expect(canViewCase({ role: "customer", email: "  MARIE@EXAMPLE.COM " }, FACTS)).toBe(true);
  });

  it("keeps out another customer", () => {
    expect(canViewCase({ role: "customer", email: "paul@example.com" }, FACTS)).toBe(false);
  });

  it("keeps out a case with no customer e-mail rather than letting everyone in", () => {
    expect(canViewCase(CUSTOMER, { ...FACTS, customerEmail: null })).toBe(false);
  });

  it("keeps out anonymous visitors", () => {
    expect(canViewCase({ role: "anonymous" }, FACTS)).toBe(false);
  });

  it("still lets in the chosen relieur once the invitation list has moved on", () => {
    expect(
      canViewCase(STRANGER, {
        ...FACTS,
        invitedBinderIds: [],
        selectedBinderId: "binder-z",
      }),
    ).toBe(true);
  });
});

describe("how much of the case each viewer sees", () => {
  it("gives an invited relieur the project without the customer", () => {
    expect(caseDisclosure(INVITED, FACTS)).toBe("project_only");
  });

  it("gives contact details only once the customer has chosen that relieur", () => {
    expect(caseDisclosure(INVITED, { ...FACTS, selectedBinderId: "binder-a" })).toBe("full");
    expect(caseDisclosure(INVITED, { ...FACTS, selectedBinderId: "binder-b" })).toBe(
      "project_only",
    );
  });

  it("gives the admin and the customer everything", () => {
    expect(caseDisclosure(ADMIN, FACTS)).toBe("full");
    expect(caseDisclosure(CUSTOMER, FACTS)).toBe("full");
  });

  it("gives nothing to someone who may not view the case at all", () => {
    expect(caseDisclosure(STRANGER, FACTS)).toBe("none");
    expect(caseDisclosure({ role: "anonymous" }, FACTS)).toBe("none");
  });
});
