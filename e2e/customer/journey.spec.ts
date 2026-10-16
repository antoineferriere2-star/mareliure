import { expect, test, type Frame, type TestInfo } from "@playwright/test";
import { computeVisibleSteps } from "../../src/build/engine/validation";
import { publicCopy } from "../../src/build/pages/public/publicLocaleContext";
import { CASE, CustomerScenario, PNG, answers, schema, type Language } from "./fixtures";

async function capture(frame: Frame, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await (await frame.frameElement()).screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

async function submitBook(frame: Frame, scenario: CustomerScenario) {
  const copy = (text: string) => publicCopy(scenario.locale, text);
  const steps = computeVisibleSteps(schema, answers);
  for (let index = 0; index < steps.length; index++) {
    const { step, visibleFields } = steps[index];
    await expect(frame.getByRole("heading", { level: 1 })).toContainText(copy(step.title));
    for (const field of visibleFields) {
      const value = answers[field.key];
      if (field.type === "photo" && field.desirability === "required") {
        await frame
          .locator(`input[type=file][id^="${field.key}"]`)
          .first()
          .setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: PNG });
        await expect
          .poll(() => scenario.calls.filter((c) => c.name === "upload_project_photo").length)
          .toBeGreaterThan(0);
      } else if (value === undefined) continue;
      else if (field.type === "text" || field.type === "number" || field.type === "measurement") {
        await frame.locator(`[id="${field.key}"]`).fill(String(value));
      } else if (
        field.type === "single_choice" ||
        field.type === "timeline" ||
        field.type === "budget"
      ) {
        const choices = field.type === "budget" ? field.ranges! : field.options;
        const option = choices.find((o) => o.value === value)!;
        await frame
          .getByRole("radiogroup", { name: copy(field.label), exact: true })
          .getByRole("radio", { name: copy(option.label), exact: false })
          .click();
      } else if (field.type === "multi_choice") {
        for (const selected of value as string[]) {
          const option = field.options.find((o) => o.value === selected)!;
          await frame
            .getByRole("group", { name: copy(field.label), exact: true })
            .getByRole("button", { name: copy(option.label), exact: false })
            .click();
        }
      } else if (field.type === "address") {
        for (const [key, part] of Object.entries(value as Record<string, string>))
          await frame.locator(`[id="${field.key}-${key}"]`).fill(part);
      } else if (field.type === "consent") {
        await frame.getByRole("checkbox").check();
      }
    }
    await frame
      .getByRole("button", {
        name: copy(index === steps.length - 1 ? "Review my answers" : "Continue"),
        exact: true,
      })
      .click();
  }
  await frame.getByRole("button", { name: copy("Send my project"), exact: true }).click();
  await expect.poll(() => scenario.submitted?.email).toBe("camille@example.invalid");
  await expect(
    frame.getByRole("heading", {
      name: scenario.language === "fr" ? "Suivre votre livre" : "Follow your book",
    }),
  ).toBeVisible();
  expect(scenario.submitted?.titre).toBe(answers.titre);
  expect(scenario.submitted?.intention).toBe("reparer");
}

