// Pure matching between a detected business type/product and the Playbooks
// already published. Deliberately simple (word-overlap scoring against the
// existing `project_type` free-text field) — no new "variant" concept, no
// Playbook generation. If nothing scores above zero, the caller must show
// an explicit "no match yet" state rather than picking one arbitrarily.

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

function scoreProjectType(projectType: string, query: string): number {
  const typeWords = new Set(normalizeWords(projectType));
  if (typeWords.size === 0) return 0;
  const queryWords = normalizeWords(query);
  let score = 0;
  for (const word of queryWords) {
    if (typeWords.has(word)) score += 1;
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
    if (!playbook.project_type) continue;
    const score = scoreProjectType(playbook.project_type, query);
    if (score > 0 && (!best || score > best.score)) {
      best = { playbook, score };
    }
  }
  return best;
}
