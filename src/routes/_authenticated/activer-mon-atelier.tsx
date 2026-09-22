import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  activateMyBinderInvitation,
  getMyPendingBinderInvitations,
} from "@/marketplace/services/marketplace.data.functions";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";

export const Route = createFileRoute("/_authenticated/activer-mon-atelier")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activer mon atelier — Ma Reliure" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ActivateMyWorkshop,
});

type Invitation = { id: string; workshopName: string; expiresAt: string };

function ActivateMyWorkshop() {
  const navigate = useNavigate();
  const router = useRouter();
  const getInvitations = useServerFn(getMyPendingBinderInvitations);
  const activate = useServerFn(activateMyBinderInvitation);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInvitations()
      .then((items) => {
        if (!cancelled) setInvitations(items);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de vérifier vos invitations. Réessayez dans un instant.");
      });
    return () => { cancelled = true; };
  }, [getInvitations]);

  async function handleActivate(invitationId: string) {
    setLoading(invitationId);
    setError(null);
    try {
      await activate({ data: { invitationId } });
      await router.invalidate();
      await navigate({ to: "/atelier", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'activation a échoué. Réessayez.");
      setLoading(null);
    }
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">Votre atelier</p>
        <h1 className="mr-title mt-4 text-mr-ink">Activer mon accès relieur</h1>
        <p className="mr-lead mt-6">
          Votre adresse est déjà confirmée. Une invitation Ma Reliure vous attend :
          activez-la pour entrer dans votre espace atelier.
        </p>
        {error && <p role="alert" className="mr-small mt-6 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux">{error}</p>}
        {!invitations && !error && <p role="status" className="mr-small mt-8">Recherche de votre invitation…</p>}
        {invitations?.length === 0 && (
          <div className="mt-10 border border-mr-rule-strong bg-white p-6">
            <p>Aucune invitation active n'est liée à ce compte. Demandez à Ma Reliure de vous inviter à votre atelier.</p>
            <Link to="/candidature-atelier" className="mr-link mr-small mt-4 inline-block">Présenter mon atelier</Link>
          </div>
        )}
        {invitations?.map((invitation) => (
          <div key={invitation.id} className="mt-10 border border-mr-rule-strong bg-white p-6">
            <h2 className="mr-heading text-mr-ink">{invitation.workshopName}</h2>
            <p className="mr-small mt-3 text-mr-muted">
              Invitation valable jusqu'au {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}.
            </p>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void handleActivate(invitation.id)}
              className="mt-6 inline-flex min-h-11 items-center rounded-[2px] bg-mr-ink px-6 py-3 font-semibold text-mr-paper disabled:opacity-60"
            >
              {loading === invitation.id ? "Activation…" : "Activer mon accès à cet atelier"}
            </button>
          </div>
        ))}
      </main>
      <LandingFooter />
    </div>
  );
}