for (const language of ["fr", "en"] as Language[]) {
  test(`${language}: request, customer space, proposal, phone refusal, label progress`, async ({
    context,
    page,
  }, info) => {
    const scenario = new CustomerScenario(language);
    await scenario.install(context);
    await page.goto("/__customer-frame");
    const width = Number(info.project.metadata.frameWidth);
    await page.locator("iframe").evaluate((element, w) => {
      element.style.width = `${w}px`;
    }, width);
    const frame = page.frame({ name: "customer" })!;
    await frame.goto(language === "fr" ? "/m/reliure-marketplace-token-000001" : "/en/project");
    // The initial Vite/TanStack compilation can be cold; subsequent UI assertions keep their normal timeout.
    await expect(frame.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 120_000 });
    expect(await frame.evaluate(() => window.innerWidth)).toBe(width);
    await submitBook(frame, scenario);
    await capture(frame, info, `${language}-submitted`);

    // The session is synthetic from the start; no OTP or real sign-in link is requested.
    await frame.goto("/mes-livres");
    await expect(
      frame.getByRole("link", { name: new RegExp(scenario.title.split(" — ")[0]) }),
    ).toBeVisible();
    await frame.getByRole("link", { name: new RegExp(scenario.title.split(" — ")[0]) }).click();
    await expect(
      frame.getByRole("heading", {
        name: language === "fr" ? "Votre proposition" : "Your proposal",
        exact: true,
      }),
    ).toBeVisible();
    await expect(frame.getByText(/135[,.]00/).first()).toBeVisible();
    expect(scenario.calls.some((c) => c.name === "getMyCustomerCase")).toBe(true);

    const logistics = frame.locator('section[aria-labelledby="logistics-title"]');
    await logistics.scrollIntoViewIfNeeded();
    await logistics
      .getByLabel(language === "fr" ? "Nom et prénom" : "Full name", { exact: true })
      .fill("Camille Recette");
    await logistics
      .getByLabel(language === "fr" ? "Adresse" : "Address", { exact: true })
      .fill("1 rue de la Recette");
    await logistics
      .getByLabel(language === "fr" ? "Code postal" : "Postcode", { exact: true })
      .fill("75011");
    await logistics.getByLabel(language === "fr" ? "Ville" : "City", { exact: true }).fill("Paris");
    const phone = logistics.getByLabel(
      language === "fr" ? "Téléphone (pour le transporteur)" : "Phone (for the carrier)",
      { exact: true },
    );
    await phone.fill("+12025550123");
    for (const [labelFr, labelEn, value] of [
      ["Poids (g)", "Weight (g)", "480"],
      ["Longueur (cm)", "Length (cm)", "34"],
      ["Largeur (cm)", "Width (cm)", "24"],
      ["Épaisseur (cm)", "Thickness (cm)", "6"],
    ]) {
      await logistics
        .getByLabel(language === "fr" ? labelFr : labelEn, { exact: true })
        .fill(value);
    }
    await logistics.locator("textarea").fill(scenario.title);
    await logistics.getByLabel(language === "fr" ? /Valeur déclarée/ : /Declared value/).fill("30");
    await logistics.getByRole("checkbox").last().check();
    const save = logistics.getByRole("button", {
      name: language === "fr" ? "Enregistrer" : "Save",
      exact: true,
    });
    await phone.fill("");
    await save.click();
    await expect(logistics.getByRole("alert")).toContainText(
      language === "fr" ? "téléphone français" : "French phone number",
    );
    await expect.poll(() => scenario.phoneRefusals).toBe(1);
    await expect(save).toBeEnabled();
    expect(scenario.savedPlan).toBe(false);
    await phone.fill("+12025550123");
    await save.click();
    await expect(logistics.getByRole("alert")).toContainText(
      language === "fr" ? "téléphone français" : "French phone number",
    );
    await expect.poll(() => scenario.phoneRefusals).toBe(2);
    await expect(save).toBeEnabled();
    expect(scenario.savedPlan).toBe(false);
    await capture(frame, info, `${language}-phone-error`);
    await phone.fill("0612345678");
    await save.click();
    await expect.poll(() => scenario.savedPlan).toBe(true);
    await expect(logistics.locator("textarea")).toHaveCount(0);

    // Simulate facts returned after external payment, without clicking a payment action.
    scenario.paid = true;
    await frame.goto(frame.url());
    const outbound = frame.locator('section[aria-labelledby="logistics-title"]');
    await expect(
      outbound.getByText(language === "fr" ? "En préparation" : "Being prepared", { exact: true }),
    ).toBeVisible();
    await expect(outbound.getByRole("button", { name: /étiquette|label/ })).toHaveCount(0);
    await outbound.scrollIntoViewIfNeeded();
    await capture(frame, info, `${language}-label-preparing`);
    scenario.labelReady = true;
    await frame.goto(frame.url());
    const ready = frame.locator('section[aria-labelledby="logistics-title"]');
    await expect(ready.getByText("SYNTHETIC-TRACKING", { exact: false })).toBeVisible();
    await expect(
      ready.getByRole("button", { name: /Download.*outbound label|Télécharger.*étiquette aller/ }),
    ).toBeVisible();
    await ready.scrollIntoViewIfNeeded();
    await capture(frame, info, `${language}-label-ready`);
    expect(
      await frame.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(await frame.evaluate(() => window.innerWidth)).toBe(width);
    expect(scenario.unexpected).toEqual([]);
    expect(scenario.external).toEqual([]);
    expect(scenario.calls.some((c) => /Checkout|OutboundLabel|sendCaseMessage/.test(c.name))).toBe(
      false,
    );
    await info.attach("mock-calls", {
      body: JSON.stringify(
        {
          width,
          calls: scenario.calls,
          unexpected: scenario.unexpected,
          external: scenario.external,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
}
