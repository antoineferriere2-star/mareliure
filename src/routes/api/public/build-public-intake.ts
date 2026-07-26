import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

const MAX_BODY_BYTES = 24 * 1024; // 24 KB
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_PER_TYPE = 5;

const auditSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  // Optional — no longer collected on the first screen, kept for backward
  // compatibility with historical submissions and later admin enrichment.
  lastName: z.string().trim().max(120).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  websiteUrl: z.string().trim().url().max(500),
  email: z.string().trim().email().max(255),
  role: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().max(4000).optional().default(""),
  biggestIssue: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true),
});

const betaSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  websiteUrl: z.string().trim().url().max(500),
  role: z.string().trim().min(1).max(200),
  businessType: z.string().trim().min(1).max(200),
  monthlyInquiries: z.string().trim().min(1).max(100),
  currentTools: z.string().trim().max(1000).optional().default(""),
  mainQualificationProblem: z.string().trim().min(1).max(4000),
  email: z.string().trim().email().max(255),
  consent: z.literal(true),
});

const envelopeSchema = z.object({
  type: z.enum(["audit", "private_beta"]),
  sourcePath: z.string().trim().min(1).max(500),
  website: z.string().optional(), // honeypot
  payload: z.record(z.string(), z.unknown()),
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "metre-build-ai";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export const Route = createFileRoute("/api/public/build-public-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Body size limit
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return jsonResponse(413, { error: "Payload too large." });
        }

        // 2) Parse JSON
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return jsonResponse(400, { error: "Invalid JSON body." });
        }

        // 3) Envelope validation
        const envelope = envelopeSchema.safeParse(json);
        if (!envelope.success) {
          return jsonResponse(400, { error: "Invalid request shape." });
        }
        const { type, sourcePath, website, payload } = envelope.data;

        // 4) Honeypot: silently succeed to avoid signalling to bots
        if (website && website.trim().length > 0) {
          return jsonResponse(200, { ok: true });
        }

        // 5) Payload validation per type
        const schema = type === "audit" ? auditSchema : betaSchema;
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          return jsonResponse(400, {
            error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid payload.",
          });
        }
        const cleanPayload = parsed.data;

        // 6) IP fingerprint + rate limit
        const ip = getClientIp(request);
        const ipHash = hashIp(ip);
        const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const windowStart = new Date(
          Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000,
        ).toISOString();

        const { count: recentCount, error: rateReadError } = await supabaseAdmin
          .from("build_public_request_rate")
          .select("*", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .eq("request_type", type)
          .gte("created_at", windowStart);

        if (rateReadError) {
          console.error("[build-public-intake] rate read", rateReadError);
          return jsonResponse(500, { error: "Unable to process request." });
        }

        if ((recentCount ?? 0) >= RATE_LIMIT_MAX_PER_TYPE) {
          return jsonResponse(429, {
            error: "Too many requests. Please try again later.",
          });
        }

        // 7) Insert
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("build_public_requests")
          .insert({
            request_type: type,
            source_path: sourcePath,
            payload: cleanPayload,
            consent: true,
            user_agent: userAgent,
            ip_hash: ipHash,
            status: "new",
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          console.error("[build-public-intake] insert", insertError);
          return jsonResponse(500, { error: "Unable to save request." });
        }

        // 8) Log rate row (fire-and-forget semantics but await for consistency)
        await supabaseAdmin
          .from("build_public_request_rate")
          .insert({ ip_hash: ipHash, request_type: type });

        return jsonResponse(200, { ok: true, id: inserted.id });
      },
    },
  },
});
