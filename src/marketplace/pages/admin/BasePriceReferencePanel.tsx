import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BASE_PRICE_CONFIDENCES,
  BASE_PRICE_PRICING_MODES,
  BASE_PRICE_STATUSES,
  matchesBasePriceFilter,
  type BasePriceConfidence,
  type BasePriceFilter,
  type BasePricePricingMode,
  type BasePriceStatus,
} from "@/marketplace/pricing/basePrices";
import { getBasePriceReference, saveBasePrice } from "@/marketplace/services/pricing.data.functions";

type ReferenceData = Awaited<ReturnType<typeof getBasePriceReference>>;
type ReferenceItem = ReferenceData["families"][number]["items"][number];

function toCents(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function draftFor(item: ReferenceItem) {
  const entry = item.entry;
  return {
    amount: entry?.default_unit_price_cents === null || !entry ? "" : String(entry.default_unit_price_cents / 100),
    unit: entry?.unit ?? "",
    pricingMode: entry?.pricing_mode ?? ("fixed" as BasePricePricingMode),
    status: entry?.status ?? ("draft" as BasePriceStatus),
    sourceNote: entry?.source_note ?? "",
    confidence: entry?.confidence ?? ("low" as BasePriceConfidence),
    needsHumanValidation: entry?.needs_human_validation ?? true,
  };
}

function BasePriceRow({ item, onSaved }: { item: ReferenceItem; onSaved: () => Promise<unknown> }) {
  const save = useServerFn(saveBasePrice);
  const [draft, setDraft] = useState(() => draftFor(item));
  const [problem, setProblem] = useState<string | null>(null);
  const amount = toCents(draft.amount);
  const isManual = draft.pricingMode === "manual_review";

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          pricingKey: item.key,
          defaultUnitPriceCents: isManual ? null : amount,
          unit: draft.unit,
          pricingMode: draft.pricingMode,
          status: draft.status,
          sourceNote: draft.sourceNote.trim() || null,
          confidence: draft.confidence,
          needsHumanValidation: draft.needsHumanValidation,
        },
      }),
    onSuccess: async () => {
      setProblem(null);
      await onSaved();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  return (
    <tr className="border-b border-border/60 align-top">
      <td className="min-w-48 py-2 pr-3">
        <p className="font-medium">{item.label}</p>
        {item.hint && <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {item.mapping.referenceOperationKeys.length > 0
            ? item.mapping.referenceOperationKeys.join(" · ")
            : "Aucun OPR direct"}
          {item.mapping.note ? ` — ${item.mapping.note}` : ""}
        </p>
      </td>
      <td className="w-28 py-2 pr-2">
        <Input
          aria-label={`Prix de ${item.label}`}
          className="h-9"
          disabled={isManual}
          inputMode="decimal"
          placeholder={isManual ? "Sur étude" : "€"}
          value={draft.amount}
          onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
        />
      </td>
      <td className="w-28 py-2 pr-2">
        <Input
          aria-label={`Unité de ${item.label}`}
          className="h-9"
          placeholder="ouvrage"
          value={draft.unit}
          onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
        />
      </td>
      <td className="w-36 py-2 pr-2">
        <select
          aria-label={`Mode tarifaire de ${item.label}`}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={draft.pricingMode}
          onChange={(event) =>
            setDraft({
              ...draft,
              pricingMode: event.target.value as BasePricePricingMode,
              amount: event.target.value === "manual_review" ? "" : draft.amount,
            })
          }
        >
          {BASE_PRICE_PRICING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode === "fixed" ? "Forfait" : mode === "unit" ? "Unité" : mode === "starting_from" ? "À partir de" : "Sur étude"}
            </option>
          ))}
        </select>
      </td>
      <td className="w-28 py-2 pr-2">
        <select
          aria-label={`Statut de ${item.label}`}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value as BasePriceStatus })}
        >
          {BASE_PRICE_STATUSES.filter((status) => status !== "retired").map((status) => (
            <option key={status} value={status}>
              {status === "published" ? "Publié" : "Brouillon"}
            </option>
          ))}
        </select>
      </td>
      <td className="w-28 py-2 pr-2">
        <select
          aria-label={`Confiance de ${item.label}`}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={draft.confidence}
          onChange={(event) => setDraft({ ...draft, confidence: event.target.value as BasePriceConfidence })}
        >
          {BASE_PRICE_CONFIDENCES.map((confidence) => (
            <option key={confidence} value={confidence}>
              {confidence === "low" ? "Faible" : confidence === "medium" ? "Moyenne" : "Élevée"}
            </option>
          ))}
        </select>
        <label className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <input
            checked={draft.needsHumanValidation}
            type="checkbox"
            onChange={(event) => setDraft({ ...draft, needsHumanValidation: event.target.checked })}
          />
          À valider
        </label>
      </td>
      <td className="min-w-40 py-2 pr-2">
        <Input
          aria-label={`Note de ${item.label}`}
          className="h-9"
          placeholder="Note interne"
          value={draft.sourceNote}
          onChange={(event) => setDraft({ ...draft, sourceNote: event.target.value })}
        />
        {item.entry && <p className="mt-1 text-xs text-muted-foreground">v{item.entry.version} · modifié le {new Date(item.entry.updated_at).toLocaleDateString("fr-FR")}</p>}
      </td>
      <td className="w-28 py-2 text-right">
        <Button disabled={saving.isPending} size="sm" onClick={() => saving.mutate()}>
          {item.entry ? "Versionner" : "Créer"}
        </Button>
        {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
      </td>
    </tr>
  );
}

