// Auto-generates machine-safe identifiers (field keys, option values) from a
// human-entered label, so a non-technical author never has to type one by
// hand — while staying editable for anyone who wants to.
export function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    // After NFD, accented letters split into a base letter + a combining
    // diacritical mark; stripping marks leaves the plain ASCII base letter.
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "champ";
}

export function uniqueSlug(label: string, existing: string[]): string {
  const base = slugify(label);
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
