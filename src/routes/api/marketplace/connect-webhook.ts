import { createFileRoute } from "@tanstack/react-router";
import { handleWorkshopConnectWebhook } from "@/marketplace/stripe/workshopConnectWebhook.server";
export const Route = createFileRoute("/api/marketplace/connect-webhook")({
  server: { handlers: { POST: ({ request }) => handleWorkshopConnectWebhook(request) } },
});
