import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => {
    const { admin } = Route.useRouteContext();
    return (
      <AdminStub
        title="Dashboard"
        description={`Bienvenue ${admin.email ?? admin.userId}. Vue d'ensemble de l'activité Métré Build AI.`}
      >
        Missions actives, dossiers récents, demandes publiques en attente — les widgets seront branchés ici.
      </AdminStub>
    );
  },
});
