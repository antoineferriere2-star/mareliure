import { createFileRoute } from "@tanstack/react-router";
import { AdminStub } from "@/build/pages/admin/AdminStub";

export const Route = createFileRoute("/_authenticated/build/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "Onboarding — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: () => (
    <AdminStub
      title="Onboarding"
      description="Assistant de mise en place initiale du compte Métré Build AI."
    />
  ),
});
