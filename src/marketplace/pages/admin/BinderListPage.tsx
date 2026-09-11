/**
 * The relieur roster. Approval is a human act (§51): a workshop only starts
 * receiving projects once someone has looked at its portfolio and said yes.
 */
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  inviteBinderMember,
  listMarketplaceBinders,
  setBinderStatus,
} from "@/marketplace/services/marketplace.data.functions";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "À valider",
  approved: "Approuvé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export function BinderListPage() {
  const fetchBinders = useServerFn(listMarketplaceBinders);
  const setStatus = useServerFn(setBinderStatus);
  const invite = useServerFn(inviteBinderMember);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binders"] as const;

  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => fetchBinders() });
  const update = useMutation({
    mutationFn: (input: { binderId: string; status: string }) =>
      setStatus({ data: input as { binderId: string; status: "approved" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const inviteMember = useMutation({
    mutationFn: (input: { binderId: string; email: string }) => invite({ data: input }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const binders = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Relieurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {binders.filter((b) => b.status === "approved").length} approuvé(s) sur {binders.length}.
        </p>
      </header>

      {binders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun relieur enregistré.</p>
      ) : (
        <ul className="space-y-3">
          {binders.map((binder) => (
            <li
              key={binder.id}
              className="rounded-lg border border-border bg-card p-4 sm:flex sm:items-start sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {binder.workshop_name ?? binder.display_name}
                  {binder.is_demo && (
                    <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                      démonstration
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[binder.display_name, binder.city, `${binder.years_experience ?? "?"} ans`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {binder.bio && <p className="mt-2 text-sm text-muted-foreground">{binder.bio}</p>}
                {binder.skills.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {binder.skills.map(binderSkillLabel).join(", ")}
                  </p>
                )}
              </div>
              <div className="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABELS[binder.status] ?? binder.status}
                </span>
                {/* L'entrée de la session tarifaire : on ouvre la fiche d'un
                    atelier depuis la liste, en face de la personne. */}
                <Link
                  to="/marketplace/pricing/$binderId"
                  params={{ binderId: binder.id }}
                  className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Sa grille
                </Link>
                {binder.status !== "approved" ? (
                  <Button
                    size="sm"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ binderId: binder.id, status: "approved" })}
                  >
                    Approuver
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ binderId: binder.id, status: "suspended" })}
                  >
                    Suspendre
                  </Button>
                )}
              </div>
              <div className="mt-3 sm:mt-2 sm:basis-full">
                <InviteMemberForm
                  disabled={inviteMember.isPending}
                  onInvite={(inviteEmail) =>
                    inviteMember.mutate({ binderId: binder.id, email: inviteEmail })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One e-mail field per atelier row — Phase A ships the workflow, not a
 * membership management screen (§8 : « même si l'UI de gestion
 * multi-utilisateurs n'est pas encore développée »).
 */
function InviteMemberForm({
  disabled,
  onInvite,
}: {
  disabled: boolean;
  onInvite: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim());
    setSent(true);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        required
        placeholder="e-mail à inviter"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setSent(false);
        }}
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={disabled}>
        Inviter
      </Button>
      {sent && <span className="text-xs text-muted-foreground">Invitation envoyée.</span>}
    </form>
  );
}
