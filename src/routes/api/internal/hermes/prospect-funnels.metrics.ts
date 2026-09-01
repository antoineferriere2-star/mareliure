/**
 * GET /api/internal/hermes/prospect-funnels/metrics — read-only gateway.
 *
 * Deliberately separate from the creation endpoint and from its token: reading
 * attendance figures is not the same authority as publishing a Project Intake,
 * so `HERMES_ADMIN_READ_TOKEN` is its own secret and this handler performs no
 * write of any kind. Server-side only, no browser automation, and scoped to the
 * internal sales workspaces by `readHermesFunnelMetrics`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { admin } from "@/build/services/adminAuth.server";
import { readHermesFunnelMetrics } from "@/build/services/hermesMetrics.server";
import { ServerFnError } from "@/build/services/serverError";
import { PROSPECT_STATUSES } from "@/build/workspaces/internalSales";

const querySchema = z.object({
  campaignId: z.string().trim().min(1).max(120).optional(),
  status: z.enum(PROSPECT_STATUSES).optional(),
  since: z.string().trim().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function handleHermesProspectFunnelMetrics(request: Request): Promise<Response> {
  const configuredToken = process.env.HERMES_ADMIN_READ_TOKEN;
  if (!configuredToken) return json(404, { error: "Not found" });
  if (bearerToken(request) !== configuredToken) return json(401, { error: "Unauthorized" });

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return json(400, { error: "Invalid query" });

  // Hermès is a machine caller: every outcome comes back as JSON, never as the
  // HTML error page the SSR shell would render.
  try {
    const sb = await admin();
    const result = await readHermesFunnelMetrics(sb, parsed.data);
    return json(200, result);
  } catch (err) {
    const status = err instanceof ServerFnError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Hermes metrics read failed";
    return json(status, { error: message.slice(0, 700) });
  }
}

export const Route = createFileRoute("/api/internal/hermes/prospect-funnels/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => handleHermesProspectFunnelMetrics(request),
    },
  },
});
