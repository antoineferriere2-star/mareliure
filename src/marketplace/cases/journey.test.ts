import { describe, expect, it } from "vitest";
import { CASE_JOURNEY, visibleJourney } from "./journey";
import { CASE_STATUSES } from "./state";

describe("le parcours que le client suit", () => {
  /**
   * La règle qui compte : une étape dont la brique produit n'existe pas ne
   * doit jamais apparaître, quel que soit l'état du dossier. Annoncer « Envoyé
   * à l'atelier » à quelqu'un dont le livre ne peut pas encore voyager par Ma
   * Reliure, c'est promettre un service qui n'existe pas.
   */
  it("n'affiche jamais une étape indisponible", () => {
    const indisponibles = CASE_JOURNEY.filter((s) => !s.available).map((s) => s.id);
    expect(indisponibles).toEqual(["travel", "return", "delivered"]);

    for (const status of CASE_STATUSES) {
      const ids = visibleJourney(status).map((s) => s.id);
      for (const cachee of indisponibles) expect(ids, status).not.toContain(cachee);
    }
  });

  it("montre les étapes qui existent, dans l'ordre", () => {
    expect(visibleJourney("under_review").map((s) => s.id)).toEqual([
      "project",
      "estimate",
      "workshop",
      "order",
      "received",
      "work",
      "finished",
    ]);
  });

  it("marque ce qui est franchi, ce qui est en cours et ce qui vient", () => {
    const states = (status: string) => visibleJourney(status).map((s) => s.state);
    expect(states("under_review")).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(states("matching")).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(states("binder_selected")).toEqual([
      "done",
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(states("received_by_binder")).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "current",
      "upcoming",
    ]);
    expect(states("work_finished")).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "done",
      "current",
    ]);
  });

  it("n'a jamais plus d'une étape en cours", () => {
    for (const status of CASE_STATUSES)
      expect(
        visibleJourney(status).filter((s) => s.state === "current").length,
        status,
      ).toBeLessThanOrEqual(1);
  });

  /**
   * Un statut que le parcours ne connaît pas ne doit pas faire disparaître la
   * page : il rend simplement les étapes comme à venir.
   */
  it("ne casse pas sur un statut hérité", () => {
    const legacy = visibleJourney("quotes_received");
    expect(legacy).toHaveLength(7);
    expect(legacy.every((s) => s.state === "upcoming")).toBe(true);
  });

  it("donne à chaque étape les deux textes qu'elle peut avoir à afficher", () => {
    for (const stage of CASE_JOURNEY) {
      expect(stage.reached.length).toBeGreaterThan(15);
      expect(stage.upcoming.length).toBeGreaterThan(15);
    }
  });
});
