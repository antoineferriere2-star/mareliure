#!/usr/bin/env node
/**
 * Construit la ressource `reliure-fr-v1` (src/marketplace/reference/reliure-fr-v1/) et son journal de
 * normalisation (docs/reference/reliure-fr-v1/) à partir des fichiers de recherche BRUTS.
 *
 *   RELIURE_REFERENCE_SOURCE=D:/Users/antoi/Downloads node scripts/buildReliureReference.mjs
 *
 * Règles de ce script (voir docs/CODEX_HANDOFF.md, « PR 2a ») :
 *  - la SOURCE BRUTE reste hors du dépôt et n'est jamais modifiée ; seuls `operations-reliure.json` et
 *    `operations-relations.json` sont lus ;
 *  - AUCUN PRIX n'est lu : ni `observed-public-prices.csv`, ni aucun champ tarifaire des opérations
 *    (ils sont vides sur 195/195 et retirés, journalisés) ;
 *  - rien n'est corrigé en silence : chaque écart A1–A11 (+ V3/V4) est écrit dans le journal avec
 *    l'ancien contenu, le nouveau, la raison, le type de correction et l'impact ;
 *  - la sortie est déterministe (aucune date d'exécution, tri stable) : rejouer le script sur la même
 *    source ne change pas un octet.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.RELIURE_REFERENCE_SOURCE ?? "D:/Users/antoi/Downloads";
const OUT = resolve(ROOT, "src/marketplace/reference/reliure-fr-v1");
const DOCS = resolve(ROOT, "docs/reference/reliure-fr-v1");
const VERSION = "reliure-fr-v1";
const PUBLISHED_ON = "2026-09-20";

const readBytes = (name) => readFileSync(resolve(SRC, name));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rawOps = JSON.parse(readBytes("operations-reliure.json").toString("utf8"));
const rawRels = JSON.parse(readBytes("operations-relations.json").toString("utf8"));
const sourceFiles = ["operations-reliure.json", "operations-relations.json"].map((name) => ({ name, sha256: sha256(readBytes(name)) }));

const OPS = rawOps.operations;
const journal = [];
let jn = 0;
const log = (rule, type, subject, before, after, reason, impact) =>
  journal.push({ id: `J-${String(++jn).padStart(4, "0")}`, rule, type, subject, before, after, reason, impact });
const fail = (message) => {
  console.error("ÉCHEC :", message);
  process.exit(1);
};

// --- utilitaires --------------------------------------------------------------------------
const stripDiacritics = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
/** Comparaison de libellés : sans accents ni casse, apostrophes et ponctuation unifiées. */
const norm = (s) => stripDiacritics(String(s)).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const keyOf = (id) => {
  const m = /^(OPR-\d{4})/.exec(id);
  if (!m) fail(`identifiant d'opération inattendu : ${id}`);
  return m[1];
};
const unique = (list) => [...new Set(list)];
const uniqueBy = (list, f) => {
  const seen = new Set();
  return list.filter((x) => (seen.has(f(x)) ? false : seen.add(f(x))));
};

if (OPS.length !== 195) fail(`195 entrées attendues, ${OPS.length} lues`);
const byKey = new Map(OPS.map((o) => [keyOf(o.operation_id), o]));
if (byKey.size !== OPS.length) fail("identifiants d'opération en double");

// --- A9 : identifiants stables (sans slug) -------------------------------------------------
for (const o of OPS) {
  const key = keyOf(o.operation_id);
  log("A9", "identifiant", key, o.operation_id, key,
    "Le suffixe reprenait un slug du libellé : corriger le libellé aurait changé l'identité.",
    "Aucune dépendance ne doit utiliser un slug ; les liens du référentiel et des prestations d'atelier portent la clé stable.");
}

// --- A10 : codes de domaine ASCII + libellés ----------------------------------------------
const DOMAIN_LABELS = {
  COUTURE: "Couture",
  COUVRURE: "Couvrure",
  CORPS_D_OUVRAGE: "Corps d'ouvrage",
  DORURE_TITRAGE: "Dorure & titrage",
  DOS_ENDOSSURE: "Dos & endossure",
  EXAMEN_PREPARATION: "Examen & préparation",
  FINITIONS: "Finitions",
  GARDES: "Gardes",
  PLATS_CARTONS: "Plats & cartons",
  PRESTATIONS_COMMERCIALES: "Prestations commerciales",
  PROTECTION_CARTONNAGE: "Protection & cartonnage",
  RESTAURATION_PAPIER: "Restauration du papier",
  RESTAURATION_RELIURE: "Restauration de la reliure",
  TRANCHES: "Tranches",
};
const domainCode = (raw) => stripDiacritics(raw).toUpperCase();
for (const code of unique(OPS.map((o) => o.domain))) {
  if (domainCode(code) !== code) {
    const n = OPS.filter((o) => o.domain === code).length;
    log("A10", "code de domaine", code, code, domainCode(code), "Code irrégulier : un accent au milieu de codes ASCII.", `${n} entrées ; aucun effet visible (le libellé affiché est « ${DOMAIN_LABELS[domainCode(code)]} »).`);
  }
  if (!DOMAIN_LABELS[domainCode(code)]) fail(`domaine sans libellé : ${code}`);
}

