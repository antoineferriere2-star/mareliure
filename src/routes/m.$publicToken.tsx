import { createFileRoute } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";

export const Route = createFileRoute("/m/$publicToken")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Métré Build AI — Mission runtime" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RuntimePage,
});

function RuntimePage() {
  const { publicToken } = Route.useParams();
  return <MissionRuntime publicToken={publicToken} />;
}
