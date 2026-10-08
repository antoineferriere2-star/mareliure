import { useEffect } from "react";

/**
 * Supabase's configured Site URL sends magic-link / email-confirmation
 * redirects to the home page instead of the app page we requested via
 * `emailRedirectTo` (its Redirect URLs allowlist needs that page added - a
 * dashboard config fix, not something this code can control). Until then,
 * catch a stray unprocessed session token in the hash and hand it to /auth,
 * which already knows how to detect the session and route to /build or /portal.
 *
 * Used by every page a home URL can land on: the root, and /en since the root
 * of finebindery.com redirects there (the browser keeps the hash across the
 * 301).
 */
export function useForwardStrayAuthHash() {
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.location.replace(`/auth${window.location.hash}`);
    }
  }, []);
}
