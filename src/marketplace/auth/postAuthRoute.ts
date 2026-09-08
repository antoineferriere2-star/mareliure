/**
 * Où atterrit un compte Ma Reliure après connexion.
 *
 * Le moteur Métré a déjà sa propre réponse — `src/build/services/postAuthRoute.ts`
 * envoie un admin sur `/build` et tout le reste sur `/portal`. Elle est juste
 * pour Métré et fausse pour Ma Reliure : un relieur qui se connecte y trouvait
 * le portail client Métré, en anglais, avec une invitation à configurer un
 * « project intake ». Ce n'est pas un bug du moteur, c'est qu'on lui demandait
 * une décision qui ne le regarde pas.
 *
 * D'où ce second résolveur. Il vit dans `src/marketplace/` parce que les trois
 * destinations sont des notions de la marketplace, et le choix entre les deux
 * se fait à la route (`src/routes/auth.tsx`), au même endroit et de la même
 * façon que le choix de la page d'accueil.
 *
 * Comme son homologue : pur, dépendances injectées, testé. Le navigateur ne
 * décide d'aucun privilège — chaque vérification est un appel serveur.
 */

export type MarketplacePostAuthDestination =
  { to: "/marketplace/cases" } | { to: "/atelier" } | { to: "/mes-livres" };

export interface MarketplacePostAuthDeps {
  /** Lève une erreur si le compte n'est pas administrateur. */
  checkAdmin(): Promise<unknown>;
  /** `null` si aucun atelier n'est rattaché à ce compte. */
  getBinderProfile(): Promise<unknown>;
}

/**
 * Trois rôles, trois portes, dans l'ordre du plus privilégié au plus commun.
 *
 * Le cas par défaut est « Mes livres » et non la page d'accueil : quelqu'un qui
 * se connecte cherche ses livres, et si la liste est vide cette page est
 * précisément celle qui propose de rattacher un projet. L'envoyer sur la
 * landing lui redemanderait de chercher.
 *
 * Aucun espace de travail Métré n'est provisionné au passage. C'est volontaire :
 * une cliente qui confie un livre n'a pas à recevoir un espace de logiciel B2B.
 */
export async function resolveMarketplacePostAuthDestination(
  deps: MarketplacePostAuthDeps,
): Promise<MarketplacePostAuthDestination> {
  try {
    await deps.checkAdmin();
    return { to: "/marketplace/cases" };
  } catch {
    // pas administrateur — on continue
  }

  try {
    if (await deps.getBinderProfile()) return { to: "/atelier" };
  } catch {
    // profil de relieur illisible : on traite le compte comme un client plutôt
    // que de bloquer la connexion sur une erreur secondaire.
  }

  return { to: "/mes-livres" };
}
