/**
 * La console de prix, telle qu'un administrateur la manipule.
 *
 * Séparée de `marketplace.data.functions.ts` parce que ce sont deux métiers :
 * là-bas on fait avancer des dossiers, ici on construit une connaissance et on
 * arrête des prix. Chaque fonction commence par `assertAdmin` — un test le
 * vérifie — et rien ici n'est accessible à un relieur ni à un client : le
 * référentiel est un actif interne, et la grille d'un atelier ne regarde pas
 * ses confrères.
 *
 * Trois couches, jamais fusionnées : le benchmark se consulte, les grilles se
 * relèvent, le Pricebook se publie. Aucune fonction ne fait passer un montant
 * de l'une à l'autre.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import {
  COMPLEXITY_CLASSES,
  SIZE_CLASSES,
  WORK_FAMILIES,
  WORK_ITEMS,
} from "@/marketplace/pricing/catalog";
import { PRICE_BASES, validateBenchmark } from "@/marketplace/pricing/benchmark";
import { composePrice, MAX_LINE_QUANTITY } from "@/marketplace/pricing/composition";
import { MODIFIER_AXES, MODIFIER_KINDS, validateModifier } from "@/marketplace/pricing/modifiers";
import { PRICING_METHODS } from "@/marketplace/pricing/pricebook";
import { preparePricebookEntry } from "@/marketplace/pricing/pricebookInput";
import { COMPOSITION_POLICY, PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import { PRICING_MODES } from "@/marketplace/pricing/pricingModes";
import { RATE_SOURCES, rateProvenanceFor } from "@/marketplace/pricing/provenance";
import { validateRate } from "@/marketplace/pricing/rateCard";
import { referencesFor } from "@/marketplace/pricing/references";
import { STANDARD_VAT_RATE_BPS } from "@/marketplace/pricing/vat";
import { loadPricingContext, referencesForWork } from "./pricingContext.server";
import {
  loadBinderRates,
  loadWorkItemRows,
  recordMarketplaceEvent,
  toPricebookEntry,
} from "./pricingRepository.server";

const sizeClass = z.enum(SIZE_CLASSES);
const complexityClass = z.enum(COMPLEXITY_CLASSES);
const workItemKeys = new Set(WORK_ITEMS.map((item) => item.key));
const catalogueKey = z.string().refine((key) => workItemKeys.has(key), "Travail hors catalogue");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

// ---------------------------------------------------------------------------
// Lecture : toute la console en un appel
// ---------------------------------------------------------------------------

/**
 * Ce que la console affiche, dans ses cinq vues.
 *
 * Un seul appel plutôt qu'un par vue : les vues se renvoient l'une à l'autre
 * (un trou du catalogue mène au benchmark, une alerte de marge au Pricebook),
 * et elles doivent parler des mêmes chiffres au même instant.
 */