// --- A7 : nature des entrées ---------------------------------------------------------------
const KIND_OF_TYPE = {
  atomic_operation: "operation",
  commercial_service: "package",
  composite_operation: "package",
  diagnostic: "diagnostic",
  surcharge: "adjustment",
  option: "adjustment",
  material: "material_choice",
};
const KIND_OVERRIDES = {
  "OPR-0187": ["generic_quote", "« Prestation sur devis » est la ligne libre du devis, déjà offerte partout : ce n'est pas une prestation à importer."],
};
const INACTIVE = {
  "OPR-0187": "Remplacée par la ligne libre du devis (toujours disponible) : retirée des propositions.",
};

// --- unités et modes (A6) ------------------------------------------------------------------
const UNIT_VOCABULARY = [
  ["ouvrage", "par ouvrage"], ["volume", "par volume"], ["cahier", "par cahier"], ["feuillet", "par feuillet"],
  ["tranche", "par tranche"], ["plat", "par plat"], ["dos", "par dos"], ["garde", "par garde"], ["coin", "par coin"],
  ["coiffe", "par coiffe"], ["mors", "par mors"], ["nerf", "par nerf"], ["titre", "par titre"], ["ligne", "par ligne"],
  ["caractère", "par caractère"], ["pièce", "par pièce"], ["motif", "par motif"], ["boîte", "par boîte"],
  ["cm", "par cm"], ["cm²", "par cm²"],
];
const UNIT_BY_SOURCE = new Map(UNIT_VOCABULARY.map(([key, label]) => [label, key]));
UNIT_BY_SOURCE.set("par feuille", "feuillet"); // même sens : la feuille de papier
const MODE_BY_SOURCE = new Map([["par heure", "hourly"], ["forfait", "fixed"], ["sur devis", "on_quote"]]);
const MODE_ORDER = ["per_unit", "hourly", "fixed", "on_quote"];
const droppedUnits = new Map(); // unité source → clés d'entrées

// --- champs retirés (A11) ---------------------------------------------------------------------
const EMPTY_LIKE = (v) => v === undefined || v === null || v === "" || v === "unknown" || (Array.isArray(v) && v.length === 0);
const DROPPED_FIELDS = [
  ["price_drivers", "Vide sur les 195 entrées : le référentiel ne porte aucune logique de prix."],
  ["complexity_drivers", "Vide sur les 195 entrées."],
  ["condition_driver", "« unknown » sur les 195 entrées."],
  ["preferred_unit_if_documented", "« unknown » sur les 195 entrées."],
  ["historical_terms", "Vide sur les 195 entrées : aucun terme historique n'est retenu dans cette version."],
  ["minimum_charge_possible", "Texte identique sur les 195 entrées (« possible selon politique de l'atelier ») : ce n'est pas une donnée."],
  ["dimension_driver", "Texte quasi identique (« format, hauteur, largeur et épaisseur ») : boilerplate."],
  ["quantity_driver", "« unknown » sur 193 entrées ; les 2 valeurs renseignées ne suffisent pas à un pilotage."],
  ["material_driver", "« unknown » sur 192 entrées ; les 3 valeurs renseignées ne suffisent pas à un pilotage."],
  ["incompatible_with", "Vide sur les 195 entrées."],
  ["tools_or_techniques", "Non utilisé par le produit en V1."],
  ["applicable_to", "Non utilisé par le produit en V1."],
  ["materials_commonly_used", "Texte libre non relié au référentiel des matériaux : ne doit pas faire remonter une opération sur un mot de matériau (recherche « cuir »)."],
  ["internal_only_possible", "Non utilisé par le produit en V1."],
  ["hierarchy_level", "Niveaux mélangés (A8) : la hiérarchie est remplacée par le seul lien de variante `variantOf`."],
];
for (const [field, reason] of DROPPED_FIELDS) {
  const filled = OPS.filter((o) => !EMPTY_LIKE(o[field]));
  log("A11", "champ retiré", field, { entriesWithAValue: filled.length, of: OPS.length, samples: unique(filled.map((o) => JSON.stringify(o[field]))).slice(0, 3) }, null, reason,
    filled.length > 0 ? `${filled.length} valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.` : "Aucune information perdue.");
}
{
  const noteCounts = OPS.reduce((m, o) => ((m[o.notes] = (m[o.notes] ?? 0) + 1), m), {});
  var BOILERPLATE_NOTES = new Set(Object.entries(noteCounts).filter(([, n]) => n >= 10).map(([note]) => note));
  log("A11", "champ retiré", "notes (texte répété)", { repeatedTexts: [...BOILERPLATE_NOTES], entries: OPS.filter((o) => BOILERPLATE_NOTES.has(o.notes)).length }, null,
    "Texte répété sur 10 entrées ou plus : c'est du boilerplate. Les notes propres à une entrée sont conservées (`internalNotes`).", "Aucune information propre à une entrée perdue.");
}

