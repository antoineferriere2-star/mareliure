import { afterEach, describe, expect, it, vi } from "vitest";
import { isHydrated, markHydrated, navigateBeforeHydration } from "./hydration";

// Redirections des routes `ssr: false` : avant l'hydratation, une navigation complète
// (jamais une redirection du routeur, qui provoquerait l'erreur React #418).
describe("redirection autour de l'hydratation", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("signale l'hydratation une fois la racine montée", () => {
    expect(isHydrated()).toBe(false);
    markHydrated();
    expect(isHydrated()).toBe(true);
  });

  it("quitte la page par une navigation complète et ne rend jamais la main au routeur", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    let settled = false;
    void navigateBeforeHydration("/auth?redirect=%2Fatelier").then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).toHaveBeenCalledWith("/auth?redirect=%2Fatelier");
    expect(settled).toBe(false);
  });
});
