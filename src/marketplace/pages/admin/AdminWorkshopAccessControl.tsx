import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CARD } from "@/marketplace/pages/binder/quotes/quoteUi";
import { setBinderStatus } from "@/marketplace/services/marketplace.data.functions";

type WorkshopStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";
type AccessStatus = "approved" | "suspended";

const STATUS_LABELS: Record<WorkshopStatus, string> = {
  draft: "Brouillon",
  pending_review: "À examiner",
  approved: "Autorisé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

function workshopStatusLabel(status: string) {
  return STATUS_LABELS[status as WorkshopStatus] ?? status;
}

export function WorkshopStatusText({ status }: { status: string }) {
  return <>{workshopStatusLabel(status)}</>;
}

export function AdminWorkshopReviewSummary({ statuses }: { statuses: string[] }) {
  const waitingCount = statuses.filter((status) => status === "pending_review").length;
  if (!waitingCount) return null;
  return (
    <p className="border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950" role="status">
      <strong>
        {waitingCount} atelier{waitingCount > 1 ? "s" : ""} en attente.
      </strong>{" "}
      Ouvrez une fiche pour examiner et autoriser son accès.
    </p>
  );
}

export function AdminWorkshopAccessControl({
  binderId,
  status,
}: {
  binderId: string;
  status: string;
}) {
  const updateStatus = useServerFn(setBinderStatus);
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<AccessStatus | null>(null);
  const update = useMutation({
    mutationFn: (nextStatus: AccessStatus) =>
      updateStatus({ data: { binderId, status: nextStatus } }),
    onSuccess: async () => {
      setConfirmation(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "workshops"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "workshop", binderId] }),
      ]);
    },
  });
  const isApproved = status === "approved";
  const nextStatus: AccessStatus = isApproved ? "suspended" : "approved";

  return (
    <section className={`${CARD} space-y-3`} aria-labelledby="workshop-access-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="workshop-access-title" className="font-serif text-lg">
            Autorisation de l'atelier
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            État actuel : {workshopStatusLabel(status)}.
          </p>
        </div>
        <Button
          type="button"
          variant={isApproved ? "outline" : "default"}
          disabled={update.isPending}
          onClick={() => setConfirmation(nextStatus)}
        >
          {isApproved ? "Suspendre l'accès" : "Autoriser l'accès"}
        </Button>
      </div>
      {confirmation && (
        <div className="border border-border bg-background p-4" aria-live="polite">
          <h3 className="font-semibold">
            {confirmation === "approved" ? "Autoriser cet atelier ?" : "Suspendre cet atelier ?"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {confirmation === "approved"
              ? "L'équipe pourra accéder à son espace métier et recevoir les dossiers qui lui sont adressés."
              : "L'espace et ses données seront conservés, mais l'équipe perdra immédiatement l'accès métier."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate(confirmation)}
            >
              {update.isPending ? "Mise à jour…" : "Confirmer"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => setConfirmation(null)}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          La mise à jour n'a pas abouti. Réessayez.
        </p>
      )}
    </section>
  );
}
