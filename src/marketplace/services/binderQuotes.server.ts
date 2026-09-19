/**
 * L'outil devis → facture du relieur, côté serveur : accès aux données et
 * orchestration. Rien ici ne calcule un montant (voir quotes/quoteCalc.ts) et
 * rien ne décide de qui est l'atelier : l'appelant (les server functions)
 * résout `binderId` depuis la session avec `requireBinderId`, puis le passe à
 * CHAQUE fonction de ce fichier.
 *
 * Isolation (patron du dépôt : RLS deny-all + service-role + contrôle explicite) :
 * chaque lecture et chaque écriture porte `binder_id = binderId`. Un identifiant
 * qui appartient à un autre atelier n'est jamais « refusé » — il est introuvable :
 * même réponse qu'un identifiant inexistant.
 *
 * Le client est typé par `integrations/supabase/types.ts` (généré depuis la base).
 * Les unions que la base garantit par CHECK (régime de TVA, type de remise…) et les
 * colonnes jsonb (émetteur, ventilation de TVA) y sont des `string` / `Json` : elles
 * sont précisées en UN seul endroit, aux frontières `asQuoteRow`, `asInvoiceRow` et
 * `profileFromRow`, jamais par un client non typé.
 */
import type { Json, Tables } from "@/integrations/supabase/types";
import type { Supa } from "@/build/services/adminAuth.server";
import { findActiveBinderMembership } from "./binderMembership.server";
import {
  buildQuoteRows,
  EMPTY_BILLING_PROFILE,
  issuerOf,
  profileReadiness,
  QuoteError,
  type BillingProfile,
} from "@/marketplace/quotes/quoteBuild";
import type {
  BillingProfileInput,
  CategoryInput,
  ClientInput,
  QuoteInput,
  ServiceInput,
} from "@/marketplace/quotes/quoteInput";
import { canTransition, isQuoteStatus, type QuoteStatus } from "@/marketplace/quotes/quoteStatus";
import { STARTER_CATALOG } from "@/marketplace/quotes/starterCatalog";
import {
  invoiceView,
  quoteView,
  type DocumentSummary,
  type DocumentView,
  type InvoiceDbRow,
  type ItemDbRow,
  type QuoteDbRow,
} from "@/marketplace/quotes/quoteViews";

// Frontières typées : ce que la base garantit par CHECK / par construction du serveur.
const asQuoteRow = (row: Tables<"marketplace_binder_quotes">) => row as unknown as QuoteDbRow;
const asInvoiceRow = (row: Tables<"marketplace_binder_invoices">) => row as unknown as InvoiceDbRow;
const asItemRows = (rows: Tables<"marketplace_binder_quote_items">[] | Tables<"marketplace_binder_invoice_items">[]) =>
  rows as unknown as ItemDbRow[];
/** Une valeur du domaine transmise à une fonction SQL en jsonb. */
const asJson = (value: unknown) => value as Json;

export type BinderQuotesErrorCode =
  | "no_binder"
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "profile_incomplete"
  | "failed";

const STATUS_BY_CODE: Record<BinderQuotesErrorCode, number> = {
  no_binder: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 400,
  profile_incomplete: 422,
  failed: 500,
};

export class BinderQuotesError extends Error {
  readonly code: BinderQuotesErrorCode;
  readonly status: number;
  readonly missing: string[];
  constructor(code: BinderQuotesErrorCode, missing: string[] = []) {
    super(code);
    this.name = "BinderQuotesError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.missing = missing;
  }
}

/** L'atelier de cette session : tout membre ACTIF, ou personne. */
export async function requireBinderId(sb: Supa, userId: string): Promise<string> {
  const membership = await findActiveBinderMembership(sb, userId);
  if (!membership) throw new BinderQuotesError("no_binder");
  return membership.binderId;
}

const fromQuoteError = (error: unknown): never => {
  if (error instanceof QuoteError) {
    throw new BinderQuotesError(error.code === "profile_incomplete" ? "profile_incomplete" : "invalid_input", error.missing);
  }
  throw error;
};

// ---------------------------------------------------------------------------
// Profil de facturation
// ---------------------------------------------------------------------------

