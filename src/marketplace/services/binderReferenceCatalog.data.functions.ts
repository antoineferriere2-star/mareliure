/**
 * Les server functions du catalogue de référence. Même patron que l'outil devis : `requireSupabaseAuth`
 * prouve qui appelle, `requireBinderId` résout SON atelier depuis la session — jamais depuis l'entrée —,
 * l'entrée est validée par un schéma strict, puis `binderReferenceCatalog.server.ts` fait le travail.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { favoriteInput, referenceServiceInput } from "@/marketplace/reference/catalogInput";
import { BinderQuotesError, requireBinderId, type BinderQuotesErrorCode } from "./binderQuotes.server";
import { addReferenceService, setServiceFavorite } from "./binderReferenceCatalog.server";

const MESSAGES: Record<BinderQuotesErrorCode, string> = {
  no_binder: "Aucun atelier n'est associé à ce compte.",
  not_found: "Introuvable.",
  conflict: "Cette action n'est plus possible.",
  invalid_input: "Les informations envoyées ne sont pas valides.",
  profile_incomplete: "Le profil de l'atelier est incomplet.",
  failed: "L'opération n'a pas pu aboutir. Réessayez.",
};

async function run<T>(userId: string, work: (binderId: string, sb: Awaited<ReturnType<typeof admin>>) => Promise<T>): Promise<T> {
  const sb = await admin();
  try {
    const binderId = await requireBinderId(sb, userId);
    return await work(binderId, sb);
  } catch (err) {
    if (err instanceof BinderQuotesError) fail(err.status, MESSAGES[err.code]);
    throw err;
  }
}

export const addMyReferenceService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => referenceServiceInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => addReferenceService(sb, binderId, data)));

export const setMyServiceFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => favoriteInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => setServiceFavorite(sb, binderId, data)));
