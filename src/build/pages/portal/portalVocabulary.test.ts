// One concept, one word, per register.
//
// CLAUDE.md keeps Mission / Playbook / Dossier Commercial as the *internal*
// vocabulary — tables, types, identifiers, commits — because that model is
// what stops anyone calling a Mission a "form" or a Dossier a "lead". What a
// customer reads is a separate register, and it was inconsistent: the
// marketing site sold a "Project Intake" and a "Project Brief", then the
// portal handed the same person "Missions" and "Dossiers". They signed up for
// one product and logged into another.
//
// This guards the customer-facing half. It deliberately does NOT look at
// identifiers: `listWorkspaceMissions`, `build_dossiers` and `missionId` are
// correct and must stay.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PORTAL = join(process.cwd(), "src/routes/_authenticated/portal");

function portalFiles(): string[] {
  return readdirSync(PORTAL).filter((f) => f.endsWith(".tsx"));
}

/** Strip comments, imports and JSX expressions so only rendered text and literals remain. */
function readableText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^import[\s\S]*?from\s+".*?";$/gm, "");
}

/** Text a person actually sees: JSX text nodes and double-quoted string literals. */
function visibleStrings(source: string): string[] {
  const text = readableText(source);
  const jsx = [...text.matchAll(/>\s*([A-Z][^<>{}\n]{2,80}?)\s*</g)].map((m) => m[1]!);
  const literals = [...text.matchAll(/"([^"\\]{4,120})"/g)].map((m) => m[1]!);
  return [...jsx, ...literals].filter((s) => /[a-z]/.test(s) && !s.includes("/"));
}

describe("the portal speaks the language the customer bought in", () => {
  it.each(portalFiles())("%s shows no internal term to a customer", (file) => {
    const offenders = visibleStrings(readFileSync(join(PORTAL, file), "utf8")).filter((s) =>
      /\b(Dossiers?|Missions?)\b/.test(s),
    );
    expect(offenders, `${file} renders internal vocabulary`).toEqual([]);
  });

  it("uses the same words the marketing site sells", () => {
    const route = readFileSync(join(PORTAL, "route.tsx"), "utf8");
    expect(route).toContain("Project Briefs");
    expect(route).toContain("Project Intakes");
  });

  it("keeps the internal names in code, untouched", () => {
    // The other half of the rule. Renaming these would be the actual mistake:
    // the conceptual model is what CLAUDE.md protects.
    const missions = readFileSync(join(PORTAL, "missions.tsx"), "utf8");
    expect(missions).toContain("listWorkspaceMissions");
    expect(missions).toContain("setMissionPaused");
  });

  it("never lets a banned word in, whichever register", () => {
    // Project Intake is not "Form"; Project Brief is not "Lead". Switching
    // register must not become an excuse to switch concept.
    for (const file of portalFiles()) {
      const shown = visibleStrings(readFileSync(join(PORTAL, file), "utf8")).join(" | ");
      expect(shown, file).not.toMatch(/\b(lead|leads|form submission|questionnaire)\b/i);
    }
  });
});
