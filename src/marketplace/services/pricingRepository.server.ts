/**
 * L'accès au référentiel tarifaire, côté serveur uniquement.
 *
 * Les tables `marketplace_*` refusent `anon` et `authenticated` : ce fichier et
 * ses appelants sont le seul chemin. Il ne décide de rien — il charge les
 * grilles, les repères, le Pricebook et les modificateurs, et rend au domaine
 * des objets typés. Toute la règle vit dans `src/marketplace/pricing/`, pure et
 * testable sans base.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { Json } from "@/integrations/supabase/types";
import type { MarketplaceEventType } from "@/marketplace/analytics/events";
import {
  COMPLEXITY_CLASSES,
  SIZE_CLASSES,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import type { PriceBasis, PriceBenchmark } from "@/marketplace/pricing/benchmark";
import type { ModifierAxis, ModifierKind, PricingModifier } from "@/marketplace/pricing/modifiers";
import {
  aggregateRates,
  type BinderRate,
  type RateAggregate,
} from "@/marketplace/pricing/rateCard";
import type { PriceProvenance, RateSource } from "@/marketplace/pricing/provenance";
import type { PricebookEntry, PricingMethod } from "@/marketplace/pricing/pricebook";
import type { PricingMode } from "@/marketplace/pricing/pricingModes";

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

// ---------------------------------------------------------------------------
// Pricebook
// ---------------------------------------------------------------------------

export const PRICEBOOK_COLUMNS =
  "id, work_item_key, size_class, complexity_class, pricing_mode, reference_binder_payout_cents, customer_price_cents, price_ht_high_cents, unit_label, vat_rate_bps, customer_price_ttc_cents, target_margin_bps, minimum_margin_cents, included_work_items, public_visible, pricing_method, version, status, reference_count_at_validation, notes, change_reason, validated_at, validated_by, created_at, created_by";

type PricebookRow = {
  id: string;
  work_item_key: string;
  size_class: string;
  complexity_class: string;
  pricing_mode: string;
  reference_binder_payout_cents: number | null;
  customer_price_cents: number | null;
  price_ht_high_cents: number | null;
  unit_label: string | null;
  vat_rate_bps: number;
  customer_price_ttc_cents: number | null;
  target_margin_bps: number;
  minimum_margin_cents: number | null;
  included_work_items: string[] | null;
  public_visible: boolean;
  pricing_method: string;
  version: number;
  status: string;
  reference_count_at_validation: number;
  notes: string | null;
  change_reason: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  created_by: string | null;
};

export function toPricebookEntry(row: PricebookRow): PricebookEntry {
  return {
    id: row.id,
    workItemKey: row.work_item_key,
    sizeClass: row.size_class as SizeClass,
    complexityClass: row.complexity_class as ComplexityClass,
    pricingMode: row.pricing_mode as PricingMode,
    referenceBinderPayoutCents: row.reference_binder_payout_cents,
    customerPriceCents: row.customer_price_cents,
    priceHtHighCents: row.price_ht_high_cents,
    unitLabel: row.unit_label,
    vatRateBps: row.vat_rate_bps,
    customerPriceTtcCents: row.customer_price_ttc_cents,
    targetMarginBps: row.target_margin_bps,
    minimumMarginCents: row.minimum_margin_cents,
    includedWorkItems: row.included_work_items ?? [],
    publicVisible: row.public_visible,
    pricingMethod: row.pricing_method as PricingMethod,
    version: row.version,
    status: row.status as PricebookEntry["status"],
    referenceCountAtValidation: row.reference_count_at_validation,
    notes: row.notes,
    changeReason: row.change_reason,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Toutes les versions, ou seulement celles en vigueur. */
export async function loadPricebook(sb: Supa, publishedOnly = true): Promise<PricebookEntry[]> {
  let query = sb.from("marketplace_pricebook").select(PRICEBOOK_COLUMNS);
  if (publishedOnly) query = query.eq("status", "published");
  const { data: rows } = await query.order("work_item_key").order("version", { ascending: false });
  return ((rows ?? []) as PricebookRow[]).map(toPricebookEntry);
}

/**
 * Ce que la page publique peut lire, et rien d'autre.
 *
 * Filtré en base **et** dans le domaine (`publicPriceRows`) : le filtre SQL
 * évite de charger ce qui n'est pas public, le filtre du domaine garantit
 * qu'une erreur de requête n'en publierait pas pour autant.
 */
