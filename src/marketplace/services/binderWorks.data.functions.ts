/**
 * Les server functions des contacts et des ouvrages de l'atelier. Même patron que l'outil devis
 * (binderQuotes.data.functions.ts) : `requireSupabaseAuth` prouve qui appelle, `requireBinderId`
 * résout SON atelier depuis la session — jamais depuis l'entrée —, l'entrée est validée par des
 * schémas stricts, puis `binderWorks.server.ts` fait le travail.
 *
 * Aucune de ces fonctions ne reçoit un identifiant d'atelier, une référence d'ouvrage, une
 * source ou une origine : le navigateur ne les fournit jamais.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { contactInput, idInput, workInput, worksFilterInput } from "@/marketplace/works/workInput";
import { BinderQuotesError, requireBinderId, type BinderQuotesErrorCode } from "./binderQuotes.server";
import {
  getContact,
  getWork,
  listContacts,
  listWorks,
  saveContact,
  saveWork,
  setContactArchived,
  setWorkArchived,
} from "./binderWorks.server";

const MESSAGES: Record<BinderQuotesErrorCode, string> = {
  no_binder: "Aucun atelier n'est associé à ce compte.",
  not_found: "Introuvable.",
  conflict: "Cette action n'est plus possible.",
  invalid_input: "Les informations envoyées ne sont pas valides.",
  profile_incomplete: "Le profil de l'atelier est incomplet.",
  failed: "L'opération n'a pas pu aboutir. Réessayez.",
};

/** Une erreur métier devient une réponse ; jamais le détail interne d'une requête. */
async function run<T>(
  userId: string,
  work: (binderId: string, sb: Awaited<ReturnType<typeof admin>>) => Promise<T>,
): Promise<T> {
  const sb = await admin();
  try {
    const binderId = await requireBinderId(sb, userId);
    return await work(binderId, sb);
  } catch (err) {
    if (err instanceof BinderQuotesError) fail(err.status, MESSAGES[err.code]);
    throw err;
  }
}

const withArchived = worksFilterInput.pick({ includeArchived: true });

// --- Contacts ------------------------------------------------------------------------------

export const getMyContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withArchived.parse(data ?? {}))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => listContacts(sb, binderId, { includeArchived: data.includeArchived })),
  );

export const getMyContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => getContact(sb, binderId, data.id)));

export const saveMyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => contactInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveContact(sb, binderId, data)));

export const setMyContactArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.extend({ archived: z.boolean() }).parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => setContactArchived(sb, binderId, data.id, data.archived)),
  );

// --- Ouvrages -------------------------------------------------------------------------------

export const getMyWorks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => worksFilterInput.parse(data ?? {}))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) =>
      listWorks(sb, binderId, { contactId: data.contactId, includeArchived: data.includeArchived }),
    ),
  );

export const getMyWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => getWork(sb, binderId, data.id)));

export const saveMyWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => workInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveWork(sb, binderId, data)));

export const setMyWorkArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.extend({ archived: z.boolean() }).parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => setWorkArchived(sb, binderId, data.id, data.archived)),
  );
