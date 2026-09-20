/**
 * La recherche dans le référentiel — locale, pure, sans dépendance, instantanée à cette échelle
 * (≈ 190 entrées) et sans rien de lourd à changer à quelques milliers d'entrées : l'index est un
 * tableau de jeux de mots pré-normalisés, un score par champ.
 *
 * Normalisation : accents, casse, apostrophes typographiques (`’` → `'` : 644 dans les données, un
 * relieur tape `'`), ponctuation, pluriels simples (`nerfs` = `nerf`). Le relieur trouve « nerf » sans
 * savoir comment l'entrée s'écrit.
 *
 * Ce qui n'est JAMAIS cherché comme une prestation : les ajustements (majoration, remise), les choix de
 * matériau (« Choix de cuir »), la ligne générique « sur devis » et les entrées inactives. « cuir » ne
 * ramène donc jamais un matériau.
 */
import { isImportable, type ReferenceOperation } from "./types";

const STOP_WORDS = new Set(["de", "du", "des", "la", "le", "les", "un", "une", "au", "aux", "en", "et", "sur", "sous", "pour", "par", "avec", "d", "l"]);

/** Sans accents ni casse ; `’` → `'` ; ponctuation → espace. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pluriel simple : `nerfs` → `nerf`, `coiffes` → `coiffe`. Appliqué des DEUX côtés, donc toujours cohérent. */
const stem = (word: string): string => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word);

const words = (normalized: string): string[] => normalized.split(/[ ']+/).filter(Boolean).map(stem);

/** Les mots de la requête qui portent un sens (sans mots vides ni lettres seules). */
export const queryTokens = (query: string): string[] =>
  normalizeSearch(query)
    .split(/[ ']+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);

type Field = "name" | "customerName" | "synonym" | "keyword" | "category";
const WEIGHT: Record<Field, number> = { name: 100, customerName: 90, synonym: 60, keyword: 40, category: 10 };
const PREFIX_FACTOR = 0.8;

interface Indexed {
  operation: ReferenceOperation;
  nameNorm: string;
  customerNorm: string | null;
  synonymNorms: string[];
  fields: Record<Field, Set<string>>;
}

export interface ReferenceSearchIndex {
  readonly entries: readonly Indexed[];
}

export interface ReferenceHit {
  operation: ReferenceOperation;
  score: number;
  /** Où la requête a été trouvée en premier — utile pour dire « trouvé via le synonyme … ». */
  matchedIn: Field;
}

/**
 * Construit l'index. Seules les entrées IMPORTABLES (active + operation / package / diagnostic) y entrent :
 * c'est la barrière qui garde ajustements, matériaux et entrées inactives hors de la recherche.
 */
export function buildSearchIndex(operations: readonly ReferenceOperation[], domainLabels: Record<string, string> = {}): ReferenceSearchIndex {
  const entries = operations.filter(isImportable).map((operation): Indexed => {
    const nameNorm = normalizeSearch(operation.canonicalName);
    const customerNorm = operation.customerName ? normalizeSearch(operation.customerName) : null;
    const synonymNorms = operation.synonyms.map(normalizeSearch);
    const set = (texts: string[]) => new Set(texts.flatMap((t) => words(normalizeSearch(t))));
    return {
      operation,
      nameNorm,
      customerNorm,
      synonymNorms,
      fields: {
        name: set([operation.canonicalName]),
        customerName: set(operation.customerName ? [operation.customerName] : []),
        synonym: set(operation.synonyms),
        keyword: set(operation.searchKeywords),
        category: set([domainLabels[operation.domain] ?? operation.domain.replace(/_/g, " "), operation.family, operation.subfamily]),
      },
    };
  });
  return { entries };
}

/** 0 : rien ; sinon le poids du meilleur champ, réduit si le mot n'est qu'un début de mot. */
function tokenScore(token: string, entry: Indexed): { score: number; field: Field } {
  let best = { score: 0, field: "name" as Field };
  for (const field of Object.keys(WEIGHT) as Field[]) {
    const set = entry.fields[field];
    let s = 0;
    if (set.has(token)) s = WEIGHT[field];
    else if (token.length >= 3) for (const w of set) if (w.startsWith(token)) { s = WEIGHT[field] * PREFIX_FACTOR; break; }
    if (s > best.score) best = { score: s, field };
  }
  return best;
}

export function searchReference(index: ReferenceSearchIndex, query: string, options: { limit?: number } = {}): ReferenceHit[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const whole = normalizeSearch(query);
  const hits: ReferenceHit[] = [];
  for (const entry of index.entries) {
    let total = 0;
    let first: { score: number; field: Field } | null = null;
    let matchedAll = true;
    for (const token of tokens) {
      const t = tokenScore(token, entry);
      if (t.score === 0) { matchedAll = false; break; }
      total += t.score;
      if (!first || t.score > first.score) first = t;
    }
    if (!matchedAll || !first) continue;
    if (entry.nameNorm === whole) total += 300;
    else if (entry.customerNorm === whole) total += 280;
    else if (entry.synonymNorms.includes(whole)) total += 250;
    if (entry.nameNorm.startsWith(whole)) total += 120;
    else if (entry.nameNorm.includes(whole)) total += 60;
    else if (entry.synonymNorms.some((s) => s.includes(whole))) total += 30;
    hits.push({ operation: entry.operation, score: total, matchedIn: first.field });
  }
  hits.sort((a, b) => b.score - a.score || a.operation.canonicalName.localeCompare(b.operation.canonicalName, "fr") || a.operation.key.localeCompare(b.operation.key));
  return options.limit ? hits.slice(0, options.limit) : hits;
}

// ---------------------------------------------------------------------------
// Le catalogue de l'atelier (préparé pour PR 2b : « Mes prestations » d'abord, référentiel ensuite)
// ---------------------------------------------------------------------------

export interface SearchableService {
  name: string;
  description: string | null;
  referenceOperationKey: string | null;
}

/**
 * Cherche dans les prestations de l'atelier : son nom, sa description ET les synonymes de l'opération
 * liée (« titrage » retrouve sa prestation « Dorure titre » liée à « Dorure sur pièce de titre »).
 * Une prestation personnelle (sans lien) se cherche par son seul nom et sa description.
 */
export function searchServices<T extends SearchableService>(
  services: readonly T[],
  query: string,
  lookup: (key: string) => ReferenceOperation | undefined = () => undefined,
): T[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const scored: { service: T; score: number; order: number }[] = [];
  services.forEach((service, order) => {
    const linked = service.referenceOperationKey ? lookup(service.referenceOperationKey) : undefined;
    const own = new Set(words(normalizeSearch(service.name)));
    const description = new Set(words(normalizeSearch(service.description ?? "")));
    const reference = new Set(
      linked ? [linked.canonicalName, linked.customerName ?? "", ...linked.synonyms, ...linked.searchKeywords].flatMap((t) => words(normalizeSearch(t))) : [],
    );
    let total = 0;
    for (const token of tokens) {
      const pick = (set: Set<string>, weight: number) => (set.has(token) ? weight : token.length >= 3 && [...set].some((w) => w.startsWith(token)) ? weight * PREFIX_FACTOR : 0);
      const s = Math.max(pick(own, 100), pick(description, 40), pick(reference, 30));
      if (s === 0) return;
      total += s;
    }
    scored.push({ service, score: total, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.service);
}
