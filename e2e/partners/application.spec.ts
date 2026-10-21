import { test, expect } from "@playwright/test";
import { fromJSON } from "seroval";

test("refus précis, focus répété, formats et refus serveur simulé, sans envoi réel", async ({
  page,
  context,
}, testInfo) => {
  const calls: { name: string; data: unknown }[] = [];
  const unexpected: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:8089" && !["data:", "blob:"].includes(url.protocol)) {
      unexpected.push(url.origin + url.pathname);
      return route.abort();
    }
    if (url.pathname.startsWith("/_serverFn/")) {
      const meta = JSON.parse(
        Buffer.from(url.pathname.split("/").pop()!, "base64url").toString(),
      ) as { export: string };
      const name = meta.export.replace(/_createServerFn_handler$/, "");
      const encoded =
        request.method() === "GET" ? url.searchParams.get("payload") : request.postData();
      const data = encoded ? (fromJSON(JSON.parse(encoded)) as { data?: unknown }).data : undefined;
      calls.push({ name, data });
      let result: unknown;
      if (name === "getRequestMarketplaceBrand") result = "MA_RELIURE";
      else if (name === "getRequestFineBinderyLocale") result = "fr";
      else if (name === "submitBinderApplication")
        result = {
          ok: false,
          fieldErrors: { email: "Saisissez une autre adresse e-mail (refus simulé)." },
        };
      else {
        unexpected.push(name);
        return route.abort();
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ result, context: {} }),
      });
    }
    if (url.pathname === "/api/public/track-view") return route.fulfill({ json: { ok: true } });
    if (!["GET", "HEAD"].includes(request.method()) || url.pathname.startsWith("/api/")) {
      unexpected.push(request.method() + " " + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/partenaires-relieurs#candidature");
  await page.waitForFunction(async () => {
    const path = "/src/lib/hydration.ts";
    return (await import(path)).isHydrated();
  });
  // A root effect can precede hydration of a split route. Observe an actual local state change.
  const skill = page.locator("#candidature button[aria-pressed]").first();
  await expect(async () => {
    if ((await skill.getAttribute("aria-pressed")) !== "true") await skill.click();
    await expect(skill).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 60_000 });
  await skill.click();
  await expect(skill).toHaveAttribute("aria-pressed", "false");
  await testInfo.attach("initial-rpc", {
    body: JSON.stringify({ calls, unexpected, browserErrors }, null, 2),
    contentType: "application/json",
  });
  const submit = page.getByRole("button", { name: "Envoyer ma candidature", exact: true });
  await submit.click();
  const first = page.locator("#pr-first-name");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(first).toHaveAccessibleDescription("Renseignez votre prénom.");
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(first).toBeFocused();
  expect(calls.filter((call) => call.name === "submitBinderApplication")).toHaveLength(0);

  await first.fill("Camille");
  await page.locator("#pr-last-name").fill("QA");
  await page.locator("#pr-workshop").fill("Atelier de recette");
  await page.locator("#pr-email").fill("adresse-incomplete");
  await page.locator("#pr-phone").fill("demain");
  await page.locator("#pr-website").fill("atelier.fr");
  await page.locator("#pr-years").fill("2.5");
  await submit.click();
  await expect(page.locator("#pr-email")).toBeFocused();
  await expect(page.locator("#pr-email")).toHaveAccessibleDescription(/adresse e-mail valide/);
  await expect(page.locator("#pr-phone")).toHaveAccessibleDescription(/7 à 15 chiffres/);
  await expect(page.locator("#pr-website")).toHaveAccessibleDescription(/https:\/\//);
  await expect(page.locator("#pr-years")).toHaveAccessibleDescription(/nombre entier/);
  await expect(page.locator("#pr-consent")).toHaveAccessibleDescription(/Acceptez/);
  expect(calls.filter((call) => call.name === "submitBinderApplication")).toHaveLength(0);
  await testInfo.attach("refus-rattaches-aux-champs", {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  // UI constraints are read rather than simulated by server validation.
  for (const [id, max] of Object.entries({
    "pr-first-name": 100,
    "pr-last-name": 100,
    "pr-workshop": 200,
    "pr-city": 100,
    "pr-email": 200,
    "pr-phone": 30,
    "pr-website": 300,
    "pr-message": 2000,
  }))
    await expect(page.locator("#" + id)).toHaveAttribute("maxlength", String(max));
  await expect(page.locator("#pr-city")).not.toHaveAttribute("required", "");
  await expect(page.locator("#pr-email")).toHaveAttribute("type", "email");
  await expect(page.locator("#pr-phone")).toHaveAttribute("type", "tel");
  await expect(page.locator("#pr-website")).toHaveAttribute("type", "url");

  await page.locator("#pr-email").fill("camille@example.invalid");
  await page.locator("#pr-phone").fill("+49 30 123456");
  await page.locator("#pr-website").fill("https://atelier.example.invalid");
  await page.locator("#pr-years").fill("2");
  await page.locator("#pr-consent").check();
  await submit.click();
  await expect(page.locator("#pr-email")).toBeFocused();
  await expect(page.locator("#pr-email")).toHaveAccessibleDescription(
    "Saisissez une autre adresse e-mail (refus simulé).",
  );
  expect(calls.filter((call) => call.name === "submitBinderApplication")).toEqual([
    {
      name: "submitBinderApplication",
      data: expect.objectContaining({ consent: true, city: undefined, yearsExperience: 2 }),
    },
  ]);
  await expect(page.getByText("Candidature envoyée.", { exact: false })).toHaveCount(0);
  expect(unexpected).toEqual([]);
  expect(browserErrors).toEqual([]);
});
