/**
 * Qui voit un projet, et qui entre dans son fil.
 *
 * Les scénarios que le brief exige de tester : un atelier sollicité puis non
 * retenu perd l'accès, un client ne lit jamais le dossier d'un autre, un
 * atelier jamais celui d'un autre, et Ma Reliure voit ce qui est nécessaire.
 */
import { describe, expect, it } from "vitest";
import {
  binderAccessFacts,
  canViewCase,
  caseDisclosure,
  projectThreadAccess,
  type Viewer,
} from "../permissions";

const OWNER = "user-marie";
const ADMIN: Viewer = { role: "admin" };
const CUSTOMER: Viewer = { role: "customer", userId: OWNER };
const OTHER_CUSTOMER: Viewer = { role: "customer", userId: "user-paul" };
const MARTIN: Viewer = { role: "binder", binderId: "binder-martin" };
const DUVAL: Viewer = { role: "binder", binderId: "binder-duval" };

const facts = (matches: { binderId: string; state: string }[]) =>
  binderAccessFacts({ matches, customerUserId: OWNER });

describe("un atelier ne voit un projet que tant que sa sollicitation est en cours", () => {
  it("voit le projet quand l'offre est envoyée ou acceptée", () => {
    expect(canViewCase(MARTIN, facts([{ binderId: "binder-martin", state: "offered" }]))).toBe(
      true,
    );
    expect(canViewCase(MARTIN, facts([{ binderId: "binder-martin", state: "accepted" }]))).toBe(
      true,
    );
  });

  it("perd l'accès après un refus, une expiration ou une clôture", () => {
    for (const state of ["declined", "expired", "cancelled"])
      expect(canViewCase(MARTIN, facts([{ binderId: "binder-martin", state }])), state).toBe(false);
  });

  it("perd l'accès quand un autre atelier est retenu, même s'il avait accepté", () => {
    const afterSelection = facts([
      { binderId: "binder-martin", state: "selected" },
      { binderId: "binder-duval", state: "accepted" },
    ]);
    expect(canViewCase(DUVAL, afterSelection)).toBe(false);
    expect(caseDisclosure(DUVAL, afterSelection)).toBe("none");
    expect(canViewCase(MARTIN, afterSelection)).toBe(true);
    expect(caseDisclosure(MARTIN, afterSelection)).toBe("assigned");
  });

  it("ne voit jamais le projet d'un autre atelier", () => {
    expect(canViewCase(DUVAL, facts([{ binderId: "binder-martin", state: "offered" }]))).toBe(
      false,
    );
  });
});

describe("le fil d'un projet", () => {
  const selected = facts([
    { binderId: "binder-martin", state: "selected" },
    { binderId: "binder-duval", state: "cancelled" },
  ]);

  it("n'existe pas avant qu'un atelier soit retenu — pour personne", () => {
    const beforeSelection = {
      ...facts([{ binderId: "binder-martin", state: "accepted" }]),
      status: "binder_accepted",
    };
    for (const viewer of [ADMIN, CUSTOMER, MARTIN])
      expect(projectThreadAccess(viewer, beforeSelection)).toBe("none");
  });

  it("s'ouvre en écriture au client propriétaire, à l'atelier retenu et à Ma Reliure", () => {
    for (const status of [
      "binder_selected",
      "paid",
      "received_by_binder",
      "in_progress",
      "work_finished",
    ]) {
      const current = { ...selected, status };
      expect(projectThreadAccess(CUSTOMER, current), status).toBe("write");
      expect(projectThreadAccess(MARTIN, current), status).toBe("write");
      expect(projectThreadAccess(ADMIN, current), status).toBe("write");
    }
  });

  it("reste fermé à tout autre client et à l'atelier non retenu", () => {
    const current = { ...selected, status: "in_progress" };
    expect(projectThreadAccess(OTHER_CUSTOMER, current)).toBe("none");
    expect(projectThreadAccess(DUVAL, current)).toBe("none");
    expect(projectThreadAccess({ role: "anonymous" }, current)).toBe("none");
  });

  it("reste lisible une fois le projet terminé : c'est l'archive du livre", () => {
    const done = { ...selected, status: "completed" };
    expect(projectThreadAccess(CUSTOMER, done)).toBe("read");
    expect(projectThreadAccess(MARTIN, done)).toBe("read");
    expect(projectThreadAccess(DUVAL, done)).toBe("none");
  });

  it("n'ouvre rien à un dossier que personne n'a rattaché", () => {
    const unclaimed = {
      ...binderAccessFacts({
        matches: [{ binderId: "binder-martin", state: "selected" }],
        customerUserId: null,
      }),
      status: "in_progress",
    };
    expect(projectThreadAccess(CUSTOMER, unclaimed)).toBe("none");
  });
});
