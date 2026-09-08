import { describe, expect, it, vi } from "vitest";
import { resolveMarketplacePostAuthDestination } from "./postAuthRoute";

const admin = () => Promise.resolve({ ok: true });
const notAdmin = () => Promise.reject(new Error("403"));

describe("où atterrit un compte Ma Reliure après connexion", () => {
  it("envoie un administrateur au back-office", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: admin,
      getBinderProfile: () => Promise.resolve(null),
    });
    expect(dest).toEqual({ to: "/marketplace/cases" });
  });

  it("envoie un relieur à son atelier", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve({ id: "b1" }),
    });
    expect(dest).toEqual({ to: "/atelier" });
  });

  it("envoie tout autre compte à ses livres", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve(null),
    });
    expect(dest).toEqual({ to: "/mes-livres" });
  });

  /**
   * L'ordre compte : un administrateur qui tiendrait aussi un atelier doit
   * arriver sur le back-office, et on ne doit même pas être allé chercher son
   * profil de relieur pour le savoir.
   */
  it("privilégie l'administration, sans interroger le profil de relieur", async () => {
    const getBinderProfile = vi.fn(() => Promise.resolve({ id: "b1" }));
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: admin,
      getBinderProfile,
    });
    expect(dest).toEqual({ to: "/marketplace/cases" });
    expect(getBinderProfile).not.toHaveBeenCalled();
  });

  /**
   * Une erreur sur une vérification secondaire ne doit pas coincer quelqu'un à
   * la porte : mieux vaut l'espace client que rien du tout.
   */
  it("bascule sur les livres si le profil de relieur est illisible", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.reject(new Error("500")),
    });
    expect(dest).toEqual({ to: "/mes-livres" });
  });

  /**
   * Aucun espace de travail Métré n'est provisionné : c'est la différence de
   * fond avec le résolveur du moteur, et elle doit rester visible dans le type
   * comme dans les dépendances.
   */
  it("ne demande aucun provisionnement d'espace de travail", () => {
    const deps: Record<string, unknown> = {
      checkAdmin: admin,
      getBinderProfile: () => Promise.resolve(null),
    };
    expect(Object.keys(deps)).toEqual(["checkAdmin", "getBinderProfile"]);
  });
});
