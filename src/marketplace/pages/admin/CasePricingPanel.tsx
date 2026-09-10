/**
 * Le prix d'un dossier : composé depuis la grille Ma Reliure, décidé par un
 * humain, figé à la validation.
 *
 * Le panneau part des prestations que le moteur a lues dans le Dossier. On
 * coche, on décoche, on ajuste les quantités, le format, la complexité ; la
 * composition se recalcule côté serveur. Le prix client TTC et la rémunération
 * atelier se pré-remplissent avec elle — les changer est permis, se justifie,
 * et n'appartient qu'au dossier : la grille ne bouge pas. Une fois validé, le
 * panneau n'affiche plus que la photographie.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  composeCasePricing,
  validateMarketplacePricing,
} from "@/marketplace/services/marketplace.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_ITEMS,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { assessMargin, type MarginAssessment } from "@/marketplace/pricing/margin";
import { PROVENANCE_LABELS } from "@/marketplace/pricing/provenance";
import type { PricingSnapshot } from "@/marketplace/pricing/snapshot";
import { formatVatRate, fromTtc } from "@/marketplace/pricing/vat";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  inputClass,
  MarginBadge,
  ProvenanceTag,
  selectClass,
} from "./pricing/consoleShared";
import { centsToInput, eurosToCents, money, shortDate } from "./pricing/consoleFormat";

interface CasePricingRow {
  manual_review_required: boolean;
  pricing_status: string;
  pricing_snapshot: PricingSnapshot | null;
  price_includes: string[];
}

interface Request {
  lines: readonly { workItemKey: string; quantity: number }[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
}

/** Une photographie prise avant la grille unique porte d'autres champs. */
type StoredSnapshot = Partial<PricingSnapshot> &
  Pick<PricingSnapshot, "priceTtcCents" | "priceHtCents" | "vatRateBps" | "vatCents" | "payoutCents"> & {
    validatedAt?: string;
    confidence?: { label: string };
    operations: (Partial<PricingSnapshot["operations"][number]> & {
      workItemKey: string;
      label: string;
      quantity: number;
      priceHtCents?: number | null;
    })[];
    margin: PricingSnapshot["margin"];
  };

export function CasePricingPanel({
  caseId,
  row,
  refresh,
}: {
  caseId: string;
  row: CasePricingRow;
  refresh: () => Promise<unknown>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prix Ma Reliure
        </h2>
        <span className="text-xs text-muted-foreground">
          {row.pricing_status === "validated" ? "Validé · figé" : "À composer"}
        </span>
      </div>
      {row.pricing_status === "validated" && row.pricing_snapshot ? (
        <FrozenPrice snapshot={row.pricing_snapshot as unknown as StoredSnapshot} />
      ) : (
        <Composer caseId={caseId} row={row} refresh={refresh} />
      )}
    </section>
  );
}