function profileFromRow(row: Tables<"marketplace_binder_billing_profiles">): BillingProfile {
  return {
    workshopName: row.workshop_name,
    legalName: row.legal_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    siret: row.siret,
    vatNumber: row.vat_number,
    legalNotes: row.legal_notes,
    email: row.email,
    phone: row.phone,
    vatRegime: row.vat_regime as BillingProfile["vatRegime"],
    defaultVatRateBps: row.default_vat_rate_bps,
    vatMention: row.vat_mention,
    quotePrefix: row.quote_prefix,
    invoicePrefix: row.invoice_prefix,
    quoteValidityDays: row.quote_validity_days,
    paymentTerms: row.payment_terms,
    quoteNotes: row.quote_notes,
    invoiceNotes: row.invoice_notes,
  };
}

export async function loadBillingProfile(sb: Supa, binderId: string): Promise<BillingProfile> {
  const { data, error } = await sb
    .from("marketplace_binder_billing_profiles")
    .select("*")
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (data) return profileFromRow(data);
  // Aucun profil encore : le nom de l'atelier (déjà connu de Ma Reliure) sert de départ, jamais un régime de TVA.
  const { data: binder } = await sb
    .from("marketplace_binders")
    .select("workshop_name, display_name, city, postal_code")
    .eq("id", binderId)
    .maybeSingle();
  return {
    ...EMPTY_BILLING_PROFILE,
    workshopName: binder?.workshop_name ?? binder?.display_name ?? null,
    city: binder?.city ?? null,
    postalCode: binder?.postal_code ?? null,
  };
}

export async function saveBillingProfile(sb: Supa, binderId: string, input: BillingProfileInput): Promise<BillingProfile> {
  const { data, error } = await sb
    .from("marketplace_binder_billing_profiles")
    .upsert(
      {
        binder_id: binderId,
        workshop_name: input.workshopName,
        legal_name: input.legalName,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        postal_code: input.postalCode,
        city: input.city,
        country: input.country,
        siret: input.siret,
        vat_number: input.vatNumber,
        legal_notes: input.legalNotes,
        email: input.email,
        phone: input.phone,
        vat_regime: input.vatRegime,
        default_vat_rate_bps: input.defaultVatRateBps,
        vat_mention: input.vatMention,
        quote_prefix: input.quotePrefix,
        invoice_prefix: input.invoicePrefix,
        quote_validity_days: input.quoteValidityDays,
        payment_terms: input.paymentTerms,
        quote_notes: input.quoteNotes,
        invoice_notes: input.invoiceNotes,
      },
      { onConflict: "binder_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new BinderQuotesError("failed");
  return profileFromRow(data);
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface CategoryView {
  id: string;
  name: string;
  sortOrder: number;
}
export interface ServiceView {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unitPriceCents: number;
  vatRateBps: number | null;
  unit: string | null;
  isActive: boolean;
  archived: boolean;
}

const categoryView = (row: Tables<"marketplace_binder_service_categories">): CategoryView => ({ id: row.id, name: row.name, sortOrder: row.sort_order });
const serviceView = (row: Tables<"marketplace_binder_services">): ServiceView => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description,
  unitPriceCents: row.unit_price_cents,
  vatRateBps: row.vat_rate_bps,
  unit: row.unit,
  isActive: row.is_active,
  archived: row.archived_at !== null,
});

export async function listCatalog(
  sb: Supa,
  binderId: string,
  options: { includeArchived?: boolean } = {},
): Promise<{ categories: CategoryView[]; services: ServiceView[] }> {
  const [categories, services] = await Promise.all([
    sb.from("marketplace_binder_service_categories").select("*").eq("binder_id", binderId).order("sort_order"),
    sb.from("marketplace_binder_services").select("*").eq("binder_id", binderId).order("sort_order"),
  ]);
  if (categories.error || services.error) throw new BinderQuotesError("failed");
  return {
    categories: (categories.data ?? []).map(categoryView),
    services: (services.data ?? []).map(serviceView).filter((s: ServiceView) => options.includeArchived || !s.archived),
  };
}

async function assertOwnCategory(sb: Supa, binderId: string, categoryId: string | null) {
  if (!categoryId) return;
  const { data } = await sb
    .from("marketplace_binder_service_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (!data) throw new BinderQuotesError("invalid_input");
}

export async function saveCategory(sb: Supa, binderId: string, input: CategoryInput): Promise<CategoryView> {
  const values = { name: input.name, sort_order: input.sortOrder };
  const query = input.id
    ? sb.from("marketplace_binder_service_categories").update(values).eq("id", input.id).eq("binder_id", binderId)
    : sb.from("marketplace_binder_service_categories").insert({ ...values, binder_id: binderId });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return categoryView(data);
}

export async function saveService(sb: Supa, binderId: string, input: ServiceInput): Promise<ServiceView> {
  await assertOwnCategory(sb, binderId, input.categoryId);
  const values = {
    category_id: input.categoryId,
    name: input.name,
    description: input.description,
    unit_price_cents: input.unitPriceCents,
    vat_rate_bps: input.vatRateBps,
    unit: input.unit,
    is_active: input.isActive,
  };
  const query = input.id
    ? sb.from("marketplace_binder_services").update(values).eq("id", input.id).eq("binder_id", binderId)
    : sb.from("marketplace_binder_services").insert({ ...values, binder_id: binderId });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return serviceView(data);
}

/** Retire une prestation du constructeur sans rien casser : les anciens devis gardent leur snapshot. */
export async function archiveService(sb: Supa, binderId: string, serviceId: string): Promise<void> {
  const { data, error } = await sb
    .from("marketplace_binder_services")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", serviceId)
    .eq("binder_id", binderId)
    .select("id")
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
}

/**
 * Charge le catalogue de départ — des noms, jamais un prix. Une seule fois : si
 * l'atelier a déjà une catégorie, rien n'est écrit (jamais de doublon, jamais
 * d'écrasement). Les prestations arrivent inactives, à 0 €, en attente du prix de
 * l'atelier.
 */
export async function importStarterCatalog(sb: Supa, binderId: string): Promise<{ imported: boolean }> {
  const existing = await sb.from("marketplace_binder_service_categories").select("id").eq("binder_id", binderId).limit(1);
  if (existing.error) throw new BinderQuotesError("failed");
  if ((existing.data ?? []).length > 0) return { imported: false };

  const categories = await sb
    .from("marketplace_binder_service_categories")
    .insert(STARTER_CATALOG.map((c, i) => ({ binder_id: binderId, name: c.name, sort_order: i })))
    .select("id, name");
  if (categories.error) throw new BinderQuotesError("failed");
  const idByName = new Map<string, string>((categories.data ?? []).map((c) => [c.name, c.id] as const));

  const rows = STARTER_CATALOG.flatMap((category) =>
    category.services.map((name, i) => ({
      binder_id: binderId,
      category_id: idByName.get(category.name) ?? null,
      name,
      unit_price_cents: 0,
      is_active: false,
      sort_order: i,
    })),
  );
  const services = await sb.from("marketplace_binder_services").insert(rows);
  if (services.error) throw new BinderQuotesError("failed");
  return { imported: true };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface ClientView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
}
const clientView = (row: Tables<"marketplace_binder_clients">): ClientView => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  addressLine1: row.address_line1,
  postalCode: row.postal_code,
  city: row.city,
  country: row.country,
  notes: row.notes,
});

