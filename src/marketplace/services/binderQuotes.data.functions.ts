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
import { duplicateQuoteInput } from "@/marketplace/quotes/duplicateQuote";
import {
  billingProfileInput,
  categoryInput,
  clientInput,
  quoteInput,
  serviceInput,
} from "@/marketplace/quotes/quoteInput";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";
import { BASE_PRICE_REFERENCE_VERSION } from "@/marketplace/pricing/basePrices";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import {
  archiveService,
  BinderQuotesError,
  convertQuoteToInvoice,
  createQuote,
  getInvoice,
  getQuote,
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

/**
 * Le tarif de base est une suggestion Ma Reliure à copier dans le devis. Il ne
 * crée ni ne modifie une prestation de l'atelier : le montant reste un
 * snapshot de la ligne, éditable avant enregistrement.
 */
export const getMyBasePriceServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    run(context.userId, async (_binderId, sb) => {
      const { data, error } = await sb
        .from("marketplace_reference_default_prices")
        .select("pricing_key, default_unit_price_cents, unit, pricing_mode")
        .eq("reference_version", BASE_PRICE_REFERENCE_VERSION)
        .in("status", ["draft", "published"])
        .order("pricing_key");
      if (error) throw new BinderQuotesError("failed");
      const labels = new Map(WORK_ITEMS.map((item) => [item.key, item.label]));
      return (data ?? []).flatMap((row) => {
        const label = labels.get(row.pricing_key);
        return label
          ? [{
              pricingKey: row.pricing_key,
              label,
              unit: row.unit,
              unitPriceCents: row.default_unit_price_cents,
              pricingMode: row.pricing_mode,
            }]
          : [];
      });
    }),
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

/** Les dernières prestations réellement utilisées, limitées à l'atelier authentifié. */
export const getMyRecentServiceIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => run(context.userId, async (binderId, sb) => {
    const { data: quotes, error: quoteError } = await sb.from("marketplace_binder_quotes")
      .select("id").eq("binder_id", binderId).order("created_at", { ascending: false }).limit(30);
    if (quoteError) throw new BinderQuotesError("failed");
    if (!quotes?.length) return [] as string[];
    const { data: items, error: itemError } = await sb.from("marketplace_binder_quote_items")
      .select("quote_id, service_id, position").eq("binder_id", binderId)
      .in("quote_id", quotes.map((quote) => quote.id)).not("service_id", "is", null);
    if (itemError) throw new BinderQuotesError("failed");
    const order = new Map(quotes.map((quote, index) => [quote.id, index]));
    return [...new Set((items ?? [])
      .sort((a, b) => (order.get(a.quote_id) ?? 0) - (order.get(b.quote_id) ?? 0) || a.position - b.position)
      .map((item) => item.service_id).filter((value): value is string => Boolean(value)))].slice(0, 8);
  }));

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

/** Nouveau brouillon issu du snapshot d'un devis de cet atelier. */
export const duplicateMyQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data))
  .handler(({ context, data }) => run(context.userId, async (binderId, sb) => {
    const source = await getQuote(sb, binderId, data.id);
    return createQuote(sb, binderId, duplicateQuoteInput(source), todayInParis());
  }));

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
