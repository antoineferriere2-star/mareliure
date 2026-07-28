import { describe, expect, it } from "vitest";
import {
  clearSessionAuthFromStorage,
  loadStoredSessionAuthFromStorage,
  publicSessionStorageKey,
  storeSessionAuthInStorage,
  type BrowserStorageLike,
} from "./publicSessionStorage";

class MemoryStorage implements BrowserStorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("public session storage", () => {
  it("stores public runtime session auth in durable storage", () => {
    const storage = new MemoryStorage();

    storeSessionAuthInStorage(
      "public-token",
      { sessionId: "session-1", secret: "secret-1" },
      storage,
    );

    expect(loadStoredSessionAuthFromStorage("public-token", storage)).toEqual({
      sessionId: "session-1",
      secret: "secret-1",
    });
  });

  it("migrates legacy tab storage into durable storage", () => {
    const durable = new MemoryStorage();
    const legacy = new MemoryStorage();
    const key = publicSessionStorageKey("public-token");
    legacy.setItem(key, JSON.stringify({ sessionId: "legacy-session", secret: "legacy-secret" }));

    const auth = loadStoredSessionAuthFromStorage("public-token", durable, legacy);

    expect(auth).toEqual({ sessionId: "legacy-session", secret: "legacy-secret" });
    expect(durable.getItem(key)).toBe(
      JSON.stringify({ sessionId: "legacy-session", secret: "legacy-secret" }),
    );
  });

  it("ignores corrupted stored auth", () => {
    const storage = new MemoryStorage();
    storage.setItem(publicSessionStorageKey("public-token"), "{not-json");

    expect(loadStoredSessionAuthFromStorage("public-token", storage)).toBeNull();
  });

  it("clears both durable and legacy tab storage", () => {
    const durable = new MemoryStorage();
    const legacy = new MemoryStorage();
    const key = publicSessionStorageKey("public-token");
    durable.setItem(key, "durable");
    legacy.setItem(key, "legacy");

    clearSessionAuthFromStorage("public-token", durable, legacy);

    expect(durable.getItem(key)).toBeNull();
    expect(legacy.getItem(key)).toBeNull();
  });
});