export async function listClients(sb: Supa, binderId: string): Promise<ClientView[]> {
  const { data, error } = await sb.from("marketplace_binder_clients").select("*").eq("binder_id", binderId).order("name");
  if (error) throw new BinderQuotesError("failed");
  return (data ?? []).map(clientView);
}

export async function saveClient(sb: Supa, binderId: string, input: ClientInput): Promise<ClientView> {
  const values = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    address_line1: input.addressLine1,
    postal_code: input.postalCode,
    city: input.city,
    country: input.country,
    notes: input.notes,
  };
  const query = input.id
    ? sb.from("marketplace_binder_clients").update(values).eq("id", input.id).eq("binder_id", binderId)
    : sb.from("marketplace_binder_clients").insert({ ...values, binder_id: binderId });
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return clientView(data);
}

/** Le client d'un devis : un client existant DE CET ATELIER, ou une nouvelle fiche créée à la volée. */
async function resolveClientId(sb: Supa, binderId: string, input: QuoteInput): Promise<string> {
  if (input.clientId) {
    const { data } = await sb
      .from("marketplace_binder_clients")
      .select("id")
      .eq("id", input.clientId)
      .eq("binder_id", binderId)
      .maybeSingle();
    if (!data) throw new BinderQuotesError("not_found");
    return data.id;
  }
  const created = await saveClient(sb, binderId, { id: null, ...input.client, notes: null });
  return created.id;
}

