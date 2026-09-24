import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SERVICE = readFileSync(
  resolve(process.cwd(), "src/marketplace/services/fineBinderyProfile.data.functions.ts"),
  "utf8",
);
const CASES = readFileSync(
  resolve(process.cwd(), "src/marketplace/services/caseRepository.server.ts"),
  "utf8",
);
const PUBLIC_PAGES = readFileSync(
  resolve(process.cwd(), "src/marketplace/pages/fineBindery/PublicWorkshopPages.tsx"),
  "utf8",
);
const INTAKE_ROUTE = readFileSync(resolve(process.cwd(), "src/routes/$locale.project.tsx"), "utf8");

describe("FineBindery public projection security", () => {
  it("serves only approved, explicitly published workshops", () => {
    const publicRows = SERVICE.slice(SERVICE.indexOf("async function publicBinderRows"));
    expect(publicRows).toContain('.eq("status", "approved").eq("public_profile_status", "published")');
    expect(publicRows).toContain('.not("personal_referral_slug", "is", null)');
  });

  it("returns only consented portfolio entries and strips private row fields", () => {
    const projection = SERVICE.slice(
      SERVICE.indexOf("async function publicPortfolioFor"),
      SERVICE.indexOf("async function reserveStableSlug"),
    );
    expect(projection).toContain('.eq("is_published", true)');
    expect(projection).toContain('.not("publication_consent_at", "is", null)');
    expect(projection).not.toContain('select("*")');
    for (const privateField of ["binder_id", "source_work_id", "publication_consent_at", "created_at", "updated_at"]) {
      expect(projection, privateField).not.toContain(`${privateField}:`);
    }
  });

  it("scopes every profile and portfolio write to the signed-in workshop", () => {
    expect(SERVICE).toContain('.eq("id", binder.id)');
    expect(SERVICE).toContain('.eq("id", data.id).eq("binder_id", binder.id)');
    expect(SERVICE).toContain('.eq("id", data.sourceWorkId).eq("binder_id", binder.id)');
    expect(SERVICE).not.toMatch(/binderId:\s*z\./);
  });

  it("accepts direct attribution only for an approved, still-published profile", () => {
    const resolver = CASES.slice(
      CASES.indexOf("export async function resolvePublishedFineBinderyBinderBySlug"),
      CASES.indexOf("export async function signCasePhotos"),
    );
    expect(resolver).toContain('.eq("status", "approved")');
    expect(resolver).toContain('.eq("public_profile_status", "published")');
  });

  it("creates one direct workshop match with an explicit provenance event", () => {
    const reconciliation = CASES.slice(CASES.indexOf("export async function reconcileCaseTriage"));
    expect(reconciliation).toContain('acquisition_origin: fromFineBinderyProfile ? "FINEBINDERY_PROFILE"');
    expect(reconciliation).toContain('binder_id: referral.binderId');
    expect(reconciliation).toContain('state: "invited"');
    expect(reconciliation).toContain('event_type: fromFineBinderyProfile ? "finebindery_profile_request_attributed"');
    expect(reconciliation).not.toContain('fromFineBinderyProfile ? { brand: "FINE_BINDERY" }');
  });

  it("opens the FineBindery Mission and preserves every supported profile locale", () => {
    expect(PUBLIC_PAGES).not.toContain("BOOKBINDING_PUBLIC_TOKEN");
    expect(INTAKE_ROUTE).toContain("FINE_BINDERY_PUBLIC_TOKEN");
    expect(INTAKE_ROUTE).toContain("ENGINE_LOCALE[locale]");
    expect(INTAKE_ROUTE).toContain("FINE_BINDERY_PREFERRED_LANGUAGE_KEY");
    expect(INTAKE_ROUTE).toContain("FINE_BINDERY_SUBMISSION_LOCALE_KEY");
  });
});
