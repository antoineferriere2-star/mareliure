import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Settings"
      description="Réglages du compte, membres admin, configuration de la marque."
    />
  ),
});