export async function loadPublicPricebook(sb: Supa): Promise<PricebookEntry[]> {
  const { data: rows } = await sb
    .from("marketplace_pricebook")
    .select(PRICEBOOK_COLUMNS)
    .eq("status", "published")
    .eq("public_visible", true);
  return ((rows ?? []) as PricebookRow[]).map(toPricebookEntry);
}

// ---------------------------------------------------------------------------
// Benchmark marché
// ---------------------------------------------------------------------------

const BENCHMARK_COLUMNS =
  "id, work_item_key, size_class, complexity_class, low_price_cents, high_price_cents, unit_label, price_basis, format_label, source_name, source_url, source_excerpt, observed_at, provenance, status, notes";

type BenchmarkRow = {
  id: string;
  work_item_key: string;
  size_class: string | null;
  complexity_class: string | null;
  low_price_cents: number;
  high_price_cents: number;
  unit_label: string | null;
  price_basis: string;
  format_label: string | null;
  source_name: string;
  source_url: string;
  source_excerpt: string;
  observed_at: string;
  provenance: string;
  status: string;
  notes: string | null;
};

export async function loadBenchmarks(sb: Supa): Promise<PriceBenchmark[]> {
  const { data: rows } = await sb
    .from("marketplace_price_benchmarks")
    .select(BENCHMARK_COLUMNS)
    .eq("status", "active")
    .order("work_item_key");
  return ((rows ?? []) as BenchmarkRow[])
    .filter((row) => row.provenance === "WEB_BENCHMARK")
    .map((row) => ({
      id: row.id,
      workItemKey: row.work_item_key,
      sizeClass: (SIZE_CLASSES as readonly string[]).includes(row.size_class ?? "")
        ? (row.size_class as SizeClass)
        : null,
      complexityClass: (COMPLEXITY_CLASSES as readonly string[]).includes(
        row.complexity_class ?? "",
      )
        ? (row.complexity_class as ComplexityClass)
        : null,
      lowPriceCents: row.low_price_cents,
      highPriceCents: row.high_price_cents,
      unitLabel: row.unit_label,
      priceBasis: row.price_basis as PriceBasis,
      formatLabel: row.format_label,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      sourceExcerpt: row.source_excerpt,
      observedAt: row.observed_at,
      provenance: "WEB_BENCHMARK" as const,
      status: row.status as PriceBenchmark["status"],
      notes: row.notes,
    }));
}

// ---------------------------------------------------------------------------
// Modificateurs et catalogue
// ---------------------------------------------------------------------------

export async function loadModifiers(sb: Supa): Promise<PricingModifier[]> {
  const { data: rows } = await sb
    .from("marketplace_pricing_modifiers")
    .select(
      "id, axis, class_key, kind, percent_bps, fixed_cents, enabled, notes, updated_at, updated_by",
    )
    .order("axis")
    .order("class_key");
  return (rows ?? []).map((row) => ({
    id: row.id,
    axis: row.axis as ModifierAxis,
    classKey: row.class_key,
    kind: row.kind as ModifierKind,
    percentBps: row.percent_bps,
    fixedCents: row.fixed_cents,
    enabled: row.enabled,
    notes: row.notes,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

export interface WorkItemAdminRow {
  key: string;
  hint: string | null;
  active: boolean;
  requiresStudy: boolean;
  updatedAt: string | null;
}

export async function loadWorkItemRows(sb: Supa): Promise<WorkItemAdminRow[]> {
  const { data: rows } = await sb
    .from("marketplace_work_items")
    .select("key, hint, active, requires_study, updated_at");
  return (rows ?? []).map((row) => ({
    key: row.key,
    hint: row.hint,
    active: row.active,
    requiresStudy: row.requires_study,
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

/**
 * Écrit un événement. Son échec est journalisé, jamais propagé : perdre une
 * ligne d'analyse ne doit pas annuler une grille saisie en face d'un relieur.
 * Les événements qui font foi — publication d'un prix, validation d'un
 * dossier — sont écrits par les fonctions SQL, dans la même transaction.
 */
export async function recordMarketplaceEvent(
  sb: Supa,
  event: {
    type: MarketplaceEventType;
    actorUserId: string;
    caseId?: string | null;
    binderId?: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await sb.from("marketplace_events").insert({
    case_id: event.caseId ?? null,
    binder_id: event.binderId ?? null,
    actor_user_id: event.actorUserId,
    event_type: event.type,
    metadata: event.metadata as Json,
  });
  if (error) console.error(`[marketplace_events] ${event.type} non enregistré : ${error.message}`);
}
