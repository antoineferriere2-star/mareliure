import { createFileRoute } from "@tanstack/react-router";
import { ProjectSummaryAccessView } from "@/build/pages/public/ProjectSummaryAccessView";

export const Route = createFileRoute("/project-summary/$accessToken")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Métré Build — Project summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProjectSummaryPage,
});

function ProjectSummaryPage() {
  const { accessToken } = Route.useParams();
  return <ProjectSummaryAccessView accessToken={accessToken} />;
}
