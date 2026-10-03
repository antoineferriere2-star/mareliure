import { createMiddleware } from "@tanstack/react-start";

/**
 * Même rôle que `auth-attacher.ts` (généré, non modifiable) : joindre le jeton
 * de la session aux appels de server functions depuis le navigateur.
 *
 * La différence est l'import du client Supabase, fait au premier appel plutôt
 * qu'en tête de fichier. Enregistré comme middleware global dans `start.ts`,
 * l'attacheur généré faisait entrer tout supabase-js (≈ 150 Ko) dans le paquet
 * principal, donc dans chaque page publique, alors qu'un visiteur de l'accueil
 * n'appelle aucune fonction authentifiée. Le module, une fois chargé, reste en
 * cache : les appels suivants ne coûtent rien de plus.
 */
export const attachSupabaseAuthLazily = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("./client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
