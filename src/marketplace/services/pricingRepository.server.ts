/**
 * L'accès au référentiel tarifaire, côté serveur uniquement.
 *
 * Les tables `marketplace_*` refusent `anon` et `authenticated` : ce fichier et
 * ses appelants sont le seul chemin. Il ne décide de rien — il charge les
 * grilles, les agrège, et rend au moteur une photographie du marché. Toute la
 * règle vit dans `src/marketplace/pricing/`, pure et testable sans base.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import {
  COMPLEXITY_CLASSES,
  SIZE_CLASSES,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import {
  aggregateRates,
  type BinderRate,
  type RateAggregate,
} from "@/marketplace/pricing/rateCard";
import type { PriceProvenance, RateSource } from "@/marketplace/pricing/provenance";
import type { PricebookEntry, PricingMethod } from "@/marketplace/pricing/pricebook";

/**
 * Le jeu d'essai n'anime une base que si on le demande explicitement.
 *
 * Deux verrous plutôt qu'un : la variable doit être posée, **et** la marque
 * de production doit être absente. Un `.env` copié d'un environnement à
 * l'autre est l'accident le plus banal du métier, et il ferait ici entrer des
 * tarifs fictifs dans un prix de vente. Le défaut, en l'absence de toute
 * variable, est le refus.
 */
function testRatesAllowed(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) return false;
  if (env.MARKETPLACE_ENV === "production" || env.NODE_ENV === "production") return false;
  return env.MARKETPLACE_ALLOW_TEST_RATES === "true";
}

const RATE_COLUMNS =
  "id, binder_id, work_item_key, minimum_payout_cents, typical_payout_cents, maximum_payout_cents, estimated_hours, size_class, complexity_class, notes, effective_from, status, source, provenance, verified_at, verified_by";

type RateRow = {
  id: string;
  binder_id: string;
  work_item_key: string;
  minimum_payout_cents: number;
  typical_payout_cents: number;
  maximum_payout_cents: number;
  estimated_hours: number | null;
  size_class: string;
  complexity_class: string;
  notes: string | null;
  effective_from: string;
  status: string;
  source: string;
  provenance: string;
  verified_at: string | null;
  verified_by: string | null;
};

function toRate(row: RateRow, binderName: string): BinderRate & { binderName: string } {
  return {
    id: row.id,
    binderId: row.binder_id,
    binderName,
    workItemKey: row.work_item_key,
    minimumPayoutCents: row.minimum_payout_cents,
    typicalPayoutCents: row.typical_payout_cents,
    maximumPayoutCents: row.maximum_payout_cents,
    estimatedHours: row.estimated_hours,
    sizeClass: row.size_class as SizeClass,
    complexityClass: row.complexity_class as ComplexityClass,
    notes: row.notes,
    effectiveFrom: row.effective_from,
    status: row.status as BinderRate["status"],
    source: row.source as RateSource,
    provenance: row.provenance as PriceProvenance,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
  };
}

/**
 * Toutes les grilles actives, avec le nom de l'atelier qui les a données.
 *
 * Le nom compte : une contribution anonyme n'est pas traçable, et le premier
 * réflexe devant une médiane surprenante est de demander qui l'a dite.
 */
export async function loadActiveRates(sb: Supa): Promise<(BinderRate & { binderName: string })[]> {
  const { data: rows } = await sb
    .from("marketplace_binder_rates")
    .select(RATE_COLUMNS)
    .eq("status", "active");
  if (!rows || rows.length === 0) return [];

  const binderIds = [...new Set(rows.map((row) => (row as RateRow).binder_id))];
  const { data: binders } = await sb
    .from("marketplace_binders")
    .select("id, display_name, workshop_name")
    .in("id", binderIds);
  const names = new Map(
    (binders ?? []).map((b) => [
      b.id as string,
      (b.workshop_name as string | null) ?? (b.display_name as string),
    ]),
  );

  return (rows as RateRow[]).map((row) => toRate(row, names.get(row.binder_id) ?? "Atelier"));
}

/** Les grilles d'un seul atelier, brouillons compris, pour l'écran de saisie. */
export async function loadBinderRates(sb: Supa, binderId: string): Promise<BinderRate[]> {
  const { data: rows } = await sb
    .from("marketplace_binder_rates")
    .select(RATE_COLUMNS)
    .eq("binder_id", binderId)
    .neq("status", "superseded")
    .order("work_item_key");
  return (rows as RateRow[] | null)?.map((row) => toRate(row, "")) ?? [];
}

/**
 * La photographie du marché que lit le moteur.
 *
 * Agrège chaque combinaison réellement présente dans les grilles plutôt que le
 * produit cartésien travail × format × complexité : les combinaisons vides ne
 * produisent rien et n'ont pas à être calculées.
 */
export function aggregatesFrom(
  rates: readonly (BinderRate & { binderName: string })[],
): RateAggregate[] {
  const combinations = new Set(
    rates.map((rate) => `${rate.workItemKey}|${rate.sizeClass}|${rate.complexityClass}`),
  );
  const options = { includeTestData: testRatesAllowed() };
  const aggregates: RateAggregate[] = [];
  for (const combination of combinations) {
    const [workItemKey, sizeClass, complexityClass] = combination.split("|");
    const aggregate = aggregateRates(
      rates,
      workItemKey,
      sizeClass as SizeClass,
      complexityClass as ComplexityClass,
      options,
    );
    if (aggregate) aggregates.push(aggregate);
  }
  return aggregates.sort(
    (a, b) => a.workItemKey.localeCompare(b.workItemKey) || a.sizeClass.localeCompare(b.sizeClass),
  );
}

export async function loadAggregates(sb: Supa): Promise<RateAggregate[]> {
  return aggregatesFrom(await loadActiveRates(sb));
}

const PRICEBOOK_COLUMNS =
  "id, work_item_key, size_class, complexity_class, reference_binder_payout_cents, customer_price_cents, target_margin_cents, target_margin_bps, pricing_method, version, status, reference_count_at_validation, notes, validated_at, validated_by";

export async function loadPricebook(sb: Supa, publishedOnly = true): Promise<PricebookEntry[]> {
  let query = sb.from("marketplace_pricebook").select(PRICEBOOK_COLUMNS);
  if (publishedOnly) query = query.eq("status", "published");
  const { data: rows } = await query.order("work_item_key");
  return (rows ?? []).map((row) => ({
    id: row.id as string,
    workItemKey: row.work_item_key as string,
    sizeClass: row.size_class as SizeClass,
    complexityClass: row.complexity_class as ComplexityClass,
    referenceBinderPayoutCents: row.reference_binder_payout_cents as number,
    customerPriceCents: row.customer_price_cents as number,
    targetMarginCents: row.target_margin_cents as number,
    targetMarginBps: row.target_margin_bps as number,
    pricingMethod: row.pricing_method as PricingMethod,
    version: row.version as number,
    status: row.status as PricebookEntry["status"],
    referenceCountAtValidation: row.reference_count_at_validation as number,
    notes: row.notes as string | null,
    validatedAt: row.validated_at as string | null,
    validatedBy: row.validated_by as string | null,
  }));
}

export const ALL_SIZE_CLASSES = SIZE_CLASSES;
export const ALL_COMPLEXITY_CLASSES = COMPLEXITY_CLASSES;
