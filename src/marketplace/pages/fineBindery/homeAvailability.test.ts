import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FineBinderyLandingPage } from "./FineBinderyLanding";
import { loadFineBinderyHomeAvailability } from "./homeAvailability";
import { listPublicFineBinderyProfiles } from "@/marketplace/services/fineBinderyProfile.data.functions";
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";

vi.mock("@/marketplace/services/fineBinderyProfile.data.functions", () => ({ listPublicFineBinderyProfiles: vi.fn() }));
vi.mock("@/marketplace/i18n/FineBinderyLanguageSwitch", () => ({ FineBinderyLanguageSwitch: () => null, useFineBinderyDocumentLocale: () => undefined }));
vi.mock("@/build/pages/public/usePageViewTracking", () => ({ usePageViewTracking: () => undefined }));

describe("home directory availability", () => {
  it("rechecks the directory as profiles are published and unpublished", async () => {
    const list = vi.mocked(listPublicFineBinderyProfiles);
    list.mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: "qa-atelier" }] as Awaited<ReturnType<typeof listPublicFineBinderyProfiles>>)
      .mockResolvedValueOnce([]);
    expect(await loadFineBinderyHomeAvailability()).toBe(false);
    expect(await loadFineBinderyHomeAvailability()).toBe(true);
    expect(await loadFineBinderyHomeAvailability()).toBe(false);
  });

  it("does not advertise an unverified directory when the query fails", async () => {
    vi.mocked(listPublicFineBinderyProfiles).mockRejectedValueOnce(new Error("offline"));
    expect(await loadFineBinderyHomeAvailability()).toBe(false);
  });

  it.each(FINE_BINDERY_LOCALES)("keeps %s actions honest in both states, including mobile navigation and footer", (locale) => {
    const render = (hasPublishedProfiles: boolean) => renderToStaticMarkup(createElement(FineBinderyLandingPage, { locale, hasPublishedProfiles }));
    const empty = render(false);
    expect(empty).not.toContain(`href="/${locale}/professionals"`);
    expect(empty.match(new RegExp(`href="/${locale}#workshops"`, "g"))).toHaveLength(3);
    expect(empty).toContain(`href="/${locale}/project"`);
    expect(empty).toContain('id="workshops"');
    expect(empty).not.toContain(fineBinderyCopy(locale).home.paths[0].title);
    const published = render(true);
    // Four content links plus desktop navigation, mobile navigation and footer.
    expect(published.match(new RegExp(`href="/${locale}/professionals"`, "g"))).toHaveLength(7);
    expect(published).not.toContain(`href="/${locale}#workshops"`);
    expect(published).toContain(`href="/${locale}/project"`);
  });
});
