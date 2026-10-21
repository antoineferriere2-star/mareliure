/**
 * Détecteur des tables créées sans décision explicite de droits (garde-fou de 20261020100000).
 *
 * Lecture du SQL instruction par instruction, jamais par recherche de texte brut (revues #147, #152) :
 * commentaires et chaînes sont retirés avant l'analyse, les identifiants cités gardent leur nom exact
 * (casse et points compris), les renommages et changements de schéma sont suivis, et un GRANT/REVOKE ne
 * compte que pour la relation exacte qu'il désigne. Une création non comprise ou dynamique est signalée
 * plutôt qu'ignorée ; le marqueur `-- acl: dynamic-reviewed` lève ce signal pour un fichier relu à la main.
 *
 * Portée (après trois contre-revues, #147, #152, #160) : ce garde-fou attrape l'oubli d'un auteur de bonne
 * foi, pas un SQL écrit pour le tromper. Tout SQL exécuté dynamiquement (`EXECUTE`) est renvoyé à une
 * relecture humaine plutôt qu'analysé. La preuve forte reste la comparaison du catalogue des droits sur une
 * copie PostgreSQL après application (procédure de la migration 20261020100000).
 */

/** Jeton d'identifiant cité : un caractère d'usage privé, qu'aucun identifiant non cité ne peut contenir. */
const QID = "";
const IDENT = String.raw`(?:[\p{L}_][\p{L}\p{N}_$]*|\d+)`;
const QUALIFIED = String.raw`(?:(${IDENT})\s*\.\s*)?(${IDENT})`;

interface Lexed { sql: string; quoted: string[]; serviceOnly: Set<string>; dynamic: boolean }

/** PostgreSQL ne replie que l'ASCII des identifiants non cités. */
const fold = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** Les chaînes et corps `$…$` d'une instruction, mis bout à bout, parlent de créer une table persistante. */
function createsTable(literals: string): boolean {
  // SQL exécuté dynamiquement (revue de #160) : son texte peut être calculé (chr, concaténation, replace,
  // décodage base64, UESCAPE…) et n'est pas lisible statiquement. Tout EXECUTE dans un corps ou une chaîne
  // est donc à relire à la main (marqueur `-- acl: dynamic-reviewed`), quel que soit son texte apparent.
  if (/\bexecute\b/i.test(literals)) return true;
  // Une création temporaire ne masque pas une création persistante voisine (revue #152).
  const persistent = literals.replace(/\bcreate\s+(?:(?:global|local)\s+)?temp(?:orary)?\s+table\b/gi, " ");
  return /\bcreate\b/i.test(persistent) && /\btable\b/i.test(persistent);
}

const codePoint = (code: number) => (Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "");

/** Décode une chaîne `E'…'` : \xHH, \ooo, \uXXXX, \UXXXXXXXX et caractères échappés. */
function decodeE(text: string): string {
  return text.replace(/\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3}|[\s\S])/g, (_, esc: string) => {
    if (/^x/.test(esc) || (/^[uU]/.test(esc) && esc.length > 1)) return codePoint(parseInt(esc.slice(1), 16));
    if (/^[0-7]/.test(esc)) return codePoint(parseInt(esc, 8));
    return esc;
  });
}

/** Décode une chaîne `U&'…'` : \XXXX et \+XXXXXX. */
function decodeU(text: string): string {
  return text.replace(/\\\+([0-9a-fA-F]{6})|\\([0-9a-fA-F]{4})/g, (_, six: string | undefined, four: string | undefined) => codePoint(parseInt(six ?? four ?? "", 16)));
}

/** Retire commentaires, chaînes et corps `$…$` ; remplace chaque identifiant cité par un jeton. */
function lex(input: string): Lexed {
  // U+E000 est accepté par PostgreSQL dans un identifiant non cité : neutralisé avant de servir de jeton.
  const source = input.replaceAll(QID, "");
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
      const unicode = /u&$/i.test(out);
      const start = i + 1;
      i += 1;
      while (i < source.length) {
        if (escapes && source[i] === "\\") { i += 2; continue; }
        if (source[i] === "'" && source[i + 1] === "'") { i += 2; continue; }
        if (source[i] === "'") { i += 1; break; }
        i += 1;
      }
      const raw = source.slice(start, i - 1);
      literals += ` ${escapes ? decodeE(raw) : unicode ? decodeU(raw) : raw}`;
      out += "''";
      continue;
    }
    if (c === "$" && !/[\p{L}\p{N}_$]$/u.test(out)) {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(source.slice(i));
      if (tag) {
        const close = source.indexOf(tag[0], i + tag[0].length);
        const body = source.slice(i + tag[0].length, close < 0 ? source.length : close);
        // Le corps peut lui-même contenir des chaînes E'…' ou U&'…' : examiné brut et décodé.
        literals += ` ${body} ${decodeE(body)} ${decodeU(body)}`;
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
      out += ` ${QID}${quoted.length - 1} `;
      continue;
    }
    if (c === ";") endStatement();
    out += fold(c);
    i += 1;
  }
  endStatement();
  return { sql: out, quoted, serviceOnly, dynamic: dynamic && !reviewed };
}

interface Relation { schema: string; table: string; declared: boolean; original: string }

