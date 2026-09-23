import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const NAME = "20260923140000_finebindery_public_profiles.sql";
const RAW = readFileSync(resolve(process.cwd(), "supabase/migrations", NAME), "utf8").replace(/\r\n/g, "\n");
const SQL = RAW.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

describe("FineBindery public profile migration", () => {
  it("is additive and never publishes or rewrites an existing workshop", () => {
    expect(SQL).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(SQL).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(SQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(SQL).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(SQL).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("keeps profiles and portfolio items private by default", () => {
    expect(SQL).toContain("public_profile_status TEXT NOT NULL DEFAULT 'draft'");
    expect(SQL).toContain("is_published BOOLEAN NOT NULL DEFAULT false");
    expect(SQL).toContain("public_profile_published_at TIMESTAMPTZ");
  });

  it("requires explicit consent and an uploaded image for a public portfolio item", () => {
    expect(SQL).toMatch(/NOT is_published OR \(\s*publication_consent_at IS NOT NULL\s*AND \(before_photo_path IS NOT NULL OR after_photo_path IS NOT NULL\)/);
    expect(SQL).toContain("WHERE is_published = true AND publication_consent_at IS NOT NULL");
  });

  it("prevents a portfolio entry from pointing at another workshop's private work", () => {
    expect(SQL).toContain("marketplace_binder_portfolio_work_same_binder");
    expect(SQL).toContain("w.id = NEW.source_work_id AND w.binder_id = NEW.binder_id");
    expect(SQL).toContain("BEFORE INSERT OR UPDATE OF source_work_id, binder_id");
    expect(SQL).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("adds a selective public-directory index without changing table access", () => {
    expect(SQL).toContain("marketplace_binders_public_profiles_idx");
    expect(SQL).toContain("WHERE status = 'approved' AND public_profile_status = 'published'");
    expect(SQL).not.toMatch(/\bGRANT\b/i);
    expect(SQL).not.toMatch(/\bCREATE\s+POLICY\b/i);
    expect(SQL).not.toMatch(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  });

  it("records FineBindery profile provenance while preserving workshop attribution", () => {
    expect(SQL).toContain("'MA_RELIURE_ACQUIRED', 'BINDER_REFERRED', 'FINEBINDERY_PROFILE'");
    expect(SQL).toContain("acquisition_origin IN ('BINDER_REFERRED', 'FINEBINDERY_PROFILE')");
  });
});
