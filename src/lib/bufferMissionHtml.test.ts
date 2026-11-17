import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { bufferMissionHtml, MAX_ATTEMPTS, shouldBufferMissionHtml } from "./bufferMissionHtml";

const html = "<!doctype html><html><body>Présenter mon ouvrage</body></html>";
const req = () => new Request("https://mareliure.fr/m/ferriere-intake-token-000001");

/** Réponse diffusée en flux ; `fail` fait planter le flux après le premier morceau, comme le bogue React. */
function streamed(body: string, { fail = false, contentType = "text/html; charset=utf-8", status = 200 } = {}) {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    pull(controller) {
      if (!(controller as unknown as { sent?: boolean }).sent) {
        (controller as unknown as { sent?: boolean }).sent = true;
        controller.enqueue(bytes.slice(0, 20));
        return;
      }
      if (fail) controller.error(new Error("A previously unvisited boundary must have exactly one root segment."));
      else { controller.enqueue(bytes.slice(20)); controller.close(); }
    },
  });
  return new Response(stream, { status, headers: { "content-type": contentType, "x-garde": "oui" } });
}

describe("page de Mission rendue en entier avant l'envoi", () => {
  it("attend le HTML complet et annonce sa longueur en octets", async () => {
    const render = vi.fn();
    const res = await bufferMissionHtml(req(), streamed(html), render);
    expect(await res.text()).toBe(html);
    expect(res.headers.get("content-length")).toBe(String(new TextEncoder().encode(html).byteLength));
    expect(res.headers.get("x-garde")).toBe("oui");
    expect(render).not.toHaveBeenCalled();
  });

  it("relance le rendu quand le flux plante, et envoie la page complète", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const render = vi.fn().mockResolvedValueOnce(streamed(html, { fail: true })).mockResolvedValueOnce(streamed(html));
    const res = await bufferMissionHtml(req(), streamed(html, { fail: true }), render);
    expect(await res.text()).toBe(html);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it(`abandonne après ${MAX_ATTEMPTS} tentatives : l'erreur remonte au point d'entrée`, async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const render = vi.fn().mockImplementation(async () => streamed(html, { fail: true }));
    await expect(bufferMissionHtml(req(), streamed(html, { fail: true }), render)).rejects.toThrow(/unvisited boundary/);
    expect(render).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1);
  });

  it("ne touche ni aux autres pages, ni aux fonctions serveur, ni aux erreurs", () => {
    const res = streamed(html);
    expect(shouldBufferMissionHtml(new Request("https://mareliure.fr/atelier"), res)).toBe(false);
    expect(shouldBufferMissionHtml(new Request("https://mareliure.fr/_serverFn/abc"), streamed("{}", { contentType: "application/json" }))).toBe(false);
    expect(shouldBufferMissionHtml(new Request("https://mareliure.fr/m/x"), streamed(html, { status: 404 }))).toBe(false);
    expect(shouldBufferMissionHtml(new Request("https://mareliure.fr/m/x", { method: "POST" }), res)).toBe(false);
  });

  it("est branché dans le point d'entrée du Worker, avec relance du rendu", () => {
    const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
    expect(server).toContain("bufferMissionHtml(request, await normalizeCatastrophicSsrResponse(response), () => handler.fetch(new Request(request), env, ctx))");
  });
});
