/**
 * Le référentiel `reliure-fr-v1` : ses invariants (identités stables, relations valides et descriptives,
 * natures), sa recherche (les sondes du métier), ses unités — et l'ABSENCE de toute donnée tarifaire.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_REFERENCE_VERSION, findReferenceOperation, isKnownReferenceVersion, loadReference } from "./index";
import { referencePath, suggestedName } from "./presentation";
import { buildSearchIndex, normalizeSearch, queryTokens, searchReference, searchServices } from "./search";
import { STARTER_SUGGESTION_KEYS } from "./starterSuggestions";
import { IMPORTABLE_KINDS, REFERENCE_KINDS, isImportable, type ReferenceOperation } from "./types";
import { REFERENCE_UNITS, commonPracticeHint, referenceUnit, unitLabel } from "./units";

const data = await loadReference();
const { manifest, operations, relations } = data;
const index = buildSearchIndex(operations, manifest.domains);
const names = (query: string) => searchReference(index, query).map((h) => h.operation.canonicalName);
const byName = (name: string) => operations.find((o) => o.canonicalName === name)!;

describe("le référentiel est versionné", () => {
  it("la version courante est reliure-fr-v1, chargeable ; toute autre est inconnue", async () => {
    expect(CURRENT_REFERENCE_VERSION).toBe("reliure-fr-v1");
    expect(isKnownReferenceVersion("reliure-fr-v1")).toBe(true);
    expect(isKnownReferenceVersion("reliure-fr-v2")).toBe(false);
    expect(isKnownReferenceVersion("__proto__")).toBe(false);
    await expect(loadReference("reliure-fr-v9")).rejects.toThrow();
    expect(manifest.version).toBe("reliure-fr-v1");
    expect(operations.every((o) => o.version === "reliure-fr-v1")).toBe(true);
  });

  it("le manifeste dit vrai : chaque compte correspond aux données", () => {
    expect(manifest.counts.operations).toBe(operations.length);
    expect(manifest.counts.active).toBe(operations.filter((o) => o.active).length);
    expect(manifest.counts.importable).toBe(operations.filter(isImportable).length);
    expect(manifest.counts.needsBinderValidation).toBe(operations.filter((o) => o.needsBinderValidation).length);
    for (const kind of REFERENCE_KINDS) expect(manifest.counts.byKind[kind], kind).toBe(operations.filter((o) => o.kind === kind).length);
    expect(manifest.counts.relations).toEqual({
      operation_sequences: relations.operation_sequences.length,
      operation_components: relations.operation_components.length,
      operation_alternatives: relations.operation_alternatives.length,
    });
  });

  it("195 entrées : 162 opérations, 23 prestations composées, 1 diagnostic — et 9 non importables", () => {
    expect(operations).toHaveLength(195);
    expect(manifest.counts.byKind).toEqual({ operation: 162, package: 23, diagnostic: 1, adjustment: 5, material_choice: 3, generic_quote: 1 });
    expect(manifest.counts.importable).toBe(186);
  });

  it("findReferenceOperation retrouve par (version, clé) et refuse le reste", async () => {
    expect((await findReferenceOperation("reliure-fr-v1", "OPR-0103"))?.operation.canonicalName).toBe("Titrage au dos");
    expect(await findReferenceOperation("reliure-fr-v1", "OPR-9999")).toBeNull();
    expect(await findReferenceOperation("reliure-fr-v2", "OPR-0103")).toBeNull();
  });
});

describe("identités stables", () => {
  it("chaque clé est OPR-#### continue de 0001 à 0195, sans slug", () => {
    operations.forEach((o, i) => expect(o.key).toBe(`OPR-${String(i + 1).padStart(4, "0")}`));
    expect(new Set(operations.map((o) => o.key)).size).toBe(operations.length);
  });

  it("aucun slug d'identifiant n'apparaît nulle part : ni dans les entrées, ni dans les relations", () => {
    const text = readFileSync(resolve(__dirname, "reliure-fr-v1/operations.json"), "utf8") + readFileSync(resolve(__dirname, "reliure-fr-v1/relations.json"), "utf8");
    expect(text).not.toMatch(/OPR-\d{4}-[a-z]/);
    expect(text).not.toMatch(/OPR-\d{4}_/);
  });

  it("les codes de domaine sont ASCII et ont un libellé", () => {
    for (const o of operations) {
      expect(o.domain, o.key).toMatch(/^[A-Z_]+$/);
      expect(manifest.domains[o.domain], o.domain).toBeTruthy();
    }
    expect(Object.keys(manifest.domains)).toHaveLength(14);
  });
});

describe("relations : descriptives, valides, jamais des contraintes", () => {
  const keys = new Set(operations.map((o) => o.key));
  const all = [
    ...relations.operation_sequences.map((r) => ({ id: r.id, x: r.prerequisite, y: r.dependent })),
    ...relations.operation_components.map((r) => ({ id: r.id, x: r.composite, y: r.component })),
    ...relations.operation_alternatives.map((r) => ({ id: r.id, x: r.a, y: r.b })),
  ];

  it("trois familles nommées par rôle — plus aucun from / to / depends_on", () => {
    expect(Object.keys(relations).sort()).toEqual(["operation_alternatives", "operation_components", "operation_sequences"]);
    const raw = readFileSync(resolve(__dirname, "reliure-fr-v1/relations.json"), "utf8");
    expect(raw).not.toMatch(/"(from|to)"|depends_on|from_operation|to_operation|relation_type/);
  });

  it("chaque extrémité existe, aucune auto-relation, aucun identifiant en double", () => {
    for (const r of all) {
      expect(keys.has(r.x), `${r.id} ${r.x}`).toBe(true);
      expect(keys.has(r.y), `${r.id} ${r.y}`).toBe(true);
      expect(r.x, r.id).not.toBe(r.y);
    }
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });

  it("une paire ne figure que dans UNE famille", () => {
    const pairs = all.map((r) => [r.x, r.y].sort().join("|"));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("les séquences ne bouclent jamais", () => {
    const next = new Map<string, string[]>();
    for (const s of relations.operation_sequences) next.set(s.prerequisite, [...(next.get(s.prerequisite) ?? []), s.dependent]);
    const state = new Map<string, 1 | 2>();
    const visit = (n: string) => {
      expect(state.get(n), `boucle via ${n}`).not.toBe(1);
      if (state.get(n) === 2) return;
      state.set(n, 1);
      (next.get(n) ?? []).forEach(visit);
      state.set(n, 2);
    };
    operations.forEach((o) => visit(o.key));
  });

  it("les alternatives sont normalisées a < b", () => {
    for (const a of relations.operation_alternatives) expect(a.a < a.b, a.id).toBe(true);
  });

  it("chaque relation porte son drapeau interne ; une relation dont une extrémité est à valider l'est aussi", () => {
    const flag = new Map(operations.map((o) => [o.key, o.needsBinderValidation]));
    for (const r of all) {
      const rel = [...relations.operation_sequences, ...relations.operation_components, ...relations.operation_alternatives].find((x) => x.id === r.id)!;
      expect(typeof rel.needsBinderValidation).toBe("boolean");
      if (flag.get(r.x) || flag.get(r.y)) expect(rel.needsBinderValidation, r.id).toBe(true);
    }
    expect(manifest.counts.relationsNeedingValidation).toBe(all.filter((r) => [...relations.operation_sequences, ...relations.operation_components, ...relations.operation_alternatives].find((x) => x.id === r.id)!.needsBinderValidation).length);
  });

  it("aucune relation n'est un blocage : aucun champ ne dit « obligatoire », « requis » ou « bloquant »", () => {
    const raw = readFileSync(resolve(__dirname, "reliure-fr-v1/relations.json"), "utf8");
    expect(raw).not.toMatch(/"(required|mandatory|blocking|obligatoire|requis|bloquant)"/i);
  });

  it("les variantes désignent une entrée existante et ne sont jamais leur propre parent", () => {
    for (const o of operations.filter((x) => x.variantOf)) {
      expect(keys.has(o.variantOf!), o.key).toBe(true);
      expect(o.variantOf).not.toBe(o.key);
    }
    expect(operations.filter((o) => o.variantOf)).toHaveLength(7);
  });
});

describe("natures importables", () => {
  it("seuls operation, package et diagnostic sont importables — pas les ajustements", () => {
    expect([...IMPORTABLE_KINDS]).toEqual(["operation", "package", "diagnostic"]);
    expect(IMPORTABLE_KINDS).not.toContain("adjustment");
    for (const o of operations) {
      const expected = ["operation", "package", "diagnostic"].includes(o.kind) && o.active;
      expect(isImportable(o), o.key).toBe(expected);
    }
  });

  it("majorations, remise, matériaux et « prestation sur devis » ne sont ni cherchés ni importables", () => {
    for (const name of ["Majoration de grand format", "Majoration de matériau", "Majoration d’urgence", "Remise de série", "Forfait de préparation non standard", "Choix de cuir", "Choix de papier décoré", "Choix de toile", "Prestation sur devis"]) {
      const entry = byName(name);
      expect(isImportable(entry), name).toBe(false);
      expect(searchReference(index, name).some((h) => h.operation.key === entry.key), name).toBe(false);
    }
  });

  it("une entrée inactive n'est jamais proposée, même si sa nature est importable", () => {
    const base = operations.find((o) => o.kind === "operation")!;
    const fixture: ReferenceOperation[] = [{ ...base, key: "OPR-9001", canonicalName: "Opération retirée", synonyms: ["retirée"], searchKeywords: ["retirée"], active: false }, { ...base, key: "OPR-9002", canonicalName: "Opération active", synonyms: ["active"], searchKeywords: ["active"], active: true }];
    const idx = buildSearchIndex(fixture);
    expect(searchReference(idx, "opération").map((h) => h.operation.key)).toEqual(["OPR-9002"]);
    expect(isImportable(fixture[0])).toBe(false);
    expect(operations.filter((o) => !o.active).map((o) => o.canonicalName)).toEqual(["Prestation sur devis"]);
  });

  it("la barrière de l'index : 186 entrées, aucune d'une autre nature", () => {
    expect(index.entries).toHaveLength(186);
    expect(index.entries.every((e) => isImportable(e.operation))).toBe(true);
  });
});

describe("recherche : accents, synonymes, mots-clés", () => {
  it("normalise accents, casse, apostrophes typographiques et ponctuation", () => {
    expect(normalizeSearch("  L’Assommoir — Œuvre ! ")).toBe("l'assommoir oeuvre");
    expect(normalizeSearch("Réparation")).toBe("reparation");
    expect(queryTokens("Dorure de l'ouvrage")).toEqual(["dorure", "ouvrage"]);
    expect(queryTokens("de la")).toEqual([]);
  });

  it("avec ou sans accents, avec ou sans majuscule, avec l'apostrophe droite ou typographique", () => {
    expect(names("reparation de mors")).toEqual(names("RÉPARATION DE MORS"));
    expect(names("reparation de mors")).toContain("Réparation de mors");
    expect(names("titrage d'auteur")).toContain("Titrage d’auteur");
    expect(names("titrage d’auteur")).toContain("Titrage d’auteur");
  });

  it("pluriels : nerfs = nerf ; coiffes = coiffe", () => {
    expect(names("nerfs")).toEqual(names("nerf"));
    expect(names("coiffes")).toEqual(names("coiffe"));
  });

  it("une requête vide, ou faite de mots vides, ne ramène rien (jamais les 195 entrées)", () => {
    expect(names("")).toEqual([]);
    expect(names("   ")).toEqual([]);
    expect(names("de la")).toEqual([]);
    expect(names("zzzzqqq")).toEqual([]);
  });

  it("un début de mot suffit (« dor » → dorure), mais deux lettres non", () => {
    const found = names("dor");
    expect(found).toContain("Dorure des nerfs");
    expect(found).toEqual(names("dorure").length >= found.length ? found : names("dorure"));
    expect(searchReference(index, "do")).toEqual([]);
  });

  it("un synonyme retrouve l'entrée (« diagnostic préalable » → Examen de l’ouvrage)", () => {
    const hits = searchReference(index, "diagnostic préalable");
    expect(hits[0].operation.canonicalName).toBe("Examen de l’ouvrage");
    expect(["synonym", "keyword", "name", "customerName"]).toContain(hits[0].matchedIn);
  });

  it("le nom client est cherché : « Examen du livre »", () => {
    expect(names("examen du livre")[0]).toBe("Examen de l’ouvrage");
  });

  it("un mot-clé retrouve l'entrée, et une correspondance exacte de nom passe devant", () => {
    const first = searchReference(index, "Titrage au dos")[0];
    expect(first.operation.canonicalName).toBe("Titrage au dos");
    expect(first.score).toBeGreaterThan(searchReference(index, "Titrage au dos")[1].score);
  });

  it("l'ordre est déterministe", () => {
    expect(names("dorure")).toEqual(names("dorure"));
    expect(searchReference(index, "cuir", { limit: 5 })).toHaveLength(5);
  });
});

describe("recherche : chaque champ compte, tous les mots comptent, le nom exact passe devant", () => {
  const base = operations.find((o) => o.kind === "operation")!;
  const make = (key: string, canonicalName: string, over: Partial<ReferenceOperation> = {}): ReferenceOperation => ({
    ...base, key, canonicalName, customerName: null, synonyms: [], searchKeywords: [], domain: "FINITIONS", family: "Zzfam", subfamily: "Zzsub", active: true, kind: "operation", ...over,
  });
  const ids = (ops: ReferenceOperation[], query: string) => searchReference(buildSearchIndex(ops, manifest.domains), query).map((h) => h.operation.key);

  it("un mot présent SEULEMENT dans les synonymes retrouve l'entrée", () => {
    const ops = [make("OPR-9101", "Alpha", { synonyms: ["zorglub"] }), make("OPR-9102", "Beta")];
    expect(ids(ops, "zorglub")).toEqual(["OPR-9101"]);
  });

  it("un mot présent SEULEMENT dans les mots-clés retrouve l'entrée", () => {
    const ops = [make("OPR-9101", "Alpha", { searchKeywords: ["quux"] }), make("OPR-9102", "Beta")];
    expect(ids(ops, "quux")).toEqual(["OPR-9101"]);
  });

  it("un mot présent SEULEMENT dans le nom client retrouve l'entrée", () => {
    const ops = [make("OPR-9101", "Alpha", { customerName: "Wibble du livre" }), make("OPR-9102", "Beta")];
    expect(ids(ops, "wibble")).toEqual(["OPR-9101"]);
  });

  it("le nom pèse plus qu'un synonyme, qui pèse plus qu'un mot-clé, qui pèse plus que la catégorie", () => {
    const ops = [
      make("OPR-9104", "Delta", { family: "Marmelade" }),
      make("OPR-9103", "Gamma", { searchKeywords: ["marmelade confite"] }),
      make("OPR-9102", "Beta", { synonyms: ["marmelade confite"] }),
      make("OPR-9101", "Marmelade fine"),
    ];
    expect(ids(ops, "marmelade")).toEqual(["OPR-9101", "OPR-9102", "OPR-9103", "OPR-9104"]);
  });

  it("…sauf qu'un synonyme EXACT (le terme même que le relieur tape) passe devant un nom seulement voisin", () => {
    const ops = [make("OPR-9101", "Marmelade fine"), make("OPR-9102", "Beta", { synonyms: ["marmelade"] })];
    expect(ids(ops, "marmelade")).toEqual(["OPR-9102", "OPR-9101"]);
  });

  it("TOUS les mots de la requête doivent trouver (« couture nerfs » n'est pas « couture OU nerfs »)", () => {
    expect(names("couture nerfs")).toContain("Couture sur nerfs");
    expect(names("couture nerfs")).not.toContain("Dorure des nerfs");
    expect(names("couture nerfs")).not.toContain("Pose de faux nerfs");
    const ops = [make("OPR-9101", "Couture sur nerfs"), make("OPR-9102", "Dorure des nerfs")];
    expect(ids(ops, "couture nerfs")).toEqual(["OPR-9101"]);
  });

  it("le nom exact passe devant un synonyme exact d'une autre entrée", () => {
    const ops = [make("OPR-9102", "Boîte", { synonyms: ["étui"] }), make("OPR-9101", "Étui")];
    expect(ids(ops, "étui")).toEqual(["OPR-9101", "OPR-9102"]);
  });

  it("un synonyme exact passe devant une simple mention dans un nom plus long", () => {
    const ops = [make("OPR-9101", "Étui doré à la main"), make("OPR-9102", "Boîte", { synonyms: ["étui doré"] })];
    expect(ids(ops, "étui doré")[0]).toBe("OPR-9102");
  });
});

describe("recherche : les sondes du métier", () => {
  it("nerf → couture sur nerfs, nerfs véritables, faux nerfs, dorure des nerfs", () => {
    const found = names("nerf");
    for (const n of ["Couture sur nerfs", "Pose de nerfs véritables", "Pose de faux nerfs", "Dorure des nerfs"]) expect(found, n).toContain(n);
  });

  it("coiffe → formation de coiffe, reprise de coiffe", () => {
    const found = names("coiffe");
    for (const n of ["Formation des coiffes", "Reprise de coiffe", "Parure des coiffes"]) expect(found, n).toContain(n);
  });

  it("titre → titrage au dos, pièce de titre, dorure sur pièce de titre", () => {
    const found = names("titre");
    for (const n of ["Titrage au dos", "Pose de pièce de titre", "Dorure sur pièce de titre"]) expect(found, n).toContain(n);
  });

  it("cuir ne renvoie JAMAIS un matériau comme une prestation", () => {
    const hits = searchReference(index, "cuir");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.operation.kind === "material_choice")).toBe(false);
    expect(hits.map((h) => h.operation.canonicalName)).not.toContain("Choix de cuir");
    expect(hits.every((h) => IMPORTABLE_KINDS.includes(h.operation.kind))).toBe(true);
  });

  it("« reliure plein cuir » retrouve la prestation composée avant tout le reste", () => {
    expect(names("reliure plein cuir")[0]).toBe("Reliure plein cuir");
  });
});

describe("présentation", () => {
  it("chemin compact : « Dorure & titrage › Titrage » ; pas de répétition « Couvrure › Couvrure »", () => {
    expect(referencePath(byName("Dorure sur pièce de titre"), manifest)).toBe("Dorure & titrage › Titrage");
    expect(referencePath(byName("Reliure plein cuir"), manifest)).toBe("Couvrure › Matériau et structure");
  });

  it("le nom proposé est celui du particulier s'il existe, sinon le nom canonique — toujours modifiable", () => {
    expect(suggestedName(byName("Examen de l’ouvrage"))).toBe("Examen du livre");
    expect(suggestedName(byName("Titrage au dos"))).toBe("Titrage au dos");
  });
});

describe("unités : un vocabulaire court, un mode de prix séparé", () => {
  it("20 unités contrôlées, uniques, dont les exemples de la décision", () => {
    expect(REFERENCE_UNITS).toHaveLength(20);
    expect(new Set(REFERENCE_UNITS.map((u) => u.key)).size).toBe(20);
    for (const key of ["ouvrage", "cahier", "feuillet", "tranche", "plat", "coin", "coiffe", "mors", "nerf", "titre", "ligne", "caractère", "pièce", "motif", "cm", "cm²"]) expect(referenceUnit(key), key).toBeTruthy();
  });

  it("le mode de prix n'est PAS une unité : « heure », « forfait » et « sur devis » ne sont pas dans le vocabulaire d'unités", () => {
    for (const bad of ["heure", "par heure", "forfait", "sur devis", "pourcentage"]) expect(referenceUnit(bad), bad).toBeUndefined();
    for (const o of operations) for (const u of o.unitCandidates) expect(referenceUnit(u), `${o.key} ${u}`).toBeTruthy();
  });

  it("l'unité d'un atelier reste libre : une valeur inconnue s'affiche telle quelle", () => {
    expect(unitLabel("par titre")).toBe("par titre");
    expect(unitLabel("titre")).toBe("par titre");
    expect(unitLabel("séance de dorure")).toBe("séance de dorure");
    expect(unitLabel(null)).toBeNull();
  });

  it("une information de pratique courante — jamais un montant", () => {
    expect(commonPracticeHint(["titre", "ligne"], ["per_unit", "hourly"])).toBe("par titre · par ligne · à l'heure");
    expect(commonPracticeHint([], [])).toBeNull();
    expect(commonPracticeHint(["ouvrage"], ["per_unit", "on_quote"])).not.toMatch(/\d/);
  });
});

describe("les dix suggestions de départ", () => {
  it("dix clés, toutes présentes et importables, sans doublon — et aucune n'est un prix", () => {
    expect(STARTER_SUGGESTION_KEYS).toHaveLength(10);
    expect(new Set(STARTER_SUGGESTION_KEYS).size).toBe(10);
    for (const key of STARTER_SUGGESTION_KEYS) {
      const entry = operations.find((o) => o.key === key);
      expect(entry, key).toBeTruthy();
      expect(isImportable(entry!), key).toBe(true);
    }
    expect(JSON.stringify(STARTER_SUGGESTION_KEYS)).not.toMatch(/\d\s?(€|eur)/i);
  });
});

describe("le catalogue de l'atelier se cherche avec les synonymes de l'opération liée", () => {
  const services = [
    { name: "Dorure titre", description: null, referenceOperationKey: byName("Dorure sur pièce de titre").key },
    { name: "Mon étui maison", description: "sur mesure, toile", referenceOperationKey: null },
    { name: "Restauration de coiffe", description: null, referenceOperationKey: byName("Reprise de coiffe").key },
  ];
  const lookup = (key: string) => operations.find((o) => o.key === key);

  it("le nom de l'atelier, sa description, puis les synonymes du lien", () => {
    expect(searchServices(services, "dorure", lookup).map((s) => s.name)).toEqual(["Dorure titre"]);
    expect(searchServices(services, "toile", lookup).map((s) => s.name)).toEqual(["Mon étui maison"]);
    const linkedSynonym = byName("Dorure sur pièce de titre").synonyms[0];
    expect(searchServices(services, linkedSynonym, lookup).map((s) => s.name)).toContain("Dorure titre");
  });

  it("une prestation personnelle (sans lien) ne se trouve que par ce que l'atelier a écrit", () => {
    expect(searchServices(services, "reprise", (k) => (k ? undefined : undefined)).map((s) => s.name)).toEqual([]);
  });
});

describe("aucun prix dans le référentiel", () => {
  const FORBIDDEN_KEY = /price|prix|tarif|cent|amount|montant|eur\b|currency|devise|hourly_?rate|taux/i;

  const walk = (value: unknown, path: string, visit: (path: string, key: string, value: unknown) => void) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, visit));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { visit(path, k, v); walk(v, `${path}.${k}`, visit); }
  };

  it("aucune clé de la ressource ne parle de prix, de tarif ou de montant (seul `pricingModes` — un MODE — est permis)", () => {
    const bad: string[] = [];
    for (const doc of [operations, relations, manifest]) walk(doc, "$", (path, key) => { if (FORBIDDEN_KEY.test(key) && key !== "pricingModes") bad.push(`${path}.${key}`); });
    expect(bad).toEqual([]);
  });

  it("aucun texte de la ressource ne contient un montant (« 45 € », « 12,50 EUR », « 30 euros »)", () => {
    const raw = ["operations.json", "relations.json", "manifest.json"].map((f) => readFileSync(resolve(__dirname, `reliure-fr-v1/${f}`), "utf8")).join("\n");
    expect(raw).not.toMatch(/\d[\d\s.,]*\s?(€|eur\b|euros?\b)/i);
    expect(raw).not.toMatch(/€/);
  });

  it("le manifeste ne référence QUE les deux fichiers sans prix : le fichier des prix publics n'est pas une source", () => {
    expect(manifest.sourceDataset.files.map((f) => f.name).sort()).toEqual(["operations-relations.json", "operations-reliure.json"]);
    expect(JSON.stringify(manifest)).not.toMatch(/observed|public.?price/i);
  });

  it("les seuls champs numériques d'une entrée sont des compteurs de version : aucun nombre libre", () => {
    for (const o of operations) for (const [k, v] of Object.entries(o)) expect(typeof v === "number", `${o.key}.${k}`).toBe(false);
  });

  it("le dossier de la ressource ne contient que manifest, operations et relations", () => {
    expect(readdirSync(resolve(__dirname, "reliure-fr-v1")).sort()).toEqual(["manifest.json", "operations.json", "relations.json"]);
  });
});
