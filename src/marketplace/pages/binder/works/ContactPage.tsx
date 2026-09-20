/**
 * La fiche d'un contact : ses coordonnées, ses ouvrages, ses devis, ses factures. C'est tout —
 * retrouver un client et ce qu'on a fait pour lui.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContact, setMyContactArchived } from "@/marketplace/services/binderWorks.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { workOneLiner } from "@/marketplace/works/workViews";
import { ContactForm } from "./ContactForm";
import { DocumentRows } from "./WorkPage";
import { CONTACT_KEY, CONTACTS_KEY } from "./workKeys";

export function ContactPage({ contactId }: { contactId: string }) {
  const fetchContact = useServerFn(getMyContact);
  const setArchived = useServerFn(setMyContactArchived);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const detail = useQuery({ queryKey: [...CONTACT_KEY, contactId] as const, queryFn: () => fetchContact({ data: { id: contactId } }) });
  const archive = useMutation({
    mutationFn: (archived: boolean) => setArchived({ data: { id: contactId, archived } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACT_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });

  if (detail.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detail.isError || !detail.data) return <ErrorNote>Ce contact est introuvable.</ErrorNote>;
  const { contact, works, quotes, invoices } = detail.data;
  const address = [contact.addressLine1, [contact.postalCode, contact.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link to="/atelier/contacts" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
          Retour aux contacts
        </Link>
        <h1 className="font-serif text-2xl">
          {contact.name}
          {contact.archived && <span className="ml-2 text-base font-normal text-muted-foreground">(archivé)</span>}
        </h1>
        {contact.origin === "ma_reliure" && (
          <p className="text-sm text-muted-foreground">Contact issu d'un projet apporté par Ma Reliure.</p>
        )}
      </header>

      {editing ? (
        <ContactForm initial={contact} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : (
        <section aria-labelledby="contact-info" className={CARD}>
          <h2 id="contact-info" className="sr-only">Coordonnées</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {contact.email && (
              <div>
                <dt className="text-xs text-muted-foreground">E-mail</dt>
                <dd><a className="underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd>
              </div>
            )}
            {contact.phone && (
              <div>
                <dt className="text-xs text-muted-foreground">Téléphone</dt>
                <dd><a className="underline" href={`tel:${contact.phone}`}>{contact.phone}</a></dd>
              </div>
            )}
            {address && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Adresse</dt>
                <dd>{address}</dd>
              </div>
            )}
            {contact.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-line">{contact.notes}</dd>
              </div>
            )}
          </dl>
          {!contact.email && !contact.phone && !address && !contact.notes && (
            <p className="text-sm text-muted-foreground">Aucune coordonnée enregistrée.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(true)}>
              Modifier
            </button>
            <button type="button" className={SECONDARY_BUTTON} disabled={archive.isPending} onClick={() => archive.mutate(!contact.archived)}>
              {contact.archived ? "Désarchiver" : "Archiver"}
            </button>
          </div>
          {archive.isError && <div className="mt-3"><ErrorNote>L'opération n'a pas pu aboutir. Réessayez.</ErrorNote></div>}
        </section>
      )}

      <section aria-labelledby="contact-works" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="contact-works" className="font-serif text-xl">Ouvrages</h2>
          <Link to="/atelier/ouvrages/nouveau" search={{ contactId: contact.id }} className={PRIMARY_BUTTON}>
            Nouvel ouvrage
          </Link>
        </div>
        {works.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun ouvrage pour ce contact.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {works.map((w) => (
              <li key={w.id}>
                <Link to="/atelier/ouvrages/$workId" params={{ workId: w.id }} className="block px-4 py-3 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                  <span className="block font-medium">{workOneLiner({ ...w, contactName: null })}</span>
                  <span className="block text-xs text-muted-foreground">
                    {w.reference} · {w.quoteCount} devis{w.status === "archived" ? " · archivé" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="contact-quotes" className="space-y-3">
        <h2 id="contact-quotes" className="font-serif text-xl">Devis</h2>
        <DocumentRows documents={quotes} empty="Aucun devis pour ce contact." />
      </section>

      <section aria-labelledby="contact-invoices" className="space-y-3">
        <h2 id="contact-invoices" className="font-serif text-xl">Factures</h2>
        <DocumentRows documents={invoices} empty="Aucune facture pour ce contact." />
      </section>
    </div>
  );
}