export const getPricingConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [pricing, workItemRows, bindersResult] = await Promise.all([
      loadPricingContext(sb),
      loadWorkItemRows(sb),
      sb
        .from("marketplace_binders")
        .select("id, display_name, workshop_name, city, status, is_demo")
        .order("display_name"),
    ]);

    const now = new Date();
    const dbItems = new Map(workItemRows.map((row) => [row.key, row]));

    const catalogue = WORK_ITEMS.map((item) => {
      const db = dbItems.get(item.key);
      const itemAggregates = pricing.aggregates.filter((a) => a.workItemKey === item.key);
      const references = referencesFor({
        workItemKey: item.key,
        sizeClass: "standard",
        complexityClass: "standard",
        aggregates: pricing.aggregates,
        benchmarkAggregates: pricing.benchmarkAggregates,
        entries: pricing.published,
        drift: pricing.driftSignals,
        now,
      });
      return {
        key: item.key,
        label: item.label,
        family: item.family,
        role: item.role,
        requiresStudy: item.requiresStudy === true,
        hint: db?.hint ?? item.hint ?? null,
        active: db?.active ?? true,
        updatedAt: db?.updatedAt ?? null,
        binderCombinationCount: itemAggregates.length,
        maxBinderReferences: Math.max(0, ...itemAggregates.map((a) => a.referenceCount)),
        benchmarkSourceCount: new Set(
          pricing.benchmarks
            .filter((benchmark) => benchmark.workItemKey === item.key)
            .map((benchmark) => benchmark.sourceUrl),
        ).size,
        publishedCount: pricing.published.filter((entry) => entry.workItemKey === item.key).length,
        evidence: references.evidence,
      };
    });

    const rateCountByBinder = new Map<string, number>();
    for (const rate of pricing.rates)
      rateCountByBinder.set(rate.binderId, (rateCountByBinder.get(rate.binderId) ?? 0) + 1);

    return {
      families: WORK_FAMILIES,
      catalogue,
      aggregates: pricing.aggregates,
      benchmarks: pricing.benchmarks,
      benchmarkAggregates: pricing.benchmarkAggregates,
      pricebook: pricing.pricebook,
      modifiers: pricing.modifiers,
      drift: pricing.drift.map((item) => ({
        entryId: item.entry.id,
        workItemKey: item.entry.workItemKey,
        sizeClass: item.entry.sizeClass,
        complexityClass: item.entry.complexityClass,
        severity: item.severity,
        driftBps: item.driftBps,
        observedMedianCents: item.observedMedianCents,
        referenceCount: item.referenceCount,
        message: item.message,
      })),
      binders: (bindersResult.data ?? []).map((binder) => ({
        id: binder.id,
        name: binder.workshop_name ?? binder.display_name,
        city: binder.city,
        status: binder.status,
        isDemo: binder.is_demo,
        activeRateCount: rateCountByBinder.get(binder.id) ?? 0,
      })),
      rateCount: pricing.rates.length,
      binderCount: rateCountByBinder.size,
      policy: {
        version: PRICING_POLICY.version,
        targetMarginBps: PRICING_POLICY.targetMarginBps,
        minimumMarginCents: PRICING_POLICY.minimumMarginCents,
        standardVatRateBps: STANDARD_VAT_RATE_BPS,
      },
    };
  });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Le catalogue s'annote, il ne se redéfinit pas.
 *
 * Les clés, les familles, les rôles et « sur étude » appartiennent au code :
 * le moteur et les grilles les lisent. L'administration peut préciser ce
 * qu'un travail recouvre et le retirer des listes de saisie — pas le renommer
 * ni le rendre chiffrable s'il se fait sur étude.
 */
