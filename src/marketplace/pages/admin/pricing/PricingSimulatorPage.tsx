/**
 * Le simulateur : composer un projet et voir ce que la grille Ma Reliure en
 * fait.
 *
 * Il lit la grille en vigueur et compose avec `priceProject`, la fonction même
 * qui validera un dossier : demi-cuir à 390 €, plus un titrage à 50 €, font
 * 440 €. Aucune donnée d'atelier n'intervient, et rien n'est écrit — pour
 * changer un tarif, on retourne à la grille.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPricingGrid } from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_FAMILY_LABELS,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { priceProject } from "@/marketplace/pricing/pricing.engine";
import { formatVatRate } from "@/marketplace/pricing/vat";
import { MarginBadge, PricingTabs, ProvenanceTag, inputClass, selectClass } from "./consoleShared";
import { PRICING_GRID_QUERY_KEY, money, percent, wholeEuros } from "./consoleFormat";

type GridData = Awaited<ReturnType<typeof getPricingGrid>>;

export function PricingSimulatorPage() {
  const fetchGrid = useServerFn(getPricingGrid);
  const query = useQuery({ queryKey: PRICING_GRID_QUERY_KEY, queryFn: () => fetchGrid() });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-2xl">Simulateur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Composez un projet : le prix client vient de la grille Ma Reliure, la rémunération
            atelier de la politique de marge.
          </p>
        </div>
        <PricingTabs />
      </header>
      {query.isPending && <p className="text-sm text-muted-foreground">Chargement de la grille…</p>}
      {query.error && <p className="text-sm text-destructive">{(query.error as Error).message}</p>}
      {query.data && <Simulator data={query.data} />}
    </div>
  );
}

function Simulator({ data }: { data: GridData }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sizeClass, setSizeClass] = useState<SizeClass>("standard");
  const [complexityClass, setComplexityClass] = useState<ComplexityClass>("standard");

  const lines = useMemo(
    () =>
      Object.entries(quantities).map(([workItemKey, quantity]) => ({ workItemKey, quantity })),
    [quantities],
  );
  const result = useMemo(
    () =>
      lines.length > 0 ? priceProject({ lines, sizeClass, complexityClass }, data.grid) : null,
    [lines, sizeClass, complexityClass, data.grid],
  );

  const toggle = (key: string) =>
    setQuantities((current) => {
      const next = { ...current };
      if (key in next) delete next[key];
      else next[key] = 1;
      return next;
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>
            Format
            <select
              className={`${selectClass} mt-1 w-full`}
              value={sizeClass}
              onChange={(event) => setSizeClass(event.target.value as SizeClass)}
            >
              {Object.entries(SIZE_CLASS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Complexité
            <select
              className={`${selectClass} mt-1 w-full`}
              value={complexityClass}
              onChange={(event) => setComplexityClass(event.target.value as ComplexityClass)}
            >
              {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto rounded-md border border-border p-3">
          {data.families.map((family) => (
            <fieldset key={family.key}>
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {WORK_FAMILY_LABELS[family.key]}
              </legend>
              <ul className="mt-1 space-y-0.5">
                {data.rows
                  .filter((row) => row.family === family.key)
                  .map((row) => {
                    const selected = row.key in quantities;
                    return (
                      <li key={row.key} className="flex items-center gap-2 text-sm">
                        <input
                          id={`sim-${row.key}`}
                          type="checkbox"
                          checked={selected}
                          disabled={!row.active}
                          onChange={() => toggle(row.key)}
                        />
                        <label
                          htmlFor={`sim-${row.key}`}
                          className={`flex-1 ${row.active ? "" : "text-muted-foreground"}`}
                        >
                          {row.label}
                          {row.toValidate && (
                            <span className="ml-1 text-[11px] text-amber-800">à valider</span>
                          )}
                        </label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.study
                            ? "Sur étude"
                            : row.priceTtcCents !== null
                              ? wholeEuros(row.priceTtcCents)
                              : "—"}
                        </span>
                        {selected && (
                          <input
                            aria-label={`Quantité — ${row.label}`}
                            className={`${inputClass} w-14`}
                            type="number"
                            min={1}
                            max={999}
                            value={quantities[row.key]}
                            onChange={(event) =>
                              setQuantities({
                                ...quantities,
                                [row.key]: Math.max(
                                  1,
                                  Number.parseInt(event.target.value, 10) || 1,
                                ),
                              })
                            }
                          />
                        )}
                      </li>
                    );
                  })}
              </ul>
            </fieldset>
          ))}
        </div>
      </aside>

      <section className="min-w-0 space-y-4" aria-live="polite">
        {!result && (
          <p className="text-sm text-muted-foreground">Sélectionnez des prestations.</p>
        )}
        {result && (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Prestation</th>
                    <th className="px-2 py-2 text-right font-medium">Tarif Ma Reliure</th>
                    <th className="px-2 py-2 text-right font-medium">Qté</th>
                    <th className="px-2 py-2 text-right font-medium">Total TTC</th>
                    <th className="px-2 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((line) => (
                    <tr key={line.workItemKey} className="border-t border-border align-top">
                      <td className="px-2 py-1.5">
                        {line.label}
                        {line.problem && (
                          <span className="block text-xs text-amber-800">{line.problem}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(line.unitPriceTtcCents)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(line.priceTtcCents)}
                      </td>
                      <td className="px-2 py-1.5">
                        {line.provenance && <ProvenanceTag provenance={line.provenance} />}
                        {line.entryVersion !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            v{line.entryVersion}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.status === "priced" && result.breakdown ? (
              <dl className="grid max-w-md gap-1 rounded-md border border-border bg-card p-4 text-sm">
                <Line label="Total avant modificateurs" value={money(result.subtotalTtcCents)} />
                {result.modifiers.map((modifier) => (
                  <Line
                    key={modifier.label}
                    label={modifier.label}
                    value={`${modifier.deltaTtcCents >= 0 ? "+" : "−"}${money(Math.abs(modifier.deltaTtcCents))}`}
                  />
                ))}
                <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
                  <dt>Prix client Ma Reliure TTC</dt>
                  <dd className="tabular-nums">
                    {result.startingFrom ? "à partir de " : ""}
                    {money(result.breakdown.ttcCents)}
                  </dd>
                </div>
                <Line label="Prix HT" value={money(result.breakdown.htCents)} />
                <Line
                  label={`TVA (${formatVatRate(result.breakdown.vatRateBps)})`}
                  value={money(result.breakdown.vatCents)}
                />
                <div className="mt-2 flex justify-between border-t border-border pt-2">
                  <dt>Rémunération atelier proposée</dt>
                  <dd className="font-medium tabular-nums">
                    {money(result.payout?.payoutCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Marge Ma Reliure</dt>
                  <dd>
                    <MarginBadge margin={result.margin} />
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">
                  Politique : marge cible {percent(result.policy.targetMarginBps)} du HT, minimum{" "}
                  {wholeEuros(result.policy.minimumMarginCents)}.
                </p>
              </dl>
            ) : (
              <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">Pas de prix automatique pour ce projet.</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5">
                  {result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <ul className="max-w-2xl space-y-0.5 text-xs text-amber-900">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
