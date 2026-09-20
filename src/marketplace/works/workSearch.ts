/**
 * Une recherche tolérante pour les listes de l'atelier (contacts, ouvrages) : sans accents, sans
 * casse, apostrophe droite ou typographique, ponctuation ignorée. « Misérables » se trouve avec
 * « miserables », « L'Assommoir » avec « l’assommoir ».
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tous les mots tapés doivent se retrouver (dans n'importe quel ordre) dans le texte cherché. */
export function matchesSearch(haystack: string, query: string): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeSearch(haystack);
  return words.every((word) => text.includes(word));
}
