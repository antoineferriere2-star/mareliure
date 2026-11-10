/**
 * Mot de passe des espaces atelier (9 novembre 2026, demande d'Antoine après qu'un atelier a perdu
 * l'accès à son espace).
 *
 * Un atelier se connecte tous les jours : on lui demande un mot de passe, au lieu de lui faire
 * rouvrir sa boîte mail à chaque fois. Le lien et le code par e-mail restent la seule façon de
 * prouver qu'on tient l'adresse — c'est par eux qu'on crée son espace la première fois et qu'on
 * récupère un mot de passe oublié — mais l'espace atelier ne s'ouvre pas tant qu'aucun mot de passe
 * n'a été choisi.
 *
 * Supabase ne dit pas au navigateur si un compte a un mot de passe. On note donc la date du choix
 * dans les métadonnées du compte (`password_set_at`) chaque fois qu'il est posé par nos écrans ; un
 * atelier dont le mot de passe date d'avant cette règle le choisira une fois de plus.
 *
 * Le mot de passe n'est jamais posé sur un e-mail saisi à froid : toujours par `updateUser`, sur la
 * session qu'un lien ou un code vient d'ouvrir (voir la note de `MaReliureAuthPage`).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SET_AT_KEY = "password_set_at";

/** Ce que `supabase.auth.updateUser` reçoit pour poser un mot de passe et en garder la trace. */
export function passwordUpdate(password: string, now: Date = new Date()) {
  return { password, data: { [PASSWORD_SET_AT_KEY]: now.toISOString() } };
}

/** Le compte a-t-il choisi un mot de passe par nos écrans ? */
export function hasChosenPassword(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  const value = user?.user_metadata?.[PASSWORD_SET_AT_KEY];
  return typeof value === "string" && value.length > 0;
}

export function passwordTooShort(password: string): boolean {
  return password.length < PASSWORD_MIN_LENGTH;
}
