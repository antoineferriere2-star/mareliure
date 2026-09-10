/**
 * La console de prix : cinq vues sur trois couches qui ne se mélangent pas.
 *
 * - **Catalogue** : ce que le métier sait faire, et ce qu'on en sait.
 * - **Benchmark marché** : ce que des ateliers affichent sur le web. Un repère.
 * - **Tarifs artisans** : ce que nos relieurs demandent. Une observation.
 * - **Pricebook** : ce que Ma Reliure paie et vend. Une décision.
 * - **Simulateur** : sa propre page, pour composer un projet.
 *
 * Aucune vue ne recopie un montant d'une couche vers une autre. Le Pricebook
 * affiche le benchmark et les grilles à côté de chaque prix pour qu'on décide
 * en connaissance de cause — la décision, elle, se saisit à la main.
 */
import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPricingConsole,
  publishPricebookEntry,
  retireBenchmark,
  saveBenchmark,
  saveModifier,
  updateWorkItem,
} from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_ITEMS,
  workItemLabel,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { PRICE_BASES, PRICE_BASIS_LABELS, type PriceBasis } from "@/marketplace/pricing/benchmark";
import { assessMargin } from "@/marketplace/pricing/margin";
import { describeModifier, type PricingModifier } from "@/marketplace/pricing/modifiers";
import { pricebookHistory, type PricebookEntry } from "@/marketplace/pricing/pricebook";
import { PUBLISHABLE_MINIMUM_REFERENCES } from "@/marketplace/pricing/rateCard";
import {
  PRICING_MODES,
  PRICING_MODE_LABELS,
  modeCarriesAmount,
  modeRequiresUnit,
  type PricingMode,
} from "@/marketplace/pricing/pricingModes";
import { referencesFor } from "@/marketplace/pricing/references";
import { formatVatRate, fromHt } from "@/marketplace/pricing/vat";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  EvidenceNote,
  inputClass,
  MarginBadge,
  MarketBar,
  selectClass,
  ViewSection,
} from "./consoleShared";
import { centsToInput, eurosToCents, money, percent, shortDate } from "./consoleFormat";

export const CONSOLE_VIEWS = [
  { key: "catalogue", label: "Catalogue" },
  { key: "benchmark", label: "Benchmark marché" },
  { key: "artisans", label: "Tarifs artisans" },
  { key: "pricebook", label: "Pricebook" },
] as const;

export type ConsoleView = (typeof CONSOLE_VIEWS)[number]["key"];

type ConsoleData = Awaited<ReturnType<typeof getPricingConsole>>;

const QUERY_KEY = ["marketplace", "pricing", "console"] as const;

