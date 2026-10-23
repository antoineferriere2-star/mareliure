/**
 * Vérification du journal chaîné d'un émetteur, hors de la base (export d'archives, contrôle externe).
 * Format : docs/einvoicing/journal-format.md.
 *
 * Chaque entrée porte sa forme canonique (texte), l'empreinte de l'entrée précédente du même émetteur
 * (64 zéros pour la première) et sa propre empreinte : SHA-256, en hexadécimal, des octets UTF-8 de
 * `empreinte précédente + "\n" + forme canonique`.
 */
export const GENESIS_HASH = "0".repeat(64);

export interface JournalEntryText {
  seq: number;
  canonical: string;
  prevHash: string;
  hash: string;
}

export type JournalChainProblem =
  | { seq: number; problem: "seq_gap"; expected: number }
  | { seq: number; problem: "prev_hash_mismatch" }
  | { seq: number; problem: "hash_mismatch" };

export async function sha256HexOfText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const journalHash = (prevHash: string, canonical: string) => sha256HexOfText(`${prevHash}\n${canonical}`);

/**
 * Vérifie une suite d'entrées consécutives. `anchor` : l'empreinte de l'entrée qui précède la première
 * (un export par période ne contient pas tout le journal) ; à défaut, la suite doit commencer au rang 1.
 */
export async function verifyJournalChain(
  entries: readonly JournalEntryText[],
  anchor: { seq: number; hash: string } = { seq: 0, hash: GENESIS_HASH },
): Promise<{ ok: boolean; problems: JournalChainProblem[] }> {
  const problems: JournalChainProblem[] = [];
  let expected = anchor.seq + 1;
  let prev = anchor.hash;
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    if (entry.seq !== expected) problems.push({ seq: entry.seq, problem: "seq_gap", expected });
    if (entry.prevHash !== prev) problems.push({ seq: entry.seq, problem: "prev_hash_mismatch" });
    if ((await journalHash(entry.prevHash, entry.canonical)) !== entry.hash) problems.push({ seq: entry.seq, problem: "hash_mismatch" });
    prev = entry.hash;
    expected = entry.seq + 1;
  }
  return { ok: problems.length === 0, problems };
}
