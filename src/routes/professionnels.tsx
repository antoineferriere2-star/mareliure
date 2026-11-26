import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ancien annuaire : redirigé définitivement vers l'accueil français (pivot du 22 novembre 2026). */
export const Route = createFileRoute("/professionnels")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: "fr" }, statusCode: 301 });
  },
});