// --- sources : URL → clé -------------------------------------------------------------------
const SOURCE_KEY_BY_URL = new Map(Object.entries(rawOps.metadata.sources).map(([key, url]) => [url, key]));
const sourcesOf = (o) => unique([o.source_1, o.source_2, o.source_3].filter((u) => u && u !== "unknown").map((u) => SOURCE_KEY_BY_URL.get(u) ?? fail(`source inconnue : ${u}`)));

// --- V3 / V4 : entrées à faire relire en plus de la source -------------------------------------
const nameToKey = new Map();
for (const o of OPS) nameToKey.set(norm(o.canonical_name_fr), keyOf(o.operation_id));
const keyByName = (name) => nameToKey.get(norm(name)) ?? fail(`entrée introuvable : ${name}`);
const EXTRA_VALIDATION = [
  ...["Réparation de cahier", "Réparation de fond de cahier", "Réparation de cahier papier"].map((n) => [n, "V3", "Recouvrement fonctionnel probable avec deux autres « réparations de cahier » : à trancher par un relieur."]),
  ...["Nettoyage à sec préparatoire", "Nettoyage à sec de feuillet"].map((n) => [n, "V3", "Recouvrement fonctionnel probable entre deux nettoyages à sec."]),
  ...["Mise en presse préparatoire", "Mise sous presse des plats", "Mise sous presse finale"].map((n) => [n, "V3", "Trois « mises sous presse » au vocabulaire incohérent (« en presse » / « sous presse »)."]),
  ["Emboîtage", "V3", "Son synonyme « réemboîtage » est aussi une entrée distincte (OPR-0073)."],
  ["Dos brisé", "V4", "Terme de structure de reliure qui recoupe le langage d'état (« dos brisé » = abîmé) : ambigu pour un particulier."],
].map(([name, rule, reason]) => ({ key: keyByName(name), rule, reason }));
const extraValidation = new Map();
for (const e of EXTRA_VALIDATION) extraValidation.set(e.key, e);

// --- variantes (A3 / A8) ------------------------------------------------------------------------
const GENUINE_VARIANT_PARENTS = new Set(["OPR-0027", "OPR-0157", "OPR-0164"]); // couture de cahiers, étui simple, boîte de conservation
const variantOf = new Map();
for (const o of OPS) {
  const key = keyOf(o.operation_id);
  const parent = o.parent_operation_id && o.parent_operation_id !== "unknown" ? keyOf(o.parent_operation_id) : null;
  if (!parent) continue;
  if (GENUINE_VARIANT_PARENTS.has(parent)) {
    variantOf.set(key, parent);
    log("A8", "hiérarchie", key, { parent: o.parent_operation_id, level: o.hierarchy_level }, { variantOf: parent },
      "Vraie variante d'une même opération (type de couture, d'étui, de boîte) : conservée sous `variantOf`, un concept à part des prérequis.",
      "Aucun effet sur la recherche ; une variante n'est jamais un prérequis.");
  } else {
    log("A8", "hiérarchie", key, { parent: o.parent_operation_id, level: o.hierarchy_level }, { variantOf: null },
      "Le « parent » (Couvrure) est aussi un composant de ce service (il l'inclut) : ce n'est pas une variante. La classification par domaine COUVRURE reste.",
      "Aucun effet visible. Le composant éventuel est décrit par les relations `operation_components`, pas par une hiérarchie.");
  }
}

