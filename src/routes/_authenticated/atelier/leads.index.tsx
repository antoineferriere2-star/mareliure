import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/marketplace/pages/binder/LeadsPage";

export const Route = createFileRoute("/_authenticated/atelier/leads/")({ component: LeadsPage });
