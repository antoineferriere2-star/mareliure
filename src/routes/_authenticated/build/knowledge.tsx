import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/knowledge")({
  ssr: false,
  head: () => ({ meta: [{ title: "Knowledge — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Knowledge"
      description="Base de connaissance interne (matériaux, contraintes locales, tarifs)."
    />
  ),
});
