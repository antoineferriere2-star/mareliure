import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { isFineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

/**
 * L'annuaire des ateliers n'existe plus (pivot du 22 novembre 2026) : le client
 * final ne vient plus choisir un atelier sur le site, il reçoit le lien de son
 * relieur. L'ancienne adresse est redirigée définitivement vers l'accueil de la langue.
 */
export const Route = createFileRoute("/$locale/professionals")({
  beforeLoad: ({ params }) => {
    if (!isFineBinderyLocale(params.locale)) throw notFound();
    throw redirect({ to: "/$locale", params: { locale: params.locale }, statusCode: 301 });
  },
});
