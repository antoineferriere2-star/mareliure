import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

const SESSION_KEY = "metre-build-visit-session";

function readSession(): { id: string; isNew: boolean } {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return { id: existing, isNew: false };
    const id = crypto.randomUUID().replace(/-/g, "");
    window.sessionStorage.setItem(SESSION_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: crypto.randomUUID().replace(/-/g, ""), isNew: true };
  }
}

/**
 * Client-side ping for the Insights Engine: one anonymous page view per
 * public route render, including client-side navigations. No cookies, no
 * personal data — the server derives everything else it stores.
 */
export function usePageViewTracking(locale?: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const session = readSession();
    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer || "",
      locale: locale ?? "",
      sessionHash: session.id,
      isNewSession: session.isNew,
    });

    void fetch("/api/public/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, locale]);
}
