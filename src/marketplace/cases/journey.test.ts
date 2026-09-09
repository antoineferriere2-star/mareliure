import { describe, expect, it } from "vitest";
import { CASE_JOURNEY, visibleJourney } from "./journey";

describe("le parcours que le client suit", () => {
  /**
   * La règle qui compte : une étape dont la brique produit n'existe pas ne
   * doit jamais apparaître, quel que soit l'état du dossier. Annoncer « Le
   * voyage de votre livre » à quelqu'un qui ne peut ni payer ni expédier,
   * c'est promettre un service qui n'existe pas.
   */
  it("n'affiche jamais une étape indisponible", () => {
    const indisponibles = CASE_JOURNEY.filter((s) => !s.available).map((s) => s.id);
    expect(indisponibles).toEqual(["order", "travel"]);

    for (const status of ["under_review", "binder_selected", "paid", "delivered", "completed"]) {
      const ids = visibleJourney(status).map((s) => s.id);
      for (const cachee of indisponibles) expect(ids).not.toContain(cachee);
    }
  });

  it("montre les trois étapes qui existent, dans l'ordre", () => {
    expect(visibleJourney("under_review").map((s) => s.id)).toEqual([
      "project",
      "estimate",
      "workshop",
    ]);
  });

  it("marque comme atteint ce qui l'est réellement", () => {
    const debut = visibleJourney("under_review");
    expect(debut.map((s) => s.done)).toEqual([true, false, false]);

    const prix = visibleJourney("matching");
    expect(prix.map((s) => s.done)).toEqual([true, true, false]);

    const atelier = visibleJourney("binder_selected");
    expect(atelier.map((s) => s.done)).toEqual([true, true, true]);
  });

  /**
   * Un statut que le parcours ne connaît pas ne doit pas faire disparaître la
   * page : il rend simplement les étapes comme non atteintes.
   */
  it("ne casse pas sur un statut hérité", () => {
    const legacy = visibleJourney("quotes_received");
    expect(legacy).toHaveLength(3);
    expect(legacy.every((s) => s.done === false)).toBe(true);
  });

  it("donne à chaque étape les deux textes qu'elle peut avoir à afficher", () => {
    for (const stage of CASE_JOURNEY) {
      expect(stage.reached.length).toBeGreaterThan(15);
      expect(stage.upcoming.length).toBeGreaterThan(15);
    }
  });
});
