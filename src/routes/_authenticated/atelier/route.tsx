/**
 * L'espace atelier. S'authentifier suffit à entrer dans le layout ; chaque
 * server function vérifie ensuite que ce compte a un profil d'atelier et que
 * le dossier demandé lui est ouvert. Le layout n'est jamais une permission.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { WorkshopLayout } from "@/marketplace/pages/binder/WorkshopLayout";

export const Route = createFileRoute("/_authenticated/atelier")({
  ssr: false,
  component: WorkshopSpace,
});

function WorkshopSpace() {
  return (
    <WorkshopLayout>
      <Outlet />
    </WorkshopLayout>
  );
}
