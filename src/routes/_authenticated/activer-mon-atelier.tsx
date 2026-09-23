import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import {
  activateMyBinderInvitation,
  createMyBinderWorkspace,
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
  const createWorkspace = useServerFn(createMyBinderWorkspace);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [city, setCity] = useState("");

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

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setLoading("new");
    setError(null);
    try {
      await createWorkspace({ data: {
        displayName, workshopName, city: city || undefined,
      } });
      await router.invalidate();
      await navigate({ to: "/atelier", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La création de l'atelier a échoué. Réessayez.");
      setLoading(null);
    }
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">Votre atelier</p>
        <h1 className="mr-title mt-4 text-mr-ink">Mon espace atelier</h1>
        <p className="mr-lead mt-6">
          {invitations && invitations.length > 0
            ? "Une invitation Ma Reliure vous attend. Activez-la pour rejoindre cet atelier."
            : "Créez votre espace de travail en quelques instants. Vous pourrez préparer vos prestations et vos devis ; Ma Reliure validera votre atelier avant de lui confier des leads."}
        </p>
        {error && <p role="alert" className="mr-small mt-6 border-l-2 border-mr-bordeaux pl-4 text-mr-bordeaux">{error}</p>}
        {!invitations && !error && <p role="status" className="mr-small mt-8">Recherche de votre invitation…</p>}
        {invitations?.length === 0 && (
          <form onSubmit={(event) => void handleCreate(event)} className="mt-10 space-y-5 border border-mr-rule-strong bg-white p-6">
            <h2 className="mr-heading text-mr-ink">Créer mon atelier</h2>
            <label className="mr-small block font-semibold text-mr-ink">
              Votre nom
              <input required minLength={2} maxLength={200} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] font-normal" />
            </label>
            <label className="mr-small block font-semibold text-mr-ink">
              Nom de votre atelier
              <input required minLength={2} maxLength={200} value={workshopName} onChange={(event) => setWorkshopName(event.target.value)}
                className="mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] font-normal" />
            </label>
            <label className="mr-small block font-semibold text-mr-ink">
              Ville <span className="font-normal">(facultatif)</span>
              <input maxLength={100} autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)}
                className="mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] font-normal" />
            </label>
            <p className="mr-small text-mr-muted">Votre atelier sera « à valider ». L'admin autorisera séparément l'accès aux leads.</p>
            <button type="submit" disabled={loading !== null}
              className="inline-flex min-h-11 items-center rounded-[2px] bg-mr-ink px-6 py-3 font-semibold text-mr-paper disabled:opacity-60">
              {loading === "new" ? "Création…" : "Créer mon espace atelier"}
            </button>
          </form>
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
