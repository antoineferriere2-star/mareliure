import { describe, expect, it } from "vitest";
import { APPLICATION_LIMITS, validateBinderApplication } from "./applicationValidation";

const valid = {
  firstName: " Camille ",
  lastName: " Martin ",
  workshopName: " Atelier d’essai ",
  email: "camille@example.invalid",
  consent: true,
};
const errors = (input: unknown) => {
  const result = validateBinderApplication(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected refusal");
  return result.fieldErrors;
};

describe("validation partagée de la candidature atelier", () => {
  it("accepte le contact minimum, sans ville ni téléphone, et normalise les espaces", () => {
    expect(validateBinderApplication(valid)).toEqual({
      ok: true,
      data: {
        ...valid,
        firstName: "Camille",
        lastName: "Martin",
        workshopName: "Atelier d’essai",
        skills: [],
      },
    });
  });
  it("rattache tous les champs obligatoires manquants à leur nom", () => {
    expect(Object.keys(errors({}))).toEqual([
      "firstName",
      "lastName",
      "workshopName",
      "email",
      "consent",
    ]);
    expect(errors({ ...valid, firstName: "   " }).firstName).toContain("prénom");
  });
  it.each([false, undefined, "true", 1])(
    "exige un consentement explicite, reçu : %s",
    (consent) => {
      expect(errors({ ...valid, consent }).consent).toContain("Acceptez");
    },
  );
  it.each(["06 12 34 56 78", "+33 (0)6 12 34 56 78", "+49 30 123456", "+1 (212) 555-0123", ""])(
    "accepte le téléphone facultatif ou international : %s",
    (phone) => {
      expect(validateBinderApplication({ ...valid, phone }).ok).toBe(true);
    },
  );
  it.each(["appeler demain", "123", "+1234567890123456", "12+3456789"])(
    "refuse le téléphone inexploitable : %s",
    (phone) => {
      expect(errors({ ...valid, phone }).phone).toContain("7 à 15 chiffres");
    },
  );
  it.each(["https://atelier.example.invalid/profil", "http://atelier.example.invalid", ""])(
    "accepte une adresse web complète : %s",
    (websiteUrl) => {
      expect(validateBinderApplication({ ...valid, websiteUrl }).ok).toBe(true);
    },
  );
  it.each(["atelier.fr", "https://", "javascript:alert(1)", "ftp://atelier.fr"])(
    "refuse une adresse web invalide : %s",
    (websiteUrl) => {
      expect(errors({ ...valid, websiteUrl }).websiteUrl).toContain("https://");
    },
  );
  it("refuse un e-mail incomplet et conserve l’erreur lisible après sérialisation JSON", () => {
    expect(JSON.parse(JSON.stringify(errors({ ...valid, email: "camille@" })))).toEqual({
      email: expect.stringContaining("adresse e-mail valide"),
    });
  });
  it.each([0, 100])("accepte la borne d’expérience %s", (yearsExperience) => {
    expect(validateBinderApplication({ ...valid, yearsExperience }).ok).toBe(true);
  });
  it.each([-1, 101, 3.5, NaN, "3"])("refuse l’expérience hors contrat : %s", (yearsExperience) => {
    expect(errors({ ...valid, yearsExperience }).yearsExperience).toBeTruthy();
  });
  it("impose les longueurs au serveur même quand le navigateur est contourné", () => {
    for (const [field, limit] of Object.entries(APPLICATION_LIMITS)) {
      const key = field === "hpCompanyName" ? "_form" : field;
      expect(
        errors({ ...valid, [field]: "a".repeat(limit + 1) })[
          key as keyof ReturnType<typeof errors>
        ],
        field,
      ).toBeTruthy();
    }
  });
  it("garde le catalogue de savoir-faire unique et refuse une liste trop longue", () => {
    const result = validateBinderApplication({ ...valid, skills: ["invented-skill"] });
    expect(result.ok && result.data.skills).toEqual([]);
    expect(errors({ ...valid, skills: Array(21).fill("invented") }).skills).toContain("20");
  });
});
