import { createFileRoute } from "@tanstack/react-router";
import { ProjectSummaryAccessView } from "@/build/pages/public/ProjectSummaryAccessView";
import { isMaReliure } from "@/brand";

const TITLE = isMaReliure
  ? "Le récapitulatif de votre projet — Ma Reliure"
  : "Métré Build — Project summary";

export const Route = createFileRoute("/project-summary/$accessToken")({
  ssr: false,
  head: () => ({
    meta: [{ title: TITLE }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProjectSummaryPage,
});

function ProjectSummaryPage() {
  const { accessToken } = Route.useParams();
  return <ProjectSummaryAccessView accessToken={accessToken} />;
}
