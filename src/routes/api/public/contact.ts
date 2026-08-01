import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const MAX_BODY_BYTES = 12 * 1024; // 12 KB

const contactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(200).optional().default(""),
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(3000),
  consent: z.literal(true),
});

const envelopeSchema = z.object({
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

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return jsonResponse(413, { error: "Payload too large." });
        }

        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return jsonResponse(400, { error: "Invalid JSON body." });
        }

        const envelope = envelopeSchema.safeParse(json);
        if (!envelope.success) {
          return jsonResponse(400, { error: "Invalid request shape." });
        }

        const { sourcePath, website, payload } = envelope.data;
        if (website && website.trim().length > 0) {
          return jsonResponse(200, { ok: true });
        }

        const parsed = contactSchema.safeParse(payload);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          return jsonResponse(400, {
            error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid payload.",
          });
        }

        const contact = parsed.data;
        try {
          await sendTemplateEmail("public-contact", "contact@metre-pro.com", {
            idempotencyKey: crypto.randomUUID(),
            replyTo: contact.email,
            templateData: {
              ...contact,
              sourcePath,
            },
          });
        } catch (error) {
          logOperationalError("public-contact.email-send-failed", error, {
            sourcePath,
            email: contact.email,
          });
          return jsonResponse(500, { error: "Unable to send this message." });
        }

        return jsonResponse(200, { ok: true });
      },
    },
  },
});
