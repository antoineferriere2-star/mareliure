import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhookRequest } from "@/marketplace/stripe/webhookHandler.server";

export const Route = createFileRoute("/api/marketplace/stripe-webhook")({
  server: { handlers: { POST: async ({ request }) => handleStripeWebhookRequest(request) } },
});
