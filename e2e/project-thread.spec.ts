import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Le suivi de commande de bout en bout, sans e-mail ni téléphone échangé entre
 * le client et l'atelier.
 *
 * Ma Reliure confirme la commande ; l'atelier confirme la réception, écrit,
 * commence, demande une couleur avec deux photos ; le client choisit Bordeaux ;
 * l'atelier voit le choix, demande la confirmation du titrage ; le client
 * confirme ; l'atelier publie une photo d'avancement puis termine ; le client
 * lit « Votre livre est terminé ».
 *
 * Sauté tant que toutes les variables E2E_PROJECT_* ne sont pas posées. À
 * pointer uniquement sur la base de développement, avec un dossier au statut
 * « atelier retenu », rattaché au compte client jetable, dont l'atelier retenu
 * est le compte atelier jetable. Le scénario fait avancer ce dossier : il ne se
 * rejoue pas sur le même dossier.
 */
const caseId = process.env.E2E_PROJECT_CASE_ID;
const adminEmail = process.env.E2E_PROJECT_ADMIN_EMAIL;
const adminPassword = process.env.E2E_PROJECT_ADMIN_PASSWORD;
const binderEmail = process.env.E2E_PROJECT_BINDER_EMAIL;
const binderPassword = process.env.E2E_PROJECT_BINDER_PASSWORD;
const customerEmail = process.env.E2E_PROJECT_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_PROJECT_CUSTOMER_PASSWORD;

const ready = Boolean(
  caseId &&
  adminEmail &&
  adminPassword &&
  binderEmail &&
  binderPassword &&
  customerEmail &&
  customerPassword,
);

/** Un PNG d'un pixel : assez pour exercer l'envoi signé et l'affichage. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PIXEL });

async function signIn(page: Page, target: string, email: string, password: string) {
  await page.goto(`/auth?redirect=${encodeURIComponent(target)}`);
  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.replaceAll("/", "\\/")), { timeout: 30_000 });
}

async function session(browser: Browser, target: string, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, target, email, password);
  return page;
}

async function advance(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^Confirmer : ${label}$`, "i") }).click();
}

async function send(page: Page, body: string) {
  await page.getByLabel("Votre message").fill(body);
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(body)).toBeVisible();
}

test.describe("suivi de commande", () => {
  test.describe.configure({ mode: "serial" });

  test("de la commande confirmée au livre terminé, sans coordonnées échangées", async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "Le scénario à états tourne une fois, en bureau.");
    test.skip(
      !ready,
      "Posez les variables E2E_PROJECT_* avec un dossier de développement « atelier retenu » et trois comptes jetables.",
    );

    const admin = await session(
      browser,
      `/marketplace/cases/${caseId}`,
      adminEmail!,
      adminPassword!,
    );
    await expect(admin.getByRole("heading", { name: "Suivi du projet" })).toBeVisible();
    await advance(admin, "Confirmer la commande");

    const binderTarget = `/atelier/cases/${caseId}`;
    const binder = await session(browser, binderTarget, binderEmail!, binderPassword!);
    await advance(binder, "Confirmer la réception");
    await send(binder, "Votre livre est bien arrivé.");
    await advance(binder, "Commencer le travail");

    // Une couleur, deux options illustrées.
    await binder.getByText("Demander une décision au client").first().click();
    const decisionForm = binder.locator("form", { has: binder.getByLabel("Type de décision") });
    await decisionForm
      .getByLabel("Question posée au client")
      .fill("Quelle couleur de cuir préférez-vous ?");
    await decisionForm.getByLabel("Option 1").fill("Bordeaux");
    await decisionForm.getByLabel("Option 2").fill("Cognac");
    const optionPhotos = decisionForm.locator('input[type="file"]');
    await optionPhotos.nth(0).setInputFiles(photo("bordeaux.png"));
    await optionPhotos.nth(1).setInputFiles(photo("cognac.png"));
    await decisionForm.getByRole("button", { name: "Demander la décision au client" }).click();
    await expect(binder.getByText("En attente de la réponse du client").first()).toBeVisible();

    const customer = await session(browser, "/mes-livres", customerEmail!, customerPassword!);
    await expect(customer.getByText("Votre réponse est attendue").first()).toBeVisible();
    await customer.getByRole("link", { name: "Répondre" }).first().click();
    await customer.getByRole("button", { name: /Bordeaux/ }).click();
    await customer.getByRole("button", { name: "Confirmer Bordeaux" }).click();
    await expect(customer.getByText("Votre choix : Bordeaux")).toBeVisible();

    // Le fil ne transporte pas de coordonnées.
    await customer.getByLabel("Votre message").fill("Appelez-moi au 06 12 34 56 78");
    await expect(
      customer.getByRole("alert").filter({ hasText: "Les coordonnées ne passent pas" }),
    ).toBeVisible();
    await expect(customer.getByRole("button", { name: "Envoyer", exact: true })).toBeDisabled();
    await customer.getByLabel("Votre message").fill("");

    await binder.reload();
    await expect(binder.getByText("Choix confirmé : Bordeaux")).toBeVisible();

    // Le titrage, confirmé ligne par ligne.
    await binder.getByText("Demander une décision au client").first().click();
    const gildingForm = binder.locator("form", { has: binder.getByLabel("Type de décision") });
    await gildingForm.getByLabel("Type de décision").selectOption("GILDING_TEXT");
    await gildingForm
      .getByLabel("Question posée au client")
      .fill("Pouvez-vous confirmer le texte à dorer ?");
    await gildingForm.getByLabel("Texte de la ligne 1").fill("LES MISÉRABLES");
    await gildingForm.getByLabel("Texte de la ligne 2").fill("VICTOR HUGO");
    await gildingForm.getByRole("button", { name: "Demander la décision au client" }).click();

    await customer.reload();
    await expect(customer.getByText("LES MISÉRABLES")).toBeVisible();
    await customer.getByRole("button", { name: "Je confirme ce texte" }).click();
    await customer
      .getByRole("button", { name: "Oui, je confirme définitivement ce texte" })
      .click();
    await expect(customer.getByText(/Texte confirmé/)).toBeVisible();

    // Une photo d'avancement.
    await binder.reload();
    await binder.getByLabel("Mise à jour d'avancement").check();
    await binder.getByLabel("Type de mise à jour").selectOption("IN_PROGRESS");
    await binder.getByLabel("Votre message").fill("Le dos est terminé, nous passons à la dorure.");
    await binder
      .locator("form", { has: binder.getByLabel("Votre message") })
      .locator('input[type="file"]')
      .setInputFiles(photo("dos.png"));
    await binder.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(binder.getByText("Le dos est terminé, nous passons à la dorure.")).toBeVisible();

    await customer.reload();
    await expect(customer.getByText("Le dos est terminé, nous passons à la dorure.")).toBeVisible();
    await expect(customer.getByAltText("Photo jointe").first()).toBeVisible();

    await advance(binder, "Travail terminé");
    await customer.reload();
    await expect(customer.getByText("Votre livre est terminé").first()).toBeVisible();
    await expect(customer.getByText("Nous préparons son retour.").first()).toBeVisible();
  });
});
