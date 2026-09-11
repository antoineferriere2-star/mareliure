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
  listBinderCommercialTerms,
  listMarketplaceBinders,
  setBinderCommercialTerm,
  setBinderStatus,
} from "@/marketplace/services/marketplace.data.functions";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { WORK_FAMILIES, type WorkFamilyKey } from "@/marketplace/pricing/catalog";
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
              <div className="mt-3 sm:mt-2 sm:basis-full">
                <CommercialTermsSection binderId={binder.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Rémunération différenciée par famille de métier (§31) — un multiplicateur
 * sur le montant de référence de Ma Reliure, jamais une seconde grille de
 * 45 tarifs. Repliée par défaut : la plupart des ateliers n'en ont besoin
 * d'aucune (le montant de référence s'applique tel quel).
 */
function CommercialTermsSection({ binderId }: { binderId: string }) {
  const [open, setOpen] = useState(false);
  const fetchTerms = useServerFn(listBinderCommercialTerms);
  const setTerm = useServerFn(setBinderCommercialTerm);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binder-terms", binderId] as const;

  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => fetchTerms({ data: { binderId } }),
    enabled: open,
  });
  const mutation = useMutation({
    mutationFn: (input: { familyKey: WorkFamilyKey; payoutMultiplierBps: number; manualPayoutRequired: boolean }) =>
      setTerm({ data: { binderId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        Conditions commerciales
      </button>
    );
  }

  const active = (data ?? []).filter((t) => !t.effective_to);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conditions commerciales
        </p>
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
      {isPending ? (
        <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>
      ) : active.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Aucune condition particulière — rémunéré au montant de référence.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {active.map((term) => (
            <li key={term.id}>
              {WORK_FAMILIES.find((f) => f.key === term.family_key)?.label ?? term.family_key} :{" "}
              {term.manual_payout_required
                ? "rémunération manuelle"
                : `${(term.payout_multiplier_bps / 100).toFixed(1)} %`}
            </li>
          ))}
        </ul>
      )}
      <CommercialTermForm
        pending={mutation.isPending}
        onSubmit={(input) => mutation.mutate(input)}
      />
    </div>
  );
}

function CommercialTermForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: {
    familyKey: WorkFamilyKey;
    payoutMultiplierBps: number;
    manualPayoutRequired: boolean;
  }) => void;
}) {
  const [family, setFamily] = useState<WorkFamilyKey>(WORK_FAMILIES[0].key);
  const [percent, setPercent] = useState("100");
  const [manual, setManual] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      familyKey: family,
      payoutMultiplierBps: Math.round(Number.parseFloat(percent.replace(",", ".")) * 100),
      manualPayoutRequired: manual,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        value={family}
        onChange={(event) => setFamily(event.target.value as WorkFamilyKey)}
      >
        {WORK_FAMILIES.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      {!manual && (
        <input
          type="number"
          step="0.1"
          min="0"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Pourcentage du montant de référence"
        />
      )}
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} />
        Manuel
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Enregistrer
      </Button>
    </form>
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
