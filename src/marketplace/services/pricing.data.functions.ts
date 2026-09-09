/**
 * Le référentiel tarifaire, tel qu'un administrateur le manipule.
 *
 * Séparé de `marketplace.data.functions.ts` parce que ce sont deux métiers :
 * là-bas on fait avancer des dossiers, ici on construit une connaissance. Rien
 * de ce fichier n'est accessible à un relieur ni à un client — le référentiel
 * est un actif interne, et la grille d'un atelier ne regarde pas ses confrères.
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
  workItemLabel,
} from "@/marketplace/pricing/catalog";
import { RATE_SOURCES } from "@/marketplace/pricing/provenance";
import { validateRate } from "@/marketplace/pricing/rateCard";
import { detectDrift, customerPriceForMargin, marginOf } from "@/marketplace/pricing/pricebook";
import { PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import {
  aggregatesFrom,
  loadActiveRates,
  loadBinderRates,
  loadPricebook,
} from "./pricingRepository.server";

const sizeClass = z.enum(SIZE_CLASSES);
const complexityClass = z.enum(COMPLEXITY_CLASSES);
const workItemKeys = new Set(WORK_ITEMS.map((item) => item.key));

/** Le catalogue tel qu'il est offert à la saisie, familles comprises. */
export const getWorkCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return {
      families: WORK_FAMILIES.map((family) => ({
        ...family,
        items: WORK_ITEMS.filter((item) => item.family === family.key),
      })),
      sizeClasses: SIZE_CLASSES,
      complexityClasses: COMPLEXITY_CLASSES,
      sources: RATE_SOURCES,
    };
  });

/**
 * Ce que le référentiel sait aujourd'hui, travail par travail.
 *
 * C'est l'écran qui répond à « avons-nous assez de références pour vendre
 * ça ? ». Il montre donc autant les travaux couverts que ceux qui ne le sont
 * pas : un trou dans le référentiel est une information, pas une ligne
 * absente.
 */
export const getRateAggregates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const rates = await loadActiveRates(sb);
    const aggregates = aggregatesFrom(rates);
    const pricebook = await loadPricebook(sb, false);

    const covered = new Set(aggregates.map((a) => a.workItemKey));
    return {
      aggregates,
      pricebook,
      drift: detectDrift(pricebook, aggregates),
      uncovered: WORK_ITEMS.filter((item) => !covered.has(item.key)).map((item) => ({
        key: item.key,
        label: item.label,
        family: item.family,
      })),
      binderCount: new Set(rates.map((rate) => rate.binderId)).size,
      rateCount: rates.length,
    };
  });

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
  workItemKey: z.string().refine((key) => workItemKeys.has(key), "Travail hors catalogue"),
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

    await sb
      .from("marketplace_binder_rates")
      .update({ status: "superseded" })
      .eq("binder_id", data.binderId)
      .eq("work_item_key", data.workItemKey)
      .eq("size_class", data.sizeClass)
      .eq("complexity_class", data.complexityClass)
      .eq("status", "active");

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
        provenance: data.verified ? "REAL_VERIFIED" : "ADMIN_VALIDATED",
        verified_at: data.verified ? now : null,
        verified_by: data.verified ? context.userId : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) fail(500, error.message);
    return { id: row.id };
  });

export const removeBinderRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ rateId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb
      .from("marketplace_binder_rates")
      .update({ status: "superseded" })
      .eq("id", data.rateId);
    if (error) fail(500, error.message);
    return { ok: true };
  });

/**
 * Le simulateur : un panier de travaux, un résultat immédiat.
 *
 * Il ne passe pas par le moteur de dossier, parce qu'il ne part pas d'un
 * projet mais d'une sélection à la main — c'est l'outil qu'on ouvre en face
 * d'un relieur pour lui montrer comment on construit son prix. Il lit
 * exactement les mêmes agrégats.
 */