// --- kinds, unités, entrées -------------------------------------------------------------------
const domainsUsed = new Set();
const operations = OPS.map((o) => {
  const key = keyOf(o.operation_id);
  if (!KIND_OF_TYPE[o.entity_type]) fail(`type d'entrée inconnu : ${o.entity_type}`);
  let kind = KIND_OF_TYPE[o.entity_type];
  if (KIND_OVERRIDES[key]) kind = KIND_OVERRIDES[key][0];
  if (kind !== "operation") {
    const reason = KIND_OVERRIDES[key]?.[1] ?? {
      package: "Prestation commerciale ou composée : proposée comme une prestation à part entière (jamais comme une checklist).",
      diagnostic: "Diagnostic : proposé comme une prestation.",
      adjustment: "Majoration, remise ou forfait de préparation : un ajustement commercial, pas une opération technique. Il reste un mécanisme distinct du devis et n'est pas proposé dans la recherche métier.",
      material_choice: "Choix de matériau, pas une prestation : ne doit jamais remonter comme si c'en était une.",
    }[kind];
    log("A7", "nature de l'entrée", key, { entity_type: o.entity_type, name: o.canonical_name_fr }, { kind }, reason,
      ["package", "diagnostic"].includes(kind) ? "Importable dans le catalogue de l'atelier." : "Non importable dans le catalogue de l'atelier ; conservée dans la ressource.");
  }

  const rawUnits = o.unit_candidates ?? [];
  const units = [];
  const modes = new Set();
  for (const u of rawUnits) {
    if (UNIT_BY_SOURCE.has(u)) units.push(UNIT_BY_SOURCE.get(u));
    else if (MODE_BY_SOURCE.has(u)) modes.add(MODE_BY_SOURCE.get(u));
    else droppedUnits.set(u, [...(droppedUnits.get(u) ?? []), key]);
  }
  if (units.length) modes.add("per_unit");
  const unitCandidates = unique(units);
  const pricingModes = MODE_ORDER.filter((m) => modes.has(m));

  const notes = BOILERPLATE_NOTES.has(o.notes) || EMPTY_LIKE(o.notes) ? null : o.notes;
  const customerName = norm(o.customer_friendly_name ?? "") === norm(o.canonical_name_fr) ? null : (o.customer_friendly_name ?? null);
  const extra = extraValidation.get(key);
  const needsBinderValidation = Boolean(o.needs_binder_validation) || Boolean(extra);
  if (extra && !o.needs_binder_validation) {
    log(extra.rule, "à valider", key, { needs_binder_validation: false }, { needsBinderValidation: true }, extra.reason, "Signalée pour relecture par un relieur du pilote (interne : jamais affichée au relieur).");
  }
  let synonyms = unique(o.synonyms ?? []);
  if (key === "OPR-0072") {
    const before = synonyms;
    synonyms = synonyms.filter((s) => norm(s) !== norm("réemboîtage"));
    if (before.length !== synonyms.length) {
      log("V3", "synonyme en collision", key, { synonyms: before }, { synonyms }, "« réemboîtage » est aussi le nom canonique d'une autre entrée (OPR-0073) : un même mot ne désigne pas deux entrées.", "La recherche « réemboîtage » remonte OPR-0073 en premier.");
    }
  }
  domainsUsed.add(domainCode(o.domain));
  const isActive = !INACTIVE[key];
  if (!isActive) log("A7", "entrée inactive", key, { active: true }, { active: false }, INACTIVE[key], "Jamais proposée ni importée.");
  return {
    key,
    version: VERSION,
    canonicalName: o.canonical_name_fr,
    customerName,
    domain: domainCode(o.domain),
    family: o.family,
    subfamily: o.subfamily,
    kind,
    variantOf: variantOf.get(key) ?? null,
    technicalDescription: o.technical_definition,
    customerDescription: o.customer_friendly_description,
    synonyms,
    searchKeywords: unique(o.search_keywords ?? []),
    unitCandidates,
    pricingModes,
    interventionModes: unique((o.intervention_modes ?? []).map((m) => ({ "fabrication / reliure neuve": "fabrication", réparation: "reparation", restauration: "restauration", conservation: "conservation" })[m] ?? fail(`mode d'intervention inconnu : ${m}`))),
    restorationRelated: Boolean(o.restoration_related),
    gildingRelated: Boolean(o.gilding_related),
    fineBinderyRelevant: Boolean(o.fine_bindery_relevant),
    customerVisible: Boolean(o.customer_visible),
    standalone: Boolean(o.standalone_possible),
    needsBinderValidation,
    confidence: o.confidence,
    sources: sourcesOf(o),
    internalNotes: notes,
    active: isActive,
  };
});

// A6 : unités et modes
for (const [u, label] of [...UNIT_BY_SOURCE.entries()].filter(([, key]) => key)) {
  const entries = OPS.filter((o) => (o.unit_candidates ?? []).includes(u)).length;
  if (entries) log("A6", "unité", u, u, { unit: label && UNIT_BY_SOURCE.get(u) }, "Unité du vocabulaire contrôlé (20 unités + « Autre » côté atelier).", `${entries} entrées.`);
}
for (const [u, mode] of MODE_BY_SOURCE) {
  const entries = OPS.filter((o) => (o.unit_candidates ?? []).includes(u)).length;
  log("A6", "mode de prix", u, { unit_candidates: u }, { pricingModes: mode }, "« " + u + " » est un mode de tarification, pas une unité : séparé de `unitCandidates`.", `${entries} entrées.`);
}
for (const [u, keys] of [...droppedUnits.entries()].sort((a, b) => b[1].length - a[1].length)) {
  log("A6", "unité non retenue", u, u, null,
    u === "pourcentage" ? "Un pourcentage est un ajustement, pas un mode de prix de reliure : hors vocabulaire." : "Unité de longue traîne (hors du vocabulaire contrôlé court). L'atelier la saisit via « Autre » s'il la pratique.",
    `${keys.length} entrée(s) : ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", …" : ""}. Aucune information de prix perdue.`);
}