export function PricingConsolePage({ view }: { view: ConsoleView }) {
  const fetchConsole = useServerFn(getPricingConsole);
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchConsole(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-2xl">Prix</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground">
              {data.catalogue.length} travaux · {data.benchmarks.length} relevé(s) web ·{" "}
              {data.rateCount} ligne(s) de grille, {data.binderCount} atelier(s) ·{" "}
              {data.pricebook.filter((entry) => entry.status === "published").length} prix publié(s)
              · marge cible {percent(data.policy.targetMarginBps)}, minimum{" "}
              {money(data.policy.minimumMarginCents)} · TVA{" "}
              {formatVatRate(data.policy.standardVatRateBps)}
            </p>
          )}
        </div>
        <nav aria-label="Vues de la console" className="flex flex-wrap gap-1">
          {CONSOLE_VIEWS.map((item) => (
            <Link
              key={item.key}
              to="/marketplace/pricing"
              search={{ view: item.key }}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                view === item.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/marketplace/pricing/simulator"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Simulateur →
          </Link>
        </nav>
      </header>

      {isPending && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && view === "catalogue" && <CatalogueView data={data} refresh={refresh} />}
      {data && view === "benchmark" && <BenchmarkView data={data} refresh={refresh} />}
      {data && view === "artisans" && <ArtisansView data={data} />}
      {data && view === "pricebook" && <PricebookView data={data} refresh={refresh} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

function CatalogueView({ data, refresh }: { data: ConsoleData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <ViewSection
      title="Catalogue des travaux"
      aside={
        <p className="text-xs text-muted-foreground">
          Les clés, rôles et travaux sur étude viennent du code. On annote, on retire des listes —
          on ne renomme pas.
        </p>
      }
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Travail</th>
              <th className="px-3 py-2 font-medium">Rôle</th>
              <th className="px-3 py-2 text-right font-medium">Ateliers</th>
              <th className="px-3 py-2 text-right font-medium">Sources web</th>
              <th className="px-3 py-2 text-right font-medium">Prix publiés</th>
              <th className="px-3 py-2 font-medium">Preuve (format courant)</th>
              <th className="px-3 py-2 font-medium">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.families.map((family) => (
              <Fragment key={family.key}>
                <tr className="border-t border-border bg-muted/20">
                  <td
                    colSpan={8}
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                  >
                    {family.label}
                  </td>
                </tr>
                {data.catalogue
                  .filter((item) => item.family === family.key)
                  .map((item) => (
                    <Fragment key={item.key}>
                      <tr
                        className={`border-t border-border ${item.active ? "" : "text-muted-foreground"}`}
                      >
                        <td className="px-3 py-1.5">
                          {item.label}
                          {item.hint && (
                            <span className="block text-xs text-muted-foreground">{item.hint}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {item.role === "structure" ? "Structure" : "Complément"}
                          {item.requiresStudy && (
                            <span className="ml-1 text-amber-800">· sur étude</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.maxBinderReferences || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.benchmarkSourceCount || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.publishedCount || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <EvidenceNote evidence={item.evidence} />
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {item.active ? "Actif" : "Retiré des listes"}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setEditing(editing === item.key ? null : item.key)}
                          >
                            {editing === item.key ? "Fermer" : "Annoter"}
                          </button>
                        </td>
                      </tr>
                      {editing === item.key && (
                        <tr className="border-t border-border bg-muted/10">
                          <td colSpan={8} className="px-3 py-3">
                            <WorkItemEditor
                              item={item}
                              onSaved={async () => {
                                setEditing(null);
                                await refresh();
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </ViewSection>
  );
}

function WorkItemEditor({
  item,
  onSaved,
}: {
  item: ConsoleData["catalogue"][number];
  onSaved: () => Promise<void>;
}) {
  const update = useServerFn(updateWorkItem);
  const [hint, setHint] = useState(item.hint ?? "");
  const [active, setActive] = useState(item.active);
  const saving = useMutation({
    mutationFn: () => update({ data: { key: item.key, hint: hint.trim() || null, active } }),
    onSuccess: onSaved,
  });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-[24rem] flex-1 text-xs">
        Ce que le travail recouvre
        <input
          className={`${inputClass} mt-1`}
          value={hint}
          maxLength={300}
          onChange={(e) => setHint(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Proposé dans les listes de saisie
      </label>
      <Button size="sm" disabled={saving.isPending} onClick={() => saving.mutate()}>
        Enregistrer
      </Button>
      {saving.error && (
        <p className="w-full text-xs text-destructive">{(saving.error as Error).message}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Benchmark marché
// ---------------------------------------------------------------------------

const ORDER = new Map(WORK_ITEMS.map((item, index) => [item.key, index]));

function BenchmarkView({ data, refresh }: { data: ConsoleData; refresh: () => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const retire = useServerFn(retireBenchmark);
  const retiring = useMutation({
    mutationFn: (benchmarkId: string) => retire({ data: { benchmarkId } }),
    onSuccess: refresh,
  });

  const aggregates = [...data.benchmarkAggregates].sort(
    (a, b) =>
      (ORDER.get(a.workItemKey) ?? 0) - (ORDER.get(b.workItemKey) ?? 0) ||
      (a.sizeClass ?? "").localeCompare(b.sizeClass ?? ""),
  );

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <strong>Repère web.</strong> Des prix affichés publiquement par des ateliers, relevés avec
        leur page et leur extrait. Jamais publics, jamais un prix Ma Reliure, jamais une référence
        d’atelier : ils situent le Pricebook, ils ne le remplissent pas.
      </p>

      <ViewSection
        title={`Relevés par travail (${aggregates.length})`}
        aside={
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
            {adding ? "Fermer" : "Ajouter un relevé"}
          </Button>
        }
      >
        {adding && (
          <BenchmarkForm
            onSaved={async () => {
              setAdding(false);
              await refresh();
            }}
          />
        )}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Travail</th>
                <th className="px-3 py-2 font-medium">Format</th>
                <th className="px-3 py-2 font-medium">Unité</th>
                <th className="px-3 py-2 text-right font-medium">Sources</th>
                <th className="px-3 py-2 text-right font-medium">Le plus bas</th>
                <th className="px-3 py-2 text-right font-medium">Médiane</th>
                <th className="px-3 py-2 text-right font-medium">Le plus haut</th>
                <th className="px-3 py-2 font-medium">Base</th>
                <th className="px-3 py-2 font-medium">Relevé</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Aucun relevé.
                  </td>
                </tr>
              )}
              {aggregates.map((aggregate) => {
                const id = `${aggregate.workItemKey}|${aggregate.sizeClass ?? ""}|${aggregate.unitLabel ?? ""}`;
                const rows = data.benchmarks.filter(
                  (row) =>
                    row.workItemKey === aggregate.workItemKey &&
                    row.sizeClass === aggregate.sizeClass &&
                    row.unitLabel === aggregate.unitLabel,
                );
                return (
                  <Fragment key={id}>
                    <tr
                      className="cursor-pointer border-t border-border hover:bg-muted/30"
                      onClick={() => setExpanded(expanded === id ? null : id)}
                    >
                      <td className="px-3 py-1.5">{workItemLabel(aggregate.workItemKey)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {aggregate.sizeClass
                          ? SIZE_CLASS_LABELS[aggregate.sizeClass]
                          : "Non précisé"}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {aggregate.unitLabel ?? "ouvrage"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {aggregate.sourceCount}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {money(aggregate.lowCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {money(aggregate.medianCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {money(aggregate.highCents)}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {aggregate.bases.map((basis) => PRICE_BASIS_LABELS[basis]).join(" / ")}
                        {aggregate.bases.length > 1 && (
                          <span className="ml-1 text-amber-800">· mêlées</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {shortDate(aggregate.oldestObservedAt)}
                        {aggregate.stale && <span className="ml-1 text-amber-800">· ancien</span>}
                      </td>
                    </tr>
                    {expanded === id && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={9} className="px-3 py-3">
                          {aggregate.sourceCount < PUBLISHABLE_MINIMUM_REFERENCES && (
                            <p className="mb-2 text-xs text-amber-800">
                              Moins de {PUBLISHABLE_MINIMUM_REFERENCES} sources : la médiane est
                              l’avis de {aggregate.sourceCount === 1 ? "une page" : "deux pages"},
                              pas un ordre de grandeur.
                            </p>
                          )}
                          <ul className="space-y-2">
                            {rows.map((row) => (
                              <li
                                key={row.id}
                                className="grid gap-2 text-xs sm:grid-cols-[14rem_1fr_auto]"
                              >
                                <span>
                                  <a
                                    href={row.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="font-medium underline-offset-2 hover:underline"
                                  >
                                    {row.sourceName}
                                  </a>
                                  <span className="block text-muted-foreground">
                                    {row.formatLabel ?? "format non précisé"} · relevé le{" "}
                                    {shortDate(row.observedAt)}
                                  </span>
                                </span>
                                <span>
                                  <span className="tabular-nums">
                                    {row.lowPriceCents === row.highPriceCents
                                      ? money(row.lowPriceCents)
                                      : `${money(row.lowPriceCents)} – ${money(row.highPriceCents)}`}
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    {PRICE_BASIS_LABELS[row.priceBasis]}
                                  </span>
                                  <q className="mt-0.5 block text-muted-foreground">
                                    {row.sourceExcerpt}
                                  </q>
                                  {row.notes && (
                                    <span className="block text-muted-foreground">{row.notes}</span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  className="self-start text-muted-foreground underline-offset-2 hover:underline"
                                  disabled={retiring.isPending}
                                  onClick={() => retiring.mutate(row.id)}
                                >
                                  Retirer
                                </button>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ViewSection>
    </div>
  );
}

function BenchmarkForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const save = useServerFn(saveBenchmark);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    workItemKey: WORK_ITEMS[0].key,
    sizeClass: "" as SizeClass | "",
    unitLabel: "",
    low: "",
    high: "",
    priceBasis: "NOT_STATED" as PriceBasis,
    formatLabel: "",
    sourceName: "",
    sourceUrl: "",
    sourceExcerpt: "",
    observedAt: today,
    notes: "",
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const low = eurosToCents(form.low);
  const high = eurosToCents(form.high) ?? low;
  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          workItemKey: form.workItemKey,
          sizeClass: form.sizeClass || null,
          complexityClass: null,
          lowPriceCents: low ?? 0,
          highPriceCents: high ?? 0,
          unitLabel: form.unitLabel.trim() || null,
          priceBasis: form.priceBasis,
          formatLabel: form.formatLabel.trim() || null,
          sourceName: form.sourceName,
          sourceUrl: form.sourceUrl,
          sourceExcerpt: form.sourceExcerpt,
          observedAt: form.observedAt,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: onSaved,
  });
  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-4 text-xs md:grid-cols-4">
      <label className="md:col-span-2">
        Travail
        <select
          className={`${selectClass} mt-1 w-full`}
          value={form.workItemKey}
          onChange={set("workItemKey")}
        >
          {WORK_ITEMS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Format
        <select
          className={`${selectClass} mt-1 w-full`}
          value={form.sizeClass}
          onChange={set("sizeClass")}
        >
          <option value="">Non précisé par la source</option>
          {Object.entries(SIZE_CLASS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Unité (vide = l’ouvrage)
        <input
          className={`${inputClass} mt-1`}
          placeholder="par coin"
          value={form.unitLabel}
          onChange={set("unitLabel")}
        />
      </label>
      <label>
        Prix bas (€)
        <input
          className={`${inputClass} mt-1`}
          inputMode="decimal"
          value={form.low}
          onChange={set("low")}
        />
      </label>
      <label>
        Prix haut (€, vide = prix unique)
        <input
          className={`${inputClass} mt-1`}
          inputMode="decimal"
          value={form.high}
          onChange={set("high")}
        />
      </label>
      <label>
        Base
        <select
          className={`${selectClass} mt-1 w-full`}
          value={form.priceBasis}
          onChange={set("priceBasis")}
        >
          {PRICE_BASES.map((basis) => (
            <option key={basis} value={basis}>
              {PRICE_BASIS_LABELS[basis]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Format tel qu’écrit
        <input
          className={`${inputClass} mt-1`}
          placeholder="245 x 160"
          value={form.formatLabel}
          onChange={set("formatLabel")}
        />
      </label>
      <label>
        Source
        <input
          className={`${inputClass} mt-1`}
          value={form.sourceName}
          onChange={set("sourceName")}
        />
      </label>
      <label className="md:col-span-2">
        Adresse de la page
        <input
          className={`${inputClass} mt-1`}
          type="url"
          value={form.sourceUrl}
          onChange={set("sourceUrl")}
        />
      </label>
      <label>
        Relevé le
        <input
          className={`${inputClass} mt-1`}
          type="date"
          max={today}
          value={form.observedAt}
          onChange={set("observedAt")}
        />
      </label>
      <label className="md:col-span-4">
        Extrait de la page, mot pour mot
        <textarea
          className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          maxLength={400}
          value={form.sourceExcerpt}
          onChange={set("sourceExcerpt")}
        />
      </label>
      <label className="md:col-span-3">
        Notes
        <input className={`${inputClass} mt-1`} value={form.notes} onChange={set("notes")} />
      </label>
      <div className="flex items-end">
        <Button
          size="sm"
          disabled={saving.isPending || low === null}
          onClick={() => saving.mutate()}
        >
          Enregistrer le relevé
        </Button>
      </div>
      {saving.error && (
        <p className="text-destructive md:col-span-4">{(saving.error as Error).message}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarifs artisans
// ---------------------------------------------------------------------------

function ArtisansView({ data }: { data: ConsoleData }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const covered = new Set(data.aggregates.map((aggregate) => aggregate.workItemKey));
  const uncovered = data.catalogue.filter((item) => !covered.has(item.key));

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <strong>Observation.</strong> Ce que nos relieurs disent demander. Seules les lignes
        entendues du relieur ou payées sur une commande comptent dans une médiane ; une ligne
        déclarée mais non confirmée reste visible dans sa grille, hors statistique.
      </p>

      <ViewSection title={`Ateliers (${data.binders.length})`}>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Atelier</th>
                <th className="px-3 py-2 font-medium">Ville</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 text-right font-medium">Lignes actives</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.binders.map((binder) => (
                <tr key={binder.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    {binder.name}
                    {binder.isDemo && (
                      <span className="ml-1 text-xs text-muted-foreground">· démonstration</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{binder.city ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs">{binder.status}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {binder.activeRateCount || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Link
                      to="/marketplace/pricing/$binderId"
                      params={{ binderId: binder.id }}
                      className="text-xs underline-offset-2 hover:underline"
                    >
                      Ouvrir sa grille
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ViewSection>

      <ViewSection title={`Combinaisons couvertes (${data.aggregates.length})`}>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Travail</th>
                <th className="px-3 py-2 font-medium">Format · complexité</th>
                <th className="px-3 py-2 text-right font-medium">Ateliers</th>
                <th className="px-3 py-2 text-right font-medium">Le moins cher</th>
                <th className="px-3 py-2 text-right font-medium">Médiane</th>
                <th className="px-3 py-2 text-right font-medium">Le plus cher</th>
                <th className="px-3 py-2 text-right font-medium">Quartiles</th>
                <th className="px-3 py-2 font-medium">Plus ancienne</th>
              </tr>
            </thead>
            <tbody>
              {data.aggregates.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun tarif relevé auprès d’un relieur. Le moteur refuse de chiffrer sans eux.
                  </td>
                </tr>
              )}
              {data.aggregates.map((aggregate) => {
                const id = `${aggregate.workItemKey}|${aggregate.sizeClass}|${aggregate.complexityClass}`;
                const thin = aggregate.referenceCount < PUBLISHABLE_MINIMUM_REFERENCES;
                return (
                  <Fragment key={id}>
                    <tr
                      className="cursor-pointer border-t border-border hover:bg-muted/30"
                      onClick={() => setExpanded(expanded === id ? null : id)}
                    >
                      <td className="px-3 py-1.5">{workItemLabel(aggregate.workItemKey)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {SIZE_CLASS_LABELS[aggregate.sizeClass]} ·{" "}
                        {COMPLEXITY_CLASS_LABELS[aggregate.complexityClass]}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right tabular-nums ${thin ? "text-amber-800" : ""}`}
                      >
                        {aggregate.referenceCount}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {money(aggregate.minimumCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {money(aggregate.medianCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {money(aggregate.maximumCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {aggregate.q1Cents === null
                          ? "—"
                          : `${money(aggregate.q1Cents)} – ${money(aggregate.q3Cents)}`}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {shortDate(aggregate.oldestEffectiveFrom)}
                      </td>
                    </tr>
                    {expanded === id && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={8} className="px-3 py-3">
                          <ul className="space-y-1 text-xs">
                            {aggregate.contributions.map((contribution) => (
                              <li
                                key={contribution.binderId}
                                className="flex justify-between gap-4"
                              >
                                <span>{contribution.binderName}</span>
                                <span className="tabular-nums text-muted-foreground">
                                  {money(contribution.minimumPayoutCents)} –{" "}
                                  {money(contribution.maximumPayoutCents)} · courant{" "}
                                  <strong className="text-foreground">
                                    {money(contribution.typicalPayoutCents)}
                                  </strong>{" "}
                                  · {shortDate(contribution.effectiveFrom)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Enveloppe déclarée : {money(aggregate.floorCents)} –{" "}
                            {money(aggregate.ceilingCents)}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ViewSection>

      {data.drift.length > 0 && (
        <ViewSection title="Écarts avec le Pricebook">
          <ul className="space-y-1.5 text-sm">
            {data.drift.map((item) => (
              <li key={item.entryId} className="rounded-md border border-border px-3 py-2">
                <strong>{workItemLabel(item.workItemKey)}</strong>{" "}
                <span className="text-muted-foreground">
                  terrain {money(item.observedMedianCents)} ({item.driftBps > 0 ? "+" : ""}
                  {percent(item.driftBps)}) — {item.message}
                </span>
              </li>
            ))}
          </ul>
        </ViewSection>
      )}

      <ViewSection title={`Travaux sans aucune grille (${uncovered.length})`}>
        <p className="text-sm text-muted-foreground">
          {uncovered.map((item) => item.label).join(" · ")}
        </p>
      </ViewSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricebook
// ---------------------------------------------------------------------------

type PricebookRowKey = {
  workItemKey: string;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
};

function PricebookView({ data, refresh }: { data: ConsoleData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [family, setFamily] = useState<string>("");
  const [creating, setCreating] = useState<PricebookRowKey | null>(null);

  const published = data.pricebook.filter((entry) => entry.status === "published");
  const rows = useMemo(() => {
    const keyed: (PricebookRowKey & { entry: PricebookEntry | null })[] = [];
    for (const item of data.catalogue) {
      if (family && item.family !== family) continue;
      const entries = published.filter((entry) => entry.workItemKey === item.key);
      if (
        !entries.some(
          (entry) => entry.sizeClass === "standard" && entry.complexityClass === "standard",
        )
      )
        keyed.push({
          workItemKey: item.key,
          sizeClass: "standard",
          complexityClass: "standard",
          entry: null,
        });
      for (const entry of entries)
        keyed.push({
          workItemKey: entry.workItemKey,
          sizeClass: entry.sizeClass,
          complexityClass: entry.complexityClass,
          entry,
        });
    }
    return keyed;
  }, [data, family, published]);

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <strong>Décision.</strong> Ce que Ma Reliure paie et vend. Rien ne s’y écrit tout seul : un
        prix se publie à la main, avec la raison du changement, et une version publiée ne se modifie
        pas — elle est remplacée. Publier n’est pas afficher : seule la case « public » expose un
        prix sur /tarifs.
      </p>

      <ViewSection
        title="Prix"
        aside={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              className={selectClass}
              value={family}
              onChange={(e) => setFamily(e.target.value)}
            >
              <option value="">Toutes les familles</option>
              {data.families.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <NewClassPicker onPick={setCreating} />
          </div>
        }
      >
        {creating && (
          <div className="rounded-md border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">
              Nouvelle entrée : {workItemLabel(creating.workItemKey)} ·{" "}
              {SIZE_CLASS_LABELS[creating.sizeClass]} ·{" "}
              {COMPLEXITY_CLASS_LABELS[creating.complexityClass]}
            </p>
            <EntryEditor
              data={data}
              target={creating}
              current={null}
              onDone={async () => {
                setCreating(null);
                await refresh();
              }}
              onCancel={() => setCreating(null)}
            />
          </div>
        )}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Travail</th>
                <th className="px-2 py-2 font-medium">Classe</th>
                <th className="px-2 py-2 font-medium">Mode</th>
                <th className="px-2 py-2 text-right font-medium">Rémunération</th>
                <th className="px-2 py-2 text-right font-medium">Prix HT</th>
                <th className="px-2 py-2 text-right font-medium">TVA</th>
                <th className="px-2 py-2 text-right font-medium">TTC</th>
                <th className="px-2 py-2 font-medium">Marge</th>
                <th className="px-2 py-2 font-medium">Marché (TTC)</th>
                <th className="px-2 py-2 font-medium">Preuve</th>
                <th className="px-2 py-2 font-medium">Public</th>
                <th className="px-2 py-2 font-medium">Version</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = `${row.workItemKey}|${row.sizeClass}|${row.complexityClass}`;
                const entry = row.entry;
                const references = referencesFor({
                  ...row,
                  aggregates: data.aggregates,
                  benchmarkAggregates: data.benchmarkAggregates,
                  entries: published,
                  drift: data.drift,
                });
                const margin =
                  entry &&
                  entry.customerPriceCents !== null &&
                  entry.referenceBinderPayoutCents !== null
                    ? assessMargin({
                        priceHtCents: entry.customerPriceCents,
                        payoutCents: entry.referenceBinderPayoutCents,
                        targetMarginBps: entry.targetMarginBps,
                        minimumMarginCents:
                          entry.minimumMarginCents ?? data.policy.minimumMarginCents,
                      })
                    : null;
                const vat =
                  entry?.customerPriceCents != null
                    ? fromHt(entry.customerPriceCents, entry.vatRateBps)
                    : null;
                const versions = pricebookHistory(
                  data.pricebook,
                  row.workItemKey,
                  row.sizeClass,
                  row.complexityClass,
                );
                return (
                  <Fragment key={id}>
                    <tr
                      className={`border-t border-border ${entry ? "" : "text-muted-foreground"}`}
                    >
                      <td className="px-2 py-1.5">
                        {workItemLabel(row.workItemKey)}
                        {entry && entry.includedWorkItems.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            comprend : {entry.includedWorkItems.map(workItemLabel).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {SIZE_CLASS_LABELS[row.sizeClass]} ·{" "}
                        {COMPLEXITY_CLASS_LABELS[row.complexityClass]}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {entry ? PRICING_MODE_LABELS[entry.pricingMode] : "Aucun prix"}
                        {entry?.unitLabel && (
                          <span className="text-muted-foreground"> · {entry.unitLabel}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(entry?.referenceBinderPayoutCents)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(entry?.customerPriceCents)}
                        {entry?.priceHtHighCents != null && (
                          <span className="block text-xs text-muted-foreground">
                            à {money(entry.priceHtHighCents)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {vat ? `${money(vat.vatCents)} (${formatVatRate(vat.vatRateBps)})` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        {money(entry?.customerPriceTtcCents)}
                      </td>
                      <td className="px-2 py-1.5">
                        <MarginBadge margin={margin} />
                      </td>
                      <td className="px-2 py-1.5">
                        <MarketBar
                          priceCents={entry?.customerPriceTtcCents ?? null}
                          lowCents={references.benchmark?.lowCents ?? null}
                          highCents={references.benchmark?.highCents ?? null}
                          medianCents={references.benchmark?.medianCents ?? null}
                          title={
                            references.benchmark
                              ? `Web${references.benchmarkFormatUnstated ? " (format non précisé)" : ""} : ${money(references.benchmark.lowCents)} – ${money(references.benchmark.highCents)}, médiane ${money(references.benchmark.medianCents)}, ${references.benchmark.sourceCount} source(s)`
                              : undefined
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <EvidenceNote evidence={references.evidence} />
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {entry ? (entry.publicVisible ? "Oui" : "Non") : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">
                        {entry ? `v${entry.version} · ${shortDate(entry.validatedAt)}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline"
                          onClick={() => setEditing(editing === id ? null : id)}
                        >
                          {editing === id ? "Fermer" : entry ? "Modifier" : "Fixer un prix"}
                        </button>
                        {versions.length > 0 && (
                          <button
                            type="button"
                            className="ml-3 text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => setHistory(history === id ? null : id)}
                          >
                            Historique ({versions.length})
                          </button>
                        )}
                      </td>
                    </tr>
                    {editing === id && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={13} className="px-3 py-3">
                          <EntryEditor
                            data={data}
                            target={row}
                            current={entry}
                            onDone={async () => {
                              setEditing(null);
                              await refresh();
                            }}
                            onCancel={() => setEditing(null)}
                          />
                        </td>
                      </tr>
                    )}
                    {history === id && (
                      <tr className="border-t border-border bg-muted/10">
                        <td colSpan={13} className="px-3 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-left text-muted-foreground">
                              <tr>
                                <th className="py-1 font-medium">Version</th>
                                <th className="py-1 font-medium">Statut</th>
                                <th className="py-1 font-medium">Mode</th>
                                <th className="py-1 text-right font-medium">Rémunération</th>
                                <th className="py-1 text-right font-medium">HT</th>
                                <th className="py-1 text-right font-medium">TTC</th>
                                <th className="py-1 pl-4 font-medium">Validée le</th>
                                <th className="py-1 font-medium">Raison du changement</th>
                              </tr>
                            </thead>
                            <tbody>
                              {versions.map((version) => (
                                <tr key={version.id} className="border-t border-border/60">
                                  <td className="py-1">v{version.version}</td>
                                  <td className="py-1">
                                    {version.status === "published" ? "En vigueur" : "Retirée"}
                                  </td>
                                  <td className="py-1">
                                    {PRICING_MODE_LABELS[version.pricingMode]}
                                  </td>
                                  <td className="py-1 text-right tabular-nums">
                                    {money(version.referenceBinderPayoutCents)}
                                  </td>
                                  <td className="py-1 text-right tabular-nums">
                                    {money(version.customerPriceCents)}
                                  </td>
                                  <td className="py-1 text-right tabular-nums">
                                    {money(version.customerPriceTtcCents)}
                                  </td>
                                  <td className="py-1 pl-4">{shortDate(version.validatedAt)}</td>
                                  <td className="py-1 text-muted-foreground">
                                    {version.changeReason ?? "Première version"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ViewSection>

      <ModifiersPanel modifiers={data.modifiers} refresh={refresh} />
    </div>
  );
}

function NewClassPicker({ onPick }: { onPick: (key: PricebookRowKey) => void }) {
  const [workItemKey, setWorkItemKey] = useState(WORK_ITEMS[0].key);
  const [sizeClass, setSizeClass] = useState<SizeClass>("large");
  const [complexityClass, setComplexityClass] = useState<ComplexityClass>("standard");
  return (
    <span className="flex items-center gap-1">
      <select
        className={selectClass}
        value={workItemKey}
        onChange={(e) => setWorkItemKey(e.target.value)}
      >
        {WORK_ITEMS.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={sizeClass}
        onChange={(e) => setSizeClass(e.target.value as SizeClass)}
      >
        {Object.entries(SIZE_CLASS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={complexityClass}
        onChange={(e) => setComplexityClass(e.target.value as ComplexityClass)}
      >
        {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onPick({ workItemKey, sizeClass, complexityClass })}
      >
        Autre classe
      </Button>
    </span>
  );
}

/**
 * L'édition d'une entrée. Tout ce qui se calcule s'affiche en direct — TTC,
 * marge, position sur le marché — et rien ne part sans confirmation.
 */
function EntryEditor({
  data,
  target,
  current,
  onDone,
  onCancel,
}: {
  data: ConsoleData;
  target: PricebookRowKey;
  current: PricebookEntry | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const publish = useServerFn(publishPricebookEntry);
  const item = WORK_ITEMS.find((candidate) => candidate.key === target.workItemKey)!;
  const hasHistory =
    pricebookHistory(data.pricebook, target.workItemKey, target.sizeClass, target.complexityClass)
      .length > 0;

  const [mode, setMode] = useState<PricingMode>(
    item.requiresStudy ? "MANUAL_REVIEW" : (current?.pricingMode ?? "FIXED"),
  );
  const [payout, setPayout] = useState(centsToInput(current?.referenceBinderPayoutCents));
  const [price, setPrice] = useState(centsToInput(current?.customerPriceCents));
  const [high, setHigh] = useState(centsToInput(current?.priceHtHighCents));
  const [unit, setUnit] = useState(current?.unitLabel ?? "");
  const [target_, setTarget] = useState(
    String((current?.targetMarginBps ?? data.policy.targetMarginBps) / 100),
  );
  const [minimum, setMinimum] = useState(centsToInput(current?.minimumMarginCents));
  const [included, setIncluded] = useState<string[]>(current?.includedWorkItems ?? []);
  const [publicVisible, setPublicVisible] = useState(current?.publicVisible ?? false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const payoutCents = eurosToCents(payout);
  const priceCents = eurosToCents(price);
  const carries = modeCarriesAmount(mode);
  const targetBps = Math.round(Number(target_.replace(",", ".")) * 100);
  const minimumCents = minimum.trim() === "" ? null : eurosToCents(minimum);
  const vat = carries && priceCents ? fromHt(priceCents, data.policy.standardVatRateBps) : null;
  const margin =
    carries && priceCents && payoutCents
      ? assessMargin({
          priceHtCents: priceCents,
          payoutCents,
          targetMarginBps: Number.isFinite(targetBps) ? targetBps : data.policy.targetMarginBps,
          minimumMarginCents: minimumCents ?? data.policy.minimumMarginCents,
        })
      : null;
  const references = referencesFor({
    ...target,
    aggregates: data.aggregates,
    benchmarkAggregates: data.benchmarkAggregates,
    entries: data.pricebook.filter((entry) => entry.status === "published"),
    drift: data.drift,
  });

  const publishing = useMutation({
    mutationFn: () =>
      publish({
        data: {
          ...target,
          pricingMode: mode,
          referenceBinderPayoutCents: carries ? payoutCents : null,
          customerPriceHtCents: carries ? priceCents : null,
          priceHtHighCents: mode === "RANGE" ? eurosToCents(high) : null,
          unitLabel: modeRequiresUnit(mode) ? unit.trim() || null : null,
          vatRateBps: data.policy.standardVatRateBps,
          targetMarginBps: Number.isFinite(targetBps) ? targetBps : data.policy.targetMarginBps,
          minimumMarginCents: minimumCents,
          includedWorkItems: included,
          publicVisible: carries ? publicVisible : false,
          pricingMethod: "manual",
          notes: null,
          changeReason: reason.trim() || null,
        },
      }),
    onSuccess: async () => {
      setConfirming(false);
      await onDone();
    },
  });

  const complements = WORK_ITEMS.filter(
    (candidate) => candidate.key !== item.key && !candidate.requiresStudy,
  );

  return (
    <div className="grid gap-4 text-xs lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          Mode
          <select
            className={`${selectClass} mt-1 w-full`}
            value={mode}
            disabled={item.requiresStudy}
            onChange={(e) => setMode(e.target.value as PricingMode)}
          >
            {PRICING_MODES.map((value) => (
              <option key={value} value={value}>
                {PRICING_MODE_LABELS[value]}
              </option>
            ))}
          </select>
          {item.requiresStudy && (
            <span className="mt-1 block text-amber-800">Travail sur étude : pas de prix.</span>
          )}
        </label>
        <label>
          Rémunération atelier (€)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            disabled={!carries}
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
          />
          {references.binder && (
            <span className="mt-1 block text-muted-foreground">
              ateliers : médiane {money(references.binder.medianCents)} (
              {references.binder.referenceCount})
              {references.binderApproximated ? ", format courant" : ""}
            </span>
          )}
        </label>
        <label>
          {mode === "RANGE" ? "Prix HT bas (€)" : "Prix client HT (€)"}
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            disabled={!carries}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        {mode === "RANGE" && (
          <label>
            Prix HT haut (€)
            <input
              className={`${inputClass} mt-1`}
              inputMode="decimal"
              value={high}
              onChange={(e) => setHigh(e.target.value)}
            />
          </label>
        )}
        {modeRequiresUnit(mode) && (
          <label>
            Unité
            <input
              className={`${inputClass} mt-1`}
              placeholder={mode === "PER_HOUR" ? "de l’heure" : "par fleuron"}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </label>
        )}
        <label>
          Marge cible (%)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            value={target_}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label>
          Marge minimum (€, vide = politique)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            placeholder={centsToInput(data.policy.minimumMarginCents)}
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          Travaux compris dans ce prix (ne se factureront pas en plus)
          <select
            multiple
            className="mt-1 h-24 w-full rounded-md border border-input bg-background px-1 text-xs"
            value={included}
            onChange={(e) =>
              setIncluded([...e.target.selectedOptions].map((option) => option.value))
            }
          >
            {complements.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            disabled={!carries}
            checked={publicVisible && carries}
            onChange={(e) => setPublicVisible(e.target.checked)}
          />
          Afficher ce prix TTC sur /tarifs
        </label>
        <label className="sm:col-span-4">
          Raison du changement{" "}
          {hasHistory ? "(obligatoire)" : "(facultative pour une première version)"}
          <input
            className={`${inputClass} mt-1`}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>

      <aside className="space-y-2 rounded-md border border-border bg-card p-3">
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Prix HT</dt>
            <dd className="tabular-nums">{money(priceCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">TVA</dt>
            <dd className="tabular-nums">
              {vat ? `${money(vat.vatCents)} (${formatVatRate(vat.vatRateBps)})` : "—"}
            </dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>TTC</dt>
            <dd className="tabular-nums">{money(vat?.ttcCents)}</dd>
          </div>
        </dl>
        <MarginBadge margin={margin} />
        {margin?.reasons.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
        <div>
          <p className="text-muted-foreground">Marché web (TTC)</p>
          <MarketBar
            priceCents={vat?.ttcCents ?? null}
            lowCents={references.benchmark?.lowCents ?? null}
            highCents={references.benchmark?.highCents ?? null}
            medianCents={references.benchmark?.medianCents ?? null}
          />
          {references.benchmark && (
            <p className="text-muted-foreground">
              {money(references.benchmark.lowCents)} – {money(references.benchmark.highCents)} ·{" "}
              {references.benchmark.sourceCount} source(s)
              {references.benchmarkFormatUnstated ? " · format non précisé" : ""}
            </p>
          )}
        </div>
        <EvidenceNote evidence={references.evidence} />
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => setConfirming(true)}>
            Publier…
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
        {publishing.error && (
          <p className="text-destructive">{(publishing.error as Error).message}</p>
        )}
      </aside>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={current ? `Remplacer la version ${current.version}` : "Publier ce prix"}
        description="Ce prix devient celui que Ma Reliure utilise pour composer ses offres. La version précédente reste dans l’historique."
        confirmLabel="Publier"
        pending={publishing.isPending}
        onConfirm={() => publishing.mutate()}
      >
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>{workItemLabel(target.workItemKey)}</dt>
            <dd>
              {SIZE_CLASS_LABELS[target.sizeClass]} ·{" "}
              {COMPLEXITY_CLASS_LABELS[target.complexityClass]}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Mode</dt>
            <dd>{PRICING_MODE_LABELS[mode]}</dd>
          </div>
          {carries && (
            <>
              <div className="flex justify-between">
                <dt>Rémunération atelier</dt>
                <dd className="tabular-nums">{money(payoutCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Prix HT / TTC</dt>
                <dd className="tabular-nums">
                  {money(priceCents)} / {money(vat?.ttcCents)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Marge</dt>
                <dd>
                  <MarginBadge margin={margin} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Public</dt>
                <dd>{publicVisible ? "Oui, sur /tarifs" : "Non"}</dd>
              </div>
            </>
          )}
          {reason.trim() && (
            <div>
              <dt className="text-muted-foreground">Raison</dt>
              <dd>{reason.trim()}</dd>
            </div>
          )}
        </dl>
      </ConfirmDialog>
    </div>
  );
}

function ModifiersPanel({
  modifiers,
  refresh,
}: {
  modifiers: PricingModifier[];
  refresh: () => Promise<void>;
}) {
  return (
    <ViewSection
      title="Modificateurs de format et de complexité"
      aside={
        <p className="max-w-xl text-xs text-muted-foreground">
          Utilisés seulement quand aucune entrée exacte n’existe pour la classe demandée. Semés
          vides et désactivés : aucune valeur n’est proposée par le système.
        </p>
      }
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Classe</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Valeur</th>
              <th className="px-3 py-2 font-medium">Actif</th>
              <th className="px-3 py-2 font-medium">Notes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {modifiers.map((modifier) => (
              <ModifierRow key={modifier.id} modifier={modifier} refresh={refresh} />
            ))}
          </tbody>
        </table>
      </div>
    </ViewSection>
  );
}

function ModifierRow({
  modifier,
  refresh,
}: {
  modifier: PricingModifier;
  refresh: () => Promise<void>;
}) {
  const save = useServerFn(saveModifier);
  const [kind, setKind] = useState(modifier.kind);
  const [value, setValue] = useState(
    modifier.kind === "PERCENT"
      ? modifier.percentBps === null
        ? ""
        : String(modifier.percentBps / 100)
      : centsToInput(modifier.fixedCents),
  );
  const [enabled, setEnabled] = useState(modifier.enabled);
  const [notes, setNotes] = useState(modifier.notes ?? "");
  const numeric = value.trim() === "" ? null : Number(value.replace(",", "."));
  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          axis: modifier.axis,
          classKey: modifier.classKey,
          kind,
          percentBps: kind === "PERCENT" && numeric !== null ? Math.round(numeric * 100) : null,
          fixedCents: kind === "FIXED" && numeric !== null ? Math.round(numeric * 100) : null,
          enabled,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: refresh,
  });
  const label =
    modifier.axis === "size"
      ? SIZE_CLASS_LABELS[modifier.classKey as SizeClass]
      : `Complexité ${COMPLEXITY_CLASS_LABELS[modifier.classKey as ComplexityClass].toLowerCase()}`;
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">
        {label}
        {modifier.enabled && (
          <span className="ml-2 text-xs text-muted-foreground">{describeModifier(modifier)}</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <select
          className={selectClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="PERCENT">Pourcentage</option>
          <option value="FIXED">Montant fixe (€)</option>
        </select>
      </td>
      <td className="px-3 py-1.5">
        <input
          className={`${inputClass} w-24`}
          inputMode="decimal"
          placeholder={kind === "PERCENT" ? "%" : "€"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label={`Activer ${label}`}
        />
      </td>
      <td className="px-3 py-1.5">
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={saving.isPending}
          onClick={() => saving.mutate()}
        >
          Enregistrer
        </Button>
        {saving.error && (
          <p className="mt-1 text-xs text-destructive">{(saving.error as Error).message}</p>
        )}
      </td>
    </tr>
  );
}
