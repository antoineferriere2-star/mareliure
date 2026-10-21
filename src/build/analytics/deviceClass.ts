/**
 * Classe d'appareil d'une visite, depuis l'en-tête User-Agent. « bot » n'est jamais compté.
 *
 * Les mots génériques (bot, crawl, spider…) ne suffisaient pas : l'outil d'inspection de Google
 * (« Google-InspectionTool »), les navigateurs sans interface et les outils d'automatisation de nos
 * propres recettes (Playwright, Lighthouse) étaient comptés comme des visiteurs (revue #158).
 */
const AUTOMATED = new RegExp(
  [
    "bot", "crawl", "spider", "slurp", "preview", "monitor", "lighthouse", "pagespeed",
    "inspectiontool", "googleother", "google-", "headlesschrome", "playwright", "puppeteer",
    "selenium", "phantomjs", "electron", "curl/", "wget/", "python-", "node-fetch", "axios/",
    "go-http-client", "okhttp", "java/", "httpclient", "validator", "gtmetrix", "pingdom", "uptime",
  ].map((word) => word.replace(/[.*+?^${}()|[\]\/]/g, "\$&")).join("|"),
);

export function deviceClass(userAgent: string | null | undefined): "bot" | "tablet" | "mobile" | "desktop" {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua || AUTOMATED.test(ua)) return "bot";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}
