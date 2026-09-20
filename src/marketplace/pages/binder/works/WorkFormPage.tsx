/**
 * Créer ou modifier un ouvrage. Pensé pour un téléphone : trois champs suffisent (contact, titre,
 * dimensions) — le reste se replie. Un contact se choisit dans la liste ou se crée sur place, sans
 * quitter la page. Les dimensions sont en millimètres, le poids en grammes, la valeur en euros.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContacts, getMyWork, saveMyWork } from "@/marketplace/services/binderWorks.data.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { centsToEuroInput, parseEurosToCents } from "@/marketplace/quotes/quoteFormat";
import { parseMillimetres } from "@/marketplace/quotes/quoteLines";
import { workInput } from "@/marketplace/works/workInput";
import type { WorkView } from "@/marketplace/works/workViews";
import { ContactForm } from "./ContactForm";
import { CONTACTS_KEY, WORK_KEY, WORKS_KEY } from "./workKeys";

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

export function WorkFormPage({ workId, contactId }: { workId?: string; contactId?: string }) {
  const fetchWork = useServerFn(getMyWork);
  const fetchContacts = useServerFn(getMyContacts);
  const existing = useQuery({
    queryKey: [...WORK_KEY, workId] as const,
    queryFn: () => fetchWork({ data: { id: workId! } }),
    enabled: Boolean(workId),
  });
  const contacts = useQuery({ queryKey: [...CONTACTS_KEY, { showArchived: false }] as const, queryFn: () => fetchContacts({ data: {} }) });

  if (contacts.isPending || (workId && existing.isPending)) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (contacts.isError || existing.isError || !contacts.data) return <ErrorNote>Impossible de charger cette fiche. Rechargez la page.</ErrorNote>;
  return <WorkForm work={existing.data?.work ?? null} contacts={contacts.data.map((c) => ({ id: c.id, name: c.name }))} initialContactId={contactId} />;
}

function WorkForm({
  work,
  contacts,
  initialContactId,
}: {
  work: WorkView | null;
  contacts: { id: string; name: string }[];
  initialContactId?: string;
}) {
  const navigate = useNavigate();
  const save = useServerFn(saveMyWork);
  const queryClient = useQueryClient();
  const mm = (v: number | null) => (v === null ? "" : String(v));
  const [v, setV] = useState({
    contactId: work?.contactId ?? (initialContactId && contacts.some((c) => c.id === initialContactId) ? initialContactId : ""),
    title: work?.title ?? "",
    author: work?.author ?? "",
    editionNote: work?.editionNote ?? "",
    description: work?.description ?? "",
    height: mm(work?.heightMm ?? null),
    width: mm(work?.widthMm ?? null),
    thickness: mm(work?.thicknessMm ?? null),
    weight: work?.weightGrams == null ? "" : String(work.weightGrams),
    value: work?.declaredValueCents == null ? "" : centsToEuroInput(work.declaredValueCents),
    conditionNotes: work?.conditionNotes ?? "",
    internalNotes: work?.internalNotes ?? "",
  });
  const [addedContacts, setAddedContacts] = useState<{ id: string; name: string }[]>([]);
  const [newContact, setNewContact] = useState(contacts.length === 0);
  const [problems, setProblems] = useState<string[]>([]);
  const set = (key: keyof typeof v) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [key]: event.target.value }));
  // Un contact créé sur place revient aussi dans la liste rechargée : jamais deux fois.
  const allContacts = [...contacts, ...addedContacts.filter((a) => !contacts.some((c) => c.id === a.id))];

  const mutation = useMutation({
    mutationFn: async () => {
      const issues: string[] = [];
      const dim = (raw: string, label: string) => {
        if (raw.trim() === "") return null;
        const parsed = parseMillimetres(raw);
        if (parsed === null) issues.push(`${label} : un nombre de millimètres.`);
        return parsed;
      };
      const heightMm = dim(v.height, "Hauteur");
      const widthMm = dim(v.width, "Largeur");
      const thicknessMm = dim(v.thickness, "Épaisseur");
      let weightGrams: number | null = null;
      if (v.weight.trim() !== "") {
        const g = Number(v.weight.trim().replace(",", "."));
        if (!Number.isFinite(g) || g < 1 || g > 50_000) issues.push("Poids : un nombre de grammes (1 à 50 000).");
        else weightGrams = Math.round(g);
      }
      let declaredValueCents: number | null = null;
      if (v.value.trim() !== "") {
        declaredValueCents = parseEurosToCents(v.value);
        if (declaredValueCents === null) issues.push("Valeur déclarée : un montant en euros.");
      }
      if (!v.contactId) issues.push("Choisissez ou créez un contact.");
      if (v.title.trim() === "") issues.push("Le titre est requis.");
      const parsed = workInput.safeParse({
        id: work?.id ?? null,
        contactId: v.contactId,
        title: v.title,
        author: blank(v.author),
        editionNote: blank(v.editionNote),
        description: blank(v.description),
        heightMm, widthMm, thicknessMm, weightGrams, declaredValueCents,
        conditionNotes: blank(v.conditionNotes),
        internalNotes: blank(v.internalNotes),
      });
      if (issues.length > 0 || !parsed.success) throw Object.assign(new Error("invalid"), { local: [...new Set(issues)] });
      return save({ data: parsed.data });
    },
    onSuccess: (detail) => {
      void queryClient.invalidateQueries({ queryKey: WORKS_KEY });
      void queryClient.invalidateQueries({ queryKey: WORK_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      void navigate({ to: "/atelier/ouvrages/$workId", params: { workId: detail.work.id } });
    },
    onError: (error) => {
      const local = (error as { local?: string[] }).local;
      setProblems(local && local.length > 0 ? local : ["L'ouvrage n'a pas pu être enregistré. Réessayez."]);
    },
  });

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl">{work ? "Modifier l'ouvrage" : "Nouvel ouvrage"}</h1>
        <Link to={work ? "/atelier/ouvrages/$workId" : "/atelier/ouvrages"} params={work ? { workId: work.id } : undefined} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
          Annuler
        </Link>
      </header>

      <section aria-labelledby="work-contact" className={`${CARD} space-y-3`}>
        <h2 id="work-contact" className="font-serif text-lg">À qui est ce livre ?</h2>
        {allContacts.length > 0 && !newContact && (
          <Field label="Contact" htmlFor="work-contact-select">
            <select id="work-contact-select" className={FIELD} value={v.contactId} onChange={set("contactId")}>
              <option value="">Choisir un contact…</option>
              {allContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        {newContact ? (
          <ContactForm
            initial={null}
            compact
            onCancel={allContacts.length > 0 ? () => setNewContact(false) : undefined}
            onSaved={(contact) => {
              setAddedContacts((list) => [...list, { id: contact.id, name: contact.name }]);
              setV((s) => ({ ...s, contactId: contact.id }));
              setNewContact(false);
            }}
          />
        ) : (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setNewContact(true)}>
            + Nouveau contact
          </button>
        )}
      </section>

      <section aria-labelledby="work-book" className={`${CARD} space-y-3`}>
        <h2 id="work-book" className="font-serif text-lg">Le livre</h2>
        <Field label="Titre" htmlFor="work-title">
          <input id="work-title" className={FIELD} autoComplete="off" value={v.title} onChange={set("title")} />
        </Field>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Dimensions en millimètres (facultatif)</p>
          <div className="grid grid-cols-3 gap-3">
            <input aria-label="Hauteur (mm)" placeholder="Haut." inputMode="decimal" className={`${FIELD} text-center tabular-nums`} value={v.height} onChange={set("height")} />
            <input aria-label="Largeur (mm)" placeholder="Larg." inputMode="decimal" className={`${FIELD} text-center tabular-nums`} value={v.width} onChange={set("width")} />
            <input aria-label="Épaisseur (mm)" placeholder="Épais." inputMode="decimal" className={`${FIELD} text-center tabular-nums`} value={v.thickness} onChange={set("thickness")} />
          </div>
        </div>
        <Field label="État et observations" htmlFor="work-condition">
          <textarea id="work-condition" rows={2} className={`${FIELD} h-auto py-2`} placeholder="Dos détaché, coins usés…" value={v.conditionNotes} onChange={set("conditionNotes")} />
        </Field>
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Auteur, édition, poids, valeur, notes (facultatif)</summary>
          <div className="space-y-3 pb-1">
            <Field label="Auteur" htmlFor="work-author"><input id="work-author" className={FIELD} autoComplete="off" value={v.author} onChange={set("author")} /></Field>
            <Field label="Édition" htmlFor="work-edition"><input id="work-edition" className={FIELD} autoComplete="off" placeholder="Édition de 1890" value={v.editionNote} onChange={set("editionNote")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poids (g)" htmlFor="work-weight" hint="Utile pour un envoi.">
                <input id="work-weight" inputMode="numeric" className={`${FIELD} text-right tabular-nums`} value={v.weight} onChange={set("weight")} />
              </Field>
              <Field label="Valeur déclarée (€)" htmlFor="work-value">
                <input id="work-value" inputMode="decimal" className={`${FIELD} text-right tabular-nums`} value={v.value} onChange={set("value")} />
              </Field>
            </div>
            <Field label="Description" htmlFor="work-description"><textarea id="work-description" rows={2} className={`${FIELD} h-auto py-2`} value={v.description} onChange={set("description")} /></Field>
            <Field label="Notes internes" htmlFor="work-notes" hint="Jamais imprimées sur un document."><textarea id="work-notes" rows={2} className={`${FIELD} h-auto py-2`} value={v.internalNotes} onChange={set("internalNotes")} /></Field>
          </div>
        </details>
      </section>

      {problems.length > 0 && (
        <ErrorNote>{problems.join(" ")}</ErrorNote>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          className={`${PRIMARY_BUTTON} w-full sm:w-auto`}
          disabled={mutation.isPending}
          onClick={() => {
            setProblems([]);
            mutation.mutate();
          }}
        >
          {mutation.isPending ? "Enregistrement…" : work ? "Enregistrer les modifications" : "Créer l'ouvrage"}
        </button>
      </div>
    </div>
  );
}
