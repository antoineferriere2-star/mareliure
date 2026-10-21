import { afterEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_VISITOR_STORAGE_KEY, isInternalVisitor, setInternalVisitor } from "./internalVisitor";
import { runtimeSessionMetadataError } from "@/build/runtime/sessionMetadata";

function browser(search = "") {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    location: { search },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("navigateurs de l'équipe exclus des mesures", () => {
  it("compte par défaut ; ?interne=1 exclut, ?interne=0 réinclut, et le choix persiste", () => {
    const store = browser();
    expect(isInternalVisitor()).toBe(false);
    (window as unknown as { location: { search: string } }).location.search = "?interne=1";
    expect(isInternalVisitor()).toBe(true);
    (window as unknown as { location: { search: string } }).location.search = "";
    expect(isInternalVisitor()).toBe(true);
    expect(store.get(INTERNAL_VISITOR_STORAGE_KEY)).toBe("1");
    (window as unknown as { location: { search: string } }).location.search = "?interne=0";
    expect(isInternalVisitor()).toBe(false);
  });
  it("se pose et se retire depuis le pilotage", () => {
    browser();
    setInternalVisitor(true);
    expect(isInternalVisitor()).toBe(true);
    setInternalVisitor(false);
    expect(isInternalVisitor()).toBe(false);
  });
  it("reste compté si le stockage local est indisponible, et hors navigateur", () => {
    vi.stubGlobal("window", { location: { search: "?interne=1" }, localStorage: { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => undefined } });
    expect(isInternalVisitor()).toBe(false);
    vi.unstubAllGlobals();
    expect(isInternalVisitor()).toBe(false);
  });
  it("le serveur n'accepte que la valeur « 1 » pour la marque de session interne", () => {
    expect(runtimeSessionMetadataError("_internal_visit", "1")).toBeNull();
    expect(runtimeSessionMetadataError("_internal_visit", "oui")).toBe("Invalid internal visit flag.");
  });
});
