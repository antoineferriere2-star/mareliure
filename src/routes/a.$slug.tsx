/**
 * Le lien personnel d'un atelier — `mareliure.fr/a/:slug` (§52-§56).
 *
 * Résout le slug côté serveur (resolveBinderReferral, sans authentification —
 * exactement ce qu'une carte de visite révèle déjà), puis renvoie vers le
 * tunnel Guided Project Intake habituel avec `?ref=<slug>`. Aucune donnée
 * d'attribution n'est décidée ici : cette page ne fait que rediriger, la
 * résolution qui compte a lieu une seule fois, côté serveur, dans
 * reconcileCaseTriage.
 */
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { resolveBinderReferral } from "@/marketplace/services/referral.public.functions";
import { BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";

export const Route = createFileRoute("/a/$slug")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Ma Reliure" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ReferralRedirectPage,
});

function ReferralRedirectPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const resolve = useServerFn(resolveBinderReferral);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolve({ data: { slug } })
      .then((result) => {
        if (cancelled) return;
        if (result.found) {
          void navigate({
            to: "/m/$publicToken",
            params: { publicToken: BOOKBINDING_PUBLIC_TOKEN },
            search: { ref: slug },
            replace: true,
          });
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, resolve, navigate]);

  if (!notFound) {
    return (
      <div className="mr-site flex min-h-screen items-center justify-center bg-mr-paper text-mr-graphite">
        <p className="mr-body">Ouverture de l'atelier…</p>
      </div>
    );
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto max-w-xl flex-1 px-5 py-20 text-center">
        <h1 className="mr-title text-mr-ink">Cet atelier est introuvable</h1>
        <p className="mr-lead mt-4">
          Ce lien ne correspond à aucun atelier partenaire actif de Ma Reliure. Vous pouvez tout de
          même présenter votre livre : nous vous mettrons en relation avec un atelier adapté.
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
