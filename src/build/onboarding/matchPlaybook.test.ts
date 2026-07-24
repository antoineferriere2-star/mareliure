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

  it("ignores playbooks without a project_type", () => {
    const match = matchPlaybookForProduct("Deck Builder", "New Deck", [noTypePlaybook]);
    expect(match).toBeNull();
  });

  it("picks the highest-scoring playbook when several could match", () => {
    const strongerDeck: PlaybookCandidate = { id: "deck-2", name: "Deck complet", project_type: "deck terrasse" };
    const match = matchPlaybookForProduct("Deck Builder", "Deck Terrasse", [deckPlaybook, strongerDeck]);
    expect(match?.playbook.id).toBe("deck-2");
  });
});
