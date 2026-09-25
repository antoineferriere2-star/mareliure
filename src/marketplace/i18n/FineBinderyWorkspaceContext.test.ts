import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FINE_BINDERY_LOCALES } from "./fineBinderyLocale";
import { PROFESSIONAL_COPY } from "./FineBinderyWorkspaceContext";

const LAYOUT = readFileSync(new URL("../../routes/_authenticated/atelier/route.tsx", import.meta.url), "utf8");

describe("FineBindery connected workspace chrome", () => {
  it("translates its accessibility labels in every supported language", () => {
    for (const locale of FINE_BINDERY_LOCALES) {
      const copy = PROFESSIONAL_COPY[locale];
      expect(copy.skipToContent).not.toBe("");
      expect(copy.workspaceNavigation).not.toBe("");
      expect(copy.mobileNavigation).not.toBe("");
    }
    expect(PROFESSIONAL_COPY.de.skipToContent).toBe("Zum Inhalt springen");
    expect(PROFESSIONAL_COPY.it.skipToContent).toBe("Vai al contenuto");
    expect(PROFESSIONAL_COPY.es.skipToContent).toBe("Ir al contenido");
  });

  it("uses the active language for visible and assistive navigation", () => {
    expect(LAYOUT).toContain("{copy.skipToContent}");
    expect(LAYOUT).toContain("aria-label={copy.workspaceNavigation}");
    expect(LAYOUT).toContain("aria-label={copy.mobileNavigation}");
    expect(LAYOUT).not.toContain('aria-label="Espace atelier"');
    expect(LAYOUT).not.toContain('aria-label="Navigation mobile"');
  });

  it("offers all five languages in desktop and mobile navigation", () => {
    expect(LAYOUT).toContain("FINE_BINDERY_LOCALES.map");
    expect(LAYOUT).toContain("setLocale");
    expect(LAYOUT).toContain("compact locale={locale}");
  });
});