// --- relations -------------------------------------------------------------------------------
const rel = rawRels.relations;
const SEQ = []; // { id, prerequisite, dependent, origin, needsBinderValidation, notes }
const COMP = [];
const ALT = [];
const pairKey = (a, b) => `${a}>${b}`;
const usedPairs = new Map(); // "a|b" non orienté → famille
const undirected = (a, b) => [a, b].sort().join("|");
const validationNotes = [];

for (const r of rel) {
  const from = keyOf(r.from_operation_id);
  const to = keyOf(r.to_operation_id);
  if (from === to) fail(`auto-relation ${r.relation_id}`);
  if (!byKey.has(from) || !byKey.has(to)) fail(`relation vers une clé inconnue : ${r.relation_id}`);
  const note = r.notes ?? null;
  if (r.relation_type === "depends_on") {
    // A5 : la paire Boîte de conservation → Calage intérieur est aussi une inclusion (REL-0033).
    const dup = rel.find((x) => x.relation_type === "may_include" && keyOf(x.from_operation_id) === from && keyOf(x.to_operation_id) === to);
    if (dup) {
      log("A5", "relation en double", r.relation_id, { relation: r.relation_id, type: "depends_on", from: r.from_operation_id, to: r.to_operation_id }, null,
        `La même paire est aussi typée « may_include » (${dup.relation_id}). Une paire ne figure que dans une seule famille : l'inclusion est conservée.`,
        "Aucun effet : l'inclusion (« peut inclure ») décrit mieux Boîte de conservation → Calage intérieur qu'une séquence.");
      continue;
    }
    SEQ.push({ id: r.relation_id, prerequisite: from, dependent: to, origin: "relations", note });
    log("A1", "sens de la relation", r.relation_id, { from: r.from_operation_id, to: r.to_operation_id, type: "depends_on" }, { prerequisite: from, dependent: to },
      "Le gabarit du fichier est « `to` intervient habituellement après ou avec `from` » : lu littéralement, « from depends_on to » dit le contraire. Les colonnes sont désormais nommées par rôle.",
      "Sens inchangé, nom corrigé. C'est descriptif (« habituellement après ou avec »), jamais une contrainte.");
  } else if (r.relation_type === "may_include") {
    COMP.push({ id: r.relation_id, composite: from, component: to, origin: "relations", note });
  } else if (r.relation_type === "alternative_to") {
    const [a, b] = [from, to].sort();
    ALT.push({ id: r.relation_id, a, b, origin: "relations", note });
    if (a !== from) log("A1", "paire normalisée", r.relation_id, { from, to }, { a, b }, "Relation non orientée : ordre canonique a < b.", "Aucun.");
  } else fail(`type de relation inconnu : ${r.relation_type}`);
}

// A2/A3 : les « prerequisites » propres aux entrées
const MANUAL_DROPPED_PREREQ = new Map([
  ["OPR-0028>OPR-0027", "Dans l'ordre d'atelier usuel le grecquage précède la couture ; la relation REL-0004 place d'ailleurs Grecquage avant la couture à la grecque. Décision éditoriale à valider par un relieur du pilote."],
]);
const hasSeq = (a, b) => SEQ.some((s) => s.prerequisite === a && s.dependent === b);
const reachable = (from, to) => {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const n = stack.pop();
    if (n === to) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const s of SEQ) if (s.prerequisite === n) stack.push(s.dependent);
  }
  return false;
};
let derived = 0;
const newId = () => `REL-${String(40 + derived++).padStart(4, "0")}`;
for (const o of OPS) {
  const dependent = keyOf(o.operation_id);
  for (const raw of o.prerequisites ?? []) {
    const prerequisite = keyOf(raw);
    const subject = `${dependent} ← ${prerequisite}`;
    const before = { entry: dependent, prerequisites: raw };
    if (variantOf.get(dependent) === prerequisite) {
      log("A3", "variante codée comme prérequis", subject, before, null,
        "« est une variante de » n'est pas « nécessite » : la couture sur ficelles / nerfs / à la grecque est une variante de la couture de cahiers.", "Le lien de variante est conservé sous `variantOf` ; plus aucun prérequis.");
    } else if (hasSeq(prerequisite, dependent)) {
      log("A2", "prérequis redondant", subject, before, null, "Déjà décrit par une relation `operation_sequences`.", "Aucune perte.");
    } else if (hasSeq(dependent, prerequisite) || reachable(dependent, prerequisite)) {
      log("A2", "prérequis contredit", subject, before, null,
        `Le sens inverse est décrit par les relations (${SEQ.filter((s) => s.prerequisite === dependent && (s.dependent === prerequisite)).map((s) => s.id).join(", ") || "chemin de relations"}) : l'ordre métier retenu est celui du fichier de relations.`,
        "L'entrée n'est plus en contradiction avec les relations. À valider par un relieur.");
      validationNotes.push(subject);
    } else if (MANUAL_DROPPED_PREREQ.has(pairKey(dependent, prerequisite))) {
      log("A2", "prérequis contredit (ordre d'atelier)", subject, before, null, MANUAL_DROPPED_PREREQ.get(pairKey(dependent, prerequisite)), "Retiré ; à valider par un relieur.");
    } else {
      const id = newId();
      SEQ.push({ id, prerequisite, dependent, origin: "entry_prerequisites", note: null });
      log("A2", "prérequis converti en relation", subject, before, { relation: id, prerequisite, dependent },
        "Le prérequis déclaré dans l'entrée n'était décrit nulle part ailleurs : il devient une relation `operation_sequences` explicite (descriptive), à valider.", "Nouvelle relation informative « habituellement après ou avec ».");
    }
  }
}

