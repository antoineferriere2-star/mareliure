import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hasChosenPassword, passwordTooShort, passwordUpdate, PASSWORD_SET_AT_KEY } from "./workshopPassword";
import { MaReliureAuthPage } from "@/marketplace/pages/auth/MaReliureAuthPage";

describe("mot de passe des ateliers", () => {
  it("le mot de passe posé garde la trace de sa date, sans jamais porter d'e-mail", () => {
    const update = passwordUpdate("relieur-2026", new Date("2026-11-09T12:00:00.000Z"));
    expect(update).toEqual({ password: "relieur-2026", data: { [PASSWORD_SET_AT_KEY]: "2026-11-09T12:00:00.000Z" } });
    expect(JSON.stringify(update)).not.toContain("email");
  });

  it("un compte sans trace doit choisir son mot de passe", () => {
    expect(hasChosenPassword({ user_metadata: {} })).toBe(false);
    expect(hasChosenPassword({ user_metadata: null })).toBe(false);
    expect(hasChosenPassword(null)).toBe(false);
    expect(hasChosenPassword({ user_metadata: { password_set_at: "2026-11-09T12:00:00.000Z" } })).toBe(true);
  });

  it("8 caractères minimum", () => {
    expect(passwordTooShort("1234567")).toBe(true);
    expect(passwordTooShort("12345678")).toBe(false);
  });
});

describe("page de connexion, onglet atelier", () => {
  const render = (brand: "MA_RELIURE") =>
    renderToStaticMarkup(createElement(MaReliureAuthPage, {
      brand, initialAudience: "binder", accessError: null, routing: false, onSignedIn: async () => {},
    }));

  it("Ma Reliure : mot de passe d'abord, avec « Mot de passe oublié ? » et la première connexion par lien", () => {
    const html = render("MA_RELIURE");
    expect(html).toContain('id="mr-auth-password"');
    expect(html).toContain("Mot de passe oublié ?");
    expect(html).toContain("Première connexion ? Recevoir un lien de connexion");
    expect(html).not.toContain("Continuer sans mot de passe");
  });

  it("Fine Bindery : les mêmes choix dans ses cinq langues (l'en-tête FB demande un routeur, d'où la lecture du texte)", () => {
    const source = readFileSync(join(__dirname, "../pages/auth/MaReliureAuthPage.tsx"), "utf8");
    for (const label of ["Forgot your password?", "Passwort vergessen?", "Password dimenticata?", "¿Olvidaste tu contraseña?"])
      expect(source).toContain(label);
    expect(source.match(/forgotPassword: "/g)).toHaveLength(6);
  });
});
