// Error type used by server functions to report a failure to the browser.
//
// Why not `throw new Response(...)`: TanStack Start treats a thrown Response
// as a *returned* response. The browser-side `createServerFn` caller then
// RESOLVES with an empty object instead of rejecting, so every guard written
// as `try { await check() } catch { deny }` silently passed and every error
// banner stayed empty. A thrown Error is serialized and re-thrown client-side,
// so `try/catch` and `readError()` behave as intended.
export class ServerFnError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerFnError";
    this.status = status;
  }
}

/** Throws a client-visible server error. Never returns. */
export function fail(status: number, message: string): never {
  throw new ServerFnError(status, message);
}