function FrozenPrice({ snapshot }: { snapshot: StoredSnapshot }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="font-serif text-3xl tabular-nums">{money(snapshot.priceTtcCents)}</p>
      <dl className="space-y-1 text-xs">
        <Row label="Prix HT" value={money(snapshot.priceHtCents)} />
        <Row label={`TVA (${formatVatRate(snapshot.vatRateBps)})`} value={money(snapshot.vatCents)} />
        <Row label="Rémunération atelier" value={money(snapshot.payoutCents)} />
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Marge</dt>
          <dd>
            <MarginBadge margin={snapshot.margin as MarginAssessment} />
          </dd>
        </div>
        <Row
          label="Source du prix"
          value={
            snapshot.provenance
              ? PROVENANCE_LABELS[snapshot.provenance]
              : (snapshot.confidence?.label ?? "—")
          }
        />
        <Row label="Validé le" value={shortDate(snapshot.validatedAt)} />
      </dl>
      <ul className="space-y-0.5 border-t border-border pt-2 text-xs">
        {snapshot.operations.map((operation) => (
          <li key={operation.workItemKey} className="flex justify-between gap-2">
            <span>
              {operation.label}
              {operation.quantity > 1 ? ` × ${operation.quantity}` : ""}
              {operation.entryVersion != null && (
                <span className="text-muted-foreground"> · grille v{operation.entryVersion}</span>
              )}
            </span>
            <span className="tabular-nums">
              {money(
                operation.priceTtcCents ??
                  (operation as { priceHtCents?: number | null }).priceHtCents,
              )}
            </span>
          </li>
        ))}
      </ul>
      {snapshot.overridden && (
        <p className="rounded-md border border-sky-300 bg-sky-50 p-2 text-xs text-sky-950">
          Prix fixé sur le dossier
          {snapshot.composed?.priceTtcCents != null
            ? ` (grille : ${money(snapshot.composed.priceTtcCents)} TTC)`
            : ""}{" "}
          — {snapshot.overrideReason}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Composer({
  caseId,
  row,
  refresh,
}: {
  caseId: string;
  row: CasePricingRow;
  refresh: () => Promise<unknown>;
}) {
  const compose = useServerFn(composeCasePricing);
  const validate = useServerFn(validateMarketplacePricing);

  const initial = useQuery({
    queryKey: ["marketplace", "case", caseId, "composition"],
    queryFn: () => compose({ data: { caseId } }),
  });
  const recompose = useMutation({
    mutationFn: (next: Request) => compose({ data: { caseId, ...next } }),
  });
  const current = recompose.data ?? initial.data;

  const [request, setRequest] = useState<Request | null>(null);
  const [adding, setAdding] = useState("");
  const [price, setPrice] = useState("");
  const [payout, setPayout] = useState("");
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [includes, setIncludes] = useState(row.price_includes.join(", "));
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (initial.data && request === null) setRequest(initial.data.request);
  }, [initial.data, request]);

  const composition = current?.composition;
  useEffect(() => {
    if (touched || !composition || composition.status !== "priced") return;
    setPrice(centsToInput(composition.priceTtcCents));
    setPayout(centsToInput(composition.payout?.payoutCents));
  }, [composition, touched]);

  const change = (next: Request) => {
    setRequest(next);
    if (next.lines.length > 0) recompose.mutate(next);
  };

  const validation = useMutation({
    mutationFn: () =>
      validate({
        data: {
          caseId,
          lines: request!.lines,
          sizeClass: request!.sizeClass,
          complexityClass: request!.complexityClass,
          retainedPriceTtcCents: eurosToCents(price) ?? 0,
          retainedPayoutCents: eurosToCents(payout) ?? 0,
          priceIncludes: includes
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          overrideReason: reason.trim() || null,
        },
      }),
    onSuccess: async () => {
      setConfirming(false);
      await refresh();
    },
  });

  if (initial.isPending || !request)
    return <p className="mt-3 text-sm text-muted-foreground">Composition…</p>;
  if (initial.error)
    return <p className="mt-3 text-sm text-destructive">{(initial.error as Error).message}</p>;

  const priceCents = eurosToCents(price);
  const payoutCents = eurosToCents(payout);
  const breakdown = priceCents && priceCents > 0 ? fromTtc(priceCents) : null;
  const margin =
    breakdown && payoutCents && composition
      ? assessMargin({
          priceHtCents: breakdown.htCents,
          payoutCents,
          targetMarginBps: composition.policy.targetMarginBps,
          minimumMarginCents: composition.policy.minimumMarginCents,
        })
      : null;
  const priced = composition?.status === "priced";
  const overridden =
    !priced ||
    composition?.priceTtcCents !== priceCents ||
    (composition?.payout?.payoutCents ?? null) !== payoutCents;
  const unvalidated = priced ? (composition?.unvalidated ?? []) : [];
  const needsReason = overridden || unvalidated.length > 0;
  const ready =
    request.lines.length > 0 &&
    breakdown !== null &&
    payoutCents !== null &&
    payoutCents > 0 &&
    payoutCents <= breakdown.htCents &&
    (!needsReason || reason.trim() !== "") &&
    !row.manual_review_required;

  const selected = new Set(request.lines.map((line) => line.workItemKey));

  return (
    <div className="mt-3 space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label>
          Format
          <select
            className={`${selectClass} mt-1 w-full`}
            value={request.sizeClass}
            onChange={(e) => change({ ...request, sizeClass: e.target.value as SizeClass })}
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
            value={request.complexityClass}
            onChange={(e) =>
              change({ ...request, complexityClass: e.target.value as ComplexityClass })
            }
          >
            {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="space-y-1.5">
        {request.lines.map((line) => {
          const composed = composition?.lines.find((item) => item.workItemKey === line.workItemKey);
          return (
            <li key={line.workItemKey} className="rounded-md border border-border px-2 py-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked
                  aria-label={`Retirer ${composed?.label ?? line.workItemKey}`}
                  onChange={() =>
                    change({
                      ...request,
                      lines: request.lines.filter((item) => item.workItemKey !== line.workItemKey),
                    })
                  }
                />
                <span className="flex-1">{composed?.label ?? line.workItemKey}</span>
                <input
                  aria-label="Quantité"
                  className={`${inputClass} w-14`}
                  type="number"
                  min={1}
                  max={999}
                  value={line.quantity}
                  onChange={(e) =>
                    change({
                      ...request,
                      lines: request.lines.map((item) =>
                        item.workItemKey === line.workItemKey
                          ? {
                              ...item,
                              quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            }
                          : item,
                      ),
                    })
                  }
                />
                <span className="w-20 text-right text-xs tabular-nums">
                  {money(composed?.priceTtcCents)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-6 text-xs text-muted-foreground">
                {composed?.entryVersion != null && <span>grille v{composed.entryVersion}</span>}
                {composed?.provenance && <ProvenanceTag provenance={composed.provenance} />}
                {composed?.problem && (
                  <span className="block w-full text-amber-800">{composed.problem}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <select
          className={`${selectClass} flex-1`}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        >
          <option value="">Ajouter une prestation…</option>
          {WORK_ITEMS.filter((item) => !selected.has(item.key)).map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={!adding}
          onClick={() => {
            change({ ...request, lines: [...request.lines, { workItemKey: adding, quantity: 1 }] });
            setAdding("");
          }}
        >
          Ajouter
        </Button>
      </div>

      {composition && !priced && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-medium">La grille ne chiffre pas ce projet.</p>
          <ul className="mt-1 list-disc pl-4">
            {composition.reasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-1">Un prix peut être fixé à la main après étude, avec sa justification.</p>
        </div>
      )}
      {priced && composition && (
        <dl className="space-y-0.5 text-xs text-muted-foreground">
          <Row label="Total des prestations" value={money(composition.subtotalTtcCents)} />
          {composition.modifiers.map((modifier) => (
            <Row
              key={modifier.label}
              label={modifier.label}
              value={`${modifier.deltaTtcCents >= 0 ? "+" : "−"}${money(Math.abs(modifier.deltaTtcCents))}`}
            />
          ))}
          <Row label="Grille : prix client TTC" value={money(composition.priceTtcCents)} />
          <Row label="Grille : rémunération proposée" value={money(composition.payout?.payoutCents)} />
        </dl>
      )}
      {composition && composition.warnings.length > 0 && (
        <ul className="space-y-0.5 text-xs text-amber-900">
          {composition.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
        <label>
          Prix client TTC (€)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setTouched(true);
              setPrice(e.target.value);
            }}
          />
        </label>
        <label>
          Rémunération atelier (€)
          <input
            className={`${inputClass} mt-1`}
            inputMode="decimal"
            value={payout}
            onChange={(e) => {
              setTouched(true);
              setPayout(e.target.value);
            }}
          />
        </label>
      </div>
      <dl className="space-y-1 text-xs">
        <Row label="Prix HT" value={money(breakdown?.htCents)} />
        <Row
          label={`TVA (${formatVatRate(breakdown?.vatRateBps ?? 2_000)})`}
          value={money(breakdown?.vatCents)}
        />
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Marge</dt>
          <dd>
            <MarginBadge margin={margin} />
          </dd>
        </div>
      </dl>
      {needsReason && (
        <label className="block text-xs">
          {!priced
            ? "Sur quoi repose ce prix fixé à la main ?"
            : overridden
              ? "Pourquoi s’écarter de la grille ?"
              : `Tarif non validé dans la grille (${unvalidated.join(", ")}) : validez-le dans la grille, ou justifiez ce prix.`}{" "}
          (obligatoire)
          <textarea
            className="mt-1 min-h-14 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <label className="block text-xs">
        Ce que le prix comprend
        <input
          className={`${inputClass} mt-1`}
          value={includes}
          placeholder="Reliure, matériaux, expédition retour"
          onChange={(e) => setIncludes(e.target.value)}
        />
      </label>

      <Button disabled={!ready} onClick={() => setConfirming(true)}>
        Valider le prix…
      </Button>
      {row.manual_review_required && (
        <p className="text-xs text-amber-800">
          La revue manuelle doit être levée avant de valider un prix.
        </p>
      )}
      {(recompose.error || validation.error) && (
        <p className="text-xs text-destructive">
          {((recompose.error ?? validation.error) as Error).message}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Valider et figer ce prix"
        description="Le prix, sa décomposition et les versions de la grille utilisées sont figés dans le dossier. Ils ne se recalculeront plus, et la grille ne change pas."
        confirmLabel="Valider le prix"
        pending={validation.isPending}
        onConfirm={() => validation.mutate()}
      >
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Prix client TTC</dt>
            <dd className="font-medium tabular-nums">{money(priceCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Prix HT · TVA</dt>
            <dd className="tabular-nums">
              {money(breakdown?.htCents)} · {money(breakdown?.vatCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Rémunération atelier</dt>
            <dd className="tabular-nums">{money(payoutCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Marge</dt>
            <dd>
              <MarginBadge margin={margin} />
            </dd>
          </div>
          {margin && margin.status !== "OK" && (
            <p className="text-xs text-amber-900">{margin.reasons.join(" ")}</p>
          )}
          <p className="text-xs">
            Source : {PROVENANCE_LABELS[needsReason ? "CASE_OVERRIDE" : "ADMIN_VALIDATED"]}
            {needsReason ? ` — ${reason.trim()}` : ""}
          </p>
        </dl>
        {validation.error && (
          <p className="text-xs text-destructive">{(validation.error as Error).message}</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
