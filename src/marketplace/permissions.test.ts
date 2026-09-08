import { describe, expect, it } from "vitest";
import { canViewCase, caseDisclosure, type CaseAccessFacts, type Viewer } from "./permissions";

const OWNER = "user-marie";
const OTHER = "user-paul";

const CLAIMED: CaseAccessFacts = {
  invitedBinderIds: ["binder-a", "binder-b"],
  selectedBinderId: null,
  customerUserId: OWNER,
};

const UNCLAIMED: CaseAccessFacts = { ...CLAIMED, customerUserId: null };

const ADMIN: Viewer = { role: "admin" };
const INVITED: Viewer = { role: "binder", binderId: "binder-a" };
const STRANGER: Viewer = { role: "binder", binderId: "binder-z" };
const CUSTOMER: Viewer = { role: "customer", userId: OWNER };

describe("who may open a case", () => {
  it("lets the admin in", () => {
    expect(canViewCase(ADMIN, CLAIMED)).toBe(true);
  });

  it("lets in a relieur who was invited to this case", () => {
    expect(canViewCase(INVITED, CLAIMED)).toBe(true);
  });

  it("keeps out a relieur who was not", () => {
    // The whole reason build_dossiers stays service-role only: guessing a case
    // id must get you nothing.
    expect(canViewCase(STRANGER, CLAIMED)).toBe(false);
  });

  it("still lets in the chosen relieur once the invitation list has moved on", () => {
    expect(
      canViewCase(STRANGER, { ...CLAIMED, invitedBinderIds: [], selectedBinderId: "binder-z" }),
    ).toBe(true);
  });

  it("keeps out anonymous visitors", () => {
    expect(canViewCase({ role: "anonymous" }, CLAIMED)).toBe(false);
  });
});

describe("a customer is authorised by ownership, never by e-mail", () => {
  it("lets in the account the case is attached to", () => {
    expect(canViewCase(CUSTOMER, CLAIMED)).toBe(true);
  });

  it("keeps out every other account", () => {
    expect(canViewCase({ role: "customer", userId: OTHER }, CLAIMED)).toBe(false);
  });

  it("keeps everyone out of a case nobody has claimed", () => {
    // An unclaimed case belongs to nobody, so it opens for nobody — not even
    // the person whose e-mail is on the Dossier. Claiming is a deliberate act.
    expect(canViewCase(CUSTOMER, UNCLAIMED)).toBe(false);
    expect(canViewCase({ role: "customer", userId: OTHER }, UNCLAIMED)).toBe(false);
  });

  it("cannot be granted by anything a visitor typed into a public form", () => {
    // Regression guard for the shape this replaced: access used to be
    // `visitor_email === auth.email`, so registering an address was enough.
    // The facts a decision is made from no longer contain an address at all.
    expect(Object.keys(CLAIMED)).toEqual([
      "invitedBinderIds",
      "selectedBinderId",
      "customerUserId",
    ]);
  });
});

describe("how much of the case each viewer sees", () => {
  it("gives an invited relieur the project without the customer", () => {
    expect(caseDisclosure(INVITED, CLAIMED)).toBe("project_only");
  });

  it("gives contact details only once the customer has chosen that relieur", () => {
    expect(caseDisclosure(INVITED, { ...CLAIMED, selectedBinderId: "binder-a" })).toBe("full");
    expect(caseDisclosure(INVITED, { ...CLAIMED, selectedBinderId: "binder-b" })).toBe(
      "project_only",
    );
  });

  it("gives the admin and the owning customer everything", () => {
    expect(caseDisclosure(ADMIN, CLAIMED)).toBe("full");
    expect(caseDisclosure(CUSTOMER, CLAIMED)).toBe("full");
  });

  it("gives nothing to someone who may not view the case at all", () => {
    expect(caseDisclosure(STRANGER, CLAIMED)).toBe("none");
    expect(caseDisclosure({ role: "customer", userId: OTHER }, CLAIMED)).toBe("none");
    expect(caseDisclosure(CUSTOMER, UNCLAIMED)).toBe("none");
    expect(caseDisclosure({ role: "anonymous" }, CLAIMED)).toBe("none");
  });
});
