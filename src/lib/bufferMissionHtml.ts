/**
 * Page publique d'une Mission (/m/:publicToken) rendue en entier, et rendue
 * de nouveau si le rendu plante, avant d'envoyer quoi que ce soit.
 *
 * Constaté depuis le 10/11/2026, surtout sous Firefox (de 1 chargement sur 10
 * à 1 sur 2 selon les jours) : le rendu en flux de cette page plante au
 * hasard dans React —
 *   « A previously unvisited boundary must have exactly one root segment.
 *     This is a bug in React. » (flushCompletedBoundary → flushSegment)
 * Diffusée en flux, la page arrivait coupée vers 7,4 Ko sur 9,6 Ko, en plein
 * script de déshydratation du routeur : page blanche, dans l'iframe du site de
 * l'atelier Ferrière comme en accès direct. Erreur lue le 17/11/2026 sur une
 * préversion de diagnostic du Worker ; jamais reproduite en local.
 *
 * Cette page est petite et rendue sans SSR (`ssr: false`) : rien à gagner à la
 * diffuser en flux. On attend le HTML complet ; si la lecture du flux échoue,
 * on relance le rendu (au plus MAX_ATTEMPTS fois). Le HTML part avec sa
 * longueur. Le rechargement de secours côté navigateur (missionReloadGuard.ts)
 * reste le dernier filet.
 */
export const MAX_ATTEMPTS = 3;

export function shouldBufferMissionHtml(request: Request, response: Response): boolean {
  if (request.method !== "GET" || response.status !== 200) return false;
  if (!new URL(request.url).pathname.startsWith("/m/")) return false;
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

function complete(response: Response, body: ArrayBuffer): Response {
  const headers = new Headers(response.headers);
  headers.delete("transfer-encoding");
  headers.set("content-length", String(body.byteLength));
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * `render` relance le rendu de la même requête. Si toutes les tentatives
 * échouent, l'erreur remonte : le point d'entrée renvoie sa page d'erreur.
 */
export async function bufferMissionHtml(
  request: Request,
  response: Response,
  render: () => Response | Promise<Response>,
): Promise<Response> {
  if (!shouldBufferMissionHtml(request, response)) return response;
  let current = response;
  for (let attempt = 1; ; attempt++) {
    try {
      return complete(current, await current.arrayBuffer());
    } catch (error) {
      console.error(`[mission] rendu interrompu (tentative ${attempt}/${MAX_ATTEMPTS})`, error);
      if (attempt >= MAX_ATTEMPTS) throw error;
      current = await render();
      if (!shouldBufferMissionHtml(request, current)) return current;
    }
  }
}
