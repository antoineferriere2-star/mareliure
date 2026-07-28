import { expect, test } from "@playwright/test";

const clientEmail = process.env.E2E_CLIENT_EMAIL;
const clientPassword = process.env.E2E_CLIENT_PASSWORD;

test.describe("authenticated client portal", () => {
  test("signs in with a pre-provisioned client account and reaches the portal", async ({
    page,
  }) => {
    test.skip(
      !clientEmail || !clientPassword,
      "Set E2E_CLIENT_EMAIL and E2E_CLIENT_PASSWORD to run the authenticated portal smoke test.",
    );

    await page.goto("/auth");
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByLabel("Work email").fill(clientEmail!);
    await page.getByLabel("Password").fill(clientPassword!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/portal(?:\/|$)/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /My Dossiers|Client Portal/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/No workspace is linked|Requests received|Next step/i).first(),
    ).toBeVisible();
  });
});
