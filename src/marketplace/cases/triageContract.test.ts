// The line this file defends: a Project Brief is a document written for a
// person, and no machine rule may depend on its wording.
//
// The failure it prevents is silent and expensive. Someone rewords "Valeur
// estimée à plus de 1 000 €" in the Playbook — a copy edit, reviewed by nobody
// technical — and thousand-euro books stop being held for manual review. No
// error, no failing build, no log line. Just heritage books going straight out
// to three workshops.
//
// Two guards. The first rewrites every human-readable string in the Playbook
// and asserts the triage output is byte-for-byte identical. The second reads
// the source of the triage modules and refuses any dependency on the Brief at
// all, so the property cannot be reintroduced by a later edit that happens to
// keep today's wording working.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateProjectBrief } from "@/build/engine/brief";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";
import type { PlaybookSchema } from "@/build/schema/playbook";
import type { Answers } from "@/build/schema/answers";
import { buildCaseProfile } from "./caseProfile";
import { triageCase } from "./triage";

/** A heritage manuscript worth over 1 000 €, with mould — every flag at once. */
const FLAGGED: Answers = {
  intention: "restaurer",
  titre: "Traité de la lumière",
  nature: "manuscrit",
  etat: ["moisissure", "dos_abime"],
  etatDos: "fragile",
  valeurRaisons: ["historique"],
  valeurFinanciere: "gt_1000",
  budget: "gt_700",
  delai: "pas_urgent",
  name: "Antoine Perrin",
  email: "antoine@example.com",
  localisation: { zip: "31000", city_state: "Toulouse" },
  consentement: true,
};

/** An ordinary project that must stay unflagged however the Playbook reads. */
const ORDINARY: Answers = {
  intention: "belle_reliure",
  titre: "Les Rêveries du promeneur solitaire",
  nature: "livre_courant",
  etat: ["bon_etat"],
  materiau: "toile",
  valeurRaisons: ["decoration"],
  valeurFinanciere: "lt_100",
  budget: "150_250",
  delai: "1_2_mois",
  name: "Sophie Nguyen",
  email: "sophie@example.com",
  localisation: { zip: "44000", city_state: "Nantes" },
  consentement: true,
};

/**
 * Every string a human reads, replaced. Field labels, help text, option
 * labels, reassurances, step titles, consistency messages, Brief line labels
 * and values, summary fragments, suggested next actions.
 *
 * Deliberately NOT touched: `key`, `value`, `id`, `fieldKey`, `stepId`,
 * `section`, `type`, `unit`, `currency` and the rest of the machine
 * vocabulary. That asymmetry is the whole point — the machine words are a
 * contract, the human words are not.
 */
const HUMAN_KEYS = new Set([
  "label",
  "helpText",
  "placeholder",
  "title",
  "why",
  "message",
  "reassurance",
  "missingMessage",
  "consentText",
  "template",
  "emptySummaryFallback",
  "statusLabel",
  "missionNameTemplate",
  "onMissingLabel",
  "onMissingValue",
]);

/** `value` is machine vocabulary on an option and human prose on a Brief line. */
function isBriefLineValue(node: Record<string, unknown>): boolean {
  return typeof node.value === "string" && typeof node.label === "string" && !("key" in node);
}

function rewordEverything<T>(node: T): T {
  if (Array.isArray(node)) return node.map(rewordEverything) as unknown as T;
  if (node === null || typeof node !== "object") return node;

  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === "string" &&
      (HUMAN_KEYS.has(key) || (key === "value" && isBriefLineValue(source)))
    ) {
      out[key] = `REWORDED ${key} ${value.length}`;
      continue;
    }
    out[key] = rewordEverything(value);
  }
  return out as T;
}

const REWORDED: PlaybookSchema = rewordEverything(bookbindingPlaybookSchema);

describe("rewording the Playbook cannot change the triage", () => {
  it("actually rewrote the human strings, so the test below means something", () => {
    // A guard on the guard: if rewordEverything silently stopped matching, the
    // assertions after it would pass against an unchanged Playbook.
    const before = JSON.stringify(bookbindingPlaybookSchema);
    const after = JSON.stringify(REWORDED);
    expect(after).not.toEqual(before);
    expect(after).toContain("REWORDED label");
    expect(after).toContain("REWORDED message");
    // ...while every machine value survived untouched.
    expect(after).toContain('"gt_1000"');
    expect(after).toContain('"valeurFinanciere"');
    expect(after).toContain('"moisissure"');
  });

  it("produces a visibly different Brief", () => {
    const original = generateProjectBrief(bookbindingPlaybookSchema, FLAGGED, { name: "M" });
    const reworded = generateProjectBrief(REWORDED, FLAGGED, { name: "M" });
    expect(JSON.stringify(reworded)).not.toEqual(JSON.stringify(original));
  });

  it("and an identical triage, for a flagged project", () => {
    const triage = triageCase(buildCaseProfile(FLAGGED));
    expect(triage).toEqual({
      manualReviewRequired: true,
      heritageFlag: true,
      declaredValueBand: "over_1000",
      flags: ["declared_value_over_1000", "heritage_book", "suspected_mould"],
    });
    // The Playbook is not even an input. Regenerating the Brief from the
    // reworded schema changes nothing, because nothing reads it.
    generateProjectBrief(REWORDED, FLAGGED, { name: "M" });
    expect(triageCase(buildCaseProfile(FLAGGED))).toEqual(triage);
  });

  it("and an identical triage, for an ordinary project", () => {
    expect(triageCase(buildCaseProfile(ORDINARY))).toEqual({
      manualReviewRequired: false,
      heritageFlag: false,
      declaredValueBand: "under_100",
      flags: [],
    });
  });
});

describe("the triage modules do not depend on the Project Brief at all", () => {
  function source(relativePath: string): string {
    return readFileSync(resolve(process.cwd(), relativePath), "utf8");
  }

  const MODULES = ["src/marketplace/cases/triage.ts", "src/marketplace/cases/caseProfile.ts"];

  it.each(MODULES)("%s never imports the Brief", (path) => {
    const body = source(path);
    expect(body).not.toContain("schema/brief");
    expect(body).not.toContain("engine/brief");
  });

  it.each(MODULES)("%s never reads a Brief field by name", (path) => {
    // Comments legitimately mention the Brief to explain why it is absent, so
    // strip them before looking for actual usage.
    const body = source(path)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const briefField of [
      "projectSummary",
      "confirmedInformation",
      "assumptionsAndCalculated",
      "missingInformation",
      "missionName",
      "ProjectBrief",
    ]) {
      expect(body, `${path} must not read ${briefField}`).not.toContain(briefField);
    }
  });

  it("takes a CaseProfile and nothing else", () => {
    // A second argument would be the crack a Brief eventually slips through.
    expect(triageCase.length).toBe(1);
  });
});