export const updateWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        key: catalogueKey,
        hint: z.string().trim().max(300).nullable(),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: before } = await sb
      .from("marketplace_work_items")
      .select("hint, active")
      .eq("key", data.key)
      .maybeSingle();
    if (!before) fail(404, "Travail absent de la base : rejouer la migration du catalogue.");

    const hint = data.hint === "" ? null : data.hint;
    const { error } = await sb
      .from("marketplace_work_items")
      .update({
        hint,
        active: data.active,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("key", data.key);
    if (error) fail(500, error.message);

    await recordMarketplaceEvent(sb, {
      type: "pricing_work_item_updated",
      actorUserId: context.userId,
      metadata: {
        work_item_key: data.key,
        before: { hint: before.hint, active: before.active },
        after: { hint, active: data.active },
      },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Benchmark marché
// ---------------------------------------------------------------------------

export const saveBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workItemKey: catalogueKey,
        sizeClass: sizeClass.nullable(),
        complexityClass: complexityClass.nullable().default(null),
        lowPriceCents: z.number().int().positive(),
        highPriceCents: z.number().int().positive(),
        unitLabel: z.string().trim().max(40).nullable().default(null),
        priceBasis: z.enum(PRICE_BASES),
        formatLabel: z.string().trim().max(80).nullable().default(null),
        sourceName: z.string().trim().min(1).max(120),
        sourceUrl: z.string().trim().url().max(500),
        sourceExcerpt: z.string().trim().min(1).max(400),
        observedAt: isoDate,
        notes: z.string().trim().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const errors = validateBenchmark(data);
    if (errors.length > 0) fail(422, errors.join(" "));
    const sb = await admin();
    const { data: row, error } = await sb
      .from("marketplace_price_benchmarks")
      .insert({
        work_item_key: data.workItemKey,
        size_class: data.sizeClass,
        complexity_class: data.complexityClass,
        low_price_cents: data.lowPriceCents,
        high_price_cents: data.highPriceCents,
        unit_label: data.unitLabel || null,
        price_basis: data.priceBasis,
        format_label: data.formatLabel || null,
        source_name: data.sourceName,
        source_url: data.sourceUrl,
        source_excerpt: data.sourceExcerpt,
        observed_at: data.observedAt,
        provenance: "WEB_BENCHMARK",
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error)
      fail(
        error.code === "23505" ? 409 : 500,
        error.code === "23505" ? "Ce relevé existe déjà." : error.message,
      );
    return { id: row.id };
  });

export const retireBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ benchmarkId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("marketplace_price_benchmarks")
      .update({ status: "retired" })
      .eq("id", data.benchmarkId);
    if (error) fail(500, error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Tarifs artisans
// ---------------------------------------------------------------------------

export const getBinderRateCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ binderId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: binder } = await sb
      .from("marketplace_binders")
      .select("id, display_name, workshop_name, city")
      .eq("id", data.binderId)
      .maybeSingle();
    if (!binder) fail(404, "Atelier introuvable");
    return { binder, rates: await loadBinderRates(sb, data.binderId) };
  });

const rateInput = z.object({
  binderId: z.string().uuid(),
  workItemKey: catalogueKey,
  minimumPayoutCents: z.number().int().positive(),
  typicalPayoutCents: z.number().int().positive(),
  maximumPayoutCents: z.number().int().positive(),
  estimatedHours: z.number().positive().max(500).nullable().default(null),
  sizeClass: sizeClass.default("standard"),
  complexityClass: complexityClass.default("standard"),
  notes: z.string().trim().max(500).nullable().default(null),
  source: z.enum(RATE_SOURCES).default("binder_interview"),
  /**
   * `verified` dit qu'un humain a entendu ce tarif de la bouche du relieur.
   * C'est ce qui fait passer la ligne en `REAL_VERIFIED`, donc ce qui la rend
   * comptable dans une médiane. Jamais coché par défaut.
   */
  verified: z.boolean().default(false),
});

/**
 * Enregistre une ligne de grille.
 *
 * Ne modifie jamais une ligne existante : elle est marquée `superseded` et une
 * nouvelle est écrite. Le référentiel est un historique, pas un état — savoir
 * qu'un atelier a monté ses tarifs de 15 % en un an vaut plus que connaître
 * son tarif du jour.
 */
export const saveBinderRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rateInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const errors = validateRate(data);
    if (errors.length > 0) fail(422, errors.join(" "));
    const sb = await admin();
    const now = new Date().toISOString();

    const { data: previous } = await sb
      .from("marketplace_binder_rates")
      .select("id, typical_payout_cents")
      .eq("binder_id", data.binderId)
      .eq("work_item_key", data.workItemKey)
      .eq("size_class", data.sizeClass)
      .eq("complexity_class", data.complexityClass)
      .eq("status", "active")
      .maybeSingle();

    await sb
      .from("marketplace_binder_rates")
      .update({ status: "superseded" })
      .eq("binder_id", data.binderId)
      .eq("work_item_key", data.workItemKey)
      .eq("size_class", data.sizeClass)
      .eq("complexity_class", data.complexityClass)
      .eq("status", "active");

    const provenance = rateProvenanceFor({ verified: data.verified, source: data.source });
    const { data: row, error } = await sb
      .from("marketplace_binder_rates")
      .insert({
        binder_id: data.binderId,
        work_item_key: data.workItemKey,
        minimum_payout_cents: data.minimumPayoutCents,
        typical_payout_cents: data.typicalPayoutCents,
        maximum_payout_cents: data.maximumPayoutCents,
        estimated_hours: data.estimatedHours,
        size_class: data.sizeClass,
        complexity_class: data.complexityClass,
        notes: data.notes,
        status: "active",
        source: data.source,
        provenance,
        verified_at: data.verified ? now : null,
        verified_by: data.verified ? context.userId : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);

    await recordMarketplaceEvent(sb, {
      type: previous ? "binder_rate_updated" : "binder_rate_created",
      actorUserId: context.userId,
      binderId: data.binderId,
      metadata: {
        rate_id: row.id,
        previous_rate_id: previous?.id ?? null,
        work_item_key: data.workItemKey,
        size_class: data.sizeClass,
        complexity_class: data.complexityClass,
        typical_payout_cents: data.typicalPayoutCents,
        previous_typical_payout_cents: previous?.typical_payout_cents ?? null,
        provenance,
        source: data.source,
      },
    });
    return { id: row.id, provenance };
  });

