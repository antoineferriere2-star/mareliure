import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { breadcrumbSchema, fineBinderyWebsiteSchema, MARELIURE_SITE_URL } from "./structured-data";
import { fineBinderyDirectoryHead, fineBinderyHomeHead } from "@/marketplace/i18n/fineBinderySeo";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const ldOf = (head: { scripts?: { children: string }[] }) => (head.scripts ?? []).map((script) => JSON.parse(script.children));

describe("données structurées des sites publics", () => {
  it("le fil d'Ariane de Ma Reliure commence par « Accueil »", () => {
    const crumbs = breadcrumbSchema([{ name: "Tarifs", path: "/tarifs" }], MARELIURE_SITE_URL, "Accueil");
    expect(crumbs.itemListElement[0]).toMatchObject({ name: "Accueil", item: "https://mareliure.fr/" });
    expect(read("src/routes/tarifs.tsx")).toContain('MARELIURE_SITE_URL, "Accueil")');
    expect(read("src/routes/partenaires-relieurs.tsx")).toContain('"Accueil",');
  });

  it("la page relieurs balise les questions qu'elle affiche, depuis le même tableau", () => {
    expect(read("src/routes/partenaires-relieurs.tsx")).toContain("faqPageSchema(PARTNER_FAQ)");
  });

  it("Fine Bindery déclare ses cinq langues", () => {
    expect(fineBinderyWebsiteSchema.inLanguage).toEqual([...FINE_BINDERY_LOCALES]);
  });

  it.each([...FINE_BINDERY_LOCALES])("l'accueil Fine Bindery (%s) balise sa FAQ dans sa langue", (locale) => {
    const [faq] = ldOf(fineBinderyHomeHead(locale));
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(fineBinderyCopy(locale).home.faq.map((item) => item.question));
  });

  it.each([...FINE_BINDERY_LOCALES])("l'annuaire Fine Bindery (%s) porte un fil d'Ariane localisé", (locale) => {
    const [crumbs] = ldOf(fineBinderyDirectoryHead(locale));
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement[1]).toMatchObject({ name: fineBinderyCopy(locale).nav.workshops, item: `https://finebindery.com/${locale}/professionals` });
  });
});

describe("le paquet principal des pages publiques", () => {
  it("n'importe le client Supabase qu'à la demande (attacheur de jeton et garde d'authentification)", () => {
    expect(read("src/start.ts")).toContain("attachSupabaseAuthLazily");
    expect(read("src/start.ts")).not.toContain('from "@/integrations/supabase/auth-attacher"');
    expect(read("src/integrations/supabase/lazy-auth-attacher.ts")).toContain('await import("./client")');
    expect(read("src/routes/_authenticated/route.tsx")).not.toMatch(/^import \{ supabase \}/m);
  });
});
