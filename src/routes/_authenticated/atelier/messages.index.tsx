import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "@/marketplace/pages/binder/MessagesPage";

export const Route = createFileRoute("/_authenticated/atelier/messages/")({ component: MessagesPage });
