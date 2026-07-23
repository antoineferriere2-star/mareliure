import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/build/missions")({
  ssr: false,
  component: () => <Outlet />,
});
