import {workshopIntakeGuidance} from "./workshopIntakeGuidance";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorkshopIntakeNotice } from "./WorkshopIntakeCopy";
it.each(["fr", "en", "de", "it", "es"] as const)("%s attribue le devis et la facture à l’atelier, sans promesse de vente Oppe", locale => {
  for (const stage of ["intro", "review", "next"] as const) {
    const html = renderToStaticMarkup(createElement(WorkshopIntakeNotice, { locale, stage }));
    expect(html).not.toMatch(/Ma Reliure étudie|proposition chiffrée par Ma Reliure|OPPE SAS/);
    expect(html).toContain("<section");
  }
  expect(workshopIntakeGuidance(locale).stepExplanations?.ouvrage).toBeTruthy();
});
