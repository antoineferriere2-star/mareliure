import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/build/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/build/dashboard" });
  },
});
