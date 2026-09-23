/**
 * Les contacts de l'atelier : retrouver un client, voir combien d'ouvrages et de documents lui sont
 * liés, en créer un. Une liste et une recherche — pas de pipeline, pas de score, pas de campagne.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { getMyContacts } from "@/marketplace/services/binderWorks.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, FIELD, PRIMARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { ContactForm } from "./ContactForm";
import { CONTACTS_KEY } from "./workKeys";
import { matchesSearch } from "@/marketplace/works/workSearch";
import { BinderEmptyState, BinderPageHeader } from "../BinderPageUi";

export function ContactsPage() {
  const fetchContacts = useServerFn(getMyContacts);
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const contacts = useQuery({
    queryKey: [...CONTACTS_KEY, { showArchived }] as const,
    queryFn: () => fetchContacts({ data: { includeArchived: showArchived } }),
  });

  const rows = (contacts.data ?? []).filter((c) =>
    matchesSearch([c.name, c.organization, c.email, c.phone, c.city].filter(Boolean).join(" "), search),
  );

  return (
    <div className="space-y-5">
      <BinderPageHeader eyebrow="Carnet d'atelier" title="Contacts" description="Retrouvez un client, ses ouvrages et ses documents sans ressaisie." action={!creating ? (
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>
            Nouveau contact
          </button>
        ) : undefined} />

      {creating && (
        <ContactForm
          initial={null}
          onCancel={() => setCreating(false)}
          onSaved={(contact) => void navigate({ to: "/atelier/contacts/$contactId", params: { contactId: contact.id } })}
        />
      )}

      {contacts.isPending && (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Chargement…</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {contacts.isError && <ErrorNote>Les contacts n'ont pas pu être chargés. Rechargez la page.</ErrorNote>}

      {contacts.data && (
        <>
          {contacts.data.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  aria-label="Chercher un contact"
                  placeholder="Chercher un contact…"
                  className={`${FIELD} pl-9`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
                Afficher les contacts archivés
              </label>
            </div>
          )}

          {contacts.data.length === 0 ? (
            <BinderEmptyState title="Aucun contact pour le moment" description="Créez un contact pour retrouver ses ouvrages, ses devis et ses factures au même endroit." />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun contact ne correspond à « {search} ».</p>
          ) : (
            <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/atelier/contacts/$contactId"
                    params={{ contactId: c.id }}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {c.name}
                        {c.archived && <span className="ml-2 text-xs font-normal text-muted-foreground">(archivé)</span>}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[c.email, c.phone, c.city].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {c.workCount} ouvrage{c.workCount > 1 ? "s" : ""}
                      <br />
                      {c.documentCount} document{c.documentCount > 1 ? "s" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
