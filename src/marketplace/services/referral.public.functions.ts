/**
 * The one marketplace server function with no `requireSupabaseAuth`.
 *
 * Resolving `/a/:slug` has to work for a signed-out, first-time visitor —
 * that is the entire point of an atelier's referral link. It hands back
 * nothing a printed business card bearing that link does not already reveal:
 * an approved workshop's id and display name. See
 * caseRepository.server.ts#resolveApprovedBinderBySlug for why an unknown
 * slug and a real-but-unapproved one resolve identically to "not found".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin } from "@/build/services/adminAuth.server";
import { resolveApprovedBinderBySlug } from "./caseRepository.server";

export const resolveBinderReferral = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(1).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const sb = await admin();
    const binder = await resolveApprovedBinderBySlug(sb, data.slug);
    return binder ? { found: true as const, ...binder } : { found: false as const };
  });
