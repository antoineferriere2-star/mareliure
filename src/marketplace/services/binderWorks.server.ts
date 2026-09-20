/**
 * Contacts et ouvrages de l'atelier, côté serveur : accès aux données et orchestration.
 *
 * Même règle que l'outil devis (voir binderQuotes.server.ts) : l'appelant résout `binderId`
 * depuis la session avec `requireBinderId` et le passe à CHAQUE fonction ; chaque lecture et
 * chaque écriture porte `binder_id = binderId`. Un identifiant qui appartient à un autre
 * atelier n'est jamais « refusé » — il est introuvable, comme un identifiant inexistant.
 *
 * Ce que le navigateur ne décide jamais : l'atelier, la référence d'un ouvrage (numérotée par la
 * base, dans la même transaction que l'écriture), la source (un ouvrage saisi ici est
 * « mon client »), le dossier d'origine, l'origine d'un contact. La base le refuse aussi (deux
 * triggers : un ouvrage ne pointe pas le contact d'un autre atelier).
 *
 * Aucune valeur d'un document émis n'est jamais lue ici pour être réécrite : un devis garde son
 * snapshot, quoi qu'il arrive à la fiche du contact ou de l'ouvrage.
 */
import type { Tables } from "@/integrations/supabase/types";
import type { Supa } from "@/build/services/adminAuth.server";
import type { DocumentSummary } from "@/marketplace/quotes/quoteViews";
import { contactDisplayName } from "@/marketplace/works/contactName";
import type { ContactInput, WorkInput } from "@/marketplace/works/workInput";
import type {
  ContactDetail,
  ContactOrigin,
  ContactSummary,
  ContactView,
  WorkDetail,
  WorkSource,
  WorkStatus,
  WorkSummary,
  WorkView,
} from "@/marketplace/works/workViews";
import { BinderQuotesError } from "./binderQuotes.server";

// ---------------------------------------------------------------------------
// Lignes → vues
// ---------------------------------------------------------------------------

export const contactView = (row: Tables<"marketplace_binder_clients">): ContactView => ({
  id: row.id,
  name: row.name,
  firstName: row.first_name,
  lastName: row.last_name,
  organization: row.organization,
  email: row.email,
  phone: row.phone,
  addressLine1: row.address_line1,
  postalCode: row.postal_code,
  city: row.city,
  country: row.country,
  notes: row.notes,
  origin: row.origin as ContactOrigin,
  archived: row.archived_at !== null,
});