export const removeBinderRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rateId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: rate } = await sb
      .from("marketplace_binder_rates")
      .select("binder_id, work_item_key, size_class, complexity_class")
      .eq("id", data.rateId)
      .maybeSingle();
    if (!rate) fail(404, "Ligne de grille introuvable");
    const { error } = await sb
      .from("marketplace_binder_rates")
      .update({ status: "superseded" })
      .eq("id", data.rateId);
    if (error) fail(500, error.message);
    await recordMarketplaceEvent(sb, {
      type: "binder_rate_updated",
      actorUserId: context.userId,
      binderId: rate.binder_id,
      metadata: {
        rate_id: data.rateId,
        removed: true,
        work_item_key: rate.work_item_key,
        size_class: rate.size_class,
        complexity_class: rate.complexity_class,
      },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Simulateur
// ---------------------------------------------------------------------------

export const pricingLinesInput = z
  .array(
    z.object({
      workItemKey: catalogueKey,
      quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    }),
  )
  .min(1)
  .max(30);

/**
 * Le simulateur : une composition, un résultat immédiat.
 *
 * Il compose à partir du Pricebook exactement comme la validation d'un dossier
 * — même fonction, mêmes données — et place à côté de chaque ligne ce que
 * disent les ateliers et le web. Il n'écrit rien d'autre qu'un événement.
 */
export const simulatePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        lines: pricingLinesInput,
        sizeClass: sizeClass.default("standard"),
        complexityClass: complexityClass.default("standard"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const pricing = await loadPricingContext(sb);

    const composition = composePrice({
      lines: data.lines,
      sizeClass: data.sizeClass,
      complexityClass: data.complexityClass,
      entries: pricing.published,
      modifiers: pricing.modifiers,
      policy: COMPOSITION_POLICY,
    });
    const references = referencesForWork(
      pricing,
      data.lines.map((line) => line.workItemKey),
      data.sizeClass,
      data.complexityClass,
    );

    await recordMarketplaceEvent(sb, {
      type: "pricing_simulated",
      actorUserId: context.userId,
      metadata: {
        lines: data.lines,
        size_class: data.sizeClass,
        complexity_class: data.complexityClass,
        status: composition.status,
        payout_cents: composition.payoutCents,
        price_ht_cents: composition.priceHtCents,
        margin_status: composition.margin?.status ?? null,
      },
    });

    return { composition, references, vatRateBps: STANDARD_VAT_RATE_BPS };
  });

// ---------------------------------------------------------------------------
// Pricebook
// ---------------------------------------------------------------------------

export const pricebookEntryInput = z.object({
  workItemKey: catalogueKey,
  sizeClass: sizeClass.default("standard"),
  complexityClass: complexityClass.default("standard"),
  pricingMode: z.enum(PRICING_MODES).default("FIXED"),
  referenceBinderPayoutCents: z.number().int().positive().nullable(),
  customerPriceHtCents: z.number().int().positive().nullable(),
  priceHtHighCents: z.number().int().positive().nullable().default(null),
  unitLabel: z.string().trim().max(40).nullable().default(null),
  vatRateBps: z.number().int().min(0).max(10_000).default(STANDARD_VAT_RATE_BPS),
  targetMarginBps: z.number().int().min(0).max(9_999).default(PRICING_POLICY.targetMarginBps),
  minimumMarginCents: z.number().int().min(0).nullable().default(null),
  includedWorkItems: z.array(catalogueKey).max(20).default([]),
  publicVisible: z.boolean().default(false),
  pricingMethod: z.enum(PRICING_METHODS).default("manual"),
  notes: z.string().trim().max(500).nullable().default(null),
  changeReason: z.string().trim().max(500).nullable().default(null),
});

/**
 * Publie une entrée de Pricebook.
 *
 * Le seul chemin par lequel un prix devient vendable, et il exige un geste
 * humain : rien ne publie tout seul, `detectDrift` ne fait que signaler, le
 * benchmark ne fait que situer. La marge ne bloque pas — elle est rendue avec
 * son état pour que l'écran l'ait montrée. Seules les incohérences refusent.
 *
 * La publication elle-même est atomique, en base : l'ancienne version est
 * retirée, la nouvelle écrite et l'événement `pricebook_updated` posé dans la
 * même transaction.
 */
export const publishPricebookEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => pricebookEntryInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const pricing = await loadPricingContext(sb);

    const history = pricing.pricebook.filter(
      (entry) =>
        entry.workItemKey === data.workItemKey &&
        entry.sizeClass === data.sizeClass &&
        entry.complexityClass === data.complexityClass,
    );
    const unitLabel = data.unitLabel?.trim() || null;
    const prepared = preparePricebookEntry(
      { ...data, unitLabel },
      {
        hasPreviousVersion: history.length > 0,
        policyMinimumMarginCents: PRICING_POLICY.minimumMarginCents,
      },
    );
    if (prepared.errors.length > 0) fail(422, prepared.errors.join(" "));

    const aggregate = pricing.aggregates.find(
      (a) =>
        a.workItemKey === data.workItemKey &&
        a.sizeClass === data.sizeClass &&
        a.complexityClass === data.complexityClass,
    );

    const { data: row, error } = await sb.rpc("marketplace_publish_pricebook_entry", {
      p_work_item_key: data.workItemKey,
      p_size_class: data.sizeClass,
      p_complexity_class: data.complexityClass,
      p_pricing_mode: data.pricingMode,
      p_pricing_method: data.pricingMethod,
      p_reference_binder_payout_cents: data.referenceBinderPayoutCents,
      p_customer_price_cents: data.customerPriceHtCents,
      p_price_ht_high_cents: data.priceHtHighCents,
      p_unit_label: unitLabel,
      p_vat_rate_bps: data.vatRateBps,
      p_customer_price_ttc_cents: prepared.customerPriceTtcCents,
      p_target_margin_bps: data.targetMarginBps,
      p_minimum_margin_cents: data.minimumMarginCents,
      p_included_work_items: data.includedWorkItems,
      p_public_visible: data.publicVisible,
      p_reference_count: aggregate?.referenceCount ?? 0,
      p_notes: data.notes || null,
      p_change_reason: data.changeReason || null,
      p_actor_user_id: context.userId,
    });
    if (error || !row) fail(409, error?.message ?? "Publication refusée.");

    return {
      entry: toPricebookEntry(row as Parameters<typeof toPricebookEntry>[0]),
      margin: prepared.margin,
    };
  });

