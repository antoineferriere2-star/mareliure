import { expect, test } from "@playwright/test";

const EXPECTED = {
  en: "We take responsibility for the entire journey of your book.",
  fr: "Nous prenons en charge tout le parcours de votre livre.",
  de: "Wir übernehmen die Verantwortung für den gesamten Weg Ihres Buches.",
  it: "Ci assumiamo la responsabilità dell’intero viaggio del tuo libro.",
  es: "Nos responsabilizamos de todo el recorrido de tu libro.",
} as const;

const HTML_LANG = { en: "en-GB", fr: "fr", de: "de-DE", it: "it-IT", es: "es-ES" } as const;

test.describe.configure({ timeout: 60_000 });

const EUROPEAN_QA = {
  de: { question: "Was möchten Sie mit Ihrem Buch machen?", continue: "Weiter", validation: "Bitte prüfen Sie Folgendes" },
  it: { question: "Cosa desideri fare con il tuo libro?", continue: "Continua", validation: "Controlla quanto segue" },
  es: { question: "¿Qué quieres hacer con tu libro?", continue: "Continuar", validation: "Revise lo siguiente" },
} as const;

for (const [locale, heading] of Object.entries(EXPECTED)) {
  test(`FineBindery ${locale} has localized chrome and SEO`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale as keyof typeof HTML_LANG], { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://finebindery.com/${locale}`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", "https://finebindery.com/en");
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(6);
    await page.screenshot({ path: `output/finebindery-i18n-qa/${locale}-desktop.png`, fullPage: true });
  });
}

test("language switch keeps the current public surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  await page.goto("/de");
  await page.getByRole("link", { name: "IT" }).click();
  await expect(page).toHaveURL(/\/it$/);
});

for (const [locale, expected] of Object.entries(EUROPEAN_QA)) {
  test(`FineBindery ${locale} keeps project and validation localized`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.goto(`/${locale}/project`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(expected.question, { timeout: 20_000 });
    await expect(page.getByText("Repairing a damaged book", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: expected.continue }).click();
    await expect(page.getByRole("alert")).toContainText(expected.validation);
    await expect(page.getByRole("alert")).not.toContainText("Please check");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `output/finebindery-i18n-qa/${locale}-project-validation.png`, fullPage: true });
  });
}

for (const width of [375, 390, 430]) {
  test(`German landing remains responsive at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium");
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/de");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(EXPECTED.de);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `output/finebindery-i18n-qa/de-mobile-${width}.png`, fullPage: true });
  });
}
