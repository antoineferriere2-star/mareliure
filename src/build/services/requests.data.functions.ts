// Server functions for managing public requests (free audit / private beta
// forms submitted from the marketing pages). AI/Gateway imports are dynamic
// inside handlers so their server-only credentials never reach the client
// bundle — same discipline as admin.data.functions.ts /
// onboarding.data.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { admin, assertAdmin } from "./adminAuth.server";
import { fetchSitePublicHtml } from "@/build/onboarding/safeFetch.server";
import { extractSiteText } from "@/build/onboarding/extractText";
import { fail } from "./serverError";

export const REQUEST_STATUSES = ["new", "reviewing", "contacted", "closed"] as const;

export const listBuildPublicRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        type: z.enum(["audit", "private_beta"]).optional(),
        status: z.enum(REQUEST_STATUSES).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    let query = sb
      .from("build_public_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.type) query = query.eq("request_type", data.type);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) fail(500, error.message);
    return rows ?? [];
  });

export const getBuildPublicRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: row, error } = await sb
      .from("build_public_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!row) fail(404, "Not found");
    return row;
  });

export const updateBuildPublicRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(REQUEST_STATUSES) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: updated, error } = await sb
      .from("build_public_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!updated) fail(404, "Not found");
    return updated;
  });

/**
 * Admin-triggered audit of the requester's own website — never run
 * automatically at public submission time (that route is unauthenticated,
 * an automatic AI call there would be an abuse surface). Additive: writes
 * audit_result + audit_analyzed_at, never touches the original payload.
 */
export const runSiteAuditForRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();

    const { data: row, error } = await sb
      .from("build_public_requests")
      .select("id, payload")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!row) fail(404, "Not found");

    const payload = row.payload as Record<string, unknown>;
    const websiteUrl = typeof payload.websiteUrl === "string" ? payload.websiteUrl : null;
    if (!websiteUrl) fail(400, "This request has no website URL to audit.");

    let fetched: { finalUrl: string; html: string };
    try {
      fetched = await fetchSitePublicHtml(websiteUrl);
    } catch (err) {
      fail(400, err instanceof Error ? err.message : "Impossible de récupérer ce site.");
    }
    const extracted = extractSiteText(fetched.html);

    const requesterName =
      typeof payload.firstName === "string"
        ? `${payload.firstName} ${typeof payload.lastName === "string" ? payload.lastName : ""}`.trim()
        : typeof payload.name === "string"
          ? payload.name
          : "";
    const company = typeof payload.company === "string" ? payload.company : "";
    const requesterContext = [requesterName, company].filter(Boolean).join(", ");

    const { runSiteAudit } = await import("@/build/ai/siteAudit");
    const result = await runSiteAudit(extracted, requesterContext);
    if (result.status === "error" || !result.data) {
      fail(502, result.error ?? "Audit IA impossible.");
    }

    const { data: updated, error: updateError } = await sb
      .from("build_public_requests")
      .update({
        audit_result: result.data as unknown as Json,
        audit_analyzed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (updateError) fail(500, updateError.message);
    return updated;
  });
