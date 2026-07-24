// Pure matching between a detected business type/product and the Playbooks
// already published. Deliberately simple (word-overlap scoring against the
// Playbook's own project_type + name) — no new "variant" concept, no
// translation dictionary, no Playbook generation. If nothing scores above
// zero, the caller must show an explicit "no match yet" state rather than
// picking one arbitrarily.
//
// Matching against `name` in addition to `project_type` is deliberate: a
// real-world validation run (site content in French, "Terrasse en bois
// composite") failed to match the published "Terrasse / Deck — v1" Playbook
// because `project_type` was the single English word "deck" — the Playbook's
// own display name already carried the matching French word. Requiring an
// admin to also maintain a project_type/translation table in sync would be
// the more complex fix for the same result.

export interface PlaybookCandidate {
  id: string;
  name: string;
  project_type: string | null;
}

export interface PlaybookMatch {
  playbook: PlaybookCandidate;
  score: number;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function scoreAgainst(text: string, query: string): number {
  const textWords = new Set(normalizeWords(text));
  if (textWords.size === 0) return 0;
  // Dedupe query words too — otherwise a business type and product that
  // happen to repeat the same word (e.g. "Deck Builder" + "Deck Terrasse")
  // would inflate the score per occurrence instead of per distinct match.
  const queryWords = new Set(normalizeWords(query));
  let score = 0;
  for (const word of queryWords) {
    if (textWords.has(word)) score += 1;
  }
  return score;
}

/** Highest-scoring published Playbook for a confirmed business type + product, or null if none scores above zero. */
export function matchPlaybookForProduct(
  businessType: string,
  product: string,
  playbooks: PlaybookCandidate[],
): PlaybookMatch | null {
  const query = `${businessType} ${product}`;
  let best: PlaybookMatch | null = null;
  for (const playbook of playbooks) {
    const matchableText = [playbook.project_type, playbook.name].filter(Boolean).join(" ");
    const score = scoreAgainst(matchableText, query);
    if (score > 0 && (!best || score > best.score)) {
      best = { playbook, score };
    }
  }
  return best;
}
