/**
 * Redirections des routes rendues côté client seulement (`ssr: false`).
 *
 * Le serveur n'envoie rien sous ces routes, et le routeur résout leurs `beforeLoad` AVANT
 * d'hydrater. Une redirection du routeur à ce moment fait rendre la page cible là où le serveur
 * n'avait rien rendu : erreur React #418 (vue sur /atelier → /auth sans session). Avant
 * l'hydratation initiale, la redirection est donc une navigation complète : la page cible est
 * rendue par le serveur et hydrate normalement. Ensuite, la redirection du routeur reprend.
 */
let hydrated = false;

/** Appelé une fois, au premier rendu validé de la racine. */
export function markHydrated(): void {
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Navigation complète vers `href` ; la promesse ne se résout jamais (la page est quittée). */
export function navigateBeforeHydration(href: string): Promise<never> {
  window.location.replace(href);
  return new Promise<never>(() => undefined);
}
