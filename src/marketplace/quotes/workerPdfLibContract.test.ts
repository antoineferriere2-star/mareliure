// Contrat : `pdf-lib` doit être bundlé dans le Worker par son build ES, jamais par son point d'entrée CommonJS.
//
// Pourquoi : `pdf-lib` déclare `main: cjs/index.js` et dépend de `tslib` 1.x (UMD). Bundlé ainsi, il s'évalue sous
// Node (donc les tests passent) mais échoue sous workerd — « Cannot destructure property '__extends' » — et TOUTES
// les server functions du module devis (catalogue, clients, devis, factures, PDF) répondent alors 500 en production.
// Aucun test unitaire ne peut le voir : ce contrat lit la configuration qui l'empêche, et le script de build refuse
// le motif dans l'artefact serveur.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pdf-lib dans le Worker", () => {
  it("vite.config.ts aliase pdf-lib vers son build ES", () => {
    const config = read("vite.config.ts");
    expect(config).toMatch(/find:\s*\/\^pdf-lib\$\//);
    expect(config).toContain("node_modules/pdf-lib/es/index.js");
  });

  it("le build ES de pdf-lib existe bien à l'endroit visé", () => {
    expect(existsSync(resolve(process.cwd(), "node_modules/pdf-lib/es/index.js"))).toBe(true);
  });

  it("le script de build refuse le motif d'interopérabilité cassé dans le bundle serveur", () => {
    const script = read("scripts/buildMaReliure.mjs");
    expect(script).toContain("BROKEN_TSLIB_INTEROP");
    expect(script).toContain('".output/server"');
    // Le motif attrape exactement ce que le bundler produisait avant le correctif.
    const pattern = /var \{ __extends[^}]*\} = \(\/\* @__PURE__ \*\/ __toESM\(/;
    expect(pattern.test("var { __extends, __assign, __rest } = (/* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {")).toBe(true);
    expect(pattern.test("import { __extends } from \"tslib\";")).toBe(false);
  });

  it("le bundle serveur construit (s'il existe) ne contient pas le motif cassé", () => {
    const dir = resolve(process.cwd(), ".output/server");
    if (!existsSync(dir)) return;
    const pattern = /var \{ __extends[^}]*\} = \(\/\* @__PURE__ \*\/ __toESM\(/;
    const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith(".mjs"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(pattern.test(readFileSync(resolve(dir, file), "utf8")), file).toBe(false);
  });
});