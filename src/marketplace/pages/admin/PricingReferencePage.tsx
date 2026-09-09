/**
 * Ce que le référentiel sait, et ce qu'il ignore.
 *
 * L'écran répond à une seule question : « avons-nous assez de références pour
 * vendre ce travail ? ». Il montre donc autant les travaux couverts que les
 * autres — un trou dans le référentiel est une information, pas une ligne
 * absente. C'est cette liste qui dit quel relieur appeler ensuite.
 *
 * Deux prudences d'affichage, qui sont des décisions et pas du style :
 * la médiane passe avant la moyenne, et les quartiles n'apparaissent qu'au
 * delà de cinq ateliers. Un « premier quartile » calculé sur trois valeurs
 * donnerait l'apparence d'une statistique là où il n'y a qu'un avis.
 */
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRateAggregates } from "@/marketplace/services/pricing.data.functions";
import {
  SIZE_CLASS_LABELS,
  WORK_FAMILY_LABELS,
  workItemLabel,
  type WorkFamilyKey,
} from "@/marketplace/pricing/catalog";
import { formatEuros } from "@/marketplace/pricing/money";
import { PUBLISHABLE_MINIMUM_REFERENCES } from "@/marketplace/pricing/rateCard";
import { PricingSimulator } from "./PricingSimulator";

export function PricingReferencePage() {
  const fetchAggregates = useServerFn(getRateAggregates);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "pricing", "aggregates"] as const,
    queryFn: () => fetchAggregates(),
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const { aggregates, uncovered, drift, binderCount, rateCount } = data;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-2xl">Référentiel tarifaire</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rateCount} ligne(s) de grille, {binderCount} atelier(s) contributeur(s),{" "}
          {aggregates.length} combinaison(s) couverte(s).
        </p>
      </header>

      {aggregates.length === 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-medium text-amber-900">Le référentiel est vide.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
            Aucun tarif n’a encore été relevé auprès d’un relieur. Tant que c’est le cas, le moteur
            refuse de chiffrer et chaque projet part en revue manuelle — ce qui est le comportement
            voulu. Ouvrez la fiche d’un atelier pour saisir sa grille.
          </p>
        </section>
      ) : (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Travaux couverts
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Travail</th>
                  <th className="px-3 py-2 font-medium">Format</th>
                  <th className="px-3 py-2 text-right font-medium">Ateliers</th>
                  <th className="px-3 py-2 text-right font-medium">Le moins cher</th>
                  <th className="px-3 py-2 text-right font-medium">Médiane</th>
                  <th className="px-3 py-2 text-right font-medium">Le plus cher</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((aggregate) => {
                  const id = `${aggregate.workItemKey}|${aggregate.sizeClass}|${aggregate.complexityClass}`;
                  const thin = aggregate.referenceCount < PUBLISHABLE_MINIMUM_REFERENCES;
                  return (
                    <Fragment key={id}>
                      <tr
                        className="cursor-pointer border-t border-border hover:bg-muted/30"
                        onClick={() => setExpanded(expanded === id ? null : id)}
                      >
                        <td className="px-3 py-2">{workItemLabel(aggregate.workItemKey)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {SIZE_CLASS_LABELS[aggregate.sizeClass]}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={thin ? "text-amber-700" : ""}>
                            {aggregate.referenceCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatEuros(aggregate.minimumCents)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatEuros(aggregate.medianCents)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatEuros(aggregate.maximumCents)}
                        </td>
                      </tr>
                      {expanded === id && (
                        <tr className="border-t border-border bg-muted/20">
                          <td colSpan={6} className="px-3 py-3">
                            {/* La traçabilité : devant une médiane surprenante,
                                le premier réflexe est de demander qui l'a dite. */}
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Contributions
                            </p>
                            <ul className="mt-2 space-y-1 text-sm">
                              {aggregate.contributions.map((contribution) => (
                                <li key={contribution.binderId} className="flex justify-between">
                                  <span>{contribution.binderName}</span>
                                  <span className="tabular-nums text-muted-foreground">
                                    {formatEuros(contribution.minimumPayoutCents)} –{" "}
                                    {formatEuros(contribution.maximumPayoutCents)} · courant{" "}
                                    <strong className="text-foreground">
                                      {formatEuros(contribution.typicalPayoutCents)}
                                    </strong>{" "}
                                    · {contribution.effectiveFrom}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {/* Deux lignes qui ne disent pas la même chose. Le
                                tableau montre la dispersion des tarifs courants
                                entre ateliers ; l'enveloppe ajoute la marge que
                                chacun se donne sur ses propres lignes. */}
                            <p className="mt-2 text-xs text-muted-foreground">
                              Enveloppe déclarée : {formatEuros(aggregate.floorCents)} –{" "}
                              {formatEuros(aggregate.ceilingCents)}
                            </p>
                            {aggregate.q1Cents !== null && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Quartiles : {formatEuros(aggregate.q1Cents)} –{" "}
                                {formatEuros(aggregate.q3Cents!)}
                              </p>
                            )}
                            {thin && (
                              <p className="mt-2 text-xs text-amber-700">
                                Moins de {PUBLISHABLE_MINIMUM_REFERENCES} ateliers : cette
                                fourchette ne doit pas être présentée comme un ordre de grandeur du
                                métier.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {drift.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Écarts avec le Pricebook
          </h2>
          {/* Un signal, jamais une écriture. Qu'un relieur change ses tarifs ne
              doit pas déplacer un prix de vente sans qu'un humain le décide. */}
          <ul className="mt-3 space-y-2">
            {drift.map((item) => (
              <li
                key={item.entry.id}
                className={`rounded-md border p-3 text-sm ${
                  item.severity === "act" ? "border-amber-300 bg-amber-50" : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{workItemLabel(item.entry.workItemKey)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    référence {formatEuros(item.entry.referenceBinderPayoutCents)} · terrain{" "}
                    {formatEuros(item.observedMedianCents)} ({item.driftBps > 0 ? "+" : ""}
                    {(item.driftBps / 100).toFixed(1)} %)
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PricingSimulator />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Travaux sans aucun tarif ({uncovered.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Un projet qui en contient un seul part en revue manuelle.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(
            uncovered.reduce<Record<string, string[]>>((groups, item) => {
              const key = item.family;
              return { ...groups, [key]: [...(groups[key] ?? []), item.label] };
            }, {}),
          ).map(([family, labels]) => (
            <div key={family} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {WORK_FAMILY_LABELS[family as WorkFamilyKey] ?? family}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                {labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
