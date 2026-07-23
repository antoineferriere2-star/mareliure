import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/playbooks")({
  ssr: false,
  head: () => ({ meta: [{ title: "Playbooks — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Playbooks"
      description="Modèles de questions de qualification et briefs par type de projet."
    />
  ),
});