// A4 : « commonly_bundled » en texte libre → composants, quand le texte désigne une entrée sans ambiguïté
const searchable = OPS.map((o) => ({ key: keyOf(o.operation_id), names: [o.canonical_name_fr, o.customer_friendly_name, ...(o.synonyms ?? [])].filter(Boolean).map(norm) }));
for (const o of OPS) {
  const composite = keyOf(o.operation_id);
  for (const text of o.commonly_bundled ?? []) {
    const matches = unique(searchable.filter((s) => s.key !== composite && s.names.includes(norm(text))).map((s) => s.key));
    if (matches.length === 1) {
      const component = matches[0];
      const already = COMP.some((c) => c.composite === composite && c.component === component) || SEQ.some((s) => undirected(s.prerequisite, s.dependent) === undirected(composite, component));
      if (already) {
        log("A4", "texte libre déjà décrit", `${composite} ~ ${text}`, { commonly_bundled: text }, { component }, "Le texte désigne une entrée dont la paire figure déjà dans une relation.", "Aucun ajout.");
      } else {
        const id = newId();
        COMP.push({ id, composite, component, origin: "commonly_bundled", note: `Issu du texte libre « ${text} ».` });
        log("A4", "texte libre résolu", `${composite} ~ ${text}`, { commonly_bundled: text }, { relation: id, composite, component }, "Le texte désigne exactement une entrée : il devient une relation `operation_components` (« peut inclure »), à valider.", "Nouvelle relation informative.");
      }
    } else {
      log("A4", "texte libre non résolu", `${composite} ~ ${text}`, { commonly_bundled: text }, null,
        matches.length === 0 ? "Le texte ne désigne aucune entrée (ou un domaine, pas une opération)." : `Le texte est ambigu (${matches.join(", ")}).`, "Aucune relation créée ; l'information reste dans la source brute.");
    }
  }
}

// related_operations : pas une des trois familles
for (const o of OPS) {
  for (const raw of o.related_operations ?? []) {
    const a = keyOf(o.operation_id);
    const b = keyOf(raw);
    const where = [
      SEQ.some((s) => undirected(s.prerequisite, s.dependent) === undirected(a, b)) && "operation_sequences",
      COMP.some((c) => undirected(c.composite, c.component) === undirected(a, b)) && "operation_components",
      ALT.some((x) => undirected(x.a, x.b) === undirected(a, b)) && "operation_alternatives",
    ].filter(Boolean);
    log("A2", "opération liée (hors des trois familles)", `${a} ~ ${b}`, { related_operations: raw }, null,
      where.length ? `Paire déjà décrite dans ${where.join(", ")}.` : "« Liée à » n'est ni une séquence, ni une inclusion, ni une alternative : pas de famille pour la porter.",
      where.length ? "Aucune perte." : "Information non reprise ; à réintroduire dans la bonne famille après relecture.");
  }
}

// contrôles d'intégrité de la sortie
const familyOfPair = new Map();
for (const [family, list, f] of [["operation_sequences", SEQ, (r) => [r.prerequisite, r.dependent]], ["operation_components", COMP, (r) => [r.composite, r.component]], ["operation_alternatives", ALT, (r) => [r.a, r.b]]]) {
  for (const r of list) {
    const [x, y] = f(r);
    if (!byKey.has(x) || !byKey.has(y)) fail(`${r.id} référence une clé inconnue`);
    const u = undirected(x, y);
    if (familyOfPair.has(u)) fail(`la paire ${u} figure dans deux familles (${familyOfPair.get(u)} et ${family})`);
    familyOfPair.set(u, family);
  }
}
{
  const state = new Map();
  const visit = (n) => {
    if (state.get(n) === 1) fail(`boucle dans operation_sequences via ${n}`);
    if (state.get(n) === 2) return;
    state.set(n, 1);
    for (const s of SEQ) if (s.prerequisite === n) visit(s.dependent);
    state.set(n, 2);
  };
  for (const o of operations) visit(o.key);
}

