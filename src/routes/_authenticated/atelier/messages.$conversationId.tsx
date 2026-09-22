import { createFileRoute } from "@tanstack/react-router";
import { MessageThreadPage } from "@/marketplace/pages/binder/MessagesPage";

export const Route = createFileRoute("/_authenticated/atelier/messages/$conversationId")({
  component: RouteComponent,
});

function RouteComponent() { return <MessageThreadPage caseId={Route.useParams().conversationId} />; }