/**
 * Pose un modificateur de format ou de complexité.
 *
 * Tracé comme une modification du Pricebook, parce qu'il en déplace les prix
 * pour toutes les classes qu'aucune entrée exacte ne couvre.
 */
export const saveModifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        axis: z.enum(MODIFIER_AXES),
        classKey: z.string(),
        kind: z.enum(MODIFIER_KINDS),
        percentBps: z.number().int().nullable(),
        fixedCents: z.number().int().nullable(),
        enabled: z.boolean(),
        notes: z.string().trim().max(300).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const errors = validateModifier(data);
    if (errors.length > 0) fail(422, errors.join(" "));
    const sb = await admin();
    const { error } = await sb.from("marketplace_pricing_modifiers").upsert(
      {
        axis: data.axis,
        class_key: data.classKey,
        kind: data.kind,
        percent_bps: data.percentBps,
        fixed_cents: data.fixedCents,
        enabled: data.enabled,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "axis,class_key" },
    );
    if (error) fail(500, error.message);
    await recordMarketplaceEvent(sb, {
      type: "pricebook_updated",
      actorUserId: context.userId,
      metadata: {
        modifier: {
          axis: data.axis,
          class_key: data.classKey,
          kind: data.kind,
          percent_bps: data.percentBps,
          fixed_cents: data.fixedCents,
          enabled: data.enabled,
        },
      },
    });
    return { ok: true };
  });
