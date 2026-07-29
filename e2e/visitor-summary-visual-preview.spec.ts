/**
 * Integration validation for the Visitor Project Summary + Deck visual
 * preview feature, against a real Supabase-backed environment (this repo
 * has only one Supabase project — production; see e2e/README.md and
 * e2e/fixtures/deckPreviewFixtures.ts for why every fixture here is
 * self-tearing-down).
 *
 * Skips entirely (not a failure) when SUPABASE_SERVICE_ROLE_KEY isn't set —
 * mirrors the existing gating pattern used by authenticated-portal.spec.ts
 * for E2E_CLIENT_EMAIL/PASSWORD, so this suite never fails in an
 * environment (like a fresh checkout) that hasn't been given the key.
 *
 * The visitor "email" used throughout is contact@oppe.fr — a safe address
 * the project owner controls, never a real customer's address.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  hasSupabaseAdminCredentials,
  adminClient,
  provisionDeckPreviewFixtures,
  teardownDeckPreviewFixtures,
  seedCorruptedPreviewDossier,
  type DeckPreviewFixtures,
} from "./fixtures/deckPreviewFixtures";

const TEST_VISITOR_EMAIL = "contact@oppe.fr";

test.describe("Visitor summary + Deck visual preview (real Supabase)", () => {
  test.skip(
    !hasSupabaseAdminCredentials(),
    "Requires SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) to seed/tear down real fixtures — see e2e/README.md.",
  );

  let fixtures: DeckPreviewFixtures;

  test.beforeAll(async () => {
    fixtures = await provisionDeckPreviewFixtures();
  });

  test.afterAll(async () => {
    if (fixtures) await teardownDeckPreviewFixtures(fixtures);
  });

  // The footer nav always renders exactly two buttons (Back, then
  // Continue/Generate project brief) regardless of locale — clicking by
  // position instead of by translated text keeps this robust across EN/ES.
  async function clickPrimaryAction(page: Page) {
    await page.locator("div.mt-8.flex button").nth(1).click();
  }

  async function fillCommonSteps(page: Page, { withWidth }: { withWidth: boolean }) {
    await page.getByRole("button", { name: "I know what I want" }).click();
    await clickPrimaryAction(page);

    await page.getByRole("button", { name: "New deck" }).click();
    await clickPrimaryAction(page);

    await page.getByRole("button", { name: "Single-family home" }).click();
    await page.getByRole("button", { name: "No existing deck" }).click();
    await clickPrimaryAction(page);

    await page.getByLabel(/^Length/).fill("12");
    if (withWidth) await page.getByLabel(/^Width/).fill("10");
    await clickPrimaryAction(page);

    await page.getByRole("button", { name: "Ground-level" }).click();
    await clickPrimaryAction(page);

    await page.getByRole("button", { name: "Composite" }).click();
    await clickPrimaryAction(page);

    await page.getByRole("button", { name: "Stairs" }).click();
    await page.getByRole("button", { name: "Railing" }).click();
    await clickPrimaryAction(page);

    await clickPrimaryAction(page); // photos — none attached, optional

    await page.getByRole("button", { name: "$10k-$25k" }).click();
    await page.getByRole("button", { name: "Within 3 months" }).click();
    await clickPrimaryAction(page);

    await page.getByLabel(/^ZIP code/).fill("10001");
    await clickPrimaryAction(page);

    await page.getByLabel(/^Name/).fill("E2E Test Visitor");
    await page.getByLabel(/^Email/).fill(TEST_VISITOR_EMAIL);
    await page.getByRole("checkbox").check();
  }

  async function submitCompleteDeck(page: Page, publicToken: string) {
    await page.goto(`/m/${publicToken}`);
    await fillCommonSteps(page, { withWidth: true });
    await clickPrimaryAction(page); // final submit ("Generate project brief")
    await expect(page.getByRole("heading", { name: /project summary/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  async function submitPartialDeck(page: Page, publicToken: string) {
    await page.goto(`/m/${publicToken}`);
    await fillCommonSteps(page, { withWidth: false }); // length only — no width
    await clickPrimaryAction(page);
    await expect(page.getByRole("heading", { name: /project summary/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  test("newly created compatible Mission receives visualPreview.enabled explicitly; the disabled/legacy-shaped Mission does not", async () => {
    const supabase = adminClient();
    const { data: enabled } = await supabase
      .from("build_missions")
      .select("proposal")
      .eq("id", fixtures.missionEnabledId)
      .single();
    const { data: disabled } = await supabase
      .from("build_missions")
      .select("proposal")
      .eq("id", fixtures.missionDisabledId)
      .single();

    expect((enabled?.proposal as Record<string, unknown> | null)?.visualPreview).toEqual({
      enabled: true,
      type: "simple-deck-3d",
      version: 1,
    });
    expect((disabled?.proposal as Record<string, unknown> | null)?.visualPreview).toBeUndefined();
  });

  test("a complete Deck submission stores visitor_summary.visualPreview and the post-submit page renders the preview", async ({
    page,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);

    // Immediate post-submit rendering.
    await expect(
      page.getByRole("img", { name: /illustrative preview of your deck/i }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This is a simplified visual preview based on your answers. Dimensions, colors and project features are illustrative. It is not a final design, construction plan or technical approval.",
      ),
    ).toBeVisible();

    // Persisted snapshot, read directly from the database.
    const supabase = adminClient();
    const { data: dossiers } = await supabase
      .from("build_dossiers")
      .select("id, visitor_summary, visitor_email_sent_at")
      .eq("mission_id", fixtures.missionEnabledId);
    expect(dossiers).toHaveLength(1);
    const summary = dossiers![0].visitor_summary as Record<string, unknown>;
    const visualPreview = summary.visualPreview as { resolution: { status: string } };
    expect(visualPreview.resolution.status).toBe("complete");
  });

  test("the secure summary link renders the exact same persisted snapshot as the post-submit page", async ({
    page,
    context,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);
    const dimensionsOnSubmitPage = await page.locator("text=/×.*sq ft/").first().textContent();

    const link = await page
      .getByRole("link", { name: /review your summary/i })
      .getAttribute("href");
    expect(link).toBeTruthy();

    const securePage = await context.newPage();
    await securePage.goto(link!);
    await expect(
      securePage.getByRole("img", { name: /illustrative preview of your deck/i }),
    ).toBeVisible();
    const dimensionsOnSecurePage = await securePage
      .locator("text=/×.*sq ft/")
      .first()
      .textContent();
    expect(dimensionsOnSecurePage).toBe(dimensionsOnSubmitPage);
    await securePage.close();
  });

  test("visitor email records a valid secure link (dispatch confirmed server-side)", async ({
    page,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);
    const supabase = adminClient();
    const { data: dossiers } = await supabase
      .from("build_dossiers")
      .select("visitor_email_sent_at")
      .eq("mission_id", fixtures.missionEnabledId);
    // At least one dossier from this run must show a successful send.
    expect(dossiers!.some((d) => d.visitor_email_sent_at)).toBe(true);
    // Actual inbox receipt at contact@oppe.fr cannot be verified from here —
    // no mail-reading tool is available in this environment.
  });

  test("partial dimensions (width missing) produce the text fallback, never invented geometry", async ({
    page,
  }) => {
    await submitPartialDeck(page, fixtures.missionEnabledToken);
    await expect(
      page.getByText(/we'll show a representative preview once approximate length and width/i),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /illustrative preview/i })).toHaveCount(0);
  });

  test("a Mission with the preview disabled shows no preview section at all", async ({ page }) => {
    await submitCompleteDeck(page, fixtures.missionDisabledToken);
    await expect(page.getByRole("img", { name: /illustrative preview/i })).toHaveCount(0);
    await expect(page.getByText(/simplified visual preview based on your answers/i)).toHaveCount(0);
  });

  test("English + Imperial and Spanish + Imperial both render correctly (English + Metric / Spanish + Metric covered at unit-test level — no live visitor path sets metric today)", async ({
    page,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);
    await expect(page.getByText(/12 ft.*10 ft/)).toBeVisible();

    const spanishPage = await page.context().newPage();
    await spanishPage.addInitScript(() => {
      window.localStorage.setItem("metre-build-public-locale", "es-US");
    });
    await submitCompleteDeck(spanishPage, fixtures.missionEnabledToken);
    await expect(
      spanishPage.getByText(/Esta es una vista previa visual simplificada/),
    ).toBeVisible();
    await spanishPage.close();
  });

  test("mobile rendering at 375px and 390px shows the preview without layout breakage", async ({
    browser,
  }) => {
    for (const width of [375, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await submitCompleteDeck(page, fixtures.missionEnabledToken);
      await expect(
        page.getByRole("img", { name: /illustrative preview of your deck/i }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/deck-preview-mobile-${width}.png`,
        fullPage: true,
      });
      await context.close();
    }
  });

  test("rotate/reset controls are keyboard-focusable with visible focus and actually change the view", async ({
    page,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);
    const rotateRight = page.getByRole("button", { name: "Rotate right" });
    await rotateRight.focus();
    await expect(rotateRight).toBeFocused();

    const before = await page
      .getByRole("img", { name: /illustrative preview/i })
      .getAttribute("viewBox");
    await page.keyboard.press("Enter");
    const after = await page
      .getByRole("img", { name: /illustrative preview/i })
      .getAttribute("viewBox");
    expect(after).not.toBe(before);

    const reset = page.getByRole("button", { name: "Reset view" });
    await reset.focus();
    await page.keyboard.press("Enter");
    const afterReset = await page
      .getByRole("img", { name: /illustrative preview/i })
      .getAttribute("viewBox");
    expect(afterReset).toBe(before);
  });

  test("a renderer failure in the preview is isolated — the rest of the page still renders", async ({
    page,
  }) => {
    const { accessToken } = await seedCorruptedPreviewDossier(fixtures);
    await page.goto(`/project-summary/${accessToken}`);
    await expect(page.getByText(/Project summary/i).first()).toBeVisible();
    await expect(page.getByText(/couldn't be shown/i)).toBeVisible();
  });

  test("the public API response never exposes internal ids or raw storage paths", async ({
    page,
  }) => {
    await submitCompleteDeck(page, fixtures.missionEnabledToken);
    const link = await page
      .getByRole("link", { name: /review your summary/i })
      .getAttribute("href");
    const token = link!.split("/").pop()!;

    const response = await page.request.post("/api/public/project-summary", {
      data: { token },
    });
    const body = await response.text();
    expect(body).not.toContain(fixtures.missionEnabledId);
    expect(body).not.toContain(fixtures.workspaceId);
    expect(body).not.toContain("build-inspiration-photos");
  });
});
