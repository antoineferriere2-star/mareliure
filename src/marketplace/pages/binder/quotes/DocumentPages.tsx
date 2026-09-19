/**
 * Le détail d'un devis et d'une facture : ce qui a été enregistré, le PDF, et la
 * prochaine action évidente — « Marquer comme accepté », puis « Convertir en
 * facture ». Une facture est en lecture seule : elle ne se modifie pas.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  convertMyQuoteToInvoice,
  getMyInvoice,
  getMyInvoicePdf,
  getMyQuote,
  getMyQuotePdf,
  setMyQuoteStatus,
} from "@/marketplace/services/binderQuotes.data.functions";
import { allowedTransitions, canConvertToInvoice, isEditable, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/marketplace/quotes/quoteStatus";
import { formatDimensions } from "@/marketplace/quotes/quoteLines";
import { downloadPdf, euros, formatDateLong, openPdf, parseServerError } from "@/marketplace/quotes/quoteFormat";
import type { DocumentView } from "@/marketplace/quotes/quoteViews";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, PAYMENT_LABELS, PRIMARY_BUTTON, QuoteStatusBadge, SECONDARY_BUTTON } from "./quoteUi";
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
            <tbody>
              {doc.items.map((item) => (
                <tr key={item.position} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{item.label}</span>
                    {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{String(item.quantity).replace(".", ",")}{item.unit ? ` ${item.unit}` : ""}</td>
                  <td className="py-2 text-right tabular-nums">{euros(item.unitPriceCents)}</td>
                  {showVat && <td className="py-2 text-right tabular-nums">{String(item.vatRateBps / 100).replace(".", ",")} %</td>}
                  <td className="py-2 text-right tabular-nums">{euros(item.totalHtCents)}</td>
                </tr>
              ))}
            </tbody>
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
            {toInvoice.isPending ? "Création de la facture…" : "Convertir en facture"}
          </button>
        )}
        {isEditable(current) && (
          <Link to="/atelier/devis/$quoteId/modifier" params={{ quoteId: doc.id }} className={SECONDARY_BUTTON}>Modifier</Link>
        )}
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

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const fetchInvoice = useServerFn(getMyInvoice);
  const fetchPdf = useServerFn(getMyInvoicePdf);
  const invoice = useQuery({ queryKey: [...INVOICES_KEY, invoiceId] as const, queryFn: () => fetchInvoice({ data: { id: invoiceId } }) });

  if (invoice.isPending) return <Loading />;
  if (invoice.error || !invoice.data) return <ErrorNote>Facture introuvable.</ErrorNote>;
  const doc = invoice.data;

  return (
    <div className="space-y-5">
      <Link to="/atelier/devis" className="text-sm text-muted-foreground underline">← Devis et factures</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Facture {doc.number}</h1>
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
        {doc.payment && (
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold">{PAYMENT_LABELS[doc.payment.status]}</span>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <PdfActions fetchPdf={fetchPdf} id={doc.id} />
      </div>
      <p className="text-sm text-muted-foreground">Une facture émise ne se modifie pas.</p>
      <DocumentBody doc={doc} />
    </div>
  );
}