const FILTERS: { value: BasePriceFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "numeric", label: "Tarifs numériques" },
  { value: "manual_review", label: "Sur étude" },
  { value: "needs_validation", label: "À valider" },
  { value: "modified", label: "Modifiés" },
];

export function BasePriceReferencePanel() {
  const fetchReference = useServerFn(getBasePriceReference);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "base-prices"] as const;
  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => fetchReference() });
  const [filter, setFilter] = useState<BasePriceFilter>("all");
  const [search, setSearch] = useState("");

  const visibleFamilies = useMemo(
    () =>
      (data?.families ?? [])
        .map((family) => ({
          ...family,
          items: family.items.filter((item) =>
            matchesBasePriceFilter(
              {
                label: item.label,
                pricingKey: item.key,
                pricingMode: item.entry?.pricing_mode ?? null,
                defaultUnitPriceCents: item.entry?.default_unit_price_cents ?? null,
                needsHumanValidation: item.entry?.needs_human_validation ?? true,
                hasEntry: item.entry !== null,
              },
              filter,
              search,
            ),
          ),
        }))
        .filter((family) => family.items.length > 0),
    [data, filter, search],
  );

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const allItems = data.families.flatMap((family) => family.items);
  const configured = allItems.filter((item) => item.entry !== null);
  const numerical = configured.filter((item) => item.entry?.default_unit_price_cents !== null);
  const manual = configured.filter((item) => item.entry?.pricing_mode === "manual_review");
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">Tarifs de base Ma Reliure</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Convention interne de départ. Elle n’est ni un prix de marché, ni un tarif professionnel recommandé, et ne limite jamais le tarif propre d’un atelier.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {configured.length} / {allItems.length} prestation(s) configurée(s) · {numerical.length} prix numérique(s) · {manual.length} sur étude · version {data.referenceVersion}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>
            {item.label}
          </Button>
        ))}
        <Input className="ml-auto max-w-xs" placeholder="Rechercher une prestation" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {visibleFamilies.map((family) => (
        <section key={family.key} className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{family.label}</h3>
          </header>
          <div className="overflow-x-auto px-4">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Prestation / OPR</th>
                  <th className="py-2 font-medium">Prix €</th>
                  <th className="py-2 font-medium">Unité</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 font-medium">Statut</th>
                  <th className="py-2 font-medium">Signal interne</th>
                  <th className="py-2 font-medium">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {family.items.map((item) => (
                  <BasePriceRow key={item.entry?.id ?? item.key} item={item} onSaved={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {visibleFamilies.length === 0 && <p className="text-sm text-muted-foreground">Aucune prestation ne correspond aux filtres.</p>}
    </section>
  );
}
