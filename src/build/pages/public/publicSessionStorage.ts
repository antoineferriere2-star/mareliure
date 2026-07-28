export type SessionAuth = { sessionId: string; secret: string };

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function publicSessionStorageKey(publicToken: string) {
  return `metre_build_session_${publicToken}`;
}

export function parseStoredSessionAuth(raw: string | null): SessionAuth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionAuth>;
    if (typeof parsed.sessionId === "string" && typeof parsed.secret === "string") {
      return { sessionId: parsed.sessionId, secret: parsed.secret };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return null;
}

export function loadStoredSessionAuthFromStorage(
  publicToken: string,
  durableStorage: BrowserStorageLike | null | undefined,
  legacyTabStorage?: BrowserStorageLike | null,
): SessionAuth | null {
  const key = publicSessionStorageKey(publicToken);
  const durable = parseStoredSessionAuth(durableStorage?.getItem(key) ?? null);
  if (durable) return durable;

  const legacy = parseStoredSessionAuth(legacyTabStorage?.getItem(key) ?? null);
  if (!legacy || !durableStorage) return legacy;

  try {
    durableStorage.setItem(key, JSON.stringify(legacy));
  } catch {
    /* keep the legacy tab session usable */
  }
  return legacy;
}

export function storeSessionAuthInStorage(
  publicToken: string,
  auth: SessionAuth,
  durableStorage: BrowserStorageLike | null | undefined,
) {
  if (!durableStorage) return;
  try {
    durableStorage.setItem(publicSessionStorageKey(publicToken), JSON.stringify(auth));
  } catch {
    /* ignore private browsing / quota failures */
  }
}

export function clearSessionAuthFromStorage(
  publicToken: string,
  durableStorage: BrowserStorageLike | null | undefined,
  legacyTabStorage?: BrowserStorageLike | null,
) {
  const key = publicSessionStorageKey(publicToken);
  try {
    durableStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    legacyTabStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

function browserStorages() {
  if (typeof window === "undefined") return { durableStorage: null, legacyTabStorage: null };
  return { durableStorage: window.localStorage, legacyTabStorage: window.sessionStorage };
}

export function loadStoredAuth(publicToken: string): SessionAuth | null {
  const { durableStorage, legacyTabStorage } = browserStorages();
  return loadStoredSessionAuthFromStorage(publicToken, durableStorage, legacyTabStorage);
}

export function storeAuth(publicToken: string, auth: SessionAuth) {
  storeSessionAuthInStorage(publicToken, auth, browserStorages().durableStorage);
}

export function clearStoredAuth(publicToken: string) {
  const { durableStorage, legacyTabStorage } = browserStorages();
  clearSessionAuthFromStorage(publicToken, durableStorage, legacyTabStorage);
}
