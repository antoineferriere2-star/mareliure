/**
 * Détecteur des tables créées sans décision explicite de droits (garde-fou de 20261020100000).
 *
 * Lecture du SQL instruction par instruction, jamais par recherche de texte brut (revue #147) :
 * commentaires et chaînes sont retirés avant l'analyse, les identifiants cités sont normalisés,
 * les renommages sont suivis et un GRANT/REVOKE ne compte que pour le nom exact qu'il désigne.
 * Une création non comprise est signalée plutôt qu'ignorée.
 */
const IDENT = String.raw`[a-z_][a-z0-9_$]*`;
const QUALIFIED = String.raw`(?:(${IDENT})\s*\.\s*)?(${IDENT})`;

interface Lexed { sql: string; serviceOnly: Set<string>; dynamic: boolean }

/** Retire commentaires, chaînes et corps `$…$` ; normalise la casse et les identifiants cités. */
function lex(source: string): Lexed {
  const serviceOnly = new Set<string>();
  let dynamic = false;
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "-" && next === "-") {
      const end = source.indexOf("\n", i);
      const line = source.slice(i, end < 0 ? source.length : end);
      const marker = /^--\s*acl:\s*service-only\s+(.+)$/i.exec(line);
      if (marker) for (const name of marker[1].split(/[\s,]+/)) if (name) serviceOnly.add(bareName(name));
      i = end < 0 ? source.length : end;
      continue;
    }
    if (c === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < source.length && depth > 0) {
        if (source.startsWith("/*", i)) { depth += 1; i += 2; }
        else if (source.startsWith("*/", i)) { depth -= 1; i += 2; }
        else i += 1;
      }
      out += " ";
      continue;
    }
    if (c === "'") {
      const escapes = /e$/i.test(out) && !/[a-z0-9_$]e$/i.test(out);
      i += 1;
      while (i < source.length) {
        if (escapes && source[i] === "\\") { i += 2; continue; }
        if (source[i] === "'" && source[i + 1] === "'") { i += 2; continue; }
        if (source[i] === "'") { i += 1; break; }
        i += 1;
      }
      out += "''";
      continue;
    }
    if (c === "$" && !/[a-z0-9_$]$/i.test(out)) {
      const tag = /^\$(?:[a-z_][a-z0-9_]*)?\$/i.exec(source.slice(i));
      if (tag) {
        const close = source.indexOf(tag[0], i + tag[0].length);
        const body = source.slice(i + tag[0].length, close < 0 ? source.length : close);
        // Une table créée dans un bloc dynamique échappe à l'analyse : signalée, jamais ignorée.
        if (/\bcreate\s+(?!(?:global\s+|local\s+)?temp(?:orary)?\b)(?:\w+\s+)*?table\b/i.test(body)) dynamic = true;
        i = close < 0 ? source.length : close + tag[0].length;
        out += " $$ ";
        continue;
      }
    }
    if (c === '"') {
      const end = source.indexOf('"', i + 1);
      out += source.slice(i + 1, end < 0 ? source.length : end).toLowerCase();
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    out += c.toLowerCase();
    i += 1;
  }
  return { sql: out, serviceOnly, dynamic };
}

function bareName(name: string): string {
  return name.replace(/"/g, "").toLowerCase().replace(/^public\./, "");
}

/** Nom d'une table de `public` (schéma absent ou `public`), sinon null. */
function publicName(schema: string | undefined, table: string): string | null {
  return !schema || schema === "public" ? table : null;
}

export function undeclaredTables(source: string): string[] {
  const { sql, serviceOnly, dynamic } = lex(source);
  // Nom courant → décision explicite prise ; l'ordre des instructions compte (renommages).
  const tables = new Map<string, { declared: boolean; original: string }>();
  const unreadable: string[] = dynamic ? ["<création dans un bloc $…$>"] : [];
  const create = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:global|local)\s+)?(temp|temporary|unlogged)?\s*table\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`);
  const selectInto = new RegExp(String.raw`^select\b[\s\S]*?\binto\s+(?:(temp|temporary|unlogged)\s+)?(?:table\s+)?${QUALIFIED}`);
  const rename = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${QUALIFIED}\s+rename\s+to\s+(${IDENT})`);
  const grant = /^(?:grant|revoke)\b[\s\S]*?\bon\s+([\s\S]+?)\s+(?:to|from)\b/;

  for (const raw of sql.split(";")) {
    const statement = raw.trim().replace(/\s+/g, " ");
    if (!statement) continue;
    if (/^create\s+(?:\w+\s+)*?table\b/.test(statement)) {
      const m = create.exec(statement);
      if (!m) { unreadable.push(`<create table illisible : ${statement.slice(0, 60)}>`); continue; }
      if (m[1] === "temp" || m[1] === "temporary") continue;
      const name = publicName(m[2], m[3]);
      if (name) tables.set(name, { declared: false, original: name });
      continue;
    }
    const into = /^select\b/.test(statement) ? selectInto.exec(statement) : null;
    if (into) {
      if (into[1] === "temp" || into[1] === "temporary") continue;
      const name = publicName(into[2], into[3]);
      if (name) tables.set(name, { declared: false, original: name });
      continue;
    }
    const renamed = rename.exec(statement);
    if (renamed) {
      const from = publicName(renamed[1], renamed[2]);
      const entry = from ? tables.get(from) : undefined;
      if (from && entry) { tables.delete(from); tables.set(renamed[3], entry); }
      continue;
    }
    const granted = grant.exec(statement);
    if (granted) {
      const objects = granted[1].trim();
      if (/^all\s+tables\s+in\s+schema\b/.test(objects)) {
        if (/\bpublic\b/.test(objects)) for (const entry of tables.values()) entry.declared = true;
        continue;
      }
      if (/^(?:function|procedure|routine|sequence|schema|database|type|domain|language|large|foreign|tablespace|parameter|all\s)/.test(objects)) continue;
      for (const part of objects.replace(/^table\s+/, "").split(",")) {
        const m = new RegExp(String.raw`^\s*${QUALIFIED}\s*$`).exec(part);
        const name = m ? publicName(m[1], m[2]) : null;
        const entry = name ? tables.get(name) : undefined;
        if (entry) entry.declared = true;
      }
    }
  }
  const missing = [...tables.entries()]
    .filter(([name, entry]) => !entry.declared && !serviceOnly.has(name) && !serviceOnly.has(entry.original))
    .map(([name]) => name);
  return [...missing, ...unreadable];
}
