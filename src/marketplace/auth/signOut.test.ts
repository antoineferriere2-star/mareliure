import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  performSignOut,
  purgeStoredSupabaseSession,
  supabaseProjectRef,
  type SignOutDeps,
} from "./signOut";

function deps(overrides: Partial<SignOutDeps> = {}) {
  const calls: string[] = [];
  const base: SignOutDeps = {
    cancelQueries: async () => void calls.push("cancelQueries"),
    clearCache: () => void calls.push("clearCache"),
    signOut: async () => (calls.push("signOut"), { error: null }),
    purgeLocalSession: () => void calls.push("purgeLocalSession"),
    invalidateRouter: async () => void calls.push("invalidateRouter"),
    goToSignIn: async () => void calls.push("goToSignIn"),
  };
  return { calls, deps: { ...base, ...overrides } };
}

describe("performSignOut", () => {
  it("stops requests and empties the cache before the session goes, then opens the sign-in door", async () => {
    const { calls, deps: d } = deps();
    const result = await performSignOut(d);
    expect(calls).toEqual([
      "cancelQueries",
      "clearCache",
      "signOut",
      "purgeLocalSession",
      "invalidateRouter",
      "goToSignIn",
    ]);
    expect(result.confirmedByServer).toBe(true);
  });

  it("still gets the person out when the server does not answer", async () => {
    const { calls, deps: d } = deps({
      signOut: async () => {
        throw new Error("network down");
      },
    });
    const result = await performSignOut(d);
    expect(result.confirmedByServer).toBe(false);
    // The contract: signed out of THIS device whatever happens.
    expect(calls).toContain("purgeLocalSession");
    expect(calls.at(-1)).toBe("goToSignIn");
  });

  it("still gets the person out when the server answers with an error", async () => {
    const { calls, deps: d } = deps({ signOut: async () => ({ error: new Error("401") }) });
    const result = await performSignOut(d);
    expect(result.confirmedByServer).toBe(false);
    expect(calls.at(-1)).toBe("goToSignIn");
    expect(calls).toContain("purgeLocalSession");
  });

  it("never navigates before the session is gone (the guard would send them straight back)", async () => {
    const { calls, deps: d } = deps();
    await performSignOut(d);
    expect(calls.indexOf("goToSignIn")).toBeGreaterThan(calls.indexOf("purgeLocalSession"));
    expect(calls.indexOf("goToSignIn")).toBeGreaterThan(calls.indexOf("invalidateRouter"));
  });
});

describe("purgeStoredSupabaseSession", () => {
  function fakeStorage(entries: Record<string, string>) {
    const data = new Map(Object.entries(entries));
    return {
      data,
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      removeItem: (key: string) => void data.delete(key),
    };
  }

  it("removes this project's session — token, chunks and code verifier — and nothing else", () => {
    const storage = fakeStorage({
      "sb-abc123-auth-token": "{}",
      "sb-abc123-auth-token.0": "{}",
      "sb-abc123-auth-token-code-verifier": "v",
      "sb-otherproject-auth-token": "{}", // another Supabase project in the same browser
      "metre_build_session_reliure-marketplace-token-000001": "{}", // an intake in progress
      "metre-build-public-locale": "fr-FR",
    });
    expect(purgeStoredSupabaseSession(storage, "abc123")).toBe(3);
    expect([...storage.data.keys()].sort()).toEqual([
      "metre-build-public-locale",
      "metre_build_session_reliure-marketplace-token-000001",
      "sb-otherproject-auth-token",
    ]);
  });

  it("does not match a project whose name merely starts the same way", () => {
    const storage = fakeStorage({ "sb-abc-auth-token": "{}", "sb-abcdef-auth-token": "{}" });
    purgeStoredSupabaseSession(storage, "abc");
    expect([...storage.data.keys()]).toEqual(["sb-abcdef-auth-token"]);
  });

  it("does nothing when the project cannot be identified — it will not guess", () => {
    const storage = fakeStorage({ "sb-abc-auth-token": "{}" });
    expect(purgeStoredSupabaseSession(storage, null)).toBe(0);
    expect(storage.data.size).toBe(1);
  });
});

describe("supabaseProjectRef", () => {
  it("reads the reference from the project URL, and refuses what is not a URL", () => {
    expect(supabaseProjectRef("https://hljxohondjvrkzqicexl.supabase.co")).toBe("hljxohondjvrkzqicexl");
    expect(supabaseProjectRef("not a url")).toBeNull();
    expect(supabaseProjectRef("")).toBeNull();
  });
});

describe("every Ma Reliure space can be left", () => {
  // The bug this guards: three spaces, no way out, and /auth sends a signed-in
  // person straight back. A layout added later without the button fails here.
  const LAYOUTS = [
    "src/routes/_authenticated/mes-livres/route.tsx",
    "src/routes/_authenticated/atelier/route.tsx",
    "src/routes/_authenticated/marketplace/route.tsx",
  ];

  it.each(LAYOUTS)("%s carries the sign-out button", (path) => {
    const file = resolve(process.cwd(), path);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("<SignOutButton");
  });

  it("signs out of this device only, so the phone stays signed in when the desktop leaves", () => {
    const source = readFileSync(resolve(process.cwd(), "src/marketplace/pages/SignOutButton.tsx"), "utf8");
    expect(source).toContain('signOut({ scope: "local" })');
  });
});
