/**
 * La grille tarifaire Ma Reliure, telle qu'un administrateur la manipule.
 *
 * Chaque fonction commence par `assertAdmin` — un test le vérifie. Rien ici
 * n'est accessible à un atelier ni à un client : la grille est l'outil de
 * décision de Ma Reliure. Un atelier connaît sa rémunération par son offre, un
 * client le prix de son projet, et le benchmark web ne sort jamais d'ici.
 *
 * Aucune fonction ne modifie un prix sans geste humain : le benchmark
 * initialise la grille une fois, par la migration, et un refus d'atelier
 * s'enregistre sur le dossier sans toucher la grille.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { admin, assertAdmin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { WORK_FAMILIES, WORK_ITEMS } from "@/marketplace/pricing/catalog";
import { MAX_LINE_QUANTITY } from "@/marketplace/pricing/composition";
import { MODIFIER_AXES, MODIFIER_KINDS, validateModifier } from "@/marketplace/pricing/modifiers";
import { validatePayoutPolicy } from "@/marketplace/pricing/payout";
import { activeEntry } from "@/marketplace/pricing/pricebook";
import {
  GRID_ACTIONS,
  MAX_GRID_PRICE_CENTS,
  planPricebookChange,
  type GridChangeRequest,
  type PricebookChange,
} from "@/marketplace/pricing/pricebookChanges";
import { buildPricingGrid, gridSummary } from "@/marketplace/pricing/pricingGrid";
import { GRID_PRICING_MODES } from "@/marketplace/pricing/pricingModes";
import { STANDARD_VAT_RATE_BPS } from "@/marketplace/pricing/vat";
import { loadPricingData, toPricingGrid, type PricingData } from "./pricingContext.server";
import { recordMarketplaceEvent } from "./marketplaceEvents.server";

const workItemKeys = new Set(WORK_ITEMS.map((item) => item.key));
const catalogueKey = z
  .string()
  .refine((key) => workItemKeys.has(key), "Prestation hors catalogue");

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * La grille entière, en un appel : les lignes, leur historique, les règles de
 * calcul, et la grille en vigueur telle que le moteur la lit — le simulateur
 * compose à partir d'elle, avec la fonction qui validera un dossier.
 */
export const getPricingGrid = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const data = await loadPricingData(await admin());
    const rows = buildPricingGrid(data);
    return {
      families: WORK_FAMILIES,
      rows,
      summary: gridSummary(rows),
      history: data.entries,
      modifiers: data.modifiers,
      policy: data.policy,
      grid: toPricingGrid(data),
      vatRateBps: STANDARD_VAT_RATE_BPS,
    };
  });

// ---------------------------------------------------------------------------
// Écriture de la grille
// ---------------------------------------------------------------------------

function planChanges(data: PricingData, requests: readonly GridChangeRequest[]) {
  const changes: PricebookChange[] = [];
  const errors: string[] = [];
  for (const request of requests) {
    const planned = planPricebookChange(request, {
      entry: activeEntry(data.entries, request.workItemKey),
      benchmark: data.benchmarks.find((item) => item.workItemKey === request.workItemKey) ?? null,
    });
    if (planned.change) changes.push(planned.change);
    errors.push(...planned.errors);
  }
  return { changes, errors };
}

/**
 * Une transaction pour tous les changements : ils passent ensemble ou pas du
 * tout. Une ligne modifiée par quelqu'un d'autre depuis l'ouverture de la
 * grille fait tout refuser, plutôt que d'écraser sa décision.
 */
async function writeChanges(
  sb: Supa,
  changes: readonly PricebookChange[],
  changeReason: string | null,
  actorUserId: string,
): Promise<number> {
  const { data, error } = await sb.rpc("marketplace_save_pricebook_changes", {
    p_changes: changes as unknown as Json,
    p_change_reason: changeReason ?? undefined,
    p_actor_user_id: actorUserId,
  });
  if (error)
    fail(
      409,
      error.code === "40001"
        ? "Un tarif a été modifié entre-temps : rechargez la grille avant d'enregistrer."
        : error.message,
    );
  return (data ?? []).length;
}