async function assertOwnServices(sb: Supa, binderId: string, input: QuoteInput) {
  const ids = [...new Set(input.lines.map((l) => l.serviceId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const { data, error } = await sb.from("marketplace_binder_services").select("id").eq("binder_id", binderId).in("id", ids);
  if (error) throw new BinderQuotesError("failed");
  if ((data ?? []).length !== ids.length) throw new BinderQuotesError("invalid_input");
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

async function loadQuoteRow(sb: Supa, binderId: string, quoteId: string): Promise<QuoteDbRow | null> {
  const { data, error } = await sb
    .from("marketplace_binder_quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  return data ? asQuoteRow(data) : null;
}

export async function getQuote(sb: Supa, binderId: string, quoteId: string): Promise<DocumentView> {
  const row = await loadQuoteRow(sb, binderId, quoteId);
  if (!row) throw new BinderQuotesError("not_found");
  const [items, invoice] = await Promise.all([
    sb.from("marketplace_binder_quote_items").select("*").eq("quote_id", quoteId).eq("binder_id", binderId).order("position"),
    sb.from("marketplace_binder_invoices").select("id, invoice_number").eq("quote_id", quoteId).eq("binder_id", binderId).maybeSingle(),
  ]);
  if (items.error) throw new BinderQuotesError("failed");
  return quoteView(row, asItemRows(items.data ?? []), invoice.data ?? null);
}

export async function listQuotes(sb: Supa, binderId: string): Promise<DocumentSummary[]> {
  const { data, error } = await sb
    .from("marketplace_binder_quotes")
    .select("id, quote_number, status, issue_date, valid_until, client_name, book_title, total_ttc_cents, currency")
    .eq("binder_id", binderId)
    .order("created_at", { ascending: false });
  if (error) throw new BinderQuotesError("failed");
  return (data ?? []).map((row) => ({
    kind: "quote" as const,
    id: row.id,
    number: row.quote_number,
    status: row.status,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    clientName: row.client_name,
    bookTitle: row.book_title,
    totalTtcCents: row.total_ttc_cents,
    currency: row.currency,
  }));
}

/**
 * Crée un devis : le serveur recalcule tout, attribue le numéro (dans la même
 * transaction que l'écriture des lignes) et renvoie le document tel qu'enregistré.
 */
export async function createQuote(sb: Supa, binderId: string, input: QuoteInput, today: string): Promise<DocumentView> {
  const profile = await loadBillingProfile(sb, binderId);
  await assertOwnServices(sb, binderId, input);
  // Le profil est contrôlé AVANT d'écrire quoi que ce soit (pas de fiche client créée pour rien).
  try {
    buildQuoteRows({ input, profile, issueDate: today, clientId: null });
  } catch (error) {
    fromQuoteError(error);
  }
  const clientId = await resolveClientId(sb, binderId, input);
  const { quote, items } = buildQuoteRows({ input, profile, issueDate: today, clientId });

  const { data, error } = await sb.rpc("marketplace_binder_create_quote", {
    p_binder_id: binderId,
    p_quote: asJson(quote),
    p_items: asJson(items),
  });
  if (error || !data) throw new BinderQuotesError("failed");
  return getQuote(sb, binderId, data as string);
}

/** Modifie un devis BROUILLON (le numéro, la date et le statut ne changent pas). */
export async function updateQuote(sb: Supa, binderId: string, quoteId: string, input: QuoteInput): Promise<DocumentView> {
  const existing = await loadQuoteRow(sb, binderId, quoteId);
  if (!existing) throw new BinderQuotesError("not_found");
  if (existing.status !== "draft") throw new BinderQuotesError("conflict");

  const profile = await loadBillingProfile(sb, binderId);
  await assertOwnServices(sb, binderId, input);
  const clientId = await resolveClientId(sb, binderId, input);
  let built;
  try {
    // La date d'émission reste celle du devis ; la validité repart d'elle.
    built = buildQuoteRows({ input, profile, issueDate: existing.issue_date, clientId });
  } catch (error) {
    return fromQuoteError(error);
  }
  const { error } = await sb.rpc("marketplace_binder_update_quote", {
    p_binder_id: binderId,
    p_quote_id: quoteId,
    p_quote: asJson(built.quote),
    p_items: asJson(built.items),
  });
  if (error) {
    if (String(error.message).includes("quote_not_editable")) throw new BinderQuotesError("conflict");
    if (String(error.message).includes("quote_not_found")) throw new BinderQuotesError("not_found");
    throw new BinderQuotesError("failed");
  }
  return getQuote(sb, binderId, quoteId);
}

export async function setQuoteStatus(sb: Supa, binderId: string, quoteId: string, to: string): Promise<DocumentView> {
  if (!isQuoteStatus(to)) throw new BinderQuotesError("invalid_input");
  const row = await loadQuoteRow(sb, binderId, quoteId);
  if (!row) throw new BinderQuotesError("not_found");
  const from = row.status as QuoteStatus;
  if (!canTransition(from, to)) throw new BinderQuotesError("conflict");
  // Garde optimiste : le changement n'a lieu que si le statut est encore celui qu'on vient de lire.
  const { data, error } = await sb
    .from("marketplace_binder_quotes")
    .update({ status: to })
    .eq("id", quoteId)
    .eq("binder_id", binderId)
    .eq("status", from)
    .select("id")
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("conflict");
  return getQuote(sb, binderId, quoteId);
}

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

/**
 * Devis accepté → facture, sans ressaisie. La facture exige l'identité complète de
 * l'atelier (adresse, SIRET, TVA ou mention de franchise) ; elle reprend le devis
 * tel qu'il est, avec l'identité de l'émetteur À CETTE DATE.
 */
export async function convertQuoteToInvoice(sb: Supa, binderId: string, quoteId: string, today: string): Promise<DocumentView> {
  const quote = await loadQuoteRow(sb, binderId, quoteId);
  if (!quote) throw new BinderQuotesError("not_found");
  if (quote.status !== "accepted") throw new BinderQuotesError("conflict");

  const profile = await loadBillingProfile(sb, binderId);
  const readiness = profileReadiness({ ...profile, vatRegime: quote.vat_regime, vatMention: quote.vat_mention ?? profile.vatMention }, "invoice");
  if (!readiness.ready) throw new BinderQuotesError("profile_incomplete", readiness.missing);

  const { data, error } = await sb.rpc("marketplace_binder_convert_quote_to_invoice", {
    p_binder_id: binderId,
    p_quote_id: quoteId,
    p_issue_date: today,
    // Nullable côté SQL (« pas de mentions ») ; le générateur type les arguments de fonction non-nullables.
    p_invoice_notes: profile.invoiceNotes as unknown as string,
    p_issuer: asJson(issuerOf(profile)),
  });
  if (error || !data) {
    const message = String(error?.message ?? "");
    if (message.includes("quote_not_found")) throw new BinderQuotesError("not_found");
    if (message.includes("quote_not_accepted") || message.includes("quote_already_invoiced")) throw new BinderQuotesError("conflict");
    throw new BinderQuotesError("failed");
  }
  return getInvoice(sb, binderId, data as string);
}

export async function getInvoice(sb: Supa, binderId: string, invoiceId: string): Promise<DocumentView> {
  const { data: row, error } = await sb
    .from("marketplace_binder_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("binder_id", binderId)
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!row) throw new BinderQuotesError("not_found");
  const [items, quote] = await Promise.all([
    sb.from("marketplace_binder_invoice_items").select("*").eq("invoice_id", invoiceId).eq("binder_id", binderId).order("position"),
    sb.from("marketplace_binder_quotes").select("id, quote_number").eq("id", row.quote_id).eq("binder_id", binderId).maybeSingle(),
  ]);
  if (items.error) throw new BinderQuotesError("failed");
  return invoiceView(asInvoiceRow(row), asItemRows(items.data ?? []), quote.data ?? null);
}

export async function listInvoices(sb: Supa, binderId: string): Promise<DocumentSummary[]> {
  const { data, error } = await sb
    .from("marketplace_binder_invoices")
    .select("id, invoice_number, issue_date, client_name, book_title, total_ttc_cents, currency, payment_status")
    .eq("binder_id", binderId)
    .order("created_at", { ascending: false });
  if (error) throw new BinderQuotesError("failed");
  return (data ?? []).map((row) => ({
    kind: "invoice" as const,
    id: row.id,
    number: row.invoice_number,
    status: row.payment_status,
    issueDate: row.issue_date,
    validUntil: null,
    clientName: row.client_name,
    bookTitle: row.book_title,
    totalTtcCents: row.total_ttc_cents,
    currency: row.currency,
  }));
}
