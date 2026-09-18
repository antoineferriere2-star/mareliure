/**
 * Le point d'entrée HTTP du hook « Send Email » de Supabase Auth — voir
 * `authEmailHook.server.ts` pour la décision (marque, gabarit, lien). Ce
 * fichier ne fait que vérifier que l'appelant est bien Supabase (signature
 * Standard Webhooks) et traduire son verdict en réponse HTTP.
 *
 * Supabase considère un 200 vide comme un succès et toute autre réponse
 * comme un échec de l'envoi — ce que `requestAccessLink` (accessLink.ts)
 * traduit déjà en message pour la personne qui attend son lien. Le lien
 * `hook_send_email_uri` n'est écrit dans la configuration Supabase
 * (`configureMareliureAuth.ts`) qu'une fois cette route vérifiée en
 * production par un appel signé à la main.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import {
  handleSendEmailHook,
  parseSendEmailHookPayload,
} from "@/marketplace/auth/authEmailHook.server";
import { logOperationalError } from "@/build/services/operationalLog.server";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleAuthEmailHook(request: Request): Promise<Response> {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!secret || !supabaseUrl) {
    logOperationalError(
      "auth-email-hook.misconfigured",
      new Error("SEND_EMAIL_HOOK_SECRET or SUPABASE_URL missing"),
      {},
    );
    return json(500, { error: "Not configured" });
  }

  const raw = await request.text();
  let verified: unknown;
  try {
    const webhook = new Webhook(secret.replace(/^v1,/, ""));
    verified = webhook.verify(raw, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    });
  } catch (error) {
    if (error instanceof WebhookVerificationError) return json(401, { error: "Invalid signature" });
    throw error;
  }

  const payload = parseSendEmailHookPayload(verified);
  if (!payload) return json(400, { error: "Unexpected payload shape" });

  try {
    await handleSendEmailHook(payload, supabaseUrl);
  } catch (error) {
    logOperationalError("auth-email-hook.send-failed", error, {
      emailActionType: payload.email_data.email_action_type,
    });
    return json(500, { error: "Send failed" });
  }

  return new Response(null, { status: 200 });
}

export const Route = createFileRoute("/api/internal/marketplace/auth-email-hook")({
  server: { handlers: { POST: async ({ request }) => handleAuthEmailHook(request) } },
});
