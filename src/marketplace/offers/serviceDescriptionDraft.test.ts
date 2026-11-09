import { describe, expect, it } from "vitest";
import { draftServiceDescription, type DraftLine } from "./serviceDescriptionDraft";

// Lignes telles que le Playbook reliure les produit pour RL-013 (vue admin, divulgation complète).
const rl013: DraftLine[] = [
  { label: "Type de projet", value: "Réparation", category: "Le projet" },
  { label: "Titre", value: "Paroissien Romain", category: "L'ouvrage" },
  { label: "Auteur", value: "Missal", category: "L'ouvrage" },
  { label: "Année d'édition", value: "1858", category: "L'ouvrage" },
  { label: "Nature de l'ouvrage", value: "Un livre ancien", category: "L'ouvrage" },
  { label: "État déclaré", value: "Couverture détachée", category: "État" },
  { label: "Dos", value: "Intact", category: "État" },
  { label: "Plats", value: "Détachés du corps du livre", category: "État" },
  { label: "Cahiers", value: "Oui, le bloc est solide", category: "État" },
  { label: "Photos", value: "04.jpg, 05.jpg", category: "Pièces jointes" },
  { label: "Importance de l'ouvrage", value: "Valeur sentimentale", category: "Valeur" },
  { label: "Valeur déclarée", value: "Entre 100 et 500 €", category: "Valeur" },
  { label: "Nom", value: "Srdjan Djeric", category: "Contact" },
  { label: "E-mail", value: "client@example.com", category: "Contact" },
  { label: "Téléphone", value: "+385 00 000 000", category: "Contact" },
  { label: "Format (H × L × ép., cm)", value: "16 × 13 × 3", category: "L'ouvrage" },
];
const components = [
  { workItemKey: "reemboitage", label: "Réemboîtage" },
  { workItemKey: "reparation_plats", label: "Reprise des plats" },
];
const draft = (over: Partial<Parameters<typeof draftServiceDescription>[0]> = {}) =>
  draftServiceDescription({ title: "Paroissien Romain", reference: "RL-013", components, lines: rl013, heritage: true, brandName: "Ma Reliure", ...over });

describe("brouillon de la prestation demandée à l'atelier", () => {
  it("RL-013 : travaux chiffrés, état déclaré, conditions", () => {
    expect(draft()).toBe([
      "Paroissien Romain (RL-013)",
      "Titre : Paroissien Romain · Auteur : Missal · Année d'édition : 1858 · Format : 16 × 13 × 3",
      "",
      "Travaux demandés :",
      "- Réemboîtage : remettre le corps d'ouvrage dans sa couverture d'origine.",
      "- Reprise des plats.",
      "",
      "État déclaré par le client (à vérifier à réception) :",
      "- État déclaré : Couverture détachée",
      "- Dos : Intact",
      "- Plats : Détachés du corps du livre",
      "- Cahiers : Oui, le bloc est solide",
      "",
      "Conditions :",
      "- Conserver les éléments d'origine (couvrure, gardes, fermoir, tranches, décors), sauf accord préalable.",
      "- Tout travail non prévu ci-dessus (recouture, remplacement de matériaux, nettoyage ou teinture du cuir) : prévenir Ma Reliure avant d'intervenir.",
      "- Ouvrage ancien : examen à réception, avec un avis transmis à Ma Reliure avant de commencer.",
      "- Photos avant et après le travail, déposées dans le dossier.",
    ].join("\n"));
  });

  it("ne reprend jamais le contact, la valeur ni le budget du client", () => {
    const text = draft({ lines: [...rl013, { label: "Budget", value: "250 – 400 €", category: "Budget" }] });
    for (const secret of ["Djeric", "client@example.com", "+385", "100 et 500", "Valeur sentimentale", "250 – 400"])
      expect(text).not.toContain(secret);
  });

  it("une rubrique ajoutée plus tard au Playbook n'entre pas sans décision", () => {
    expect(draft({ lines: [...rl013, { label: "Note interne", value: "secret", category: "Nouvelle rubrique" }] })).not.toContain("secret");
  });

  it("ouvrage non ancien : pas de clause d'examen ; Fine Bindery : la marque est nommée", () => {
    const text = draft({ heritage: false, brandName: "Fine Bindery" });
    expect(text).not.toContain("Ouvrage ancien");
    expect(text).toContain("prévenir Fine Bindery");
  });

  it("sans travaux chiffrés, le dit au lieu d'inventer", () => {
    expect(draft({ components: [] })).toContain("Travaux demandés :\n- À préciser.");
  });

  it("tient dans la limite de 2 000 caractères de l'envoi pour un dossier chargé", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ workItemKey: `x${i}`, label: `Travail complémentaire numéro ${i}` }));
    expect(draft({ components: many }).length).toBeLessThanOrEqual(2000);
  });
});
