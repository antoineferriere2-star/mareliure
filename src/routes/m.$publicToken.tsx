import { createFileRoute } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import { isMaReliure } from "@/brand";

/**
 * Le titre de l'onglet pendant tout le parcours.
 *
 * Il annonçait « Métré Build AI — Mission runtime » sur les deux marques. Sur
 * Ma Reliure, quelqu'un décrivait le livre auquel il tient pendant huit
 * étapes en ayant sous les yeux le nom d'un produit dont il n'a jamais
 * entendu parler, et le mot « runtime ».
 *
 * Un visiteur n'a pas à savoir quel moteur fait tourner la page.
 */
const TITLE = isMaReliure ? "Présenter mon livre — Ma Reliure" : "Project Intake — Métré Build";

export const Route = createFileRoute("/m/$publicToken")({
  ssr: false,
  head: () => ({
    meta: [{ title: TITLE }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: RuntimePage,
});

function RuntimePage() {
  const { publicToken } = Route.useParams();
  return <MissionRuntime publicToken={publicToken} />;
}
