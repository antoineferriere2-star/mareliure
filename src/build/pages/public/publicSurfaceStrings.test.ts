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
