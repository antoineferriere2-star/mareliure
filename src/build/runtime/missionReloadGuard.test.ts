import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MISSION_RELOAD_DELAY_MS, MISSION_RELOAD_GUARD, MISSION_RELOAD_MARK } from "./missionReloadGuard";

/** Exécute le script dans une fenêtre simulée et renvoie ce qu'il a fait. */
function run({ routerStarted, name = "" }: { routerStarted: boolean; name?: string }) {
  vi.useFakeTimers();
  const listeners: Record<string, () => void> = {};
  const reload = vi.fn();
  const win = {
    name,
    __TSR_ROUTER__: routerStarted ? {} : undefined,
    location: { reload },
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  };
  new Function("window", "location", "addEventListener", "setTimeout", MISSION_RELOAD_GUARD)(win, win.location, win.addEventListener, win.setTimeout);
  listeners.load?.();
  vi.advanceTimersByTime(MISSION_RELOAD_DELAY_MS - 1);
  const reloadedEarly = reload.mock.calls.length > 0;
  vi.advanceTimersByTime(1);
  vi.useRealTimers();
  return { reloadedEarly, reloaded: reload.mock.calls.length, name: win.name };
}

describe("rechargement de secours de la page de Mission", () => {
  it("recharge une fois si le routeur n'a pas démarré 5 s après le chargement", () => {
    expect(run({ routerStarted: false })).toEqual({ reloadedEarly: false, reloaded: 1, name: MISSION_RELOAD_MARK });
  });

  it("ne fait rien quand la page a démarré", () => {
    expect(run({ routerStarted: true })).toEqual({ reloadedEarly: false, reloaded: 0, name: "" });
  });

  it("ne recharge jamais deux fois de suite", () => {
    expect(run({ routerStarted: false, name: MISSION_RELOAD_MARK }).reloaded).toBe(0);
  });

  it("est posé dans l'en-tête de la route /m/:publicToken", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/m.$publicToken.tsx"), "utf8");
    expect(route).toContain("scripts: [{ children: MISSION_RELOAD_GUARD }]");
  });
});
