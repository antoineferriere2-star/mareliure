import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CasePhotoGallery, stepPhoto } from "./CasePhotoViewer";
import { WorkshopOfferCard } from "./binder/WorkshopOfferCard";

describe("visionneuse des photos", () => {
  it("passe d'une photo à l'autre en boucle", () => {
    expect(stepPhoto(0, 1, 12)).toBe(1);
    expect(stepPhoto(11, 1, 12)).toBe(0);
    expect(stepPhoto(0, -1, 12)).toBe(11);
    expect(stepPhoto(0, 1, 0)).toBe(0);
  });

  it("chaque vignette est un bouton qui agrandit sa photo ; une photo non signée n'apparaît pas", () => {
    const html = renderToStaticMarkup(createElement(CasePhotoGallery, {
      photos: [{ url: "https://x/a.jpg", caption: null }, { url: null, caption: null }, { url: "https://x/b.jpg", caption: "Mors" }],
    }));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Agrandir la photo 1"');
    expect(html).toContain('alt="Mors"');
    expect(html).not.toContain("null");
  });

  it("libellés anglais pour Fine Bindery", () => {
    const html = renderToStaticMarkup(createElement(CasePhotoGallery, { photos: [{ url: "https://x/a.jpg", caption: null }], locale: "en-US" }));
    expect(html).toContain('aria-label="Enlarge photo 1"');
  });
});

describe("cadre « Proposition de projet » partagé atelier / aperçu admin", () => {
  it("affiche la rémunération et la prestation saisie, retours à la ligne compris", () => {
    const html = renderToStaticMarkup(createElement(WorkshopOfferCard, {
      payoutCents: 7500, serviceDescription: "Réparation des deux mors.\nCharnières en soie.", brandName: "Ma Reliure",
    }));
    expect(html).toMatch(/75,00/);
    expect(html).toContain("Réparation des deux mors.\nCharnières en soie.");
    expect(html).toContain("whitespace-pre-line");
  });

  it("sans rémunération validée, le dit au lieu d'afficher un montant", () => {
    const html = renderToStaticMarkup(createElement(WorkshopOfferCard, { payoutCents: null, serviceDescription: null, brandName: "Fine Bindery" }));
    expect(html).toContain("ne contient pas de rémunération validée");
    expect(html).not.toMatch(/€/);
  });
});
