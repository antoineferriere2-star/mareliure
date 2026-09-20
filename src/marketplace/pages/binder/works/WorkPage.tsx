/**
 * La fiche d'un ouvrage — l'objet central. « Les Misérables — Victor Hugo · Mme Martin · 220 × 145 ×
 * 32 mm · Dos détaché » se lit en cinq secondes ; dessous, tout ce qui s'y rattache : ses devis et ses
 * factures. Le devis part de la fiche (contact et livre déjà connus : rien à ressaisir).
 */
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyWork, setMyWorkArchived } from "@/marketplace/services/binderWorks.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, PAYMENT_LABELS, PRIMARY_BUTTON, QuoteStatusBadge, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { euros, formatDateLong } from "@/marketplace/quotes/quoteFormat";
import { isQuoteStatus } from "@/marketplace/quotes/quoteStatus";
import type { DocumentSummary } from "@/marketplace/quotes/quoteViews";
import { formatWeight, formatWorkDimensions } from "@/marketplace/works/workViews";
import { WORK_KEY, WORKS_KEY } from "./workKeys";

/** La provenance d'un ouvrage, dite sans ambiguïté : les deux voies ne se confondent jamais. */
export function SourceBadge({ source }: { source: "mon_client" | "ma_reliure" }) {
  return source === "ma_reliure" ? (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      Projet apporté par Ma Reliure
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
      Mon client · Aucune commission Ma Reliure
    </span>
  );
}

/** Une liste de devis ou de factures, cliquable. */
export function DocumentRows({ documents, empty }: { documents: DocumentSummary[]; empty: string }) {
  if (documents.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {documents.map((doc) => (
        <li key={`${doc.kind}-${doc.id}`}>
          <Link
            {...(doc.kind === "quote"
              ? { to: "/atelier/devis/$quoteId" as const, params: { quoteId: doc.id } }
              : { to: "/atelier/factures/$invoiceId" as const, params: { invoiceId: doc.id } })}
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{doc.number}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {formatDateLong(doc.issueDate)}
                {doc.bookTitle ? ` · ${doc.bookTitle}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular-nums">{euros(doc.totalTtcCents)}</span>
              {doc.kind === "quote" && isQuoteStatus(doc.status) ? (
                <QuoteStatusBadge status={doc.status} validUntil={doc.validUntil} />
              ) : (
                <span className="text-xs text-muted-foreground">{PAYMENT_LABELS[doc.status as keyof typeof PAYMENT_LABELS] ?? doc.status}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function WorkPage({ workId }: { workId: string }) {
  const fetchWork = useServerFn(getMyWork);
  const setArchived = useServerFn(setMyWorkArchived);
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: [...WORK_KEY, workId] as const, queryFn: () => fetchWork({ data: { id: workId } }) });
  const archive = useMutation({
    mutationFn: (archived: boolean) => setArchived({ data: { id: workId, archived } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORK_KEY });
      void queryClient.invalidateQueries({ queryKey: WORKS_KEY });
    },
  });

  if (detail.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detail.isError || !detail.data) return <ErrorNote>Cet ouvrage est introuvable.</ErrorNote>;
  const { work, contact, quotes, invoices } = detail.data;
  const dimensions = formatWorkDimensions(work);
  const weight = formatWeight(work.weightGrams);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/atelier/ouvrages" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
          Retour aux ouvrages
        </Link>
        <h1 className="font-serif text-2xl">
          {work.title}
          {work.author && <span className="font-sans text-lg font-normal text-muted-foreground"> — {work.author}</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{work.reference}</span>
          <span aria-hidden="true">·</span>
          {contact ? (
            <Link to="/atelier/contacts/$contactId" params={{ contactId: contact.id }} className="inline-flex min-h-11 items-center underline">
              {contact.name}
            </Link>
          ) : (
            <span>Sans contact</span>
          )}
          {work.status === "archived" && <span>· archivé</span>}
        </div>
        <SourceBadge source={work.source} />
      </header>

      <div className="flex flex-wrap gap-2">
        {work.status === "active" && (
          <Link to="/atelier/devis/nouveau" search={{ workId: work.id }} className={PRIMARY_BUTTON}>
            Créer un devis
          </Link>
        )}
        <Link to="/atelier/ouvrages/$workId/modifier" params={{ workId: work.id }} className={SECONDARY_BUTTON}>
          Modifier
        </Link>
        <button type="button" className={SECONDARY_BUTTON} disabled={archive.isPending} onClick={() => archive.mutate(work.status === "active")}>
          {work.status === "active" ? "Archiver" : "Désarchiver"}
        </button>
      </div>
      {archive.isError && <ErrorNote>L'opération n'a pas pu aboutir. Réessayez.</ErrorNote>}

      <section aria-labelledby="work-facts" className={CARD}>
        <h2 id="work-facts" className="sr-only">Description de l'ouvrage</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {work.editionNote && <Fact label="Édition" value={work.editionNote} />}
          {dimensions && <Fact label="Dimensions (H × L × é)" value={dimensions} />}
          {weight && <Fact label="Poids" value={weight} />}
          {work.declaredValueCents !== null && <Fact label="Valeur déclarée" value={euros(work.declaredValueCents)} />}
          {work.conditionNotes && <Fact label="État et observations" value={work.conditionNotes} wide />}
          {work.description && <Fact label="Description" value={work.description} wide />}
          {work.internalNotes && <Fact label="Notes internes" value={work.internalNotes} wide />}
        </dl>
        {!work.editionNote && !dimensions && !weight && work.declaredValueCents === null && !work.conditionNotes && !work.description && !work.internalNotes && (
          <p className="text-sm text-muted-foreground">
            Rien d'autre n'est renseigné. <Link to="/atelier/ouvrages/$workId/modifier" params={{ workId: work.id }} className="underline">Ajouter les dimensions et l'état</Link>.
          </p>
        )}
      </section>

      <section aria-labelledby="work-quotes" className="space-y-3">
        <h2 id="work-quotes" className="font-serif text-xl">Devis</h2>
        <DocumentRows documents={quotes} empty="Aucun devis pour cet ouvrage." />
      </section>

      <section aria-labelledby="work-invoices" className="space-y-3">
        <h2 id="work-invoices" className="font-serif text-xl">Factures</h2>
        <DocumentRows documents={invoices} empty="Aucune facture pour cet ouvrage." />
      </section>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  );
}
