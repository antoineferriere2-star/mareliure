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
  | { to: "/build" }
  | { to: "/portal" }
  | { to: null; error: string };

export const PROVISION_ERROR =
  "We couldn't finish setting up your workspace. Please try again — if it keeps failing, contact support@metre-pro.com.";

export async function resolvePostAuthDestination(
  deps: PostAuthDeps,
): Promise<PostAuthDestination> {
  try {
    await deps.checkAdmin();
    return { to: "/build" };
  } catch {
    // not a Métré admin — continue
  }

  try {
    await deps.checkWorkspace();
    return { to: "/portal" };
  } catch {
    // no workspace yet — provision one
  }

  try {
    const result = await deps.provision();
    if (result.status === "admin") return { to: "/build" };
    return { to: "/portal" };
  } catch {
    return { to: null, error: PROVISION_ERROR };
  }
}
