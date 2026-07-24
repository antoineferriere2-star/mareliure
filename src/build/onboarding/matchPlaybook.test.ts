import { describe, expect, it } from "vitest";
import { matchPlaybookForProduct, type PlaybookCandidate } from "./matchPlaybook";

const deckPlaybook: PlaybookCandidate = { id: "deck-1", name: "Terrasse / Deck — v1", project_type: "deck" };
const roofingPlaybook: PlaybookCandidate = { id: "roof-1", name: "Toiture — v1", project_type: "toiture" };
const noTypePlaybook: PlaybookCandidate = { id: "notype-1", name: "Ancien Playbook", project_type: null };

describe("matchPlaybookForProduct", () => {
  it("matches on an exact word overlap with project_type", () => {
    const match = matchPlaybookForProduct("Deck Builder", "New Deck", [deckPlaybook, roofingPlaybook]);
    expect(match?.playbook.id).toBe("deck-1");
    expect(match?.score).toBeGreaterThan(0);
  });

  it("matches on a partial word overlap, case- and accent-insensitive", () => {
    const match = matchPlaybookForProduct("Entreprise de Toiture", "Réfection de toiture", [
      deckPlaybook,
      roofingPlaybook,
    ]);
    expect(match?.playbook.id).toBe("roof-1");
  });

  it("returns null when nothing scores above zero", () => {
    const match = matchPlaybookForProduct("Plombier", "Réparation de fuite", [deckPlaybook, roofingPlaybook]);
    expect(match).toBeNull();
  });

  it("returns null when neither the name nor project_type overlap the query, even without a project_type", () => {
    const match = matchPlaybookForProduct("Deck Builder", "New Deck", [noTypePlaybook]);
    expect(match).toBeNull();
  });

  it("picks the highest-scoring playbook when several could match", () => {
    const strongerDeck: PlaybookCandidate = {
      id: "deck-2",
      name: "Deck complet",
      project_type: "deck terrasse extension",
    };
    const match = matchPlaybookForProduct("Deck Builder", "Deck Terrasse Extension", [deckPlaybook, strongerDeck]);
    expect(match?.playbook.id).toBe("deck-2");
  });

  it("matches via the Playbook's display name when project_type alone would miss (real validation case: French site content vs English project_type)", () => {
    const match = matchPlaybookForProduct("Fabricant de bois composite", "Terrasse en bois composite", [
      deckPlaybook,
      roofingPlaybook,
    ]);
    expect(match?.playbook.id).toBe("deck-1");
  });

  it("still matches by name alone when project_type is null", () => {
    const frenchNamedOnly: PlaybookCandidate = { id: "fence-1", name: "Clôture composite — v1", project_type: null };
    const match = matchPlaybookForProduct("Fabricant de clôtures", "Clôture composite", [frenchNamedOnly]);
    expect(match?.playbook.id).toBe("fence-1");
  });
});
