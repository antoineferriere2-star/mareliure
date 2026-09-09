/**
 * Le simulateur : un panier de travaux, un résultat immédiat.
 *
 * Il ne part pas d'un dossier mais d'une sélection à la main, parce que son
 * usage principal est la conversation — on l'ouvre en face d'un relieur pour
 * lui montrer comment son tarif devient un prix, et ce que Ma Reliure garde.
 * Montrer la marge à l'artisan est un choix : un réseau se construit mal sur
 * une commission qu'on cache.
 *
 * Il lit exactement les mêmes agrégats que le moteur, et s'abstient dans les
 * mêmes cas. Un simulateur plus indulgent que la production serait un piège.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { simulatePricing } from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_FAMILIES,
  WORK_ITEMS,
  workItemLabel,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { formatEuros } from "@/marketplace/pricing/money";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PricingSimulator() {
  const simulate = useServerFn(simulatePricing);
  const [selected, setSelected] = useState<string[]>([]);
  const [sizeClass, setSizeClass] = useState<SizeClass>("standard");
  const [complexityClass, setComplexityClass] = useState<ComplexityClass>("standard");

  const run = useMutation({
    mutationFn: () => simulate({ data: { workItemKeys: selected, sizeClass, complexityClass } }),
  });

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const result = run.data;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-xl">Simulateur</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Composez un projet, voyez ce qu’il produit. Mêmes données que le moteur.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <Label htmlFor="sim-size">Format</Label>
          <select
            id="sim-size"
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sizeClass}
            onChange={(event) => setSizeClass(event.target.value as SizeClass)}
          >
            {Object.entries(SIZE_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sim-complexity">Complexité</Label>
          <select
            id="sim-complexity"
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={complexityClass}
            onChange={(event) => setComplexityClass(event.target.value as ComplexityClass)}
          >
            {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-border p-3">
        {WORK_FAMILIES.map((family) => (
          <div key={family.key} className="mb-3 last:mb-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {family.label}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WORK_ITEMS.filter((item) => item.family === family.key).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    selected.includes(item.key)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button disabled={selected.length === 0 || run.isPending} onClick={() => run.mutate()}>
          Calculer
        </Button>
        {selected.length > 0 && (
          <button
            type="button"
            className="text-sm text-muted-foreground underline"
            onClick={() => setSelected([])}
          >
            Vider
          </button>
        )}
      </div>

      {run.error && <p className="mt-3 text-sm text-destructive">{(run.error as Error).message}</p>}

      {result && (
        <div className="mt-5 rounded-md border border-border bg-muted/30 p-4">
          {result.components.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {result.components.map((component) => (
                  <tr key={component.workItemKey}>
                    <td className="py-1">
                      {component.label}
                      {component.approximated && (
                        <span
                          className="ml-1 text-amber-700"
                          title={component.approximationNote ?? ""}
                        >
                          ≈
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-right text-xs text-muted-foreground">
                      {component.referenceCount} ateliers
                    </td>
                    <td className="py-1 pl-3 text-right tabular-nums">
                      {formatEuros(component.referencePayoutCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.missing.length > 0 && (
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Sans tarif : {result.missing.map(workItemLabel).join(", ")}. Un seul travail non
              tarifé suffit à ne pas conclure — un total partiel aurait l’air complet.
            </p>
          )}

          {result.status === "suggested" ? (
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rémunération atelier suggérée</dt>
                <dd className="tabular-nums">{formatEuros(result.payoutCents!)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Prix Ma Reliure</dt>
                <dd className="tabular-nums">{formatEuros(result.customerPriceCents!)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Marge</dt>
                <dd className="tabular-nums text-muted-foreground">
                  {formatEuros(result.marginCents!)} · {(result.marginBps! / 100).toFixed(1)} %
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fourchette observée</dt>
                <dd className="tabular-nums text-muted-foreground">
                  {formatEuros(result.lowCents!)} – {formatEuros(result.highCents!)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              Pas de prix : le référentiel ne couvre pas ce projet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