export const simulatePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workItemKeys: z.array(z.string()).min(1).max(20),
        sizeClass: sizeClass.default("standard"),
        complexityClass: complexityClass.default("standard"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const aggregates = aggregatesFrom(await loadActiveRates(sb));

    const components = [];
    const missing: string[] = [];
    for (const key of data.workItemKeys) {
      const exact = aggregates.find(
        (a) =>
          a.workItemKey === key &&
          a.sizeClass === data.sizeClass &&
          a.complexityClass === data.complexityClass,
      );
      const fallback = aggregates.find(
        (a) =>
          a.workItemKey === key && a.sizeClass === "standard" && a.complexityClass === "standard",
      );
      const found = exact ?? fallback;
      if (!found) {
        missing.push(key);
        continue;
      }
      components.push({
        workItemKey: key,
        label: workItemLabel(key),
        referencePayoutCents: found.medianCents,
        lowCents: found.minimumCents,
        highCents: found.maximumCents,
        referenceCount: found.referenceCount,
        approximated: exact === undefined,
        approximationNote: exact === undefined ? "tarif du format courant" : null,
      });
    }

    if (components.length === 0)
      return {
        status: "manual_review" as const,
        components,
        missing,
        payoutCents: null,
        customerPriceCents: null,
        lowCents: null,
        highCents: null,
        marginCents: null,
        marginBps: null,
        referenceCount: 0,
      };

    const payoutCents = components.reduce((sum, c) => sum + c.referencePayoutCents, 0);
    const customerPriceCents = customerPriceForMargin(
      payoutCents,
      PRICING_POLICY.targetMarginBps,
      PRICING_POLICY.roundingIncrementCents,
    );
    const { marginCents, marginBps } = marginOf(customerPriceCents, payoutCents);

    return {
      // Une seule ligne non tarifée suffit à ne pas conclure : un panier
      // partiel donnerait un total qui a l'air complet.
      status: missing.length > 0 ? ("manual_review" as const) : ("suggested" as const),
      components,
      missing,
      payoutCents,
      customerPriceCents,
      lowCents: customerPriceForMargin(
        components.reduce((sum, c) => sum + c.lowCents, 0),
        PRICING_POLICY.targetMarginBps,
        PRICING_POLICY.roundingIncrementCents,
      ),
      highCents: customerPriceForMargin(
        components.reduce((sum, c) => sum + c.highCents, 0),
        PRICING_POLICY.targetMarginBps,
        PRICING_POLICY.roundingIncrementCents,
      ),
      marginCents,
      marginBps,
      referenceCount: Math.min(...components.map((c) => c.referenceCount)),
    };
  });

/**
 * Publie une entrée de Pricebook.
 *
 * Le seul chemin par lequel un prix devient vendable. Il exige un geste humain
 * : rien dans le système ne publie tout seul, et `detectDrift` ne fait que
 * signaler. C'est la garantie qu'un relieur qui change ses tarifs ne peut pas
 * déplacer un prix de vente sans que personne ne l'ait décidé.
 */
export const publishPricebookEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workItemKey: z.string().refine((key) => workItemKeys.has(key), "Travail hors catalogue"),
        sizeClass: sizeClass.default("standard"),
        complexityClass: complexityClass.default("standard"),
        referenceBinderPayoutCents: z.number().int().positive(),
        customerPriceCents: z.number().int().positive(),
        notes: z.string().trim().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.referenceBinderPayoutCents > data.customerPriceCents)
      fail(422, "La rémunération de référence ne peut pas dépasser le prix client.");
    const sb = await admin();
    const now = new Date().toISOString();

    const aggregates = aggregatesFrom(await loadActiveRates(sb));
    const aggregate = aggregates.find(
      (a) =>
        a.workItemKey === data.workItemKey &&
        a.sizeClass === data.sizeClass &&
        a.complexityClass === data.complexityClass,
    );

    // Une entrée publiée est figée : on retire l'ancienne et on en écrit une
    // nouvelle avec sa version. L'historique dit quel prix était en vigueur
    // le jour d'une commande.
    const { data: previous } = await sb
      .from("marketplace_pricebook")
      .select("version")
      .eq("work_item_key", data.workItemKey)
      .eq("size_class", data.sizeClass)
      .eq("complexity_class", data.complexityClass)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    await sb
      .from("marketplace_pricebook")
      .update({ status: "retired" })
      .eq("work_item_key", data.workItemKey)
      .eq("size_class", data.sizeClass)
      .eq("complexity_class", data.complexityClass)
      .eq("status", "published");

    const { marginCents, marginBps } = marginOf(
      data.customerPriceCents,
      data.referenceBinderPayoutCents,
    );
    const { error } = await sb.from("marketplace_pricebook").insert({
      work_item_key: data.workItemKey,
      size_class: data.sizeClass,
      complexity_class: data.complexityClass,
      reference_binder_payout_cents: data.referenceBinderPayoutCents,
      customer_price_cents: data.customerPriceCents,
      target_margin_cents: marginCents,
      target_margin_bps: marginBps,
      pricing_method: "margin_target",
      version: (previous?.version ?? 0) + 1,
      status: "published",
      reference_count_at_validation: aggregate?.referenceCount ?? 0,
      notes: data.notes,
      validated_at: now,
      validated_by: context.userId,
    });
    if (error) fail(500, error.message);
    return { ok: true, version: (previous?.version ?? 0) + 1 };
  });
