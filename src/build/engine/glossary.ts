/**
 * Light contextual help for a trade's vocabulary.
 *
 * A visitor asked "does the spine still hold?" may not know what a spine is in
 * the binder's sense. The help is a short list of words, each with a plain
 * definition, shown under the step that actually uses them — not a glossary
 * page nobody opens, and not a tooltip on every label.
 *
 * The *entries* are data the deployment supplies (a Playbook's vocabulary is
 * its own business); this module only decides which of them a given step needs.
 * It never knows a word.
 */

export interface GlossaryEntry {
  /** The word as the visitor should see it. */
  term: string;
  /** One plain sentence, no jargon of its own. */
  definition: string;
  /**
   * Other spellings to look for (a plural that isn't `term` + s, a synonym).
   * `term` itself is always looked for.
   */
  aliases?: string[];
}

/** Lower-case, accent-free: "Étui" must find "etui" and "ÉTUI". */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The entries whose word appears, as a whole word, in any of `texts` — in the
 * order the glossary lists them, each once.
 *
 * Whole word, with an optional plural "s": "dos" is found in "Le dos du livre"
 * but not in "dossier". A term made of several words matches as a phrase.
 */
export function findGlossaryEntries(
  texts: readonly string[],
  glossary: readonly GlossaryEntry[],
): GlossaryEntry[] {
  const haystack = normalizeForMatch(texts.join(" \n "));
  return glossary.filter((entry) =>
    [entry.term, ...(entry.aliases ?? [])].some((word) => {
      const needle = normalizeForMatch(word).trim();
      if (!needle) return false;
      return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}s?($|[^a-z0-9])`).test(haystack);
    }),
  );
}
