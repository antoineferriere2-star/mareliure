import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin } from "@/build/services/adminAuth.server";
import { runHermesProspectFunnelBatch } from "@/build/services/hermesProspectFunnels.server";
import { ServerFnError } from "@/build/services/serverError";

const MAX_BODY_BYTES = 24 * 1024;

const prospectInput = z.object({
  companyName: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().min(1).max(2048),
  businessType: z.string().trim().max(80).optional().nullable(),
  vertical: z.string().trim().max(80).optional().nullable(),
  product: z.string().trim().max(80).optional().nullable(),
  campaignId: z.string().trim().max(120).optional().nullable(),
  requestId: z.string().trim().min(8).max(80).optional().nullable(),
});

const bodySchema = z.object({
  workspaceId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional(),
  prospects: z.array(prospectInput).min(1).max(10),
  retryFailed: z.boolean().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function handleHermesProspectFunnels(request: Request): Promise<Response> {
  const configuredToken = process.env.HERMES_PROSPECT_FUNNEL_TOKEN;
  if (!configuredToken) return json(404, { error: "Not found" });
  if (bearerToken(request) !== configuredToken) return json(401, { error: "Unauthorized" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Payload too large" });

  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!parsed.success) return json(400, { error: "Invalid Hermes prospect batch" });

  const userId = process.env.HERMES_PROSPECT_FUNNEL_USER_ID ?? parsed.data.userId;
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return json(503, { error: "Hermes actor is not configured" });
  }

  // Hermes is a machine caller: every outcome must come back as JSON with a
  // meaningful status, never as the HTML error page the SSR shell would render.
  try {
    const sb = await admin();
    const result = await runHermesProspectFunnelBatch(sb, {
      userId,
      workspaceId: parsed.data.workspaceId,
      prospects: parsed.data.prospects,
      retryFailed: parsed.data.retryFailed ?? false,
    });
    return json(200, result);
  } catch (err) {
    const status = err instanceof ServerFnError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Hermes prospect batch failed";
    return json(status, { error: message.slice(0, 700) });
  }
}


export const Route = createFileRoute("/api/internal/hermes/prospect-funnels")({
  server: {
    handlers: {
      POST: async ({ request }) => handleHermesProspectFunnels(request),
    },
  },
});
