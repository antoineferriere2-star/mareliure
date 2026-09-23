/**
 * « Devis et factures » : une liste, deux onglets, un bouton principal.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { duplicateMyQuote, getMyInvoices, getMyQuotePdf, getMyQuotes } from "@/marketplace/services/binderQuotes.data.functions";
import { downloadPdf, euros, formatDateLong } from "@/marketplace/quotes/quoteFormat";
import type { QuoteStatus } from "@/marketplace/quotes/quoteStatus";
import type { DocumentSummary } from "@/marketplace/quotes/quoteViews";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, PAYMENT_LABELS, PRIMARY_BUTTON, QuoteStatusBadge } from "./quoteUi";
import { INVOICES_KEY, QUOTES_KEY } from "./quoteQueryKeys";
import { BinderEmptyState, BinderPageHeader } from "../BinderPageUi";

export function QuotesListPage({ initialTab = "quotes" }: { initialTab?: "quotes" | "invoices" }) {
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchInvoices = useServerFn(getMyInvoices);
  const duplicate = useServerFn(duplicateMyQuote);
  const fetchPdf = useServerFn(getMyQuotePdf);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"quotes" | "invoices">(initialTab);
  const [query, setQuery] = useState("");
  const [quoteFilter, setQuoteFilter] = useState<"all" | "draft" | "sent" | "accepted" | "refused" | "invoiced">("all");
  const [actionError, setActionError] = useState(false);
  const copy = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: (quote) => { void queryClient.invalidateQueries({ queryKey: QUOTES_KEY }); void navigate({ to: "/atelier/devis/$quoteId/modifier", params: { quoteId: quote.id } }); },
    onError: () => setActionError(true),
  });
  const pdf = useMutation({
    mutationFn: async (id: string) => { const result = await fetchPdf({ data: { id } }); downloadPdf(result.filename, result.base64); },
    onError: () => setActionError(true),
  });
  const quotes = useQuery({ queryKey: QUOTES_KEY, queryFn: () => fetchQuotes() });
  const invoices = useQuery({ queryKey: INVOICES_KEY, queryFn: () => fetchInvoices() });
  const active = tab === "quotes" ? quotes : invoices;
  const filtered = Boolean(query.trim()) || (tab === "quotes" && quoteFilter !== "all");
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return ((active.data ?? []) as DocumentSummary[]).filter((row) => {
      const matchesSearch = !needle || `${row.number} ${row.clientName} ${row.bookTitle ?? ""}`.toLocaleLowerCase("fr-FR").includes(needle);
      return matchesSearch && (tab !== "quotes" || quoteFilter === "all" || row.status === quoteFilter);
    });
  }, [active.data, query, quoteFilter, tab]);

  return (
    <div className="space-y-6">
      <BinderPageHeader eyebrow="Documents" title={tab === "quotes" ? "Devis" : "Factures"} description="Le livre, les prestations et le chiffrage au même endroit." action={<Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>Nouveau devis</Link>} />

      <div role="tablist" aria-label="Type de document" className="flex gap-2 border-b border-border">
        {(
          [
            ["quotes", "Devis", quotes.data?.length],
            ["invoices", "Factures", invoices.data?.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium ${tab === key ? "border-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {label}
            {count ? <span className="ml-2 text-xs text-muted-foreground">{count}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input aria-label="Rechercher un devis" className="min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:w-80" placeholder="Client, ouvrage ou numéro…" value={query} onChange={(event) => setQuery(event.target.value)} />
        {tab === "quotes" && <div className="flex flex-wrap gap-1" aria-label="Filtrer les devis">
          {([['all', 'Tous'], ['draft', 'Brouillons'], ['sent', 'Envoyés'], ['accepted', 'Acceptés'], ['refused', 'Refusés'], ['invoiced', 'Facturés']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setQuoteFilter(value)} className={`min-h-9 rounded-full px-3 text-xs font-medium ${quoteFilter === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{label}</button>
          ))}
        </div>}
      </div>
      {actionError && <ErrorNote>Cette action n'a pas abouti. Réessayez.</ErrorNote>}

      {active.isPending ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Chargement…</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : active.error ? (
        <ErrorNote>Impossible de charger la liste. Rechargez la page.</ErrorNote>
      ) : rows.length === 0 ? (
        <BinderEmptyState title={filtered ? "Aucun document ne correspond" : tab === "quotes" ? "Aucun devis pour le moment" : "Aucune facture pour le moment"} description={filtered ? "Modifiez la recherche ou les filtres." : tab === "quotes" ? "Choisissez le client, le livre et les prestations : le total se construit immédiatement." : "Une facture se crée depuis un devis accepté."} action={!filtered && tab === "quotes" ? <Link to="/atelier/devis/nouveau" className={PRIMARY_BUTTON}>Créer mon premier devis</Link> : undefined} />
      ) : (
        <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
          {rows.map((row) => (
            <li key={row.id}>
              {row.kind === "quote" ? (
                <div className="px-4 py-3 sm:px-5">
                  <RowBody row={row} />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <Link className="underline" to="/atelier/devis/$quoteId" params={{ quoteId: row.id }}>Ouvrir</Link>
                    {row.status === "draft" && <Link className="underline" to="/atelier/devis/$quoteId/modifier" params={{ quoteId: row.id }}>Modifier</Link>}
                    <button type="button" className="underline disabled:opacity-50" disabled={copy.isPending} onClick={() => copy.mutate(row.id)}>Dupliquer</button>
                    <button type="button" className="underline disabled:opacity-50" disabled={pdf.isPending} onClick={() => pdf.mutate(row.id)}>PDF</button>
                  </div>
                </div>
              ) : (
                <Link to="/atelier/factures/$invoiceId" params={{ invoiceId: row.id }} className="block px-4 py-3 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-5">
                  <RowBody row={row} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowBody({ row }: { row: DocumentSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {row.clientName}
          {row.bookTitle ? <span className="font-normal text-muted-foreground"> · {row.bookTitle}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.number} · {formatDateLong(row.issueDate)}
        </p>
      </div>
      {row.kind === "quote" ? (
        <QuoteStatusBadge status={row.status as QuoteStatus} validUntil={row.validUntil} />
      ) : (
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold">
          {row.status === "draft" ? "Brouillon" : PAYMENT_LABELS[row.status as keyof typeof PAYMENT_LABELS] ?? "Émise"}
        </span>
      )}
      <p className="w-28 text-right font-serif text-lg tabular-nums">{euros(row.totalTtcCents)}</p>
    </div>
  );
}
