// The last look before sending. Structural (renderToStaticMarkup): what the
// recap must show, count and label. The jump-to-step behaviour of its buttons
// is exercised in the browser QA described in the Phase A PR.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PhotoPreviewStore } from "@/build/engine/fields/types";
import { computeVisibleSteps } from "@/build/engine/validation";
import { bookbindingPlaybookSchema as playbook } from "@/build/playbooks/bookbindingPlaybookSchema";
import { NOT_SURE_VALUE, type Answers } from "@/build/schema/answers";
import { ReviewAnswers } from "./MissionRuntime";
import { publicCopy } from "./publicLocaleContext";

const fr = (text: string) => publicCopy("fr-FR", text);
const noPreviews: PhotoPreviewStore = { get: () => undefined, set: () => {}, release: () => {} };

const answers: Answers = {
  intention: "reparer",
  titre: "Le Comte de Monte-Cristo",
  nature: "livre_ancien",
  etat: ["dos_abime"],
  annee: NOT_SURE_VALUE,
  photos: [
    { filename: "a.jpg", sizeBytes: 10, mimeType: "image/jpeg", storagePath: "s/a", shot: "dos" },
    { filename: "b.jpg", sizeBytes: 10, mimeType: "image/jpeg", storagePath: "s/b" },
  ],
  consentement: true,
};

const render = (overrides: Partial<Parameters<typeof ReviewAnswers>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ReviewAnswers, {
      steps: computeVisibleSteps(playbook, answers),
      answers,
      copy: fr,
      onEdit: () => {},
      previews: noPreviews,
      photoShots: { photos: [{ key: "dos", label: "Dos", hint: "h" }] },
      ...overrides,
    }),
  );

describe("ReviewAnswers", () => {
  const html = render();

  it("counts the questions left unanswered and says sending is still possible", () => {
    expect(html).toMatch(/\d+<!-- --> <!-- -->questions sans réponse|\d+ questions sans réponse/);
    expect(html).toContain("Vous pouvez tout de même envoyer votre projet");
    expect(html).toContain("Aller à la première");
  });

  it("uses the singular for exactly one", () => {
    const complete: Answers = {};
    const steps = computeVisibleSteps(playbook, answers);
    // Fill everything but one field.
    for (const step of steps) for (const field of step.visibleFields) complete[field.key] = "x";
    const text = renderToStaticMarkup(
      createElement(ReviewAnswers, {
        steps: steps.map((s) => ({ ...s, visibleFields: s.visibleFields.slice(0, 1) })).slice(0, 1),
        answers: {},
        copy: fr,
        onEdit: () => {},
        previews: noPreviews,
      }),
    );
    expect(text).toMatch(/1(<!-- --> <!-- -->| )question sans réponse/);
  });

  it("shows photos as pictures labelled by their view, and by file name when they have none", () => {
    expect(html).toContain("Photo enregistrée");
    expect(html).toContain(">Dos<");
    expect(html).toContain(">b.jpg<");
  });

  it("draws the thumbnail when the session still has the picture", () => {
    const withPreview = render({
      previews: { get: (key) => (key === "s/a" ? "blob:a" : undefined), set: () => {}, release: () => {} },
    });
    expect(withPreview).toContain('src="blob:a"');
  });

  it("reads 'not sure' and a ticked consent in the visitor's language, never the engine's English", () => {
    expect(html).toContain("Je ne sais pas");
    expect(html).toContain(">Oui<");
    expect(html).not.toContain(">Yes<");
    expect(html).not.toContain(">Not sure<");
  });

  it("gives every step an Edit control of a usable size", () => {
    expect(html).toContain("Modifier");
    expect(html.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(computeVisibleSteps(playbook, answers).length);
  });

  it("does not show the unanswered callout when nothing is blank", () => {
    const one = computeVisibleSteps(playbook, { intention: "reparer" }).slice(0, 1);
    const text = renderToStaticMarkup(
      createElement(ReviewAnswers, {
        steps: one,
        answers: { intention: "reparer" },
        copy: fr,
        onEdit: () => {},
        previews: noPreviews,
      }),
    );
    expect(text).not.toContain("sans réponse</p>");
    expect(text).not.toContain("Aller à la première");
  });
});