const changeRequest = z.object({
  workItemKey: catalogueKey,
  action: z.enum(GRID_ACTIONS),
  priceTtcCents: z.number().int().positive().max(MAX_GRID_PRICE_CENTS).nullable().optional(),
  pricingMode: z.enum(GRID_PRICING_MODES).optional(),
  publicVisible: z.boolean().optional(),
});

/** Enregistre des tarifs, des validations, des retours à la référence web. */
export const savePricebookChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        changes: z
          .array(changeRequest)
          .min(1)
          .max(100)
          .refine(
            (list) => new Set(list.map((change) => change.workItemKey)).size === list.length,
            "Une prestation n'apparaît qu'une fois par enregistrement.",
          ),
        changeReason: z.string().trim().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { changes, errors } = planChanges(await loadPricingData(sb), data.changes);
    if (errors.length > 0) fail(422, errors.join(" "));
    return { saved: await writeChanges(sb, changes, data.changeReason || null, context.userId) };
  });

/**
 * « Valider la grille initiale » : toutes les références web encore en
 * brouillon deviennent des tarifs Ma Reliure, en une transaction.
 *
 * Deux verrous contre le geste involontaire : une confirmation écrite, et le
 * nombre de lignes que l'écran montrait — si la grille a bougé entre-temps,
 * rien n'est validé.
 */
export const validateInitialGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        expectedCount: z.number().int().min(1).max(100),
        confirmation: z.literal("VALIDER"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const pricing = await loadPricingData(sb);
    const drafts = pricing.entries.filter((entry) => entry.status === "draft");
    if (drafts.length !== data.expectedCount)
      fail(409, "La grille a changé depuis son ouverture : rechargez-la avant de valider.");
    const { changes, errors } = planChanges(
      pricing,
      drafts.map((entry) => ({ workItemKey: entry.workItemKey, action: "validate" as const })),
    );
    if (errors.length > 0) fail(422, errors.join(" "));
    return {
      validated: await writeChanges(
        sb,
        changes,
        "Validation de la grille initiale.",
        context.userId,
      ),
    };
  });

/**
 * Active ou désactive une prestation. Une prestation désactivée n'est plus
 * proposée et sort du calcul automatique ; son tarif et son historique restent.
 */
export const updateWorkItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        key: catalogueKey,
        hint: z.string().trim().max(300).nullable().optional(),
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
    if (!before) fail(404, "Prestation absente de la base : rejouer la migration du catalogue.");

    const hint = data.hint === undefined ? before.hint : data.hint || null;
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
// Règles de calcul
// ---------------------------------------------------------------------------

/** Pose un modificateur de format ou de complexité, appliqué au total du projet. */
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
      type: "pricing_policy_updated",
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

/**
 * La marge que Ma Reliure garde sur un projet, et donc la rémunération qu'elle
 * propose aux ateliers. Ne change aucun dossier déjà validé : chaque
 * photographie garde la politique sous laquelle elle a été prise.
 */
export const savePricingPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        targetMarginBps: z.number().int(),
        minimumMarginCents: z.number().int(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const errors = validatePayoutPolicy(data);
    if (errors.length > 0) fail(422, errors.join(" "));
    const sb = await admin();
    const { data: before } = await sb
      .from("marketplace_pricing_policy")
      .select("target_margin_bps, minimum_margin_cents")
      .eq("id", 1)
      .maybeSingle();
    if (!before) fail(404, "Politique absente : rejouer la migration 20260912120000.");
    const { error } = await sb
      .from("marketplace_pricing_policy")
      .update({
        target_margin_bps: data.targetMarginBps,
        minimum_margin_cents: data.minimumMarginCents,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", 1);
    if (error) fail(500, error.message);
    await recordMarketplaceEvent(sb, {
      type: "pricing_policy_updated",
      actorUserId: context.userId,
      metadata: {
        policy: {
          before: {
            target_margin_bps: before.target_margin_bps,
            minimum_margin_cents: before.minimum_margin_cents,
          },
          after: {
            target_margin_bps: data.targetMarginBps,
            minimum_margin_cents: data.minimumMarginCents,
          },
        },
      },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Composition d'un dossier
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
