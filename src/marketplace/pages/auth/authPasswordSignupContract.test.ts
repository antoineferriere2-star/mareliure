import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Régression : `MaReliureAuthPage.tsx` proposait autrefois de créer un mot
 * de passe via `supabase.auth.signUp({ email, password })` sur un e-mail
 * saisi à froid, avant toute session — n'importe quelle adresse pouvait être
 * tapée là, y compris celle d'un client déjà connu par lien magique.
 * Constaté en pratique : cela a attaché un mot de passe au compte réel d'une
 * cliente pendant un test de l'inscription atelier (CODEX_HANDOFF, 15
 * septembre 2026).
 *
 * `signUp` ne peut pas être empêché de cibler un e-mail arbitraire — c'est
 * son contrat. La correction est donc de ne plus jamais l'appeler pour
 * "ajouter un mot de passe" : seul `updateUser`, qui n'agit que sur la
 * session déjà ouverte par le lien/code qu'on vient de vérifier, peut créer
 * un mot de passe client. Ce test verrouille ce choix au niveau du fichier
 * plutôt qu'un seul appel, pour survivre à un futur refactor qui
 * réintroduirait `signUp` ailleurs dans le même composant.
 */
describe("MaReliureAuthPage — création de mot de passe client", () => {
  const source = readFileSync(join(__dirname, "MaReliureAuthPage.tsx"), "utf8");

  it("n'appelle jamais signUp pour le client (seul updateUser peut créer un mot de passe)", () => {
    expect(source).not.toMatch(/auth\.signUp\(/);
  });

  it("crée le mot de passe via updateUser, sur la session déjà ouverte", () => {
    expect(source).toMatch(/auth\.updateUser\(\{\s*password/);
  });
});
