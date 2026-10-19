import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tables = catalog.tables.filter(
  (t) => t.schema === "public" && t.name.startsWith("marketplace_"),
);
const evidence = Object.fromEntries(
  tables.map((t) => [t.name, { SELECT: [], INSERT: [], UPDATE: [], DELETE: [] }]),
);
const unresolved = [];
function visitFile(file) {
  const text = fs.readFileSync(file, "utf8"),
    tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const constants = new Map();
  function collect(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      constants.set(node.name.text, node.initializer.text);
    ts.forEachChild(node, collect);
  }
  collect(tree);
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from"
    ) {
      const literal = node.arguments[0];
      const name =
        literal && ts.isStringLiteral(literal)
          ? literal.text
          : literal && ts.isIdentifier(literal)
            ? constants.get(literal.text)
            : null;
      let chain = node;
      while (
        chain.parent &&
        (ts.isPropertyAccessExpression(chain.parent) ||
          ts.isCallExpression(chain.parent) ||
          ts.isAwaitExpression(chain.parent))
      )
        chain = chain.parent;
      const snippet = chain.getText(tree);
      if (!/\.(select|insert|update|upsert|delete)\s*\(/.test(snippet)) return;
      const record = {
        file: path.relative(root, file).replaceAll("\\", "/"),
        line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        expression: snippet.slice(0, 700),
      };
      if (evidence[name]) {
        // Filters/RETURNING and PostgREST representations can require SELECT as well.
        evidence[name].SELECT.push(record);
        if (/\.insert\s*\(/.test(snippet)) evidence[name].INSERT.push(record);
        if (/\.update\s*\(/.test(snippet)) evidence[name].UPDATE.push(record);
        if (/\.upsert\s*\(/.test(snippet)) {
          evidence[name].INSERT.push(record);
          evidence[name].UPDATE.push(record);
        }
        if (/\.delete\s*\(/.test(snippet)) evidence[name].DELETE.push(record);
      } else if (!name && /\.from\s*\(/.test(snippet)) {
        if (file.endsWith("adminDashboard.server.ts")) {
          for (const called of text.matchAll(/\bread\(\s*"(marketplace_[a-z0-9_]+)"/g))
            if (evidence[called[1]])
              evidence[called[1]].SELECT.push({
                ...record,
                resolution: "Generic read helper; literal call site: " + called[1],
              });
        } else unresolved.push(record);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/.test(file) && !/(\.test\.|\.fixture\.)/.test(file)) visitFile(file);
  }
}
walk(path.join(root, "src"));
for (const fn of catalog.functions) {
  const text = fn.definition ?? "";
  for (const match of text.matchAll(
    /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+(?:public\.)?"?(marketplace_[a-z0-9_]+)"?/gi,
  )) {
    const operation = match[1].toUpperCase().startsWith("INSERT")
      ? "INSERT"
      : match[1].toUpperCase().startsWith("DELETE")
        ? "DELETE"
        : match[1].toUpperCase() === "UPDATE"
          ? "UPDATE"
          : "SELECT";
    if (evidence[match[2]]) {
      const record = {
        function: `${fn.schema}.${fn.name}(${fn.identity_args})`,
        definitionLine: text.slice(0, match.index).split("\n").length,
        sql: match[0],
      };
      evidence[match[2]][operation].push(record);
      if (operation !== "SELECT")
        evidence[match[2]].SELECT.push({
          ...record,
          reason: "Conservative SELECT retention for WHERE, ON CONFLICT and RETURNING",
        });
      const statement = text.slice(match.index).split(";")[0];
      if (operation === "INSERT" && /ON\s+CONFLICT[\s\S]*?DO\s+UPDATE/i.test(statement))
        evidence[match[2]].UPDATE.push({
          ...record,
          reason: "INSERT ON CONFLICT DO UPDATE requires UPDATE",
        });
    }
  }
}
const rows = tables.map((table) => ({
  table: table.name,
  owner: table.owner,
  serviceBefore: table.grants.service_role,
  evidence: evidence[table.name],
  used: Object.keys(evidence[table.name]).filter(
    (operation) => evidence[table.name][operation].length,
  ),
}));
const result = {
  source: "origin/main 9d7ac9d1c8c3548755cedddeb26ed45a6b40bc9a",
  catalogAt: catalog.at,
  tables: rows,
  unresolved,
  limitations:
    "Static over-approximation: SQL in SECURITY DEFINER is retained conservatively; every dynamic table must be reviewed manually.",
};
fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    tables: rows.length,
    unresolved: unresolved.length,
    withoutReadEvidence: rows.filter((r) => !r.used.includes("SELECT")).map((r) => r.table),
    delete: rows.filter((r) => r.used.includes("DELETE")).map((r) => r.table),
  }),
);
