/**
 * Les server functions de l'outil devis → facture du relieur. Une couche fine :
 * `requireSupabaseAuth` prouve qui appelle, `requireBinderId` résout SON atelier
 * (membre actif) depuis la session — jamais depuis l'entrée —, l'entrée est
 * validée par des schémas stricts, puis `binderQuotes.server.ts` fait le travail.
 *
 * Aucune de ces fonctions ne reçoit un identifiant d'atelier, un montant total,
 * un numéro ou un statut de facture : le navigateur ne les fournit jamais.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import {
  billingProfileInput,
  categoryInput,
  clientInput,
  quoteInput,
  serviceInput,
} from "@/marketplace/quotes/quoteInput";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";
import {
  archiveService,
  BinderQuotesError,
  convertQuoteToInvoice,
  createQuote,
  getInvoice,
  getQuote,
  importStarterCatalog,
  listCatalog,
  listClients,
  listInvoices,
  listQuotes,
  loadBillingProfile,
  requireBinderId,
  saveBillingProfile,
  saveCategory,
  saveClient,
  saveService,
  setQuoteStatus,
  updateQuote,
  type BinderQuotesErrorCode,
} from "./binderQuotes.server";

const MESSAGES: Record<BinderQuotesErrorCode, string> = {
  no_binder: "Aucun atelier n'est associé à ce compte.",
  not_found: "Introuvable.",
  conflict: "Cette action n'est plus possible sur ce document.",
  invalid_input: "Les informations envoyées ne sont pas valides.",
  profile_incomplete: "profile_incomplete",
  failed: "L'opération n'a pas pu aboutir. Réessayez.",
};

/** Une erreur métier devient une réponse ; jamais le détail interne d'une requête. */
async function run<T>(userId: string, work: (binderId: string, sb: Awaited<ReturnType<typeof admin>>) => Promise<T>): Promise<T> {
  const sb = await admin();
  try {
    const binderId = await requireBinderId(sb, userId);
    return await work(binderId, sb);
  } catch (err) {
    if (err instanceof BinderQuotesError) {
      // `profile_incomplete:<ce qu'il manque>` : le relieur lit quoi renseigner.
      const message = err.code === "profile_incomplete" ? `profile_incomplete:${err.missing.join("|")}` : MESSAGES[err.code];
      fail(err.status, message);
    }
    throw err;
  }
}

const id = z.object({ id: z.string().uuid() }).strict();

// --- Profil, catalogue, clients -----------------------------------------------------

export const getBillingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => loadBillingProfile(sb, binderId)));

export const saveMyBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => billingProfileInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveBillingProfile(sb, binderId, data)));

export const getMyCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ includeArchived: z.boolean().optional() }).strict().parse(data ?? {}))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => listCatalog(sb, binderId, { includeArchived: data.includeArchived })),
  );

export const saveMyCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => categoryInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveCategory(sb, binderId, data)));

export const saveMyService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => serviceInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveService(sb, binderId, data)));

export const archiveMyService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) =>
    run(context.userId, async (binderId, sb) => {
      await archiveService(sb, binderId, data.id);
      return { ok: true as const };
    }),
  );

export const importMyStarterCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => importStarterCatalog(sb, binderId)));

export const getMyClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => listClients(sb, binderId)));

export const saveMyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => clientInput.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => saveClient(sb, binderId, data)));

// --- Devis --------------------------------------------------------------------------------

export const getMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => listQuotes(sb, binderId)));

export const getMyQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => getQuote(sb, binderId, data.id)));

export const createMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quoteInput.parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => createQuote(sb, binderId, data, todayInParis())),
  );

export const updateMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), quote: quoteInput }).strict().parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => updateQuote(sb, binderId, data.id, data.quote)),
  );

export const setMyQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.string() }).strict().parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => setQuoteStatus(sb, binderId, data.id, data.status)),
  );

// --- Factures ----------------------------------------------------------------------------------

export const convertMyQuoteToInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) =>
    run(context.userId, (binderId, sb) => convertQuoteToInvoice(sb, binderId, data.id, todayInParis())),
  );

export const getMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, (binderId, sb) => listInvoices(sb, binderId)));

export const getMyInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) => run(context.userId, (binderId, sb) => getInvoice(sb, binderId, data.id)));

// --- PDF ----------------------------------------------------------------------------------------

const safeFileName = (number: string) => number.replace(/[^A-Za-z0-9._-]/g, "_");

export const getMyQuotePdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) =>
    run(context.userId, async (binderId, sb) => {
      const quote = await getQuote(sb, binderId, data.id);
      const { base64 } = await renderDocumentPdf(quote);
      return { filename: `devis-${safeFileName(quote.number)}.pdf`, base64 };
    }),
  );

export const getMyInvoicePdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) =>
    run(context.userId, async (binderId, sb) => {
      const invoice = await getInvoice(sb, binderId, data.id);
      const { base64 } = await renderDocumentPdf(invoice);
      return { filename: `facture-${safeFileName(invoice.number)}.pdf`, base64 };
    }),
  );
