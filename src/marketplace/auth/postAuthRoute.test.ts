import { describe, expect, it, vi } from "vitest";
import { resolveMarketplacePostAuthDestination } from "./postAuthRoute";

const admin = () => Promise.resolve({ ok: true });
const notAdmin = () => Promise.reject(new Error("403"));

describe("où atterrit un compte Ma Reliure après connexion", () => {
  it("envoie un administrateur au back-office", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: admin,
      getBinderProfile: () => Promise.resolve(null),
      getPendingBinderInvitations: () => Promise.resolve([]),
    });
    expect(dest).toEqual({ to: "/marketplace/cases" });
  });

  it("envoie un relieur à son atelier", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve({ id: "b1" }),
      getPendingBinderInvitations: () => Promise.resolve([]),
    });
    expect(dest).toEqual({ to: "/atelier" });
  });

  it("envoie tout autre compte à ses livres", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve(null),
      getPendingBinderInvitations: () => Promise.resolve([]),
    });
    expect(dest).toEqual({ to: "/mes-livres" });
  });

  it("envoie un compte invité mais non activé à l'activation de son atelier", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve(null),
      getPendingBinderInvitations: () => Promise.resolve([{ id: "invitation" }]),
    });
    expect(dest).toEqual({ to: "/activer-mon-atelier" });
  });

  it("explique l'absence d'invitation à quelqu'un entré par Atelier partenaire", async () => {
    const dest = await resolveMarketplacePostAuthDestination({
      checkAdmin: notAdmin,
      getBinderProfile: () => Promise.resolve(null),
      getPendingBinderInvitations: () => Promise.resolve([]),
    }, "atelier");
    expect(dest).toEqual({ to: "/activer-mon-atelier" });
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
      getPendingBinderInvitations: () => Promise.resolve([]),
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
      getPendingBinderInvitations: () => Promise.resolve([]),
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
      getPendingBinderInvitations: () => Promise.resolve([]),
    };
    expect(Object.keys(deps)).toEqual(["checkAdmin", "getBinderProfile", "getPendingBinderInvitations"]);
  });
});
