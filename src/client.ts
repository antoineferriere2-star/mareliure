import { isMaReliure } from "./brand";
import { isPublicPerformancePage } from "./marketplace/performance/publicPages";
import { startHydration } from "./marketplace/performance/firstPaint";

startHydration(
  () => {
    void import("./hydrate-client").then(({ hydrateClient }) => hydrateClient());
  },
  isMaReliure &&
    isPublicPerformancePage(window.location.pathname) &&
    document.visibilityState === "visible",
  {
    requestFrame: (callback) => {
      window.requestAnimationFrame(callback);
    },
    listen: (name, callback) => {
      document.addEventListener(name, callback, { capture: true });
      return () => document.removeEventListener(name, callback, { capture: true });
    },
  },
);
