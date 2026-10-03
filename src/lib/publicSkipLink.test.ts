import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("le lien d'évitement des sites publics", () => {
  it("ouvre les deux entêtes et vise #contenu", () => {
    expect(read("src/marketplace/pages/landing/LandingChrome.tsx")).toContain('<SkipLink label="Aller au contenu" />');
    expect(read("src/marketplace/pages/fineBindery/FineBinderyChrome.tsx")).toContain("<SkipLink label={SKIP_LABEL[locale]} />");
  });

  it.each([
    "src/marketplace/pages/ReliureLanding.tsx",
    "src/marketplace/pages/TarifsPage.tsx",
    "src/marketplace/pages/partners/PartnersLanding.tsx",
    "src/marketplace/pages/fineBindery/FineBinderyLanding.tsx",
    "src/marketplace/pages/fineBindery/PublicWorkshopPages.tsx",
    "src/marketplace/pages/legal/LegalPages.tsx",
    "src/marketplace/pages/landing/MaReliureFallbackPages.tsx",
  ])("%s porte la cible <main id=\"contenu\">", (file) => {
    expect(read(file)).toContain('<main id="contenu"');
  });
});
