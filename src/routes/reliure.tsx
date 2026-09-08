import { createFileRoute } from "@tanstack/react-router";
import { ReliureLanding } from "@/marketplace/pages/ReliureLanding";

export const Route = createFileRoute("/reliure")({
  head: () => ({
    meta: [
      { title: "Reliure — donnez une nouvelle vie aux livres auxquels vous tenez" },
      {
        name: "description",
        content:
          "Photographiez votre livre, décrivez votre projet et recevez les propositions de relieurs sélectionnés : réparation, restauration, demi-cuir, dorure, édition collector.",
      },
    ],
  }),
  component: ReliureLanding,
});