export function undeclaredTables(source: string): string[] {
  const { sql, quoted, serviceOnly, dynamic } = lex(source);
  const name = (raw: string) => (raw.startsWith(QID) ? quoted[Number(raw.slice(QID.length))] : raw);
  const schemaOf = (raw: string | undefined) => (raw ? name(raw) : "public");
  // Clé sans ambiguïté, même pour des noms qui contiennent un point (revue #152) ; l'ordre des instructions compte.
  const key = (schema: string, table: string) => JSON.stringify([schema, table]);
  const tables = new Map<string, Relation>();
  const unreadable: string[] = dynamic ? ["<création dynamique (EXECUTE, DO, format) à déclarer>"] : [];
  const create = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:global|local)\s+)?(temp|temporary|unlogged)?\s*table\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`, "u");
  // SELECT … INTO crée une table, où qu'il soit dans l'instruction (WITH, EXPLAIN ANALYZE, parenthèses) ;
  // INSERT INTO et MERGE INTO n'en créent pas.
  const selectInto = new RegExp(String.raw`\bselect\b[\s\S]*?(?<!\b(?:insert|merge)\s)\binto\s+(?:(temp|temporary|unlogged)\s+)?(?:table\s+)?${QUALIFIED}`, "u");
  const alter = new RegExp(String.raw`^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${QUALIFIED}\s+(rename\s+to|set\s+schema)\s+(${IDENT})`, "u");
  const grant = /^(?:grant|revoke)\b[\s\S]*?\bon\s+([\s\S]+?)\s+(?:to|from)\b/u;
  const target = new RegExp(String.raw`^\s*${QUALIFIED}\s*$`, "u");
  const add = (schema: string, table: string) => tables.set(key(schema, table), { schema, table, declared: false, original: table });
  // Un nom non qualifié n'est sûrement « public » que si le fichier ne change pas le search_path et ne crée
  // pas de table temporaire du même nom (revue de #160) : sinon son GRANT ne compte pas comme déclaration.
  const temporary = new Set<string>();
  let searchPathChanged = false;

  for (const raw of sql.split(";")) {
    const statement = raw.trim().replace(/\s+/g, " ");
    if (!statement) continue;
    if (/^create\s+(?:\w+\s+)*?table\b/u.test(statement)) {
      const m = create.exec(statement);
      if (!m) { unreadable.push(`<create table illisible : ${statement.slice(0, 60)}>`); continue; }
      if (m[1] !== "temp" && m[1] !== "temporary") add(schemaOf(m[2]), name(m[3]));
      else temporary.add(name(m[3]));
      continue;
    }
    if (/^set\s+(?:(?:local|session)\s+)?search_path\b/u.test(statement) || /\bset_config\s*\(/u.test(statement)) searchPathChanged = true;
    const definesObject = /^(?:insert|merge|update|delete|grant|revoke|alter|comment|create\s+(?:or\s+replace\s+)?(?:view|materialized|policy|function|procedure|trigger|index|unique|rule))\b/u.test(statement);
    const into = /\bselect\b/u.test(statement) && !definesObject ? selectInto.exec(statement) : null;
    if (into) {
      if (into[1] !== "temp" && into[1] !== "temporary") add(schemaOf(into[2]), name(into[3]));
      else temporary.add(name(into[3]));
      continue;
    }
    const altered = alter.exec(statement);
    if (altered) {
      const schema = schemaOf(altered[1]);
      const table = name(altered[2]);
      const known = tables.get(key(schema, table));
      const rename = /^rename/u.test(altered[3]);
      const destination = rename ? { schema, table: name(altered[4]) } : { schema: name(altered[4]), table };
      // Renommer une relation antérieure au fichier ne change pas ses droits : rien à suivre. Une relation
      // qui arrive dans public par SET SCHEMA, connue ou non, doit en revanche déclarer ses accès.
      if (!known && (rename || destination.schema !== "public")) continue;
      tables.delete(key(schema, table));
      tables.set(key(destination.schema, destination.table), { ...(known ?? { declared: false, original: table }), ...destination });
      continue;
    }
    const granted = grant.exec(statement);
    if (granted) {
      const objects = granted[1].trim();
      const all = new RegExp(String.raw`^all\s+tables\s+in\s+schema\s+(.+)$`, "u").exec(objects);
      if (all) {
        const schemas = new Set(all[1].split(",").map((s) => name(s.trim())));
        for (const relation of tables.values()) if (schemas.has(relation.schema)) relation.declared = true;
        continue;
      }
      if (/^(?:function|procedure|routine|sequence|schema|database|type|domain|language|large|foreign|tablespace|parameter|all\s)/u.test(objects)) continue;
      for (const part of objects.replace(/^table\s+/u, "").split(",")) {
        const m = target.exec(part);
        if (m && !m[1] && (searchPathChanged || temporary.has(name(m[2])))) continue;
        const relation = m ? tables.get(key(schemaOf(m[1]), name(m[2]))) : undefined;
        if (relation) relation.declared = true;
      }
    }
  }
  const missing = [...tables.values()]
    .filter((relation) => relation.schema === "public" && !relation.declared && !serviceOnly.has(relation.table) && !serviceOnly.has(relation.original))
    .map((relation) => relation.table);
  return [...missing, ...unreadable];
}
