/**
 * Le simulateur : composer un projet et voir ce que le Pricebook en fait.
 *
 * Il utilise exactement la composition qui validera un dossier. À côté de
 * chaque ligne, ce que disent les ateliers et le web — pour qu'un trou du
 * Pricebook se comble ici même, en connaissance de cause : on saisit la
 * rémunération et le prix, on confirme, et l'entrée est publiée.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  publishPricebookEntry,
  simulatePricing,
} from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_FAMILIES,
  WORK_ITEMS,
  workItem,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import type { ComposedLine } from "@/marketplace/pricing/composition";
import { assessMargin } from "@/marketplace/pricing/margin";
import { PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import { PRICING_MODE_LABELS } from "@/marketplace/pricing/pricingModes";
import { formatVatRate } from "@/marketplace/pricing/vat";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, EvidenceNote, inputClass, MarginBadge, selectClass } from "./consoleShared";
import { centsToInput, eurosToCents, money } from "./consoleFormat";

type Simulation = Awaited<ReturnType<typeof simulatePricing>>;

export function PricingSimulatorPage() {
  const simulate = useServerFn(simulatePricing);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sizeClass, setSizeClass] = useState<SizeClass>("standard");
  const [complexityClass, setComplexityClass] = useState<ComplexityClass>("standard");

  const lines = Object.entries(quantities).map(([workItemKey, quantity]) => ({
    workItemKey,
    quantity,
  }));
  const run = useMutation({
    mutationFn: () => simulate({ data: { lines, sizeClass, complexityClass } }),
  });
  const result = run.data;

  const toggle = (key: string) =>
    setQuantities((current) => {
      const next = { ...current };
      if (key in next) delete next[key];
      else next[key] = 1;
      return next;
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-2xl">Simulateur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une structure, des compléments, un format : le prix que le Pricebook compose, et ce que
            disent les ateliers et le web à côté.
          </p>
        </div>
        <Link
          to="/marketplace/pricing"
          search={{ view: "pricebook" }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pricebook
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label>
              Format
              <select
                className={`${selectClass} mt-1 w-full`}
                value={sizeClass}
                onChange={(e) => setSizeClass(e.target.value as SizeClass)}
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
                onChange={(e) => setComplexityClass(e.target.value as ComplexityClass)}
              >
                {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="max-h-[36rem] space-y-3 overflow-y-auto rounded-md border border-border p-3">
            {WORK_FAMILIES.map((family) => (
              <fieldset key={family.key}>
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {family.label}
                </legend>
                <ul className="mt-1 space-y-0.5">
                  {WORK_ITEMS.filter((item) => item.family === family.key).map((item) => {
                    const selected = item.key in quantities;
                    return (
                      <li key={item.key} className="flex items-center gap-2 text-sm">
                        <input
                          id={`sim-${item.key}`}
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggle(item.key)}
                        />
                        <label htmlFor={`sim-${item.key}`} className="flex-1">
                          {item.label}
                          {item.role === "structure" && (
                            <span className="ml-1 text-xs text-muted-foreground">structure</span>
                          )}
                          {item.requiresStudy && (
                            <span className="ml-1 text-xs text-amber-800">sur étude</span>
                          )}
                        </label>
                        {selected && (
                          <input
                            aria-label={`Quantité — ${item.label}`}
                            className={`${inputClass} w-14`}
                            type="number"
                            min={1}
                            max={999}
                            value={quantities[item.key]}
                            onChange={(e) =>
                              setQuantities({
                                ...quantities,
                                [item.key]: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
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
          <div className="flex gap-2">
            <Button disabled={lines.length === 0 || run.isPending} onClick={() => run.mutate()}>
              Calculer
            </Button>
            {lines.length > 0 && (
              <Button variant="ghost" onClick={() => setQuantities({})}>
                Vider
              </Button>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {run.error && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
          {!result && (
            <p className="text-sm text-muted-foreground">
              Sélectionnez des travaux, puis calculez.
            </p>
          )}
          {result && (
            <SimulationResult
              result={result}
              sizeClass={sizeClass}
              complexityClass={complexityClass}
              onPublished={() => run.mutate()}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function SimulationResult({
  result,
  sizeClass,
  complexityClass,
  onPublished,
}: {
  result: Simulation;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  onPublished: () => void;
}) {
  const { composition, references } = result;
  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">Travail</th>
              <th className="px-2 py-2 text-right font-medium">Qté</th>
              <th className="px-2 py-2 font-medium">Pricebook</th>
              <th className="px-2 py-2 text-right font-medium">Rémun.</th>
              <th className="px-2 py-2 text-right font-medium">Prix HT</th>
              <th className="px-2 py-2 font-medium">Ateliers</th>
              <th className="px-2 py-2 font-medium">Web</th>
              <th className="px-2 py-2 font-medium">Preuve</th>
              <th className="px-2 py-2 font-medium">Saisir au Pricebook</th>
            </tr>
          </thead>
          <tbody>
            {composition.lines.map((line) => (
              <SimulationLine
                key={line.workItemKey}
                line={line}
                references={references[line.workItemKey]}
                sizeClass={sizeClass}
                complexityClass={complexityClass}
                onPublished={onPublished}
              />
            ))}
          </tbody>
        </table>
      </div>

      {composition.status === "priced" && composition.breakdown ? (
        <dl className="grid max-w-md gap-1 rounded-md border border-border bg-card p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Rémunération atelier</dt>
            <dd className="tabular-nums">{money(composition.payoutCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Prix HT</dt>
            <dd className="tabular-nums">
              {money(composition.priceHtCents)}
              {composition.priceHtHighCents !== null && ` – ${money(composition.priceHtHighCents)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              TVA ({formatVatRate(composition.breakdown.vatRateBps)})
            </dt>
            <dd className="tabular-nums">{money(composition.breakdown.vatCents)}</dd>
          </div>
          <div className="flex justify-between text-base font-medium">
            <dt>Prix TTC</dt>
            <dd className="tabular-nums">
              {composition.startingFrom ? "à partir de " : ""}
              {money(composition.breakdown.ttcCents)}
            </dd>
          </div>
          <div className="flex justify-between pt-1">
            <dt className="text-muted-foreground">Marge</dt>
            <dd>
              <MarginBadge margin={composition.margin} />
            </dd>
          </div>
          {composition.margin?.reasons.map((reason) => (
            <p key={reason} className="text-xs text-muted-foreground">
              {reason}
            </p>
          ))}
        </dl>
      ) : (
        <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">
            Pas de prix : le Pricebook ne chiffre pas ce projet en entier.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {composition.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Un total partiel aurait l’air complet : on ne l’affiche pas.
          </p>
        </div>
      )}
    </>
  );
}

function SimulationLine({
  line,
  references,
  sizeClass,
  complexityClass,
  onPublished,
}: {
  line: ComposedLine;
  references: Simulation["references"][string] | undefined;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  onPublished: () => void;
}) {
  const publish = useServerFn(publishPricebookEntry);
  const exact = references?.entry ?? null;
  const [payout, setPayout] = useState(centsToInput(exact?.referenceBinderPayoutCents));
  const [price, setPrice] = useState(centsToInput(exact?.customerPriceCents));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const study = workItem(line.workItemKey)?.requiresStudy === true;
  const payoutCents = eurosToCents(payout);
  const priceCents = eurosToCents(price);
  const margin =
    payoutCents && priceCents
      ? assessMargin({
          priceHtCents: priceCents,
          payoutCents,
          targetMarginBps: PRICING_POLICY.targetMarginBps,
          minimumMarginCents: PRICING_POLICY.minimumMarginCents,
        })
      : null;

  const publishing = useMutation({
    mutationFn: () =>
      publish({
        data: {
          workItemKey: line.workItemKey,
          sizeClass,
          complexityClass,
          pricingMode:
            exact?.pricingMode && exact.pricingMode !== "MANUAL_REVIEW"
              ? exact.pricingMode
              : "FIXED",
          referenceBinderPayoutCents: payoutCents,
          customerPriceHtCents: priceCents,
          priceHtHighCents: exact?.pricingMode === "RANGE" ? exact.priceHtHighCents : null,
          unitLabel: exact?.unitLabel ?? null,
          includedWorkItems: exact?.includedWorkItems ?? [],
          publicVisible: exact?.publicVisible ?? false,
          changeReason: reason.trim() || null,
        },
      }),
    onSuccess: () => {
      setConfirming(false);
      onPublished();
    },
  });

  return (
    <tr className="border-t border-border align-top">
      <td className="px-2 py-1.5">
        {line.label}
        {line.includedIn && (
          <span className="block text-xs text-muted-foreground">
            compris dans {workItem(line.includedIn)?.label}
          </span>
        )}
        {line.modifiers.length > 0 && (
          <span className="block text-xs text-muted-foreground">{line.modifiers.join(" · ")}</span>
        )}
        {line.problem && <span className="block text-xs text-amber-800">{line.problem}</span>}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{line.quantity}</td>
      <td className="px-2 py-1.5 text-xs">
        {line.entryVersion !== null ? (
          <>
            v{line.entryVersion} · {line.mode ? PRICING_MODE_LABELS[line.mode] : ""}
            {line.entrySizeClass !== sizeClass || line.entryComplexityClass !== complexityClass ? (
              <span className="block text-muted-foreground">
                entrée {line.entrySizeClass} · {line.entryComplexityClass}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{money(line.payoutCents)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{money(line.priceHtCents)}</td>
      <td className="px-2 py-1.5 text-xs">
        {references?.binder ? (
          <>
            {money(references.binder.medianCents)}{" "}
            <span className="text-muted-foreground">
              ({references.binder.referenceCount}
              {references.binderApproximated ? ", courant" : ""})
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-xs">
        {references?.benchmark ? (
          <>
            {money(references.benchmark.lowCents)} – {money(references.benchmark.highCents)}{" "}
            <span className="text-muted-foreground">({references.benchmark.sourceCount})</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {references && <EvidenceNote evidence={references.evidence} />}
      </td>
      <td className="px-2 py-1.5">
        {study ? (
          <span className="text-xs text-muted-foreground">Sur étude</span>
        ) : (
          <div className="flex items-center gap-1">
            <input
              aria-label={`Rémunération — ${line.label}`}
              className={`${inputClass} w-20`}
              placeholder="rémun. €"
              inputMode="decimal"
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
            />
            <input
              aria-label={`Prix HT — ${line.label}`}
              className={`${inputClass} w-20`}
              placeholder="HT €"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!payoutCents || !priceCents}
              onClick={() => setConfirming(true)}
            >
              Enregistrer…
            </Button>
          </div>
        )}
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Enregistrer dans le Pricebook"
          description={`${line.label} · ${SIZE_CLASS_LABELS[sizeClass]} · ${COMPLEXITY_CLASS_LABELS[complexityClass]}. ${exact ? `Remplace la version ${exact.version}.` : "Première version de ce prix."}`}
          confirmLabel="Publier"
          pending={publishing.isPending}
          disabled={Boolean(exact) && reason.trim() === ""}
          onConfirm={() => publishing.mutate()}
        >
          <div className="space-y-2 text-sm">
            <p className="tabular-nums">
              Rémunération {money(payoutCents)} · prix HT {money(priceCents)}
            </p>
            <MarginBadge margin={margin} />
            <label className="block text-xs">
              Raison du changement {exact ? "(obligatoire)" : "(facultative)"}
              <input
                className={`${inputClass} mt-1`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {publishing.error && (
              <p className="text-xs text-destructive">{(publishing.error as Error).message}</p>
            )}
          </div>
        </ConfirmDialog>
      </td>
    </tr>
  );
}
