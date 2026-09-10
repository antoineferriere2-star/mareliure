/**
 * La grille tarifaire Ma Reliure.
 *
 * Un tableur plutôt qu'une console : une ligne par prestation, la référence
 * web à gauche, le tarif Ma Reliure à droite, modifiable sur place. Tab passe
 * au tarif suivant, Entrée enregistre, Échap annule la ligne. Enregistrer un
 * tarif le valide ; « Valider » garde une référence initiale telle quelle ;
 * « Référence web » y revient, après confirmation.
 *
 * Sous la grille, les règles de calcul : la politique de rémunération des
 * ateliers et les modificateurs de format et de complexité. Le simulateur
 * vient après, sur son propre onglet.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPricingGrid,
  saveModifier,
  savePricebookChanges,
  savePricingPolicy,
  updateWorkItem,
  validateInitialGrid,
} from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_FAMILY_LABELS,
  type ComplexityClass,
  type SizeClass,
  type WorkFamilyKey,
} from "@/marketplace/pricing/catalog";
import {
  MODIFIER_KIND_LABELS,
  MODIFIER_KINDS,
  type ModifierKind,
  type PricingModifier,
} from "@/marketplace/pricing/modifiers";
import { proposeBinderPayout, type PayoutPolicy } from "@/marketplace/pricing/payout";
import { pricebookHistory, type PricebookEntry } from "@/marketplace/pricing/pricebook";
import { priceDelta, type GridRow } from "@/marketplace/pricing/pricingGrid";
import {
  GRID_PRICING_MODES,
  PRICING_MODE_LABELS,
  type PricingMode,
} from "@/marketplace/pricing/pricingModes";
import { unitSuffix } from "@/marketplace/pricing/webBenchmark";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  PricingTabs,
  ProvenanceTag,
  ViewSection,
  inputClass,
  selectClass,
} from "./consoleShared";
import {
  PRICING_GRID_QUERY_KEY,
  bpsToInput,
  centsToInput,
  eurosToCents,
  percent,
  percentToBps,
  shortDate,
  wholeEuros,
} from "./consoleFormat";

type GridData = Awaited<ReturnType<typeof getPricingGrid>>;

const FAMILY_FILTERS: { key: WorkFamilyKey | "all"; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "repair", label: "Réparation" },
  { key: "cloth", label: "Toile" },
  { key: "leather", label: "Cuir" },
  { key: "gilding", label: "Dorure" },
  { key: "finishing", label: "Finitions" },
  { key: "protection", label: "Protection" },
  { key: "restoration", label: "Restauration" },
  { key: "creation", label: "Création" },
];

type StatusFilter = "all" | "modified" | "toValidate" | "study";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "modified", label: "Modifiés" },
  { key: "toValidate", label: "À valider" },
  { key: "study", label: "Sur étude" },
];

interface RowEdit {
  price: string;
  mode: PricingMode;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function defaultEdit(row: GridRow): RowEdit {
  return {
    price: centsToInput(row.priceTtcCents),
    mode: row.mode ?? (row.requiresStudy ? "MANUAL_REVIEW" : "FIXED"),
  };
}

function isDirty(row: GridRow, edit: RowEdit | undefined): boolean {
  if (!edit) return false;
  if (edit.mode !== (row.mode ?? defaultEdit(row).mode)) return true;
  return edit.mode !== "MANUAL_REVIEW" && eurosToCents(edit.price) !== row.priceTtcCents;
}

function editProblem(edit: RowEdit): string | null {
  if (edit.mode === "MANUAL_REVIEW") return null;
  const cents = eurosToCents(edit.price);
  return cents === null || cents <= 0 ? "Montant invalide" : null;
}

function signedEuros(cents: number): string {
  return `${cents > 0 ? "+" : "−"}${wholeEuros(Math.abs(cents))}`;
}

function signedPercent(bps: number): string {
  return `${bps > 0 ? "+" : "−"}${percent(Math.abs(bps))}`;
}

export function PricingGridPage() {
  const fetchGrid = useServerFn(getPricingGrid);
  const query = useQuery({ queryKey: PRICING_GRID_QUERY_KEY, queryFn: () => fetchGrid() });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-2xl">Grille tarifaire Ma Reliure</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Définissez les prix utilisés par le moteur pour calculer les projets.
          </p>
        </div>
        <PricingTabs />
      </header>
      {query.isPending && <p className="text-sm text-muted-foreground">Chargement de la grille…</p>}
      {query.error && <p className="text-sm text-destructive">{(query.error as Error).message}</p>}
      {query.data && <GridView data={query.data} />}
    </div>
  );
}

function GridView({ data }: { data: GridData }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: PRICING_GRID_QUERY_KEY });
  const saveFn = useServerFn(savePricebookChanges);
  const validateAllFn = useServerFn(validateInitialGrid);
  const updateItemFn = useServerFn(updateWorkItem);

  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<WorkFamilyKey | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [resetting, setResetting] = useState<GridRow | null>(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const { rows, summary } = data;
  const dirtyRows = rows.filter((row) => isDirty(row, edits[row.key]));
  const invalid = dirtyRows.some((row) => editProblem(edits[row.key]) !== null);

  useEffect(() => {
    if (dirtyRows.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyRows.length]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          changes: dirtyRows.map((row) => {
            const edit = edits[row.key];
            return {
              workItemKey: row.key,
              action: "set" as const,
              pricingMode: edit.mode,
              priceTtcCents: edit.mode === "MANUAL_REVIEW" ? null : eurosToCents(edit.price),
            };
          }),
          changeReason: reason.trim() || null,
        },
      }),
    onSuccess: async () => {
      setEdits({});
      setReason("");
      await refresh();
    },
  });

  const quick = useMutation({
    mutationFn: (change: {
      workItemKey: string;
      action: "validate" | "reset" | "visibility";
      publicVisible?: boolean;
    }) => saveFn({ data: { changes: [change], changeReason: null } }),
    onSuccess: async (_result, change) => {
      setResetting(null);
      setEdits((current) => {
        const next = { ...current };
        delete next[change.workItemKey];
        return next;
      });
      await refresh();
    },
  });

  const validateAll = useMutation({
    mutationFn: () =>
      validateAllFn({ data: { expectedCount: summary.toValidate, confirmation: "VALIDER" } }),
    onSuccess: async () => {
      setValidatingAll(false);
      setConfirmation("");
      await refresh();
    },
  });

  const toggleActive = useMutation({
    mutationFn: (row: GridRow) => updateItemFn({ data: { key: row.key, active: !row.active } }),
    onSuccess: refresh,
  });

  const visible = useMemo(() => {
    const needle = normalize(search.trim());
    return rows.filter((row) => {
      if (family !== "all" && row.family !== family) return false;
      if (needle && !normalize(row.label).includes(needle) && !row.key.includes(needle))
        return false;
      if (status === "modified") return row.modified || isDirty(row, edits[row.key]);
      if (status === "toValidate") return row.toValidate;
      if (status === "study") return row.study;
      return true;
    });
  }, [rows, search, family, status, edits]);

  const editFor = (row: GridRow) => edits[row.key] ?? defaultEdit(row);
  const setEdit = (row: GridRow, patch: Partial<RowEdit>) =>
    setEdits((current) => ({ ...current, [row.key]: { ...editFor(row), ...patch } }));

  function onPriceKey(event: KeyboardEvent<HTMLInputElement>, row: GridRow) {
    if (event.key === "Tab") {
      const inputs = [
        ...(tableRef.current?.querySelectorAll<HTMLInputElement>(
          "input[data-grid-price]:not(:disabled)",
        ) ?? []),
      ];
      const next = inputs[inputs.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)];
      if (next) {
        event.preventDefault();
        next.focus();
        next.select();
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (dirtyRows.length > 0 && !invalid && !save.isPending) save.mutate();
    } else if (event.key === "Escape") {
      setEdits((current) => {
        const next = { ...current };
        delete next[row.key];
        return next;
      });
    }
  }

  const problem = (save.error ?? quick.error ?? toggleActive.error) as Error | null;
  let lastFamily: WorkFamilyKey | null = null;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <Stat value={summary.total} label="prestations" />
          <Stat value={summary.automatic} label="avec prix automatique" />
          <Stat value={summary.study} label="sur étude" />
          <Stat value={summary.modified} label="modifiées par rapport à la référence web" />
          <Stat value={summary.toValidate} label="à valider" />
          <div className="text-muted-foreground">
            Dernière mise à jour : {shortDate(summary.lastUpdatedAt)}
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Rechercher une prestation"
            placeholder="Rechercher…"
            className={`${inputClass} w-56`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Famille">
            {FAMILY_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                pressed={family === item.key}
                onClick={() => setFamily(item.key)}
              >
                {item.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="État">
            {STATUS_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                pressed={status === item.key}
                onClick={() => setStatus(status === item.key ? "all" : item.key)}
              >
                {item.label}
              </FilterChip>
            ))}
          </div>
          <Button
            className="ml-auto"
            size="sm"
            variant="outline"
            disabled={summary.toValidate === 0 || dirtyRows.length > 0}
            title={dirtyRows.length > 0 ? "Enregistrez d'abord vos modifications." : undefined}
            onClick={() => setValidatingAll(true)}
          >
            Valider la grille initiale ({summary.toValidate})
          </Button>
        </div>

        <div
          ref={tableRef}
          className="max-h-[calc(100vh-16rem)] overflow-auto rounded-md border border-border"
        >
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card text-left text-xs text-muted-foreground shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-2 py-2 font-medium">Prestation</th>
                <th className="px-2 py-2 text-right font-medium">Réf. web min</th>
                <th className="px-2 py-2 text-right font-medium">Référence web</th>
                <th className="px-2 py-2 text-right font-medium">Réf. web max</th>
                <th className="px-2 py-2 text-right font-medium">Tarif Ma Reliure TTC</th>
                <th className="px-2 py-2 text-right font-medium">Écart</th>
                <th className="px-2 py-2 font-medium">Mode</th>
                <th className="px-2 py-2 text-center font-medium">Actif</th>
                <th className="px-2 py-2 font-medium">Dernière modification</th>
                <th className="px-2 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-muted-foreground">
                    Aucune prestation ne correspond aux filtres.
                  </td>
                </tr>
              )}
              {visible.flatMap((row) => {
                const header =
                  row.family !== lastFamily ? (
                    <tr key={`family-${row.family}`} className="bg-muted/40">
                      <th
                        colSpan={10}
                        scope="colgroup"
                        className="px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {WORK_FAMILY_LABELS[row.family]}
                      </th>
                    </tr>
                  ) : null;
                lastFamily = row.family;
                const edit = editFor(row);
                const dirty = isDirty(row, edits[row.key]);
                const editError = dirty ? editProblem(edit) : null;
                const liveCents =
                  edit.mode === "MANUAL_REVIEW" ? null : eurosToCents(edit.price);
                const delta =
                  row.benchmark?.pricingUnit === "per_hour"
                    ? null
                    : priceDelta(liveCents, row.benchmark?.webReferenceCents ?? null);
                const benchmark = row.benchmark;
                const suffix = benchmark ? unitSuffix(benchmark.pricingUnit) : "";
                const atReference =
                  row.entry?.status === "draft" &&
                  (row.requiresStudy ||
                    row.priceTtcCents === (benchmark?.webReferenceCents ?? null));
                const line = (
                  <tr
                    key={row.key}
                    className={`border-t border-border align-middle ${row.active ? "" : "text-muted-foreground"} ${dirty ? "bg-amber-50/60" : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={row.active ? "font-medium" : ""}>{row.label}</span>
                        {row.entry && <ProvenanceTag provenance={row.entry.provenance} />}
                        {!row.active && <span className="text-[11px]">désactivée</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {benchmark?.webMinCents != null ? wholeEuros(benchmark.webMinCents) : "—"}
                    </td>
                    <td
                      className="px-2 py-1.5 text-right tabular-nums"
                      title={benchmark?.sourceSummary ?? undefined}
                    >
                      {benchmark?.webReferenceCents != null
                        ? `${wholeEuros(benchmark.webReferenceCents)}${suffix}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {benchmark?.webMaxCents != null
                        ? `${wholeEuros(benchmark.webMaxCents)}${benchmark.openEndedMax ? "+" : ""}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {edit.mode === "MANUAL_REVIEW" ? (
                        <span className="text-muted-foreground">Sur étude</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <input
                            data-grid-price
                            aria-label={`Tarif Ma Reliure TTC — ${row.label}`}
                            aria-invalid={editError ? true : undefined}
                            inputMode="decimal"
                            className={`${inputClass} w-24 text-right ${dirty ? "border-amber-600" : ""} ${editError ? "border-destructive" : ""}`}
                            value={edit.price}
                            onChange={(event) => setEdit(row, { price: event.target.value })}
                            onKeyDown={(event) => onPriceKey(event, row)}
                            onFocus={(event) => event.currentTarget.select()}
                          />
                          <span className="text-muted-foreground">€</span>
                        </span>
                      )}
                      {editError && (
                        <span className="block text-[11px] text-destructive">{editError}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                      {delta && delta.cents !== 0
                        ? `${signedEuros(delta.cents)} · ${signedPercent(delta.bps)}`
                        : ""}
                    </td>
                    <td className="px-2 py-1">
                      <select
                        aria-label={`Mode — ${row.label}`}
                        className={`${selectClass} w-32`}
                        value={edit.mode}
                        disabled={row.requiresStudy}
                        onChange={(event) =>
                          setEdit(row, {
                            mode: event.target.value as PricingMode,
                            price:
                              edit.price ||
                              centsToInput(row.priceTtcCents ?? benchmark?.webReferenceCents),
                          })
                        }
                      >
                        {GRID_PRICING_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {PRICING_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Prestation active — ${row.label}`}
                        checked={row.active}
                        disabled={toggleActive.isPending}
                        onChange={() => toggleActive.mutate(row)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground">
                      {shortDate(row.lastModifiedAt)}
                      {row.entry ? ` · v${row.entry.version}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      {row.toValidate && !dirty && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={quick.isPending}
                          onClick={() => quick.mutate({ workItemKey: row.key, action: "validate" })}
                        >
                          Valider
                        </Button>
                      )}
                      {!atReference && (benchmark?.webReferenceCents != null || row.requiresStudy) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={quick.isPending || benchmark?.pricingUnit === "per_hour"}
                          onClick={() => setResetting(row)}
                        >
                          Référence web
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        aria-expanded={openHistory === row.key}
                        onClick={() => setOpenHistory(openHistory === row.key ? null : row.key)}
                      >
                        Historique
                      </Button>
                    </td>
                  </tr>
                );
                const history =
                  openHistory === row.key ? (
                    <tr key={`${row.key}-history`} className="border-t border-border bg-muted/20">
                      <td colSpan={10} className="px-4 py-3">
                        <RowHistory
                          row={row}
                          versions={pricebookHistory(data.history, row.key)}
                          pending={quick.isPending}
                          onVisibility={(publicVisible) =>
                            quick.mutate({ workItemKey: row.key, action: "visibility", publicVisible })
                          }
                        />
                      </td>
                    </tr>
                  ) : null;
                return [header, line, history].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>

        {problem && <p className="text-sm text-destructive">{problem.message}</p>}

        {dirtyRows.length > 0 && (
          <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3 shadow-sm">
            <span className="text-sm">
              {dirtyRows.length} tarif{dirtyRows.length > 1 ? "s" : ""} modifié
              {dirtyRows.length > 1 ? "s" : ""}
            </span>
            <input
              aria-label="Motif (facultatif)"
              placeholder="Motif (facultatif)"
              className={`${inputClass} w-72`}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Enregistrer valide ces tarifs (« Validé par Ma Reliure »).
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEdits({})}>
                Annuler
              </Button>
              <Button size="sm" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <RulesSection policy={data.policy} modifiers={data.modifiers} onSaved={refresh} />

      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(open) => !open && setResetting(null)}
        title="Revenir à la référence web"
        description={
          resetting
            ? resetting.requiresStudy
              ? `${resetting.label} redevient « Sur étude », en référence initiale à valider.`
              : `${resetting.label} : tarif Ma Reliure ${resetting.priceTtcCents !== null ? wholeEuros(resetting.priceTtcCents) : "sur étude"} → ${wholeEuros(resetting.benchmark?.webReferenceCents ?? 0)}. La ligne redevient une référence initiale web, à valider.`
            : ""
        }
        confirmLabel={
          resetting && !resetting.requiresStudy
            ? `Revenir à ${wholeEuros(resetting.benchmark?.webReferenceCents ?? 0)}`
            : "Revenir à la référence web"
        }
        pending={quick.isPending}
        onConfirm={() => resetting && quick.mutate({ workItemKey: resetting.key, action: "reset" })}
      >
        {quick.error && <p className="text-xs text-destructive">{(quick.error as Error).message}</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={validatingAll}
        onOpenChange={(open) => {
          setValidatingAll(open);
          if (!open) setConfirmation("");
        }}
        title="Valider la grille initiale"
        description={`${summary.toValidate} tarif${summary.toValidate > 1 ? "s" : ""} encore à la référence web deviendront des tarifs validés par Ma Reliure, utilisables pour les dossiers clients. Les tarifs déjà validés ne changent pas.`}
        confirmLabel="Valider la grille"
        pending={validateAll.isPending}
        disabled={confirmation !== "VALIDER"}
        onConfirm={() => validateAll.mutate()}
      >
        <label className="block text-sm">
          Tapez VALIDER pour confirmer
          <input
            className={`${inputClass} mt-1`}
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {validateAll.error && (
          <p className="text-xs text-destructive">{(validateAll.error as Error).message}</p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-semibold tabular-nums">{value}</span>{" "}
        <span className="text-muted-foreground">{label}</span>
      </dd>
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 rounded-md border px-2.5 text-xs transition ${pressed ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function RowHistory({
  row,
  versions,
  pending,
  onVisibility,
}: {
  row: GridRow;
  versions: PricebookEntry[];
  pending: boolean;
  onVisibility: (visible: boolean) => void;
}) {
  const entry = row.entry;
  return (
    <div className="grid gap-4 text-xs lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="font-medium">Historique · {row.label}</p>
        <ol className="mt-2 space-y-1">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center gap-2">
              <span className="w-10 tabular-nums text-muted-foreground">v{version.version}</span>
              <span className="w-24 text-muted-foreground">{shortDate(version.createdAt)}</span>
              <span className="w-20 text-right tabular-nums">
                {version.priceTtcCents !== null ? wholeEuros(version.priceTtcCents) : "Sur étude"}
              </span>
              <ProvenanceTag provenance={version.provenance} />
              <span className="text-muted-foreground">
                {version.createdBy ? "Admin" : "Initialisation"}
                {version.status === "retired" ? " · remplacée" : " · en vigueur"}
                {version.publicVisible ? " · publique" : ""}
              </span>
              {version.changeReason && <span className="italic">« {version.changeReason} »</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-2 text-muted-foreground">
        {row.benchmark?.sourceSummary && <p>Source : {row.benchmark.sourceSummary}</p>}
        {row.benchmark?.notes && <p>{row.benchmark.notes}</p>}
        {row.hint && <p>{row.hint}</p>}
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={entry?.publicVisible ?? false}
            disabled={
              pending ||
              !entry ||
              entry.status !== "published" ||
              entry.pricingMode === "MANUAL_REVIEW"
            }
            onChange={(event) => onVisibility(event.target.checked)}
          />
          Afficher ce tarif sur /tarifs
        </label>
        {entry?.status !== "published" && (
          <p>Seul un tarif validé par Ma Reliure peut être affiché publiquement.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Règles de calcul
// ---------------------------------------------------------------------------

function RulesSection({
  policy,
  modifiers,
  onSaved,
}: {
  policy: PayoutPolicy;
  modifiers: PricingModifier[];
  onSaved: () => Promise<unknown>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ViewSection title="Rémunération des ateliers">
        <PolicyEditor key={`${policy.targetMarginBps}-${policy.minimumMarginCents}`} policy={policy} onSaved={onSaved} />
      </ViewSection>
      <ViewSection title="Modificateurs de format et de complexité">
        <p className="text-xs text-muted-foreground">
          Appliqués au total du projet, après addition des prestations. Sans modificateur actif, le
          prix du format et de la complexité courants s'applique.
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Classe</th>
              <th className="py-1 font-medium">Règle</th>
              <th className="py-1 font-medium">Valeur</th>
              <th className="py-1 text-center font-medium">Actif</th>
              <th className="py-1">
                <span className="sr-only">Enregistrer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {modifiers.map((modifier) => (
              <ModifierRow
                key={`${modifier.id}-${modifier.updatedAt}`}
                modifier={modifier}
                onSaved={onSaved}
              />
            ))}
          </tbody>
        </table>
      </ViewSection>
    </div>
  );
}

function PolicyEditor({
  policy,
  onSaved,
}: {
  policy: PayoutPolicy;
  onSaved: () => Promise<unknown>;
}) {
  const saveFn = useServerFn(savePricingPolicy);
  const [target, setTarget] = useState(bpsToInput(policy.targetMarginBps));
  const [minimum, setMinimum] = useState(centsToInput(policy.minimumMarginCents));
  const targetBps = percentToBps(target);
  const minimumCents = eurosToCents(minimum);
  const valid = targetBps !== null && minimumCents !== null && targetBps >= 0 && minimumCents >= 0;
  const changed =
    targetBps !== policy.targetMarginBps || minimumCents !== policy.minimumMarginCents;
  const example = valid
    ? proposeBinderPayout(40_000, { targetMarginBps: targetBps, minimumMarginCents: minimumCents })
    : null;
  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { targetMarginBps: targetBps ?? 0, minimumMarginCents: minimumCents ?? 0 } }),
    onSuccess: onSaved,
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Les ateliers n'ont pas de grille : Ma Reliure garde sa marge sur le prix HT du projet et
        propose le reste. La marge gardée est la plus grande des deux règles.
      </p>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="text-xs">
          Marge cible (% du HT)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>
        <label className="text-xs">
          Marge minimale (€ HT)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          />
        </label>
      </div>
      {example?.payoutCents != null && (
        <p className="text-xs text-muted-foreground">
          Exemple : prestation à 400 € HT → rémunération atelier {wholeEuros(example.payoutCents)},
          marge {wholeEuros(example.retainedMarginCents ?? 0)}.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!valid || !changed || save.isPending} onClick={() => save.mutate()}>
          Enregistrer la politique
        </Button>
        {save.error && <span className="text-xs text-destructive">{(save.error as Error).message}</span>}
      </div>
    </div>
  );
}

function ModifierRow({
  modifier,
  onSaved,
}: {
  modifier: PricingModifier;
  onSaved: () => Promise<unknown>;
}) {
  const saveFn = useServerFn(saveModifier);
  const [kind, setKind] = useState<ModifierKind>(modifier.kind);
  const [value, setValue] = useState(
    modifier.kind === "PERCENT"
      ? modifier.percentBps === null
        ? ""
        : bpsToInput(modifier.percentBps)
      : centsToInput(modifier.fixedCents),
  );
  const [enabled, setEnabled] = useState(modifier.enabled);
  const label =
    modifier.axis === "size"
      ? SIZE_CLASS_LABELS[modifier.classKey as SizeClass]
      : `Complexité ${COMPLEXITY_CLASS_LABELS[modifier.classKey as ComplexityClass].toLowerCase()}`;
  const amount = kind === "PERCENT" ? percentToBps(value) : kind === "FIXED" ? eurosToCents(value) : null;
  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          axis: modifier.axis,
          classKey: modifier.classKey,
          kind,
          percentBps: kind === "PERCENT" ? amount : null,
          fixedCents: kind === "FIXED" ? amount : null,
          enabled,
          notes: modifier.notes,
        },
      }),
    onSuccess: onSaved,
  });

  return (
    <tr className="border-t border-border">
      <td className="py-1.5 pr-2">
        {label}
        {!modifier.enabled && (
          <span className="block text-[11px] text-muted-foreground">non configuré</span>
        )}
      </td>
      <td className="py-1 pr-2">
        <select
          aria-label={`Règle — ${label}`}
          className={`${selectClass} w-36`}
          value={kind}
          onChange={(event) => setKind(event.target.value as ModifierKind)}
        >
          {MODIFIER_KINDS.map((item) => (
            <option key={item} value={item}>
              {MODIFIER_KIND_LABELS[item]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1 pr-2">
        {kind === "MANUAL_REVIEW" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <input
              aria-label={`Valeur — ${label}`}
              className={`${inputClass} w-20 text-right`}
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <span className="text-muted-foreground">{kind === "PERCENT" ? "%" : "€"}</span>
          </span>
        )}
      </td>
      <td className="py-1 text-center">
        <input
          type="checkbox"
          aria-label={`Modificateur actif — ${label}`}
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
      </td>
      <td className="py-1 text-right">
        <Button size="sm" variant="outline" className="h-7" disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
        {save.error && (
          <span className="block text-[11px] text-destructive">{(save.error as Error).message}</span>
        )}
      </td>
    </tr>
  );
}
