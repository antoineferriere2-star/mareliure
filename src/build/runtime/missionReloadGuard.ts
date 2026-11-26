/**
 * Rechargement de secours de la page publique d'une Mission (/m/:publicToken).
 *
 * Constaté le 10/11/2026 sous Firefox (environ un chargement sur dix,
 * jamais sous Chromium) : la page HTML arrive coupée en plein milieu, dans le
 * script de déshydratation du routeur. Le JavaScript ne démarre jamais et le
 * visiteur voit une page blanche — dans l'iframe du site de l'atelier
 * Ferrière comme en accès direct. La coupure survient pendant le transport,
 * pas dans le rendu : rien à corriger côté serveur.
 *
 * Ce script est placé dans le <head>, donc toujours reçu même quand la page
 * est coupée. Cinq secondes après l'événement `load`, si le routeur n'a pas
 * démarré, il recharge la page — une seule fois par onglet (marque posée dans
 * `window.name`, qui survit au rechargement et fonctionne aussi dans une
 * iframe tierce, sans stockage).
 */
export const MISSION_RELOAD_MARK = "metre-mission-recharge";
export const MISSION_RELOAD_DELAY_MS = 5000;

export const MISSION_RELOAD_GUARD = `(function(){var k=${JSON.stringify(MISSION_RELOAD_MARK)};function c(){if(window.__TSR_ROUTER__||window.name===k)return;window.name=k;location.reload();}addEventListener("load",function(){setTimeout(c,${MISSION_RELOAD_DELAY_MS});});})();`;
