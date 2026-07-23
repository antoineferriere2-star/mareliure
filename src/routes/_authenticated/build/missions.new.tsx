import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/missions/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nouvelle mission — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Nouvelle mission"
      description="Créer une nouvelle mission publique (playbook, questions, brief cible)."
    />
  ),
});
