import { isMaReliure } from "./brand";
import { isPublicPerformancePage } from "./marketplace/performance/publicPages";
import { startHydration } from "./marketplace/performance/firstPaint";
import { captureEarlyFormActions } from "./marketplace/performance/earlyFormActions";

let paintObserver: PerformanceObserver | undefined;
let paintFallback: number | undefined;
let paintReady = false;
const cancelPaintWait = () => {
  paintObserver?.disconnect();
  paintObserver = undefined;
  if (paintFallback !== undefined) window.clearTimeout(paintFallback);
  paintFallback = undefined;
};
const requestHydration = startHydration(
  () => {
    cancelPaintWait();
    void import("./hydrate-client").then(({ hydrateClient }) => hydrateClient());
  },
  isMaReliure &&
    isPublicPerformancePage(window.location.pathname) &&
    document.visibilityState === "visible",
  {
    requestFrame: (callback) => {
      const schedule = () => window.requestAnimationFrame(callback);
      if (
        paintReady ||
        performance.getEntriesByName("first-contentful-paint").length ||
        typeof PerformanceObserver === "undefined" ||
        !PerformanceObserver.supportedEntryTypes?.includes("paint")
      ) {
        paintReady = true;
        schedule();
        return;
      }
      const finish = () => {
        paintReady = true;
        cancelPaintWait();
        schedule();
      };
      paintObserver = new PerformanceObserver((list) => {
        if (!list.getEntries().some((entry) => entry.name === "first-contentful-paint")) return;
        finish();
      });
      try {
        paintObserver.observe({ type: "paint", buffered: true });
        paintFallback = window.setTimeout(finish, 2000);
      } catch {
        finish();
      }
    },
    listen: (name, callback) => {
      document.addEventListener(name, callback, { capture: true });
      return () => document.removeEventListener(name, callback, { capture: true });
    },
  },
);

if (isMaReliure && window.location.pathname === "/partenaires-relieurs") {
  captureEarlyFormActions(document, requestHydration);
}
