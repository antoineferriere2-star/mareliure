import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReliureIntakeIntro, ReliureNextSteps, ReliureReviewNotice } from "./ReliureIntakeCopy";
import { RELIURE_INTAKE_MINUTES, RELIURE_REPLY_NOTICE } from "./reliureIntakeGuidance";

const html = (component: () => ReturnType<typeof ReliureIntakeIntro>) =>
  renderToStaticMarkup(createElement(component)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// The words the project's vocabulary rule keeps out of anything a visitor reads.
const FORBIDDEN = /\b(formulaire|questionnaire|lead|conversion|prompt|utilisateur)\b/i;

describe("before the first question", () => {
  const text = html(ReliureIntakeIntro);

  it("says what the visitor gets, how long it takes and not to post the book yet", () => {
    expect(text).toContain("Une proposition chiffrée par Ma Reliure");
    expect(text).toContain(`Environ ${RELIURE_INTAKE_MINUTES} minutes`);
    expect(text).toContain("N’envoyez pas votre livre maintenant");
  });

  it("promises no more than the landing page: a price before commitment, transport agreed case by case", () => {
    expect(text).toContain("d’après vos photos");
    expect(text).toContain("vérifié à réception");
    expect(text).toContain("aucun travail ni changement de prix sans votre accord préalable");
    expect(text).toContain("le transport est convenu avec vous");
  });

  it("makes no claim about payment, a guaranteed price or a named workshop", () => {
    expect(text).not.toMatch(/gratuit|garanti|remboursé|atelier de votre choix/i);
  });

  it("is a labelled region", () => {
    expect(renderToStaticMarkup(createElement(ReliureIntakeIntro))).toContain('aria-labelledby="reliure-intro-title"');
  });
});

describe("at the last look", () => {
  const text = html(ReliureReviewNotice);

  it("says sending commits to nothing: no payment, no shipping, a proposal to accept or not", () => {
    expect(text).toContain("Envoyer ne vous engage à rien.");
    expect(text).toContain("Vous ne payez rien maintenant");
    expect(text).toContain("n’expédiez pas encore");
    expect(text).toContain("libre d’accepter ou non");
  });
});

describe("after sending", () => {
  const text = html(ReliureNextSteps);

  it("orders three steps, names who acts, and promises no figure for the reply", () => {
    expect(text).toContain("Ma Reliure étudie votre projet");
    expect(text).toContain(RELIURE_REPLY_NOTICE);
    // No SLA has been validated operationally: not a number of days, not hours.
    expect(text).not.toMatch(/Délai indicatif/);
    expect(text).not.toMatch(/\d\s*(h\b|heure|jour)|sous \d|dans les \d/i);
    expect(text).toContain("Vous recevez une proposition chiffrée");
    expect(text).toContain("Si vous acceptez : paiement, puis envoi du livre");
    expect(text.indexOf("étudie")).toBeLessThan(text.indexOf("proposition chiffrée"));
    expect(text.indexOf("proposition chiffrée")).toBeLessThan(text.indexOf("envoi du livre"));
  });

  it("tells the visitor there is nothing to do now, and not to ship before agreeing", () => {
    expect(text).toContain("vous n’avez rien à faire");
    expect(text).toContain("N’envoyez rien avant.");
  });
});

describe("vocabulary", () => {
  it.each([
    ["intro", ReliureIntakeIntro],
    ["review notice", ReliureReviewNotice],
    ["next steps", ReliureNextSteps],
  ] as const)("%s uses none of the forbidden words", (_name, component) => {
    expect(html(component)).not.toMatch(FORBIDDEN);
  });
});
