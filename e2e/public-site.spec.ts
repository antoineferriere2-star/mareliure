import { expect, test } from "@playwright/test";

// These tests cover only the anonymous marketing surface: page loads, nav,
// and client-side form validation gating. They never click a final Submit
// button, since /free-inquiry-audit and /private-beta write real rows to
// the live Supabase project (no separate test project exists yet - see
// e2e/README.md). Anything past this point (self-service signup, AI
// onboarding, publish, visitor submission, portal Dossier visibility) is
// intentionally out of scope for the same reason.

test.describe("home page", () => {
  test("loads with the primary CTA hierarchy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Try the Live Deck Intake" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get a Free Website Inquiry Audit" }).first(),
    ).toBeVisible();
  });

  test("lets visitors switch the home page language and keeps the choice", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "ES", exact: true }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Convierta consultas vagas de su sitio web/,
      }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es-US");

    await page.reload();
    await expect(page.getByRole("button", { name: "ES", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "es-US");
  });

  test("uses the selected language across the public site", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Choose site language").selectOption("es-US");

    await page.goto("/deck-builders");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Califique proyectos de terraza antes de la primera llamada comercial.",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Choose site language")).toHaveValue("es-US");

    await page.goto("/how-it-works");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "De una consulta vaga a un Project Brief estructurado.",
      }),
    ).toBeVisible();

    await page.goto("/example-project-brief");
    await expect(
      page.getByRole("heading", { level: 1, name: "Project Brief de ejemplo" }),
    ).toBeVisible();

    await page.goto("/free-inquiry-audit");
    await expect(page.getByLabel("URL del sitio web")).toBeVisible();
    await expect(page.getByRole("button", { name: "Auditar mi sitio web" })).toBeVisible();

    await page.goto("/private-beta");
    await expect(page.getByText(/Paso 1 de 4/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacidad" })).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Términos" })).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1, name: /Contactar a/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeVisible();

    // `/demo/deck-project` needs Supabase runtime secrets locally; the route
    // falls back to a server runtime error in this E2E environment before the
    // client locale provider hydrates.
  });

  test("top nav reaches every published page", async ({ page, isMobile }) => {
    // The header nav is intentionally hidden below the md breakpoint (no
    // hamburger menu exists); the footer links (tested separately below)
    // are the mobile-safe way to reach every page.
    test.skip(isMobile, "header nav collapses below md; footer nav covers mobile");
    await page.goto("/");
    await page.getByRole("link", { name: "Deck builders" }).first().click();
    await expect(page).toHaveURL(/\/deck-builders$/);

    await page.getByRole("link", { name: "How it works" }).first().click();
    await expect(page).toHaveURL(/\/how-it-works$/);

    await page.getByRole("link", { name: "Example brief" }).first().click();
    await expect(page).toHaveURL(/\/example-project-brief$/);

    await page.getByRole("link", { name: "Free audit" }).first().click();
    await expect(page).toHaveURL(/\/free-inquiry-audit$/);

    await page.getByRole("link", { name: "Contact" }).first().click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("footer reaches the legal pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Terms" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  });
});

test.describe("deck-builders page", () => {
  test("primary CTA everywhere is the audit, per the confirmed CTA hierarchy", async ({ page }) => {
    await page.goto("/deck-builders");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get a Free Website Inquiry Audit" }).first(),
    ).toBeVisible();
  });
});

test.describe("private-beta guided intake stepper", () => {
  test("gates Continue until the website URL is valid, then progresses through steps", async ({
    page,
  }) => {
    await page.goto("/private-beta");
    await expect(page.getByText(/Step 1 of 4/)).toBeVisible();

    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();

    // SSR renders the input before React hydrates its onChange handler; filling
    // too early lands the value before hydration reconciles, and it disappears.
    // Waiting for the network to go idle gives hydration time to finish first.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Website URL").fill("https://example-deck-builder.com");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page.getByText(/Step 2 of 4/)).toBeVisible();
    await expect(continueButton).toBeDisabled();
    await page.getByRole("button", { name: "Deck builder" }).click();
    await expect(continueButton).toBeEnabled();

    // Back navigation must never drop what was already entered.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText(/Step 1 of 4/)).toBeVisible();
    await expect(page.getByLabel("Website URL")).toHaveValue("https://example-deck-builder.com");
  });
});

test.describe("free inquiry audit page", () => {
  test("renders the audit request form", async ({ page }) => {
    await page.goto("/free-inquiry-audit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });
});

test.describe("contact page", () => {
  test("renders the contact form without submitting real email", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /Contact/ })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Subject")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  });
});
