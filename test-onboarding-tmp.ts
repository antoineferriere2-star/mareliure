import { fetchSitePublicHtml, normalizeOnboardingUrl } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { runOnboardingExtraction } from "@/build/ai/onboardingExtraction";
import { matchPlaybookForProduct } from "@/build/onboarding/matchPlaybook";

const badUrls = ["http://169.254.169.254/", "http://localhost", "http://127.0.0.1", "http://10.0.0.1", "http://[::1]/", "ftp://example.com"];
console.log("=== SSRF rejection ===");
for (const u of badUrls) {
  try { normalizeOnboardingUrl(u); console.log("LEAK:", u); }
  catch (e: any) { console.log("OK reject:", u, "-", e.message); }
}

const target = process.argv[2] || "https://www.silvadec.com/";
console.log("\n=== Fetch + extract:", target, "===");
try {
  const { finalUrl, html } = await fetchSitePublicHtml(target);
  console.log("finalUrl:", finalUrl, "html bytes:", html.length);
  const site = extractSiteText(html);
  console.log("title:", site.title);
  console.log("meta:", site.metaDescription);
  console.log("visibleText[0..400]:", site.visibleText.slice(0, 400));

  console.log("\n=== AI extraction ===");
  const res = await runOnboardingExtraction(site);
  console.log(JSON.stringify(res, null, 2));

  if (res.status === "ok") {
    const bt = res.data.businessTypeCandidates[0] ?? "";
    const p = res.data.products[0] ?? "";
    const playbooks = [
      { id: "e15", name: "livre", project_type: "livre" },
      { id: "deck", name: "Terrasse / Deck — v1", project_type: "deck" },
    ];
    console.log("\n=== Match for:", bt, "/", p, "=>", matchPlaybookForProduct(bt, p, playbooks));
  }
} catch (e: any) {
  console.error("FAIL:", e.message);
}
