import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/dossiers")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dossiers — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Dossiers"
      description="Briefs générés par les visiteurs publics via /m/:publicToken."
    />
  ),
});
