/**
 * The matching screen (§33): the Project Brief on the left, the relieurs who
 * could take it on the right, and a hard ceiling of three.
 *
 * The score orders the right-hand column and explains itself; it never ticks a
 * box. The admin decides, which is the whole point of a concierge MVP — and of
 * the CLAUDE.md rule that the system proposes and the human disposes.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  clearCaseManualReview,
  generateMarketplacePricing,
  getMarketplaceCase,
  saveMarketplacePricing,
  selectBinderOffer,
  sendCaseToBinders,
  validateMarketplacePricing,
} from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";
import { formatEuros } from "@/marketplace/pricing/money";
import { validateManagedPrice } from "@/marketplace/pricing/pricing.engine";
import { PRICING_REASON_LABELS } from "@/marketplace/pricing/pricing.rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toCents(euros: string): number {
  return Math.round(Number.parseFloat(euros.replace(",", ".")) * 100);
}

function PricingPanel({
  caseId,
  row,
  refresh,
}: {
  caseId: string;
  row: {
    manual_review_required: boolean;
    pricing_status: string;
    suggested_customer_price_cents: number | null;
    suggested_binder_payout_cents: number | null;
    customer_price_cents: number | null;
    binder_payout_cents: number | null;
    price_includes: string[];
    pricing_confidence: string | null;
    pricing_reason_codes: string[];
  };
  refresh: () => Promise<unknown>;
}) {
  const generate = useServerFn(generateMarketplacePricing);
  const save = useServerFn(saveMarketplacePricing);
  const validate = useServerFn(validateMarketplacePricing);
  const initialCustomer = row.customer_price_cents ?? row.suggested_customer_price_cents;
  const initialPayout = row.binder_payout_cents ?? row.suggested_binder_payout_cents;
  const [customer, setCustomer] = useState(initialCustomer ? String(initialCustomer / 100) : "");
  const [payout, setPayout] = useState(initialPayout ? String(initialPayout / 100) : "");
  const [includes, setIncludes] = useState(row.price_includes.join(", "));
  const customerCents = toCents(customer);
  const payoutCents = toCents(payout);
  const result = validateManagedPrice(
    Number.isFinite(customerCents) ? customerCents : 0,
    Number.isFinite(payoutCents) ? payoutCents : 0,
  );
  const payload = {
    caseId,
    customerPriceCents: customerCents,
    binderPayoutCents: payoutCents,
    priceIncludes: includes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  const generation = useMutation({
    mutationFn: () => generate({ data: { caseId } }),
    onSuccess: refresh,
  });
  const saving = useMutation({ mutationFn: () => save({ data: payload }), onSuccess: refresh });
  const validation = useMutation({
    mutationFn: () => validate({ data: payload }),
    onSuccess: refresh,
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prix Ma Reliure
        </h2>
        <span className="text-xs text-muted-foreground">
          {row.pricing_status === "validated" ? "Validé" : "À valider"}
        </span>
      </div>
      {row.pricing_confidence && (
        <p className="mt-2 text-xs text-muted-foreground">
          Suggestion {row.pricing_confidence} ·{" "}
          {row.pricing_reason_codes
            .map(
              (code) => PRICING_REASON_LABELS[code as keyof typeof PRICING_REASON_LABELS] ?? code,
            )
            .join(", ")}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="customer-price">Prix client (€)</Label>
          <Input
            id="customer-price"
            className="mt-1"
            inputMode="decimal"
            value={customer}
            disabled={row.pricing_status === "validated"}
            onChange={(event) => setCustomer(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="binder-payout">Rémunération atelier (€)</Label>
          <Input
            id="binder-payout"
            className="mt-1"
            inputMode="decimal"
            value={payout}
            disabled={row.pricing_status === "validated"}
            onChange={(event) => setPayout(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="price-includes">Ce que le prix comprend</Label>
        <Input
          id="price-includes"
          className="mt-1"
          value={includes}
          disabled={row.pricing_status === "validated"}
          onChange={(event) => setIncludes(event.target.value)}
          placeholder="Reliure, matériaux, expédition retour"
        />
      </div>
      <p className={`mt-3 text-sm ${result.valid ? "text-emerald-700" : "text-destructive"}`}>
        Marge : {formatEuros(result.marginCents)} · {(result.marginBps / 100).toFixed(1)} %
      </p>
      {!result.valid && customer !== "" && payout !== "" && (
        <p className="mt-1 text-xs text-destructive">{result.errors.join(" ")}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {row.pricing_status === "pending" && (
          <Button
            variant="outline"
            disabled={generation.isPending}
            onClick={() => generation.mutate()}
          >
            Calculer une suggestion
          </Button>
        )}
        {row.pricing_status !== "validated" && (
          <Button
            variant="outline"
            disabled={!result.valid || saving.isPending}
            onClick={() => saving.mutate()}
          >
            Enregistrer
          </Button>
        )}
        {row.pricing_status !== "validated" && (
          <Button
            disabled={!result.valid || validation.isPending || row.manual_review_required}
            onClick={() => validation.mutate()}
          >
            Valider le prix
          </Button>
        )}
      </div>
      {(generation.error || saving.error || validation.error) && (
        <p className="mt-3 text-sm text-destructive">
          {(generation.error ?? saving.error ?? (validation.error as Error)).message}
        </p>
      )}
    </section>
  );
}

export function CaseMatchingPage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMarketplaceCase);
  const send = useServerFn(sendCaseToBinders);
  const selectOffer = useServerFn(selectBinderOffer);
  const clearReview = useServerFn(clearCaseManualReview);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const queryKey = ["marketplace", "case", caseId] as const;
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const invite = useMutation({
    mutationFn: () => send({ data: { caseId, binderIds: selected } }),
    onSuccess: async () => {
      setSelected([]);
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "cases"] });
    },
    onError: (err: Error) => setProblem(err.message),
  });

  const release = useMutation({
    mutationFn: () => clearReview({ data: { caseId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const choose = useMutation({
    mutationFn: (binderId: string) => selectOffer({ data: { caseId, binderId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err: Error) => setProblem(err.message),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const remaining = data.remainingInvitations;
  const held = data.case.manual_review_required;
  const canInvite =
    !held &&
    data.case.pricing_status === "validated" &&
    data.case.status === "matching" &&
    remaining > 0 &&
    selected.length > 0;

  function toggle(id: string) {
    setProblem(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= remaining
          ? current
          : [...current, id],
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div>
        <CaseBriefPanel view={data.view} />
      </div>

      <aside className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Statut
          </h2>
          <p className="mt-2 text-lg">
            {isCaseStatus(data.case.status)
              ? CASE_STATUS_LABELS[data.case.status]
              : data.case.status}
          </p>
          {held && (
            <div className="mt-4 rounded-md border border-amber-600/30 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-medium">Revue manuelle requise</p>
              {/* Rendered from the stored codes by triageMessages, never by
                  splitting prose out of a column. */}
              {data.triageMessages.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {data.triageMessages.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={release.isPending}
                onClick={() => release.mutate()}
              >
                J'ai vérifié : préparer le prix
              </Button>
            </div>
          )}
          {data.requiredSkills.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Compétences attendues : {data.requiredSkills.map(binderSkillLabel).join(", ")}.
            </p>
          )}
        </section>

        <PricingPanel
          key={`${data.case.pricing_status}-${data.case.pricing_generated_at ?? "new"}`}
          caseId={caseId}
          row={data.case}
          refresh={() => queryClient.invalidateQueries({ queryKey })}
        />

        {data.matches.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Offres atelier
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              {data.matches.map((offer) => {
                const candidate = data.candidates.find((item) => item.id === offer.binder_id);
                return (
                  <li key={offer.binder_id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">
                        {candidate?.workshopName ?? candidate?.displayName ?? "Atelier"}
                      </span>
                      <span className="shrink-0">{offer.state}</span>
                    </div>
                    {offer.binder_payout_cents && (
                      <p className="mt-1 text-muted-foreground">
                        Rémunération : {formatEuros(offer.binder_payout_cents)}
                      </p>
                    )}
                    {offer.decline_reason_code && (
                      <p className="mt-1 text-amber-700">Refus : {offer.decline_reason_code}</p>
                    )}
                    {offer.state === "accepted" && (
                      <Button
                        className="mt-3"
                        size="sm"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate(offer.binder_id)}
                      >
                        Retenir cet atelier
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Relieurs compatibles
            </h2>
            <span className="text-xs text-muted-foreground">
              {remaining} invitation(s) restante(s)
            </span>
          </div>

          {data.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun relieur approuvé pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.candidates.map((candidate) => {
                const checked = selected.includes(candidate.id);
                return (
                  <li key={candidate.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                        checked
                          ? "border-foreground bg-muted/60"
                          : "border-border hover:border-foreground/30"
                      } ${candidate.alreadyInvited ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        disabled={
                          candidate.alreadyInvited ||
                          held ||
                          data.case.pricing_status !== "validated" ||
                          data.case.status !== "matching"
                        }
                        onChange={() => toggle(candidate.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">
                            {candidate.workshopName ?? candidate.displayName}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {candidate.score}/100
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[
                            candidate.city,
                            candidate.yearsExperience ? `${candidate.yearsExperience} ans` : null,
                            candidate.ratingCount > 0 && candidate.ratingAvg
                              ? `${candidate.ratingAvg}/5 (${candidate.ratingCount})`
                              : null,
                            `${candidate.activeLoad}/${candidate.capacitySlots} en cours`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {candidate.skills.length > 0 && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {candidate.skills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.missingSkills.length > 0 && (
                          <span className="mt-1 block text-xs text-amber-700">
                            Ne déclare pas :{" "}
                            {candidate.missingSkills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.alreadyInvited && (
                          <span className="mt-1 block text-xs">Déjà invité</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {problem && <p className="mt-4 text-sm text-destructive">{problem}</p>}

          <Button
            className="mt-5 w-full"
            disabled={!canInvite || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? "Envoi…" : "Envoyer le projet à ces relieurs"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Un dossier est envoyé à trois relieurs au maximum.
          </p>
        </section>
      </aside>
    </div>
  );
}
