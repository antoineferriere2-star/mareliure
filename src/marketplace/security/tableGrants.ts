/**
 * Détecteur des tables créées sans décision explicite de droits (garde-fou de 20261020100000).
 *
 * Lecture du SQL instruction par instruction, jamais par recherche de texte brut (revues #147, #152) :
 * commentaires et chaînes sont retirés avant l'analyse, les identifiants cités gardent leur nom exact
 * (casse comprise), les renommages et changements de schéma sont suivis, et un GRANT/REVOKE ne compte
 * que pour la relation exacte qu'il désigne. Une création non comprise ou dynamique est signalée plutôt
 * qu'ignorée ; le marqueur `-- acl: dynamic-reviewed` lève ce signal pour un fichier relu à la main.
 */
const IDENT = String.raw`(?:[\p{L}_][\p{L}\p{N}_$]*|qid\d+)`;
const QUALIFIED = String.raw`(?:(${IDENT})\s*\.\s*)?(${IDENT})`;

interface Lexed { sql: string; quoted: string[]; serviceOnly: Set<string>; dynamic: boolean }

/** PostgreSQL ne replie que l'ASCII des identifiants non cités. */
const fold = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** Une chaîne ou un corps `$…$` qui, mis bout à bout, parle de créer une table non temporaire. */
function createsTable(literals: string): boolean {
  return /\bcreate\b/i.test(literals) && /\btable\b/i.test(literals) && !/\btemp(?:orary)?\s+table\b/i.test(literals);
}

/** Retire commentaires, chaînes et corps `$…$` ; remplace chaque identifiant cité par un jeton `qidN`. */
function lex(source: string): Lexed {
  const serviceOnly = new Set<string>();
  const quoted: string[] = [];
  let dynamic = false;
  let reviewed = false;
  let out = "";
  let literals = "";
  let i = 0;
  const endStatement = () => { if (createsTable(literals)) dynamic = true; literals = ""; };
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "-" && next === "-") {
      const end = source.indexOf("\n", i);
      const line = source.slice(i, end < 0 ? source.length : end);
      const marker = /^--\s*acl:\s*service-only\s+(.+)$/i.exec(line);
      if (marker) for (const name of marker[1].split(/[\s,]+/)) if (name) serviceOnly.add(fold(name.replace(/"/g, "")).replace(/^public\./, ""));
      if (/^--\s*acl:\s*dynamic-reviewed\b/i.test(line)) reviewed = true;
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
      const escapes = /e$/i.test(out) && !/[\p{L}\p{N}_$]e$/iu.test(out);
      const start = i + 1;
      i += 1;
      while (i < source.length) {
        if (escapes && source[i] === "\\") { i += 2; continue; }
        if (source[i] === "'" && source[i + 1] === "'") { i += 2; continue; }
        if (source[i] === "'") { i += 1; break; }
        i += 1;
      }
      literals += ` ${source.slice(start, i - 1)}`;
      out += "''";
      continue;
    }
    if (c === "$" && !/[\p{L}\p{N}_$]$/u.test(out)) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(i));
      if (tag) {
        const close = source.indexOf(tag[0], i + tag[0].length);
        literals += ` ${source.slice(i + tag[0].length, close < 0 ? source.length : close)}`;
        i = close < 0 ? source.length : close + tag[0].length;
        out += " $$ ";
        continue;
      }
    }
    if (c === '"') {
      let name = "";
      i += 1;
      while (i < source.length) {
        if (source[i] === '"' && source[i + 1] === '"') { name += '"'; i += 2; continue; }
        if (source[i] === '"') { i += 1; break; }
        name += source[i];
        i += 1;
      }
      quoted.push(name);
      out += ` qid${quoted.length - 1} `;
      continue;
    }
    if (c === ";") endStatement();
    out += fold(c);
    i += 1;
  }
  endStatement();
  return { sql: out, quoted, serviceOnly, dynamic: dynamic && !reviewed };
}

