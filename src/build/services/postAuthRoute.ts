// Where an authenticated account lands after sign-in:
//   Métré admin        -> /build
//   workspace member   -> /portal
//   client with no workspace (legacy account, race, first sign-up)
//                      -> safe idempotent provisioning, then /portal
// Pure and dependency-injected so the decision is unit tested; the browser
// never decides privileges — every check is a server call.
export interface PostAuthDeps {
  checkAdmin(): Promise<unknown>;
  checkWorkspace(): Promise<unknown>;
  provision(): Promise<{ status: "admin" | "existing" | "provisioned" }>;
}

export type PostAuthDestination =
  { to: "/build" } | { to: "/portal" } | { to: "/portal/setup" } | { to: null; error: string };

/**
 * Where a `?redirect=` on /auth may send someone. An allow-list, not a
 * sanitiser: the value arrives in a URL anyone can craft and link to, so
 * anything not named here — an absolute URL, a protocol-relative `//host`,
 * an admin path — is simply ignored rather than cleaned up.
 *
 * /free-inquiry-audit uses this to send a visitor straight to setup after
 * they create an account, instead of dropping them on an empty portal.
 */
const ALLOWED_REDIRECTS = ["/portal/setup"] as const;
export type AllowedRedirect = (typeof ALLOWED_REDIRECTS)[number];

export function resolveRedirectTarget(requested: string | undefined): AllowedRedirect | null {
  if (!requested) return null;
  return ALLOWED_REDIRECTS.find((allowed) => allowed === requested) ?? null;
}

export const PROVISION_ERROR =
  "We couldn't finish setting up your workspace. Please try again — if it keeps failing, contact support@metre-pro.com.";

export async function resolvePostAuthDestination(
  deps: PostAuthDeps,
  requestedRedirect?: string,
): Promise<PostAuthDestination> {
  try {
    await deps.checkAdmin();
    // An admin is never diverted by a redirect param: /build is where their
    // work is, and the client-side setup wizard is not their surface.
    return { to: "/build" };
  } catch {
    // not a Métré admin — continue
  }

  const redirect = resolveRedirectTarget(requestedRedirect);

  try {
    await deps.checkWorkspace();
    return redirect ? { to: redirect } : { to: "/portal" };
  } catch {
    // no workspace yet — provision one
  }

  try {
    const result = await deps.provision();
    if (result.status === "admin") return { to: "/build" };
    return redirect ? { to: redirect } : { to: "/portal" };
  } catch {
    return { to: null, error: PROVISION_ERROR };
  }
}
