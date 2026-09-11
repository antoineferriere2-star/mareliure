import { expect, test, type Browser, type Page } from "@playwright/test";

const caseId = process.env.E2E_MARKETPLACE_CASE_ID;
const adminEmail = process.env.E2E_MARKETPLACE_ADMIN_EMAIL;
const adminPassword = process.env.E2E_MARKETPLACE_ADMIN_PASSWORD;
const binderEmail = process.env.E2E_MARKETPLACE_BINDER_EMAIL;
const binderPassword = process.env.E2E_MARKETPLACE_BINDER_PASSWORD;
const customerEmail = process.env.E2E_MARKETPLACE_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_MARKETPLACE_CUSTOMER_PASSWORD;
const binderName = process.env.E2E_MARKETPLACE_BINDER_NAME;

const ready = Boolean(
  caseId &&
  adminEmail &&
  adminPassword &&
  binderEmail &&
  binderPassword &&
  customerEmail &&
  customerPassword &&
  binderName,
);

async function signIn(page: Page, target: string, email: string, password: string) {
  await page.goto(`/auth?redirect=${encodeURIComponent(target)}`);
  // Ma Reliure's /auth leads with the emailed sign-in link; test accounts use
  // the password path reserved for workshops and the team.
  await page.getByRole("button", { name: /se connecter avec un mot de passe/ }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.replaceAll("/", "\\/")), { timeout: 30_000 });
}

async function freshRolePage(browser: Browser, target: string, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, target, email, password);
  return { context, page };
}

test.describe("managed marketplace reference journey", () => {
  test.describe.configure({ mode: "serial" });

  test("490 € customer price, 400 € workshop payout, acceptance and admin selection", async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The stateful reference journey runs once in the desktop project.");
    test.skip(
      !ready,
      "Set the E2E_MARKETPLACE_* variables with a fresh development case and three disposable accounts.",
    );

    const adminTarget = `/marketplace/cases/${caseId}`;
    const admin = await freshRolePage(browser, adminTarget, adminEmail!, adminPassword!);
    const review = admin.page.getByRole("button", { name: /préparer le prix/i });
    if (await review.isVisible()) await review.click();
    const generate = admin.page.getByRole("button", { name: "Calculer une suggestion" });
    if (await generate.isVisible()) {
      await generate.click();
      await expect(admin.page.getByLabel("Prix client (€)")).not.toHaveValue("");
    }
    await admin.page.getByLabel("Prix client (€)").fill("490");
    await admin.page.getByLabel("Rémunération atelier (€)").fill("400");
    await expect(admin.page.getByText(/Marge : 90,00 € · 18,4 %/)).toBeVisible();
    await admin.page.getByRole("button", { name: "Valider le prix" }).click();
    await expect(admin.page.getByText("Validé", { exact: true })).toBeVisible();
    const binderCard = admin.page
      .getByText(binderName!, { exact: false })
      .first()
      .locator("xpath=ancestor::label");
    const checkbox = binderCard.getByRole("checkbox");
    if (!(await checkbox.count())) {
      await admin.page.getByRole("checkbox").first().check();
    } else {
      await checkbox.check();
    }
    await admin.page.getByRole("button", { name: "Envoyer le projet à ces relieurs" }).click();

    const binderTarget = `/atelier/cases/${caseId}`;
    const binder = await freshRolePage(browser, binderTarget, binderEmail!, binderPassword!);
    await expect(binder.page.getByText("400,00 €")).toBeVisible();
    await binder.page.getByRole("button", { name: "Accepter cette offre" }).click();
    await expect(binder.page.getByText(/Offre acceptée/)).toBeVisible();

    await admin.page.reload();
    await admin.page.getByRole("button", { name: "Retenir cet atelier" }).click();
    await expect(admin.page.getByText("selected", { exact: true })).toBeVisible();

    const customerTarget = `/mes-livres/${caseId}`;
    const customer = await freshRolePage(
      browser,
      customerTarget,
      customerEmail!,
      customerPassword!,
    );
    await expect(customer.page.getByText("490,00 €")).toBeVisible();
    await expect(customer.page.getByText(binderName!, { exact: false })).toBeVisible();

    await Promise.all([admin.context.close(), binder.context.close(), customer.context.close()]);
  });
});