// Un lien à valider : issu d'une conversion / d'un texte libre, contredit, ou dont une extrémité est à valider.
const validationByKey = new Map(operations.map((o) => [o.key, o.needsBinderValidation]));
const touchesContradiction = (r) => ["REL-0011", "REL-0004"].includes(r.id);
const relNeedsValidation = (r, [x, y]) => r.origin !== "relations" || touchesContradiction(r) || validationByKey.get(x) || validationByKey.get(y);
const sequences = SEQ.map((r) => ({ id: r.id, prerequisite: r.prerequisite, dependent: r.dependent, origin: r.origin, needsBinderValidation: Boolean(relNeedsValidation(r, [r.prerequisite, r.dependent])), notes: r.note })).sort((a, b) => a.id.localeCompare(b.id));
const components = COMP.map((r) => ({ id: r.id, composite: r.composite, component: r.component, origin: r.origin, needsBinderValidation: Boolean(relNeedsValidation(r, [r.composite, r.component])), notes: r.note })).sort((a, b) => a.id.localeCompare(b.id));
const alternatives = ALT.map((r) => ({ id: r.id, a: r.a, b: r.b, origin: r.origin, needsBinderValidation: Boolean(relNeedsValidation(r, [r.a, r.b])), notes: r.note })).sort((a, b) => a.id.localeCompare(b.id));
for (const [list, name] of [[sequences, "operation_sequences"], [components, "operation_components"], [alternatives, "operation_alternatives"]]) {
  console.log(`${name.padEnd(24)} ${list.length} (dont à valider : ${list.filter((r) => r.needsBinderValidation).length})`);
}
log("A2", "indicateur de validation des relations", "39 relations d'origine", { needs_binder_validation: "absent (jamais marqué)" }, { needsBinderValidation: "true si créée par conversion, contredite, ou si une extrémité est à valider" },
  "La séquence exacte des opérations fait partie des zones à faire relire : aucune des 39 relations n'était marquée.", "Interne au pilotage du référentiel ; jamais affiché au relieur.");

operations.sort((a, b) => a.key.localeCompare(b.key));
if (operations.some((o, i) => o.key !== `OPR-${String(i + 1).padStart(4, "0")}`)) fail("clés non continues");

// --- écriture -------------------------------------------------------------------------------
const count = (f) => operations.filter(f).length;
const kinds = Object.fromEntries(["operation", "package", "diagnostic", "adjustment", "material_choice", "generic_quote"].map((k) => [k, count((o) => o.kind === k)]));
const IMPORTABLE_KINDS = ["operation", "package", "diagnostic"];
const importable = count((o) => IMPORTABLE_KINDS.includes(o.kind) && o.active);
const manifest = {
  version: VERSION,
  publishedOn: PUBLISHED_ON,
  language: "fr",
  sourceDataset: { title: rawOps.metadata.title, version: rawOps.metadata.version, files: sourceFiles },
  domains: Object.fromEntries([...domainsUsed].sort().map((d) => [d, DOMAIN_LABELS[d]])),
  sources: rawOps.metadata.sources,
  importableKinds: IMPORTABLE_KINDS,
  counts: {
    operations: operations.length,
    byKind: kinds,
    active: count((o) => o.active),
    importable,
    needsBinderValidation: count((o) => o.needsBinderValidation),
    customerVisible: count((o) => o.customerVisible),
    relations: { operation_sequences: sequences.length, operation_components: components.length, operation_alternatives: alternatives.length },
    relationsNeedingValidation: [...sequences, ...components, ...alternatives].filter((r) => r.needsBinderValidation).length,
  },
};
const json = (v) => JSON.stringify(v, null, 2) + "\n";
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });
writeFileSync(resolve(OUT, "operations.json"), json(operations));
writeFileSync(resolve(OUT, "relations.json"), json({ operation_sequences: sequences, operation_components: components, operation_alternatives: alternatives }));
writeFileSync(resolve(OUT, "manifest.json"), json(manifest));

