import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import {
  BinderQuotesError,
  requireBinderId,
  type BinderQuotesErrorCode,
} from "./binderQuotes.server";
import {
  bulkAdjustBinderPrices,
  listBinderPricingCatalog,
  resetBinderPrices,
  saveBinderPriceOverride,
  setBinderPriceFavorite,
} from "./binderPricingCatalog.server";

const messages: Record<BinderQuotesErrorCode, string> = {
  no_binder: "Aucun atelier n'est associé à ce compte.",
  not_found: "Introuvable.",
  conflict: "Cette action n'est plus possible.",
  invalid_input: "Les informations envoyées ne sont pas valides.",
  profile_incomplete: "Le profil de l'atelier est incomplet.",
  failed: "L'opération n'a pas pu aboutir. Réessayez.",
};

async function run<T>(
  userId: string,
  work: (binderId: string, sb: Awaited<ReturnType<typeof admin>>) => Promise<T>,
): Promise<T> {
  const sb = await admin();
  try {
    const binderId = await requireBinderId(sb, userId);
    return await work(binderId, sb);
  } catch (error) {
    if (error instanceof BinderQuotesError) fail(error.status, messages[error.code]);
    throw error;
  }
}

const pricingKey = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9_]+$/);
const keys = z.array(pricingKey).min(1).max(45);

export const getMyPricingCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => listBinderPricingCatalog(sb, binderId)));

export const saveMyPriceOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        pricingKey,
        unitPriceCents: z.number().int().min(0).max(100_000_000),
      })
      .strict()
      .parse(data),
  )
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => saveBinderPriceOverride(sb, binderId, data)),
  );

export const setMyBasePriceFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ pricingKey, isFavorite: z.boolean() }).strict().parse(data),
  )
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => setBinderPriceFavorite(sb, binderId, data)),
  );

export const bulkAdjustMyPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        pricingKeys: keys,
        percentBps: z.number().int().min(-9_000).max(50_000),
        source: z.enum(["base", "current"]),
      })
      .strict()
      .parse(data),
  )
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => bulkAdjustBinderPrices(sb, binderId, data)),
  );

export const resetMyPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ pricingKeys: keys }).strict().parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => resetBinderPrices(sb, binderId, data.pricingKeys)),
  );
