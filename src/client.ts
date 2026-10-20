import { isMaReliure } from "./brand";
import { isPublicPerformancePage } from "./marketplace/performance/publicPages";
import { startHydration } from "./marketplace/performance/firstPaint";

startHydration(
  () => {
    void import("./hydrate-client").then(({ hydrateClient }) => hydrateClient());
  },
  isMaReliure &&
    isPublicPerformancePage(window.location.pathname) &&
    // Le formulaire de candidature doit recevoir ses handlers immédiatement.
    window.location.pathname !== "/partenaires-relieurs" &&
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
