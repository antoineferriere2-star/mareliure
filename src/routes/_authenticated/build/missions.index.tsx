import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/missions/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Missions — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Missions"
      description="Liste des missions publiées et leurs tokens publics /m/:publicToken."
    />
  ),
});