export function undeclaredTables(source: string): string[] {
  const { sql, quoted, serviceOnly, dynamic } = lex(source);
  const name = (raw: string) => (/^qid\d+$/.test(raw) ? quoted[Number(raw.slice(3))] : raw);
  const schemaOf = (raw: string | undefined) => (raw ? name(raw) : "public");
  // Clé « schéma.nom » → décision explicite prise ; l'ordre des instructions compte.
  const tables = new Map<string, { declared: boolean; original: string }>();
  const unreadable: string[] = dynamic ? ["<création dynamique (EXECUTE, DO, format) à déclarer>"] : [];
  const create = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:global|local)\s+)?(temp|temporary|unlogged)?\s*table\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`, "u");
  const selectInto = new RegExp(String.raw`^select\b[\s\S]*?\binto\s+(?:(temp|temporary|unlogged)\s+)?(?:table\s+)?${QUALIFIED}`, "u");
  const alter = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${QUALIFIED}\s+(rename\s+to|set\s+schema)\s+(${IDENT})`, "u");
  const grant = /^(?:grant|revoke)\b[\s\S]*?\bon\s+([\s\S]+?)\s+(?:to|from)\b/u;
  const target = new RegExp(String.raw`^\s*${QUALIFIED}\s*$`, "u");
  const add = (schema: string, table: string) => tables.set(`${schema}.${table}`, { declared: false, original: table });

  for (const raw of sql.split(";")) {
    const statement = raw.trim().replace(/\s+/g, " ");
    if (!statement) continue;
    if (/^create\s+(?:\w+\s+)*?table\b/u.test(statement)) {
      const m = create.exec(statement);
      if (!m) { unreadable.push(`<create table illisible : ${statement.slice(0, 60)}>`); continue; }
      if (m[1] !== "temp" && m[1] !== "temporary") add(schemaOf(m[2]), name(m[3]));
      continue;
    }
    const into = /^select\b/u.test(statement) ? selectInto.exec(statement) : null;
    if (into) {
      if (into[1] !== "temp" && into[1] !== "temporary") add(schemaOf(into[2]), name(into[3]));
      continue;
    }
    const altered = alter.exec(statement);
    if (altered) {
      const schema = schemaOf(altered[1]);
      const table = name(altered[2]);
      const known = tables.get(`${schema}.${table}`);
      const rename = /^rename/u.test(altered[3]);
      const destination = rename ? `${schema}.${name(altered[4])}` : `${name(altered[4])}.${table}`;
      // Renommer une relation antérieure au fichier ne change pas ses droits : rien à suivre. Une relation
      // qui arrive dans public par SET SCHEMA, connue ou non, doit en revanche déclarer ses accès.
      if (!known && (rename || !destination.startsWith("public."))) continue;
      tables.delete(`${schema}.${table}`);
      tables.set(destination, known ?? { declared: false, original: table });
      continue;
    }
    const granted = grant.exec(statement);
    if (granted) {
      const objects = granted[1].trim();
      const all = new RegExp(String.raw`^all\s+tables\s+in\s+schema\s+(.+)$`, "u").exec(objects);
      if (all) {
        const schemas = new Set(all[1].split(",").map((s) => name(s.trim())));
        for (const [key, entry] of tables) if (schemas.has(key.slice(0, key.indexOf(".")))) entry.declared = true;
        continue;
      }
      if (/^(?:function|procedure|routine|sequence|schema|database|type|domain|language|large|foreign|tablespace|parameter|all\s)/u.test(objects)) continue;
      for (const part of objects.replace(/^table\s+/u, "").split(",")) {
        const m = target.exec(part);
        const entry = m ? tables.get(`${schemaOf(m[1])}.${name(m[2])}`) : undefined;
        if (entry) entry.declared = true;
      }
    }
  }
  const missing = [...tables.entries()]
    .filter(([key]) => key.startsWith("public."))
    .map(([key, entry]) => ({ table: key.slice("public.".length), entry }))
    .filter(({ table, entry }) => !entry.declared && !serviceOnly.has(table) && !serviceOnly.has(entry.original))
    .map(({ table }) => table);
  return [...missing, ...unreadable];
}
