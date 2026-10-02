import { createFileRoute } from "@tanstack/react-router";
import { handleRoundTripWebhookRequest } from "@/marketplace/services/roundTripWebhook.server";

// Suivi des étiquettes achetées automatiquement. Indépendant du verrou d'achat : une étiquette déjà
// achetée continue d'être suivie après fermeture. Sans clés ni secret configurés : 404.
export const Route = createFileRoute("/api/marketplace/sendcloud-webhook")({
  server: { handlers: { POST: async ({ request }) => handleRoundTripWebhookRequest(request) } },
});