// --- journal ----------------------------------------------------------------------------------
const RULES = {
  A1: "Sens de `depends_on` ambigu",
  A2: "Contradictions et sources multiples de relations",
  A3: "Variante encodée comme prérequis",
  A4: "`commonly_bundled` en texte libre",
  A5: "Même paire typée deux fois",
  A6: "Unités et modes de prix mélangés",
  A7: "Entrées qui ne sont pas des opérations",
  A8: "Hiérarchie mélangée",
  A9: "Identifiants instables",
  A10: "Codes de domaine irréguliers",
  A11: "Champs promis mais vides ou boilerplate",
  V3: "Doublons fonctionnels probables",
  V4: "Termes ambigus pour un particulier",
};
writeFileSync(resolve(DOCS, "journal.json"), json({ version: VERSION, generatedFrom: sourceFiles, entries: journal }));
const cell = (v) => (v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v)).replace(/\|/g, "\\|").replace(/\n/g, " ");
const md = [];
md.push(`# Journal de normalisation — ${VERSION}`, "");
md.push("Généré par `scripts/buildReliureReference.mjs` (rejouable, déterministe). **Rien n'est corrigé en silence** : chaque écart de l'audit du 20/09/2026 (A1–A11, V3, V4) est listé avec l'ancien contenu, le nouveau, la raison, le type de correction et l'impact. Le détail complet, entrée par entrée, est dans `journal.json`.", "");
md.push(`Source brute : ${sourceFiles.map((f) => `\`${f.name}\` (sha256 \`${f.sha256.slice(0, 16)}…\`)`).join(", ")} — **hors du dépôt, jamais modifiée**. Les prix publics observés et les matériaux ne sont **pas lus** par ce script.`, "");
md.push("## Bilan", "");
md.push(`- Entrées : **${operations.length}** — actives ${manifest.counts.active}, importables dans un catalogue (operation + package + diagnostic, actives) **${importable}**.`);
md.push(`- Par nature : ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(" · ")}.`);
md.push(`- Entrées « à valider » (interne) : **${manifest.counts.needsBinderValidation}** (${count((o) => o.needsBinderValidation) - OPS.filter((o) => o.needs_binder_validation).length} ajoutée(s) par la normalisation, source : ${OPS.filter((o) => o.needs_binder_validation).length}).`);
md.push(`- Relations : ${sequences.length} séquences · ${components.length} inclusions · ${alternatives.length} alternatives ; à valider : ${manifest.counts.relationsNeedingValidation}.`, "");
md.push("| Règle | Sujet | Corrections |", "| --- | --- | ---: |");
for (const [rule, title] of Object.entries(RULES)) md.push(`| ${rule} | ${title} | ${journal.filter((j) => j.rule === rule).length} |`);
md.push("");
for (const [rule, title] of Object.entries(RULES)) {
  const entries = journal.filter((j) => j.rule === rule);
  md.push(`## ${rule} — ${title}`, "");
  if (!entries.length) { md.push("Aucune correction.", ""); continue; }
  // Les corrections de même type, même raison, même impact sont regroupées : la raison est dite une fois.
  const groups = new Map();
  for (const e of entries) {
    const g = `${e.type} ${e.reason}`;
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  for (const list of groups.values()) {
    const [first] = list;
    const sameImpact = list.every((e) => e.impact === first.impact);
    md.push(`**${first.type}** (${list.length}) — *Raison :* ${first.reason}${sameImpact ? ` *Impact :* ${first.impact}` : ""}`, "");
    const shown = list.length > 40 ? list.slice(0, 5) : list;
    md.push(sameImpact ? "| # | Sujet | Ancien contenu | Nouveau contenu |" : "| # | Sujet | Ancien contenu | Nouveau contenu | Impact |", sameImpact ? "| --- | --- | --- | --- |" : "| --- | --- | --- | --- | --- |");
    for (const e of shown) md.push(`| ${e.id} | ${cell(e.subject)} | ${cell(e.before)} | ${cell(e.after)} |${sameImpact ? "" : ` ${cell(e.impact)} |`}`);
    if (shown.length < list.length) md.push("", `… et ${list.length - shown.length} autres (liste complète dans \`journal.json\`).`);
    md.push("");
  }
}
md.push("## Relations issues de la normalisation", "");
md.push("| Famille | Id | Description | Origine | À valider |", "| --- | --- | --- | --- | :---: |");
const nameOf = (k) => operations.find((o) => o.key === k).canonicalName;
for (const r of sequences) md.push(`| operation_sequences | ${r.id} | ${nameOf(r.prerequisite)} → ${nameOf(r.dependent)} (habituellement après ou avec) | ${r.origin} | ${r.needsBinderValidation ? "oui" : "non"} |`);
for (const r of components) md.push(`| operation_components | ${r.id} | ${nameOf(r.composite)} peut inclure ${nameOf(r.component)} | ${r.origin} | ${r.needsBinderValidation ? "oui" : "non"} |`);
for (const r of alternatives) md.push(`| operation_alternatives | ${r.id} | ${nameOf(r.a)} ⇄ ${nameOf(r.b)} | ${r.origin} | ${r.needsBinderValidation ? "oui" : "non"} |`);
md.push("");
writeFileSync(resolve(DOCS, "normalization-journal.md"), md.join("\n"));

console.log(`\n${VERSION} : ${operations.length} entrées, ${importable} importables, ${manifest.counts.needsBinderValidation} à valider ; ${journal.length} corrections journalisées.`);
console.log("par nature :", JSON.stringify(kinds));