export const workView = (row: Tables<"marketplace_binder_works">): WorkView => ({
  id: row.id,
  reference: row.reference,
  contactId: row.contact_id,
  title: row.title,
  author: row.author,
  editionNote: row.edition_note,
  description: row.description,
  heightMm: row.height_mm,
  widthMm: row.width_mm,
  thicknessMm: row.thickness_mm,
  weightGrams: row.weight_grams,
  declaredValueCents: row.declared_value_cents,
  conditionNotes: row.condition_notes,
  internalNotes: row.internal_notes,
  status: row.status as WorkStatus,
  source: row.source as WorkSource,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const workSummary = (
  row: Tables<"marketplace_binder_works">,
  contactName: string | null,
  quoteCount: number,
): WorkSummary => ({
  id: row.id,
  reference: row.reference,
  title: row.title,
  author: row.author,
  contactId: row.contact_id,
  contactName,
  heightMm: row.height_mm,
  widthMm: row.width_mm,
  thicknessMm: row.thickness_mm,
  conditionNotes: row.condition_notes,
  status: row.status as WorkStatus,
  source: row.source as WorkSource,
  quoteCount,
  createdAt: row.created_at,
});

const countBy = <T,>(rows: T[], key: (row: T) => string | null): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

const quoteSummary = (row: Tables<"marketplace_binder_quotes">): DocumentSummary => ({
  kind: "quote",
  id: row.id,
  number: row.quote_number,
  status: row.status,
  issueDate: row.issue_date,
  validUntil: row.valid_until,
  clientName: row.client_name,
  bookTitle: row.book_title,
  totalTtcCents: row.total_ttc_cents,
  currency: row.currency,
});

const invoiceSummary = (row: Tables<"marketplace_binder_invoices">): DocumentSummary => ({
  kind: "invoice",
  id: row.id,
  number: row.invoice_number,
  status: row.payment_status,
  issueDate: row.issue_date,
  validUntil: null,
  clientName: row.client_name,
  bookTitle: row.book_title,
  totalTtcCents: row.total_ttc_cents,
  currency: row.currency,
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function listContacts(
  sb: Supa,
  binderId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ContactSummary[]> {
  const [contacts, works, quotes, invoices] = await Promise.all([
    sb.from("marketplace_binder_clients").select("*").eq("binder_id", binderId).order("name"),
    sb.from("marketplace_binder_works").select("id, contact_id").eq("binder_id", binderId).eq("status", "active"),
    sb.from("marketplace_binder_quotes").select("id, client_id").eq("binder_id", binderId),
    sb.from("marketplace_binder_invoices").select("id, client_id").eq("binder_id", binderId),
  ]);
  if (contacts.error || works.error || quotes.error || invoices.error) throw new BinderQuotesError("failed");
  const workCounts = countBy(works.data ?? [], (w) => w.contact_id);
  const documentCounts = countBy([...(quotes.data ?? []), ...(invoices.data ?? [])], (d) => d.client_id);
  return (contacts.data ?? [])
    .filter((row) => options.includeArchived || row.archived_at === null)
    .map((row) => ({
      ...contactView(row),
      workCount: workCounts.get(row.id) ?? 0,
      documentCount: documentCounts.get(row.id) ?? 0,
    }));
}

async function loadContactRow(sb: Supa, binderId: string, contactId: string) {
  const { data, error } = await sb
    .from("marketplace_binder_clients")
    .select("*")
    .eq("id", contactId)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  return data;
}

export async function getContact(sb: Supa, binderId: string, contactId: string): Promise<ContactDetail> {
  const row = await loadContactRow(sb, binderId, contactId);
  if (!row) throw new BinderQuotesError("not_found");
  const [works, quotes, invoices] = await Promise.all([
    sb.from("marketplace_binder_works").select("*").eq("binder_id", binderId).eq("contact_id", contactId).order("created_at", { ascending: false }),
    sb.from("marketplace_binder_quotes").select("*").eq("binder_id", binderId).eq("client_id", contactId).order("created_at", { ascending: false }),
    sb.from("marketplace_binder_invoices").select("*").eq("binder_id", binderId).eq("client_id", contactId).order("created_at", { ascending: false }),
  ]);
  if (works.error || quotes.error || invoices.error) throw new BinderQuotesError("failed");
  const quoteRows = quotes.data ?? [];
  const quotesByWork = countBy(quoteRows, (q) => q.work_id);
  return {
    contact: contactView(row),
    works: (works.data ?? []).map((w) => workSummary(w, row.name, quotesByWork.get(w.id) ?? 0)),
    quotes: quoteRows.map(quoteSummary),
    invoices: (invoices.data ?? []).map(invoiceSummary),
  };
}

/**
 * Crée ou modifie un contact. L'origine, le dossier d'origine et l'archivage ne sont JAMAIS
 * touchés ici : un contact « ma_reliure » ne devient pas « mon_client » par une modification.
 */
export async function saveContact(sb: Supa, binderId: string, input: ContactInput): Promise<ContactView> {
  const values = {
    name: contactDisplayName(input),
    first_name: input.firstName,
    last_name: input.lastName,
    organization: input.organization,
    email: input.email,
    phone: input.phone,
    address_line1: input.addressLine1,
    postal_code: input.postalCode,
    city: input.city,
    country: input.country,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? sb.from("marketplace_binder_clients").update(values).eq("id", input.id).eq("binder_id", binderId)
    : sb.from("marketplace_binder_clients").insert({ ...values, binder_id: binderId, origin: "mon_client" });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return contactView(data);
}

export async function setContactArchived(sb: Supa, binderId: string, contactId: string, archived: boolean): Promise<ContactView> {
  const { data, error } = await sb
    .from("marketplace_binder_clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", contactId)
    .eq("binder_id", binderId)
    .select("*")
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return contactView(data);
}

// ---------------------------------------------------------------------------
// Ouvrages
// ---------------------------------------------------------------------------

/** Le contact d'un ouvrage : un contact DE CET ATELIER, ou une erreur — jamais celui d'un autre. */
async function assertOwnContact(sb: Supa, binderId: string, contactId: string) {
  const row = await loadContactRow(sb, binderId, contactId);
  if (!row) throw new BinderQuotesError("invalid_input");
  return row;
}

export async function listWorks(
  sb: Supa,
  binderId: string,
  options: { contactId?: string; includeArchived?: boolean } = {},
): Promise<WorkSummary[]> {
  let query = sb.from("marketplace_binder_works").select("*").eq("binder_id", binderId);
  if (options.contactId) query = query.eq("contact_id", options.contactId);
  const [works, contacts, quotes] = await Promise.all([
    query.order("created_at", { ascending: false }),
    sb.from("marketplace_binder_clients").select("id, name").eq("binder_id", binderId),
    sb.from("marketplace_binder_quotes").select("id, work_id").eq("binder_id", binderId),
  ]);
  if (works.error || contacts.error || quotes.error) throw new BinderQuotesError("failed");
  const names = new Map((contacts.data ?? []).map((c) => [c.id, c.name] as const));
  const quoteCounts = countBy(quotes.data ?? [], (q) => q.work_id);
  return (works.data ?? [])
    .filter((row) => options.includeArchived || row.status === "active")
    .map((row) => workSummary(row, row.contact_id ? (names.get(row.contact_id) ?? null) : null, quoteCounts.get(row.id) ?? 0));
}

export async function getWork(sb: Supa, binderId: string, workId: string): Promise<WorkDetail> {
  const { data: row, error } = await sb
    .from("marketplace_binder_works")
    .select("*")
    .eq("id", workId)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!row) throw new BinderQuotesError("not_found");
  const [contact, quotes] = await Promise.all([
    row.contact_id ? loadContactRow(sb, binderId, row.contact_id) : Promise.resolve(null),
    sb.from("marketplace_binder_quotes").select("*").eq("binder_id", binderId).eq("work_id", workId).order("created_at", { ascending: false }),
  ]);
  if (quotes.error) throw new BinderQuotesError("failed");
  const quoteRows = quotes.data ?? [];
  // Une facture se rattache à l'ouvrage PAR SON DEVIS : sa table n'est pas touchée (elle est immuable).
  const invoices = quoteRows.length
    ? await sb
        .from("marketplace_binder_invoices")
        .select("*")
        .eq("binder_id", binderId)
        .in("quote_id", quoteRows.map((q) => q.id))
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (invoices.error) throw new BinderQuotesError("failed");
  return {
    work: workView(row),
    contact: contact ? contactView(contact) : null,
    quotes: quoteRows.map(quoteSummary),
    invoices: (invoices.data ?? []).map(invoiceSummary),
  };
}

/**
 * Crée ou modifie un ouvrage. À la création, la référence est attribuée par la base dans la même
 * transaction ; la source est toujours « mon client » (la fonction SQL l'impose). À la
 * modification, ni la référence, ni la source, ni le dossier d'origine, ni le statut ne bougent.
 */
export async function saveWork(sb: Supa, binderId: string, input: WorkInput): Promise<WorkDetail> {
  await assertOwnContact(sb, binderId, input.contactId);
  const values = {
    contact_id: input.contactId,
    title: input.title,
    author: input.author,
    edition_note: input.editionNote,
    description: input.description,
    height_mm: input.heightMm,
    width_mm: input.widthMm,
    thickness_mm: input.thicknessMm,
    weight_grams: input.weightGrams,
    declared_value_cents: input.declaredValueCents,
    condition_notes: input.conditionNotes,
    internal_notes: input.internalNotes,
  };
  if (input.id) {
    const { data, error } = await sb
      .from("marketplace_binder_works")
      .update(values)
      .eq("id", input.id)
      .eq("binder_id", binderId)
      .select("id")
      .maybeSingle();
    if (error) throw new BinderQuotesError("failed");
    if (!data) throw new BinderQuotesError("not_found");
    return getWork(sb, binderId, data.id);
  }
  const { data, error } = await sb.rpc("marketplace_binder_create_work", {
    p_binder_id: binderId,
    p_work: values,
  });
  if (error || !data) throw new BinderQuotesError("failed");
  return getWork(sb, binderId, data as string);
}

export async function setWorkArchived(sb: Supa, binderId: string, workId: string, archived: boolean): Promise<WorkDetail> {
  const { data, error } = await sb
    .from("marketplace_binder_works")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", workId)
    .eq("binder_id", binderId)
    .select("id")
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return getWork(sb, binderId, workId);
}
