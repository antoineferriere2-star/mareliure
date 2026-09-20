/**
 * Quitter une session Ma Reliure — client, atelier ou back-office.
 *
 * Les trois espaces n'avaient aucun moyen de se déconnecter, et `/auth` renvoie
 * tout de suite une personne déjà connectée vers son espace : quelqu'un connecté
 * avec un compte ne pouvait plus en changer, sauf en effaçant les données du
 * site à la main. Cette fonction est l'unique chemin de sortie.
 *
 * Elle ne dépend d'aucun module du navigateur : tout passe par `deps`, pour que
 * l'ordre — et surtout le fait d'aboutir même quand le serveur ne répond pas —
 * soit testé sans navigateur.
 *
 * Le contrat qui compte : **la personne est déconnectée de cet appareil quoi
 * qu'il arrive**. Un `signOut` qui échoue (hors ligne, jeton déjà expiré) ne doit
 * pas la laisser dans un espace qu'elle a demandé à quitter.
 */

export interface SignOutDeps {
  /** Arrête les requêtes en vol : aucune ne doit repartir avec une session morte. */
  cancelQueries: () => Promise<unknown>;
  /** Vide le cache — il contient les livres, les messages et les prix du compte quitté. */
  clearCache: () => void;
  /** `supabase.auth.signOut`, sur cet appareil seulement (scope `local`). */
  signOut: () => Promise<{ error: unknown | null }>;
  /** Filet : efface la session stockée si `signOut` n'a pas pu le faire. */
  purgeLocalSession: () => void;
  /** Refait passer le routeur par sa garde d'authentification. */
  invalidateRouter: () => Promise<unknown>;
  /** Ouvre la porte de connexion. */
  goToSignIn: () => Promise<unknown> | void;
}

export interface SignOutResult {
  /** Le serveur a confirmé la fin de la session. Faux ne veut pas dire « toujours connecté ». */
  confirmedByServer: boolean;
}

export async function performSignOut(deps: SignOutDeps): Promise<SignOutResult> {
  await deps.cancelQueries();
  deps.clearCache();

  let confirmedByServer = false;
  try {
    const { error } = await deps.signOut();
    confirmedByServer = !error;
  } catch {
    confirmedByServer = false;
  }
  // Toujours, et pas seulement en cas d'échec : le coût est nul quand la session
  // est déjà partie, et c'est ce qui garantit la sortie quand elle ne l'est pas.
  deps.purgeLocalSession();

  await deps.invalidateRouter();
  await deps.goToSignIn();
  return { confirmedByServer };
}

/** La référence du projet Supabase, lue dans son URL : `https://<réf>.supabase.co`. */
export function supabaseProjectRef(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

/**
 * Efface la session stockée **de ce projet** — `sb-<réf>-auth-token`, avec ses
 * éventuels morceaux `.0`, `.1` — et rien d'autre. Un navigateur peut porter la
 * session d'un autre projet Supabase (Métré Build, par exemple) : la quitter ici
 * ne doit pas fermer celle-là.
 */
export function purgeStoredSupabaseSession(
  storage: Pick<Storage, "length" | "key" | "removeItem">,
  projectRef: string | null,
): number {
  if (!projectRef) return 0;
  const base = `sb-${projectRef}-auth-token`;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && (key === base || key.startsWith(`${base}.`) || key === `${base}-code-verifier`)) {
      keys.push(key);
    }
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}
