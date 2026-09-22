/** Platform operations without silent access to an atelier's private customer content. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";

export const listAdminWorkshopSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const [binders, matches, works, quotes, invoices] = await Promise.all([
      sb.from("marketplace_binders").select("id, display_name, workshop_name, city, status, updated_at").order("display_name"),
      sb.from("marketplace_case_matches").select("binder_id, case_id, state, invited_at"),
      sb.from("marketplace_binder_works").select("binder_id, source, updated_at"),
      sb.from("marketplace_binder_quotes").select("binder_id, status, updated_at"),
      sb.from("marketplace_binder_invoices").select("binder_id, created_at"),
    ]);
    if (binders.error || matches.error || works.error || quotes.error || invoices.error) fail(500, "Le suivi des ateliers n'a pas pu être chargé.");
    return (binders.data ?? []).map((binder) => {
      const bm = (matches.data ?? []).filter((m) => m.binder_id === binder.id);
      const bw = (works.data ?? []).filter((w) => w.binder_id === binder.id);
      const bq = (quotes.data ?? []).filter((q) => q.binder_id === binder.id);
      const bi = (invoices.data ?? []).filter((i) => i.binder_id === binder.id);
      return {
        id: binder.id,
        name: binder.workshop_name || binder.display_name,
        relieur: binder.display_name,
        city: binder.city,
        status: binder.status,
        leadCount: bm.filter((m) => m.state !== "declined" && m.state !== "cancelled").length,
        quoteCount: bq.length,
        workCount: bw.length,
        invoiceCount: bi.length,
        // Dates and counts only for personal clients; no name, title or message body leaves this function.
        lastActivity: [binder.updated_at, ...bm.map((m) => m.invited_at), ...bw.map((w) => w.updated_at), ...bq.map((q) => q.updated_at), ...bi.map((i) => i.created_at)].filter(Boolean).sort().at(-1) ?? binder.updated_at,
      };
    });
  });

const detailInput = z.object({ binderId: z.string().uuid() }).strict();

export const getAdminWorkshopDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => detailInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: binder, error: binderError } = await sb.from("marketplace_binders")
      .select("id, display_name, workshop_name, city, status, updated_at").eq("id", data.binderId).maybeSingle();
    if (binderError || !binder) fail(404, "Atelier introuvable.");
    const [matches, works, quotes, invoices, services, events] = await Promise.all([
      sb.from("marketplace_case_matches").select("case_id, state, invited_at").eq("binder_id", data.binderId),
      sb.from("marketplace_binder_works").select("id, case_id, source, title, reference, updated_at").eq("binder_id", data.binderId),
      sb.from("marketplace_binder_quotes").select("id, work_id, quote_number, status, total_ttc_cents, created_at").eq("binder_id", data.binderId),
      sb.from("marketplace_binder_invoices").select("id, quote_id, invoice_number, payment_status, created_at").eq("binder_id", data.binderId),
      sb.from("marketplace_binder_services").select("id").eq("binder_id", data.binderId),
      sb.from("marketplace_events").select("id, case_id, event_type, created_at").eq("binder_id", data.binderId).order("created_at", { ascending: false }).limit(30),
    ]);
    if (matches.error || works.error || quotes.error || invoices.error || services.error || events.error) fail(500, "La fiche atelier n'a pas pu être chargée.");
    const caseIds = (matches.data ?? []).map((match) => match.case_id);
    const { data: cases, error: caseError } = caseIds.length
      ? await sb.from("marketplace_cases").select("id, reference, status, brand").in("id", caseIds)
      : { data: [], error: null };
    if (caseError) fail(500, "Les dossiers n'ont pas pu être chargés.");
    const marketplaceCaseIds = new Set((cases ?? []).filter((row) => row.brand === "MA_RELIURE").map((row) => row.id));
    const platformWorks = (works.data ?? []).filter((work) => work.source === "ma_reliure" && work.case_id && marketplaceCaseIds.has(work.case_id));
    const platformWorkIds = new Set(platformWorks.map((work) => work.id));
    const platformQuotes = (quotes.data ?? []).filter((quote) => quote.work_id && platformWorkIds.has(quote.work_id));
    const platformQuoteIds = new Set(platformQuotes.map((quote) => quote.id));
    return {
      binder: { id: binder.id, name: binder.workshop_name || binder.display_name, relieur: binder.display_name, city: binder.city, status: binder.status, updatedAt: binder.updated_at },
      leads: (matches.data ?? []).filter((m) => marketplaceCaseIds.has(m.case_id)).map((match) => ({ ...match, reference: (cases ?? []).find((row) => row.id === match.case_id)?.reference ?? "", caseStatus: (cases ?? []).find((row) => row.id === match.case_id)?.status ?? "" })),
      works: platformWorks.map((work) => ({ id: work.id, caseId: work.case_id, title: work.title, reference: work.reference, updatedAt: work.updated_at })),
      quotes: platformQuotes.map((quote) => ({ id: quote.id, workId: quote.work_id, number: quote.quote_number, status: quote.status, totalTtcCents: quote.total_ttc_cents, createdAt: quote.created_at })),
      invoices: (invoices.data ?? []).filter((invoice) => platformQuoteIds.has(invoice.quote_id)).map((invoice) => ({ id: invoice.id, number: invoice.invoice_number, status: invoice.payment_status, createdAt: invoice.created_at })),
      privateCounts: {
        works: (works.data ?? []).filter((work) => work.source === "mon_client").length,
        quotes: (quotes.data ?? []).length - platformQuotes.length,
        invoices: (invoices.data ?? []).filter((invoice) => !platformQuoteIds.has(invoice.quote_id)).length,
      },
      serviceCount: (services.data ?? []).length,
      activity: (events.data ?? []).filter((event) => !event.case_id || marketplaceCaseIds.has(event.case_id)).map((event) => ({ id: event.id, type: event.event_type, at: event.created_at })),
    };
  });

export const listAdminConversationPreviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: cases, error: caseError } = await sb.from("marketplace_cases")
      .select("id, reference").eq("brand", "MA_RELIURE").order("created_at", { ascending: false }).limit(200);
    if (caseError) fail(500, "Les conversations n'ont pas pu être chargées.");
    const ids = (cases ?? []).map((row) => row.id);
    if (!ids.length) return [];
    const [messages, matches] = await Promise.all([
      sb.from("marketplace_messages").select("case_id, body, created_at, deleted_at").in("case_id", ids).order("created_at", { ascending: false }).limit(1000),
      sb.from("marketplace_case_matches").select("case_id, binder_id").in("case_id", ids).eq("state", "selected"),
    ]);
    if (messages.error || matches.error) fail(500, "Les conversations n'ont pas pu être chargées.");
    const binderIds = [...new Set((matches.data ?? []).map((row) => row.binder_id))];
    const { data: binders, error: binderError } = binderIds.length
      ? await sb.from("marketplace_binders").select("id, display_name, workshop_name").in("id", binderIds)
      : { data: [], error: null };
    if (binderError) fail(500, "Les ateliers n'ont pas pu être chargés.");
    const latest = new Map<string, { body: string; at: string }>();
    for (const row of messages.data ?? []) {
      if (!latest.has(row.case_id)) latest.set(row.case_id, { body: row.deleted_at ? "Message supprimé" : row.body ?? "Pièce jointe", at: row.created_at });
    }
    return (cases ?? []).filter((row) => latest.has(row.id)).map((row) => {
      const binderId = (matches.data ?? []).find((match) => match.case_id === row.id)?.binder_id;
      const binder = (binders ?? []).find((item) => item.id === binderId);
      return { caseId: row.id, reference: row.reference, latest: latest.get(row.id)!, binderName: binder?.workshop_name || binder?.display_name || "Non attribué" };
    }).sort((a, b) => b.latest.at.localeCompare(a.latest.at));
  });
