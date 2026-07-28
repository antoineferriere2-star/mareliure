// Regression guard: none of these French strings or raw internal
// technical keys should ever appear again on the public marketing
// surface. Scoped to files actually reachable from an unauthenticated
// public route — private/admin route files are explicitly allowed to
// keep their own French UI and are excluded on purpose.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..", "..");

const PUBLIC_SURFACE_FILES = [
  "src/build/pages/public/BuildPublicHome.tsx",
  "src/build/pages/public/BuildPublicShell.tsx",
  "src/build/pages/public/BuildMarketingPages.tsx",
  "src/build/pages/public/BuildPublicFormPages.tsx",
  "src/build/pages/public/MissionRuntime.tsx",
  "src/build/pages/public/BriefPreview.tsx",
  "src/build/pages/public/BriefSummary.tsx",
  "src/build/pages/public/AdminPreviewShots.tsx",
  "src/build/pages/public/sections/InspirationSection.tsx",
  "src/build/pages/public/sections/BeforeAfterSection.tsx",
  "src/build/pages/public/sections/InsideMetreBuildSection.tsx",
  "src/build/pages/public/sections/HeroTransformShot.tsx",
  "src/build/engine/fields/InspirationPhotoField.tsx",
  "src/build/components/DetectionBadge.tsx",
  "src/build/pages/admin/onboarding/SingleChoiceConfirmStep.tsx",
  "src/build/pages/admin/onboarding/PlaybookMatchStep.tsx",
  "src/lib/structured-data.ts",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
  "src/routes/deck-builders.tsx",
  "src/routes/how-it-works.tsx",
  "src/routes/example-project-brief.tsx",
  "src/routes/free-inquiry-audit.tsx",
  "src/routes/private-beta.tsx",
  "src/routes/privacy.tsx",
  "src/routes/terms.tsx",
];

const BANNED_STRINGS = [
  "Hypothèses",
  "Non détecté",
  "Pistes à explorer",
  "Détecté automatiquement",
  "Autre (préciser)",
  "Retour",
  "visitor_answer",
  "calculated_value",
  "deterministic_rule",
  "assumed_default",
  "Private beta",
  "Project Mission",
  "every visitor",
  "ready-to-quote",
  "sales-ready project briefs",
];

describe("public marketing surface — banned strings", () => {
  for (const file of PUBLIC_SURFACE_FILES) {
    it(`${file} contains none of the banned French/internal strings`, () => {
      const source = readFileSync(resolve(repoRoot, file), "utf8");
      for (const banned of BANNED_STRINGS) {
        expect(source, `found banned string "${banned}" in ${file}`).not.toContain(banned);
      }
    });
  }
});

describe("public marketing surface - marketing proposition", () => {
  it("keeps the confirmed homepage positioning", () => {
    const homeSource = readFileSync(
      resolve(repoRoot, "src/build/pages/public/BuildPublicHome.tsx"),
      "utf8",
    );
    const messagesSource = readFileSync(resolve(repoRoot, "src/build/i18n/messages.ts"), "utf8");

    expect(homeSource).toContain('t(locale, "home.hero.eyebrow")');
    expect(homeSource).toContain('t(locale, "home.hero.title")');
    expect(messagesSource).toContain("Guided project intake for project-based contractors");
    expect(messagesSource).toContain(
      "Turn vague website inquiries into structured Project Briefs your team can act on.",
    );
    expect(messagesSource).toContain(
      "More useful than a contact form. Simpler than a custom configurator.",
    );
  });

  it("exposes a persistent English and Spanish language choice on the public surface", () => {
    const shellSource = readFileSync(
      resolve(repoRoot, "src/build/pages/public/BuildPublicShell.tsx"),
      "utf8",
    );
    const localeSource = readFileSync(
      resolve(repoRoot, "src/build/pages/public/publicLocaleContext.ts"),
      "utf8",
    );

    expect(shellSource).toContain("PublicLanguageSelect");
    expect(localeSource).toContain("metre-build-public-locale");
    expect(localeSource).toContain('"en-US"');
    expect(localeSource).toContain('"es-US"');
  });

  it("wires the selected public language into the runtime intake labels", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/build/pages/public/MissionRuntime.tsx"),
      "utf8",
    );

    expect(source).toContain("usePublicLocale");
    expect(source).toContain("localizeField(field, copy)");
    expect(source).toContain('copy("Continue")');
    expect(source).toContain('copy("Generate project brief")');
  });

  it("keeps the free audit offer concrete and bounded", () => {
    const source = readFileSync(
      resolve(repoRoot, "src/build/pages/public/BuildPublicFormPages.tsx"),
      "utf8",
    );

    expect(source).toContain("review your current inquiry flow");
    expect(source).toContain("recommended intake path");
    expect(source).toContain("No obligation.");
  });
});
