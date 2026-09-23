/**
 * Le détail d'un devis et d'une facture : ce qui a été enregistré, le PDF, et la
 * prochaine action évidente — « Marquer comme accepté », puis préparer et
 * émettre une facture. Seule une facture émise est en lecture seule.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  convertMyQuoteToInvoice,
  createMyFullCreditNote,
  duplicateMyQuote,
  getMyInvoice,
  getMyInvoicePdf,
  getMyQuote,
  getMyQuotePdf,
  issueMyInvoice,
  setMyQuoteStatus,
  updateMyInvoiceDraft,
} from "@/marketplace/services/binderQuotes.data.functions";
import { allowedTransitions, canConvertToInvoice, isEditable, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/marketplace/quotes/quoteStatus";
import { formatDimensions } from "@/marketplace/quotes/quoteLines";
import { downloadPdf, euros, formatDateLong, openPdf, parseServerError } from "@/marketplace/quotes/quoteFormat";
import type { DocumentView } from "@/marketplace/quotes/quoteViews";
import type { InvoiceDraftInput } from "@/marketplace/invoices/invoiceCompliance";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, PAYMENT_LABELS, PRIMARY_BUTTON, QuoteStatusBadge, SECONDARY_BUTTON } from "./quoteUi";
import { INVOICES_KEY, QUOTES_KEY } from "./quoteQueryKeys";

const TRANSITION_LABELS: Partial<Record<QuoteStatus, string>> = {
  sent: "Marquer comme envoyé",
  accepted: "Marquer comme accepté",
  refused: "Marquer comme refusé",
  expired: "Marquer comme expiré",
};

function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Chargement…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corps commun
// ---------------------------------------------------------------------------

function DocumentBody({ doc }: { doc: DocumentView }) {
  const showVat = doc.vatRegime === "VAT_LIABLE";
  const dims = formatDimensions({ heightMm: doc.book.heightMm, widthMm: doc.book.widthMm, spineMm: doc.book.spineMm });
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <section aria-labelledby="doc-client" className={CARD}>
          <h2 id="doc-client" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</h2>
          <p className="mt-2 font-medium">{doc.client.name}</p>
          <p className="text-sm text-muted-foreground">
            {[doc.client.addressLine1, [doc.client.postalCode, doc.client.city].filter(Boolean).join(" "), doc.client.email, doc.client.phone].filter(Boolean).join(" · ")}
          </p>
        </section>
        <section aria-labelledby="doc-book" className={CARD}>
          <h2 id="doc-book" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ouvrage</h2>
          <p className="mt-2 font-medium">{doc.book.title || "—"}</p>
          <p className="text-sm text-muted-foreground">{[doc.book.author, dims].filter(Boolean).join(" · ")}</p>
          {doc.book.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{doc.book.notes}</p>}
        </section>
      </div>

      <section aria-labelledby="doc-lines" className={CARD}>
        <h2 id="doc-lines" className="font-serif text-lg">Prestations</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Désignation</th>
                <th className="py-2 text-right font-medium">Qté</th>
                <th className="py-2 text-right font-medium">Prix HT</th>
                {showVat && <th className="py-2 text-right font-medium">TVA</th>}
                <th className="py-2 text-right font-medium">Total HT</th>
              </tr>
            </thead>
            {doc.blocks.map((block) => <tbody key={block.key}>
              <tr className="border-b border-[#cfc5b6] bg-[#f8f4ed]"><th colSpan={showVat ? 5 : 4} className="px-2 py-2 text-left"><span className="font-serif text-base">{block.label}</span><span className="ml-2 text-xs font-normal text-muted-foreground">{block.bookCount} livre{block.bookCount > 1 ? "s" : ""}{formatDimensions(block) ? ` · ${formatDimensions(block)}` : ""}</span></th></tr>
              {doc.items.filter((item) => item.blockKey === block.key).map((item) => (
                <tr key={item.position} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{item.label}</span>
                    {item.description && !/^(Référentiel\s+\S+\s+·\s+\S+|Tarif de base Ma Reliure)$/i.test(item.description.trim()) && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                    {item.photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.photos.map((photo) => <figure key={photo.id} className="w-28 overflow-hidden rounded border bg-white"><img src={photo.url} alt={photo.caption || `Exemple pour ${item.label}`} className="aspect-[4/3] w-full object-cover" />{photo.caption && <figcaption className="p-1 text-[0.65rem] text-muted-foreground">{photo.caption}</figcaption>}</figure>)}</div>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{String(item.quantity * block.bookCount).replace(".", ",")}{item.unit ? ` ${item.unit}` : ""}</td>
                  <td className="py-2 text-right tabular-nums">{euros(item.unitPriceCents)}</td>
                  {showVat && <td className="py-2 text-right tabular-nums">{String(item.vatRateBps / 100).replace(".", ",")} %</td>}
                  <td className="py-2 text-right tabular-nums">{euros(item.totalHtCents)}</td>
                </tr>
              ))}
            </tbody>)}
          </table>
        </div>

        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          {doc.discountCents > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-muted-foreground">Sous-total HT</dt><dd className="tabular-nums">{euros(doc.subtotalCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Remise</dt><dd className="tabular-nums">− {euros(doc.discountCents)}</dd></div>
            </>
          )}
          <div className="flex justify-between"><dt className="text-muted-foreground">Total HT</dt><dd className="tabular-nums">{euros(doc.totalHtCents)}</dd></div>
          {showVat &&
            doc.vatBreakdown.filter((g) => g.baseHtCents > 0).map((g) => (
              <div key={g.vatRateBps} className="flex justify-between"><dt className="text-muted-foreground">TVA {String(g.vatRateBps / 100).replace(".", ",")} %</dt><dd className="tabular-nums">{euros(g.vatCents)}</dd></div>
            ))}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>{showVat ? "Total TTC" : "Total à payer"}</dt><dd className="tabular-nums">{euros(doc.totalTtcCents)}</dd></div>
          {doc.depositCents > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-muted-foreground">Acompte demandé</dt><dd className="tabular-nums">{euros(doc.depositCents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Solde</dt><dd className="tabular-nums">{euros(doc.balanceCents)}</dd></div>
            </>
          )}
        </dl>
        {doc.vatMention && <p className="mt-4 text-sm">{doc.vatMention}</p>}
      </section>
    </div>
  );
}

function PdfActions({ fetchPdf, id }: { fetchPdf: (args: { data: { id: string } }) => Promise<{ filename: string; base64: string }>; id: string }) {
  const [failed, setFailed] = useState(false);
  const pdf = useMutation({
    mutationFn: async (mode: "download" | "print") => {
      const { filename, base64 } = await fetchPdf({ data: { id } });
      if (mode === "download") downloadPdf(filename, base64);
      else openPdf(base64);
    },
    onMutate: () => setFailed(false),
    onError: () => setFailed(true),
  });
  return (
    <>
      <button type="button" className={SECONDARY_BUTTON} disabled={pdf.isPending} onClick={() => pdf.mutate("download")}>
        {pdf.isPending ? "Préparation…" : "Télécharger le PDF"}
      </button>
      <button type="button" className={SECONDARY_BUTTON} disabled={pdf.isPending} onClick={() => pdf.mutate("print")}>
        Imprimer
      </button>
      {failed && <ErrorNote>Le PDF n'a pas pu être généré. Réessayez.</ErrorNote>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

export function QuoteDetailPage({ quoteId }: { quoteId: string }) {
  const fetchQuote = useServerFn(getMyQuote);
  const fetchPdf = useServerFn(getMyQuotePdf);
  const setStatus = useServerFn(setMyQuoteStatus);
  const convert = useServerFn(convertMyQuoteToInvoice);
  const duplicate = useServerFn(duplicateMyQuote);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [missing, setMissing] = useState<string[]>([]);
  const [actionError, setActionError] = useState(false);

  const quote = useQuery({ queryKey: [...QUOTES_KEY, quoteId] as const, queryFn: () => fetchQuote({ data: { id: quoteId } }) });

  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: QUOTES_KEY }), queryClient.invalidateQueries({ queryKey: INVOICES_KEY })]);

  const status = useMutation({
    mutationFn: (to: QuoteStatus) => setStatus({ data: { id: quoteId, status: to } }),
    onMutate: () => setActionError(false),
    onSuccess: refresh,
    onError: () => setActionError(true),
  });
  const toInvoice = useMutation({
    mutationFn: () => convert({ data: { id: quoteId } }),
    onMutate: () => {
      setActionError(false);
      setMissing([]);
    },
    onSuccess: async (invoice) => {
      await refresh();
      // Le relieur voit tout de suite la facture qu'il vient de créer.
      void navigate({ to: "/atelier/factures/$invoiceId", params: { invoiceId: invoice.id } });
    },
    onError: (error) => {
      const parsed = parseServerError(error);
      if (parsed.code === "profile_incomplete") setMissing(parsed.missing);
      else setActionError(true);
    },
  });
  const copy = useMutation({
    mutationFn: () => duplicate({ data: { id: quoteId } }),
    onSuccess: async (draft) => { await refresh(); void navigate({ to: "/atelier/devis/$quoteId/modifier", params: { quoteId: draft.id } }); },
    onError: () => setActionError(true),
  });

  if (quote.isPending) return <Loading />;
  if (quote.error || !quote.data) return <ErrorNote>Devis introuvable.</ErrorNote>;
  const doc = quote.data;
  const current = doc.status as QuoteStatus;
  const busy = status.isPending || toInvoice.isPending;

  return (
    <div className="space-y-5">
      <Link to="/atelier/devis" className="text-sm text-muted-foreground underline">← Devis et factures</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Devis {doc.number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateLong(doc.issueDate)}{doc.validUntil ? ` · valable jusqu'au ${formatDateLong(doc.validUntil)}` : ""}
          </p>
        </div>
        <QuoteStatusBadge status={current} validUntil={doc.validUntil} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {canConvertToInvoice(current) && (
          <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => toInvoice.mutate()}>
            {toInvoice.isPending ? "Préparation de la facture…" : "Préparer la facture"}
          </button>
        )}
        {isEditable(current) && (
          <Link to="/atelier/devis/$quoteId/modifier" params={{ quoteId: doc.id }} className={SECONDARY_BUTTON}>Modifier</Link>
        )}
        <button type="button" className={SECONDARY_BUTTON} disabled={copy.isPending} onClick={() => copy.mutate()}>Dupliquer</button>
        <PdfActions fetchPdf={fetchPdf} id={doc.id} />
      </div>

      {doc.linkedInvoiceId && (
        <p className="rounded-md border border-border bg-card px-4 py-3 text-sm">
          Ce devis a été facturé :{" "}
          <Link to="/atelier/factures/$invoiceId" params={{ invoiceId: doc.linkedInvoiceId }} className="font-medium underline">
            facture {doc.linkedInvoiceNumber}
          </Link>
          .
        </p>
      )}

      {missing.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium">Pour émettre une facture, complétez votre identité : {missing.join(", ").toLowerCase()}.</p>
          <Link to="/atelier/tarifs" className="mt-1 inline-block underline">Compléter mon profil</Link>
        </div>
      )}
      {actionError && <ErrorNote>Cette action n'a pas pu être effectuée. Rechargez la page et réessayez.</ErrorNote>}

      <DocumentBody doc={doc} />

      {allowedTransitions(current).length > 0 && (
        <section aria-labelledby="doc-status" className={CARD}>
          <h2 id="doc-status" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suivi</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {allowedTransitions(current).map((to) => (
              <button key={to} type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => status.mutate(to)}>
                {TRANSITION_LABELS[to] ?? QUOTE_STATUS_LABELS[to]}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facture
// ---------------------------------------------------------------------------

const valueOrNull = (value: string) => value.trim() || null;

function InvoiceDraftEditor({ doc }: { doc: DocumentView }) {
  const updateDraft = useServerFn(updateMyInvoiceDraft);
  const issue = useServerFn(issueMyInvoice);
  const queryClient = useQueryClient();
  const compliance = doc.invoiceCompliance!;
  const [draft, setDraft] = useState<InvoiceDraftInput>({
    issueDate: doc.issueDate,
    serviceDate: compliance.serviceDate,
    dueDate: compliance.dueDate,
    operationNature: compliance.operationNature,
    clientType: compliance.clientType,
    clientName: doc.client.name,
    clientLegalName: compliance.clientLegalName,
    clientEmail: doc.client.email,
    clientPhone: doc.client.phone,
    clientAddressLine1: doc.client.addressLine1,
    clientPostalCode: doc.client.postalCode,
    clientCity: doc.client.city,
    clientCountry: doc.client.country,
    clientBillingAddressLine1: compliance.billingAddressLine1,
    clientBillingPostalCode: compliance.billingPostalCode,
    clientBillingCity: compliance.billingCity,
    clientBillingCountry: compliance.billingCountry,
    clientSiren: compliance.clientSiren,
    clientVatNumber: compliance.clientVatNumber,
    clientPurchaseOrderNumber: compliance.purchaseOrderNumber,
    clientPublicServiceCode: compliance.publicServiceCode,
    clientPublicCommitmentNumber: compliance.publicCommitmentNumber,
    deliveryAddressLine1: compliance.deliveryAddressLine1,
    deliveryPostalCode: compliance.deliveryPostalCode,
    deliveryCity: compliance.deliveryCity,
    deliveryCountry: compliance.deliveryCountry,
    paymentTerms: doc.paymentTerms,
    earlyPaymentDiscountTerms: compliance.earlyPaymentDiscountTerms,
    latePenaltyTerms: compliance.latePenaltyTerms,
    notes: doc.notes,
  });
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const set = (patch: Partial<InvoiceDraftInput>) => setDraft((current) => ({ ...current, ...patch }));
  const text = (key: keyof InvoiceDraftInput) => String(draft[key] ?? "");
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [...INVOICES_KEY, doc.id] }),
    queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
    queryClient.invalidateQueries({ queryKey: QUOTES_KEY }),
  ]);

  const save = useMutation({
    mutationFn: () => updateDraft({ data: { id: doc.id, draft } }),
    onMutate: () => { setSaved(false); setFailed(false); },
    onSuccess: async () => { await refresh(); setSaved(true); },
    onError: () => setFailed(true),
  });
  const emit = useMutation({
    mutationFn: async () => {
      await updateDraft({ data: { id: doc.id, draft } });
      return issue({ data: { id: doc.id } });
    },
    onMutate: () => { setMissing([]); setFailed(false); },
    onSuccess: refresh,
    onError: (error) => {
      const parsed = parseServerError(error);
      if (parsed.code === "profile_incomplete") setMissing(parsed.missing);
      else setFailed(true);
    },
  });
  const field = (key: keyof InvoiceDraftInput, label: string, type = "text") => (
    <Field label={label} htmlFor={`invoice-${String(key)}`}>
      <input id={`invoice-${String(key)}`} type={type} className={FIELD} value={text(key)} onChange={(event) => set({ [key]: valueOrNull(event.target.value) } as Partial<InvoiceDraftInput>)} />
    </Field>
  );

  return (
    <form className={`${CARD} space-y-5`} onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">Brouillon</p>
        <h2 className="mt-1 font-serif text-xl">Vérifier avant émission</h2>
        <p className="mt-1 text-sm text-muted-foreground">Le numéro définitif sera attribué uniquement à l'émission. Les informations seront alors figées.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("issueDate", "Date d'émission", "date")}
        {field("serviceDate", "Date de prestation", "date")}
        {field("dueDate", "Date d'échéance", "date")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de client" htmlFor="invoice-client-type">
          <select id="invoice-client-type" className={FIELD} value={draft.clientType ?? ""} onChange={(event) => set({ clientType: (event.target.value || null) as InvoiceDraftInput["clientType"] })}>
            <option value="">À renseigner</option>
            <option value="individual">Particulier</option><option value="business">Entreprise</option><option value="public_entity">Entité publique</option>
          </select>
        </Field>
        <Field label="Nature de l'opération" htmlFor="invoice-operation-nature">
          <select id="invoice-operation-nature" className={FIELD} value={draft.operationNature ?? ""} onChange={(event) => set({ operationNature: (event.target.value || null) as InvoiceDraftInput["operationNature"] })}>
            <option value="">À renseigner</option><option value="services">Services</option><option value="goods">Biens</option><option value="mixed">Mixte</option>
          </select>
        </Field>
        {field("clientName", "Nom du client")}
        {draft.clientType !== "individual" && field("clientLegalName", draft.clientType === "public_entity" ? "Nom de l'entité publique" : "Raison sociale")}
        {draft.clientType !== "individual" && field("clientSiren", "SIREN client")}
        {draft.clientType !== "individual" && field("clientVatNumber", "Numéro de TVA client")}
        {draft.clientType !== "individual" && field("clientPurchaseOrderNumber", "Bon de commande (facultatif)")}
        {draft.clientType === "public_entity" && field("clientPublicServiceCode", "Code service")}
        {draft.clientType === "public_entity" && field("clientPublicCommitmentNumber", "Numéro d'engagement")}
        {field("clientBillingAddressLine1", "Adresse de facturation")}
        {field("clientBillingPostalCode", "Code postal de facturation")}
        {field("clientBillingCity", "Ville de facturation")}
        {field("clientBillingCountry", "Pays de facturation")}
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold">Adresse de livraison différente</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {field("deliveryAddressLine1", "Adresse de livraison")}{field("deliveryPostalCode", "Code postal")}{field("deliveryCity", "Ville")}{field("deliveryCountry", "Pays")}
        </div>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Conditions de paiement" htmlFor="invoice-payment"><textarea id="invoice-payment" rows={2} className={`${FIELD} h-auto py-2`} value={text("paymentTerms")} onChange={(event) => set({ paymentTerms: valueOrNull(event.target.value) })} /></Field>
        <Field label="Conditions d'escompte" htmlFor="invoice-discount"><textarea id="invoice-discount" rows={2} className={`${FIELD} h-auto py-2`} value={text("earlyPaymentDiscountTerms")} onChange={(event) => set({ earlyPaymentDiscountTerms: valueOrNull(event.target.value) })} /></Field>
        <Field label="Pénalités de retard" htmlFor="invoice-penalties"><textarea id="invoice-penalties" rows={2} className={`${FIELD} h-auto py-2`} value={text("latePenaltyTerms")} onChange={(event) => set({ latePenaltyTerms: valueOrNull(event.target.value) })} /></Field>
        <Field label="Notes visibles" htmlFor="invoice-notes"><textarea id="invoice-notes" rows={2} className={`${FIELD} h-auto py-2`} value={text("notes")} onChange={(event) => set({ notes: valueOrNull(event.target.value) })} /></Field>
      </div>
      {missing.length > 0 && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm"><p className="font-semibold">Impossible d'émettre la facture :</p><ul className="mt-2 list-disc pl-5">{missing.map((item) => <li key={item}>{item}</li>)}</ul>{missing.some((item) => item.includes("atelier")) && <Link to="/atelier/tarifs" className="mt-2 inline-block underline">Compléter le profil atelier</Link>}</div>}
      {failed && <ErrorNote>L'action n'a pas pu aboutir. Rechargez la page et réessayez.</ErrorNote>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={SECONDARY_BUTTON} disabled={save.isPending || emit.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
        <button type="button" className={PRIMARY_BUTTON} disabled={save.isPending || emit.isPending} onClick={() => emit.mutate()}>{emit.isPending ? "Émission…" : "Émettre la facture"}</button>
        {saved && <span role="status" className="text-sm text-emerald-700">Brouillon enregistré ✓</span>}
      </div>
    </form>
  );
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const fetchInvoice = useServerFn(getMyInvoice);
  const fetchPdf = useServerFn(getMyInvoicePdf);
  const createCreditNote = useServerFn(createMyFullCreditNote);
  const queryClient = useQueryClient();
  const [creditReason, setCreditReason] = useState("");
  const [creditError, setCreditError] = useState(false);
  const invoice = useQuery({ queryKey: [...INVOICES_KEY, invoiceId] as const, queryFn: () => fetchInvoice({ data: { id: invoiceId } }) });
  const credit = useMutation({
    mutationFn: () => createCreditNote({ data: { id: invoiceId, reason: creditReason } }),
    onMutate: () => setCreditError(false),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [...INVOICES_KEY, invoiceId] }),
      queryClient.invalidateQueries({ queryKey: INVOICES_KEY }),
    ]),
    onError: () => setCreditError(true),
  });

  if (invoice.isPending) return <Loading />;
  if (invoice.error || !invoice.data) return <ErrorNote>Facture introuvable.</ErrorNote>;
  const doc = invoice.data;

  return (
    <div className="space-y-5">
      <Link to="/atelier/devis" className="text-sm text-muted-foreground underline">← Devis et factures</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">{doc.status === "draft" ? "Facture en préparation" : `Facture ${doc.number}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateLong(doc.issueDate)}
            {doc.linkedQuoteId && (
              <>
                {" · facture issue du devis "}
                <Link to="/atelier/devis/$quoteId" params={{ quoteId: doc.linkedQuoteId }} className="underline">{doc.linkedQuoteNumber ?? "d'origine"}</Link>
              </>
            )}
          </p>
        </div>
        {doc.status !== "draft" && doc.payment && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold">{PAYMENT_LABELS[doc.payment.status]}</span>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {doc.status !== "draft" && <PdfActions fetchPdf={fetchPdf} id={doc.id} />}
      </div>
      {doc.status === "draft" ? <InvoiceDraftEditor doc={doc} /> : <p className="text-sm text-muted-foreground">Cette facture est émise et ne peut plus être modifiée ni supprimée. Une correction passe par un avoir.</p>}
      <DocumentBody doc={doc} />
      {doc.status !== "draft" && <section aria-labelledby="credit-note-title" className={CARD}>
        <h2 id="credit-note-title" className="font-serif text-lg">Rectification</h2>
        {doc.creditNote ? <p className="mt-2 text-sm">Avoir complet {doc.creditNote.number}, émis le {formatDateLong(doc.creditNote.issueDate)}. La facture d'origine reste inchangée.</p> : <>
          <p className="mt-1 text-sm text-muted-foreground">Un avoir complet annule économiquement cette facture tout en conservant la pièce d'origine.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Motif de l'avoir" htmlFor="credit-note-reason"><input id="credit-note-reason" className={FIELD} value={creditReason} onChange={(event) => setCreditReason(event.target.value)} /></Field>
            <button type="button" className={SECONDARY_BUTTON} disabled={!creditReason.trim() || credit.isPending} onClick={() => credit.mutate()}>{credit.isPending ? "Création…" : "Créer l'avoir complet"}</button>
          </div>
          {creditError && <ErrorNote>L'avoir n'a pas pu être créé. Réessayez.</ErrorNote>}
        </>}
      </section>}
    </div>
  );
}
