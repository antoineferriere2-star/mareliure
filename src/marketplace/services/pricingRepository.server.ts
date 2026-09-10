/**
 * L'accès à la grille tarifaire Ma Reliure, côté serveur uniquement.
 *
 * Les tables `marketplace_*` refusent `anon` et `authenticated` : ce fichier et
 * ses appelants sont le seul chemin. Il ne décide de rien — il charge le
 * Pricebook, le benchmark web, les modificateurs et la politique de marge, et
 * rend au domaine des objets typés. Toute la règle vit dans
 * `src/marketplace/pricing/`, pure et testable sans base.
 *
 * Une lecture qui échoue lève une erreur plutôt que de rendre une liste vide :
 * une grille vide à l'écran ferait croire qu'aucun prix n'existe.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { ModifierAxis, ModifierKind, PricingModifier } from "@/marketplace/pricing/modifiers";
import type { PayoutPolicy } from "@/marketplace/pricing/payout";
import type { PricebookEntry, PricebookStatus } from "@/marketplace/pricing/pricebook";
import type { WorkItemState } from "@/marketplace/pricing/pricingGrid";
import type { PricingMode } from "@/marketplace/pricing/pricingModes";
import type { GridProvenance } from "@/marketplace/pricing/provenance";
import type { PricingUnit, WebBenchmark } from "@/marketplace/pricing/webBenchmark";

function unavailable(what: string, message: string): never {
  throw new Error(`${what} indisponible : ${message}`);
}

// ---------------------------------------------------------------------------
// Pricebook
// ---------------------------------------------------------------------------

const PRICEBOOK_COLUMNS =
  "id, work_item_key, pricing_mode, customer_price_cents, customer_price_ttc_cents, vat_rate_bps, status, provenance, version, public_visible, validated_at, validated_by, created_at, created_by, change_reason, notes";

type PricebookRow = {
  id: string;
  work_item_key: string;
  pricing_mode: string;
  customer_price_cents: number | null;
  customer_price_ttc_cents: number | null;
  vat_rate_bps: number;
  status: string;
  provenance: string;
  version: number;
  public_visible: boolean;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  created_by: string | null;
  change_reason: string | null;
  notes: string | null;
};

export function toPricebookEntry(row: PricebookRow): PricebookEntry {
  return {
    id: row.id,
    workItemKey: row.work_item_key,
    pricingMode: row.pricing_mode as PricingMode,
    priceHtCents: row.customer_price_cents,
    priceTtcCents: row.customer_price_ttc_cents,
    vatRateBps: row.vat_rate_bps,
    status: row.status as PricebookStatus,
    provenance: row.provenance as GridProvenance,
    version: row.version,
    publicVisible: row.public_visible,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
    changeReason: row.change_reason,
    notes: row.notes,
  };
}

/**
 * Les versions de la grille, historique compris. Les entrées hors classe
 * courante appartiennent à l'ancien modèle : elles ne sont pas la grille.
 */
export async function loadPricebook(
  sb: Supa,
  options: { activeOnly?: boolean } = {},
): Promise<PricebookEntry[]> {
  let query = sb
    .from("marketplace_pricebook")
    .select(PRICEBOOK_COLUMNS)
    .eq("size_class", "standard")
    .eq("complexity_class", "standard");
  if (options.activeOnly) query = query.in("status", ["draft", "published"]);
  const { data, error } = await query
    .order("work_item_key")
    .order("version", { ascending: false });
  if (error) unavailable("Pricebook", error.message);
  return ((data ?? []) as PricebookRow[]).map(toPricebookEntry);
}

/**
 * Ce que la page publique peut lire, et rien d'autre : des tarifs validés par
 * Ma Reliure et cochés « public ». Filtré en base **et** dans le domaine
 * (`publicPriceRows`).
 */
export async function loadPublicPricebook(sb: Supa): Promise<PricebookEntry[]> {
  const { data, error } = await sb
    .from("marketplace_pricebook")
    .select(PRICEBOOK_COLUMNS)
    .eq("status", "published")
    .eq("provenance", "ADMIN_VALIDATED")
    .eq("public_visible", true);
  if (error) unavailable("Pricebook public", error.message);
  return ((data ?? []) as PricebookRow[]).map(toPricebookEntry);
}

// ---------------------------------------------------------------------------
// Benchmark web
// ---------------------------------------------------------------------------

export async function loadWebBenchmarks(sb: Supa): Promise<WebBenchmark[]> {
  const { data, error } = await sb
    .from("marketplace_web_benchmarks")
    .select(
      "work_item_key, web_min_cents, web_reference_cents, web_max_cents, pricing_unit, open_ended_max, source_summary, researched_at, notes",
    );
  if (error) unavailable("Benchmark web", error.message);
  return (data ?? []).map((row) => ({
    workItemKey: row.work_item_key,
    webMinCents: row.web_min_cents,
    webReferenceCents: row.web_reference_cents,
    webMaxCents: row.web_max_cents,
    pricingUnit: row.pricing_unit as PricingUnit,
    openEndedMax: row.open_ended_max,
    sourceSummary: row.source_summary,
    researchedAt: row.researched_at,
    notes: row.notes,
  }));
}

// ---------------------------------------------------------------------------
// Règles : modificateurs, politique de marge, catalogue
// ---------------------------------------------------------------------------

export async function loadModifiers(sb: Supa): Promise<PricingModifier[]> {
  const { data, error } = await sb
    .from("marketplace_pricing_modifiers")
    .select(
      "id, axis, class_key, kind, percent_bps, fixed_cents, enabled, notes, updated_at, updated_by",
    )
    .order("axis")
    .order("class_key");
  if (error) unavailable("Modificateurs", error.message);
  return (data ?? []).map((row) => ({
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

/**
 * La politique de rémunération. Sans elle, aucune rémunération ne peut être
 * proposée : on refuse de chiffrer plutôt que de supposer une marge.
 */
export async function loadPricingPolicy(sb: Supa): Promise<PayoutPolicy> {
  const { data, error } = await sb
    .from("marketplace_pricing_policy")
    .select("target_margin_bps, minimum_margin_cents")
    .eq("id", 1)
    .maybeSingle();
  if (error) unavailable("Politique de rémunération", error.message);
  if (!data)
    unavailable(
      "Politique de rémunération",
      "ligne absente, rejouer la migration 20260912120000_mareliure_single_pricebook",
    );
  return { targetMarginBps: data.target_margin_bps, minimumMarginCents: data.minimum_margin_cents };
}

export async function loadWorkItemRows(sb: Supa): Promise<WorkItemState[]> {
  const { data, error } = await sb
    .from("marketplace_work_items")
    .select("key, hint, active, updated_at");
  if (error) unavailable("Catalogue", error.message);
  return (data ?? []).map((row) => ({
    key: row.key,
    hint: row.hint,
    active: row.active,
    updatedAt: row.updated_at,
  }));
}
