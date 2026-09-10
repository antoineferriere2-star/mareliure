/**
 * Le prix d'un dossier : composé depuis le Pricebook, décidé par un humain,
 * figé à la validation.
 *
 * Le panneau part des travaux que le moteur a lus dans le Dossier. On coche,
 * on décoche, on ajuste les quantités, le format, la complexité ; la
 * composition se recalcule côté serveur à chaque changement. Les montants
 * retenus se pré-remplissent avec elle — s'en écarter est permis, mais se
 * justifie. « Valider le prix » ouvre une confirmation qui montre ce qui va
 * être figé, marge comprise. Une fois validé, le panneau n'affiche plus que la
 * photographie : elle ne se recalcule jamais.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  composeCasePricing,
  generateMarketplacePricing,
  validateMarketplacePricing,
} from "@/marketplace/services/marketplace.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_ITEMS,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { CONFIDENCE_LABELS, type PricingConfidence } from "@/marketplace/pricing/confidence";
import { assessMargin, type MarginAssessment } from "@/marketplace/pricing/margin";
import { COMPOSITION_POLICY } from "@/marketplace/pricing/pricing.rules";
import type { PricingSnapshot } from "@/marketplace/pricing/snapshot";
import { formatVatRate, fromHt, STANDARD_VAT_RATE_BPS } from "@/marketplace/pricing/vat";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  EvidenceNote,
  inputClass,
  MarginBadge,
  selectClass,
} from "./pricing/consoleShared";
import { centsToInput, eurosToCents, money, shortDate } from "./pricing/consoleFormat";

interface CasePricingRow {
  manual_review_required: boolean;
  pricing_status: string;
  pricing_snapshot: PricingSnapshot | null;
  price_includes: string[];
  pricing_confidence: string | null;
  pricing_reference_count: number | null;
  suggested_customer_price_cents: number | null;
  suggested_binder_payout_cents: number | null;
}

interface Request {
  lines: { workItemKey: string; quantity: number }[];
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
}

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
        <FrozenPrice snapshot={row.pricing_snapshot} />
      ) : (
        <Composer caseId={caseId} row={row} refresh={refresh} />
      )}
    </section>
  );
}

function FrozenPrice({ snapshot }: { snapshot: PricingSnapshot & { validatedAt?: string } }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="font-serif text-3xl tabular-nums">{money(snapshot.priceTtcCents)}</p>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Prix HT</dt>
          <dd className="tabular-nums">{money(snapshot.priceHtCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">TVA ({formatVatRate(snapshot.vatRateBps)})</dt>
          <dd className="tabular-nums">{money(snapshot.vatCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Rémunération atelier</dt>
          <dd className="tabular-nums">{money(snapshot.payoutCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Marge</dt>
          <dd>
            <MarginBadge margin={snapshot.margin as MarginAssessment} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Preuve</dt>
          <dd>{snapshot.confidence.label}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Validé le</dt>
          <dd>{shortDate(snapshot.validatedAt)}</dd>
        </div>
      </dl>
      <ul className="space-y-0.5 border-t border-border pt-2 text-xs">
        {snapshot.operations.map((operation) => (
          <li key={operation.workItemKey} className="flex justify-between gap-2">
            <span>
              {operation.label}
              {operation.quantity > 1 ? ` × ${operation.quantity}` : ""}
              {operation.entryVersion !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  · Pricebook v{operation.entryVersion}
                </span>
              )}
              {operation.includedIn && <span className="text-muted-foreground"> · compris</span>}
            </span>
            <span className="tabular-nums">{money(operation.priceHtCents)}</span>
          </li>
        ))}
      </ul>
      {snapshot.overridden && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
          Écart au Pricebook
          {snapshot.composed
            ? ` (composé : ${money(snapshot.composed.priceHtCents)} HT)`
            : " (non chiffré)"}{" "}
          — {snapshot.overrideReason}
        </p>
      )}
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
  const generate = useServerFn(generateMarketplacePricing);

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
  const [payout, setPayout] = useState("");
  const [price, setPrice] = useState("");
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
    setPayout(centsToInput(composition.payoutCents));
    setPrice(centsToInput(composition.priceHtCents));
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
          retainedPayoutCents: eurosToCents(payout) ?? 0,
          retainedPriceHtCents: eurosToCents(price) ?? 0,
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
  const suggestion = useMutation({
    mutationFn: () => generate({ data: { caseId } }),
    onSuccess: refresh,
  });

  if (initial.isPending || !request)
    return <p className="mt-3 text-sm text-muted-foreground">Composition…</p>;
  if (initial.error)
    return <p className="mt-3 text-sm text-destructive">{(initial.error as Error).message}</p>;

  const payoutCents = eurosToCents(payout);
  const priceCents = eurosToCents(price);
  const breakdown = priceCents && priceCents > 0 ? fromHt(priceCents, STANDARD_VAT_RATE_BPS) : null;
  const margin =
    payoutCents && priceCents
      ? assessMargin({ priceHtCents: priceCents, payoutCents, ...COMPOSITION_POLICY })
      : null;
  const priced = composition?.status === "priced";
  const overridden =
    !priced || composition?.payoutCents !== payoutCents || composition?.priceHtCents !== priceCents;
  const ready =
    request.lines.length > 0 &&
    payoutCents !== null &&
    priceCents !== null &&
    payoutCents > 0 &&
    payoutCents <= priceCents &&
    (!overridden || reason.trim() !== "") &&
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
          const evidence = current?.references[line.workItemKey]?.evidence;
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
                  {money(composed?.priceHtCents)}
                </span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground">
                {composed?.entryVersion != null && (
                  <span>Pricebook v{composed.entryVersion} · </span>
                )}
                {composed?.includedIn && <span>compris dans un autre travail · </span>}
                {composed?.modifiers.map((modifier) => (
                  <span key={modifier}>{modifier} · </span>
                ))}
                {evidence && <EvidenceNote evidence={evidence} />}
                {composed?.problem && (
                  <span className="block text-amber-800">{composed.problem}</span>
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
          <option value="">Ajouter un travail…</option>
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
          <p className="font-medium">Le Pricebook ne chiffre pas ce projet.</p>
          <ul className="mt-1 list-disc pl-4">
            {composition.reasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-1">
            Un prix peut être fixé à la main après étude, avec sa justification.
          </p>
        </div>
      )}
      {priced && composition?.breakdown && (
        <p className="text-xs text-muted-foreground">
          Composé : {money(composition.payoutCents)} atelier · {money(composition.priceHtCents)} HT
          · {money(composition.breakdown.ttcCents)} TTC
          {composition.startingFrom ? " (à partir de)" : ""}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
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
        <label>
          Prix client HT (€)
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
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">TVA ({formatVatRate(STANDARD_VAT_RATE_BPS)})</dt>
          <dd className="tabular-nums">{money(breakdown?.vatCents)}</dd>
        </div>
        <div className="flex justify-between text-sm font-medium">
          <dt>Prix client TTC</dt>
          <dd className="tabular-nums">{money(breakdown?.ttcCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Marge</dt>
          <dd>
            <MarginBadge margin={margin} />
          </dd>
        </div>
        {current && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Preuve</dt>
            <dd>
              <EvidenceNote evidence={current.confidence} />
            </dd>
          </div>
        )}
      </dl>
      {overridden && (
        <label className="block text-xs">
          {priced
            ? "Pourquoi s’écarter du Pricebook ?"
            : "Sur quoi repose ce prix fixé à la main ?"}{" "}
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

      <div className="flex flex-wrap gap-2">
        <Button disabled={!ready} onClick={() => setConfirming(true)}>
          Valider le prix…
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={suggestion.isPending}
          onClick={() => suggestion.mutate()}
        >
          Référence des grilles
        </Button>
      </div>
      {row.manual_review_required && (
        <p className="text-xs text-amber-800">
          La revue manuelle doit être levée avant de valider un prix.
        </p>
      )}
      {row.suggested_customer_price_cents !== null && (
        <p className="text-xs text-muted-foreground">
          Grilles d’ateliers : {money(row.suggested_binder_payout_cents)} atelier ·{" "}
          {money(row.suggested_customer_price_cents)} client
          {row.pricing_confidence
            ? ` · ${CONFIDENCE_LABELS[row.pricing_confidence as PricingConfidence] ?? row.pricing_confidence}`
            : ""}
          {row.pricing_reference_count ? ` · ${row.pricing_reference_count} atelier(s)` : ""}
        </p>
      )}
      {(recompose.error || validation.error || suggestion.error) && (
        <p className="text-xs text-destructive">
          {((recompose.error ?? validation.error ?? suggestion.error) as Error).message}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Valider et figer ce prix"
        description="Le prix, sa décomposition et les versions du Pricebook utilisées sont figés dans le dossier. Ils ne se recalculeront plus."
        confirmLabel="Valider le prix"
        pending={validation.isPending}
        onConfirm={() => validation.mutate()}
      >
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Prix client TTC</dt>
            <dd className="font-medium tabular-nums">{money(breakdown?.ttcCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Prix HT · TVA</dt>
            <dd className="tabular-nums">
              {money(priceCents)} · {money(breakdown?.vatCents)}
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
          {overridden && <p className="text-xs">Écart au Pricebook : {reason.trim()}</p>}
        </dl>
        {validation.error && (
          <p className="text-xs text-destructive">{(validation.error as Error).message}</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
