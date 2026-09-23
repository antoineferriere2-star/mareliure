/**
 * Les ouvrages de l'atelier : « je pose un livre sur mon établi, je crée son dossier ». Une liste
 * qui se lit comme des livres (titre, contact, dimensions, état), une recherche tolérante, et un
 * gros bouton pour en créer un — l'écran est pensé pour un téléphone tenu d'une main.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, FIELD, PRIMARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { matchesSearch } from "@/marketplace/works/workSearch";
import { formatWorkDimensions } from "@/marketplace/works/workViews";
import { WORKS_KEY } from "./workKeys";
import { BinderEmptyState, BinderPageHeader } from "../BinderPageUi";

export function WorksPage() {
  const fetchWorks = useServerFn(getMyWorks);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const works = useQuery({
    queryKey: [...WORKS_KEY, { showArchived }] as const,
    queryFn: () => fetchWorks({ data: { includeArchived: showArchived } }),
  });
  const rows = (works.data ?? []).filter((w) =>
    matchesSearch([w.title, w.author, w.contactName, w.reference, w.conditionNotes].filter(Boolean).join(" "), search),
  );

  return (
    <div className="space-y-5">
      <BinderPageHeader eyebrow="Bibliothèque de travail" title="Ouvrages" description="Chaque fiche rassemble le livre, son client et les documents associés." action={<Link to="/atelier/ouvrages/nouveau" className={PRIMARY_BUTTON}>Nouvel ouvrage</Link>} />

      {works.isPending && (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Chargement…</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {works.isError && <ErrorNote>Les ouvrages n'ont pas pu être chargés. Rechargez la page.</ErrorNote>}

      {works.data && (
        <>
          {works.data.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  aria-label="Chercher un ouvrage"
                  placeholder="Titre, auteur, contact…"
                  className={`${FIELD} pl-9`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                Afficher les archivés
              </label>
            </div>
          )}

          {works.data.length === 0 ? (
            <BinderEmptyState title="Aucun ouvrage pour le moment" description="Tout part d'un ouvrage : créez sa fiche, puis faites-en le devis sans rien ressaisir." action={<Link to="/atelier/ouvrages/nouveau" className={PRIMARY_BUTTON}>Créer mon premier ouvrage</Link>} />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun ouvrage ne correspond à « {search} ».</p>
          ) : (
            <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
              {rows.map((w) => {
                const dimensions = formatWorkDimensions(w);
                return (
                  <li key={w.id}>
                    <Link
                      to="/atelier/ouvrages/$workId"
                      params={{ workId: w.id }}
                      className="block px-4 py-3 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {w.title}
                          {w.author && <span className="font-normal text-muted-foreground"> — {w.author}</span>}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{w.reference}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {[w.contactName ?? "Sans contact", dimensions, w.conditionNotes].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {w.quoteCount} devis
                        {w.source === "ma_reliure" ? " · Source : Ma Reliure" : " · Source : Mon client"}
                        {w.status === "archived" ? " · archivé" : ""}
                        {` · Activité ${new Date(w.updatedAt ?? w.createdAt).toLocaleDateString("fr-FR")}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
