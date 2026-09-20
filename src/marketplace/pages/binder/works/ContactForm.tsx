/**
 * La fiche d'un contact, en saisie : prénom, nom, entreprise ou institution, coordonnées, notes.
 * Pas un CRM — retrouver un client et ses ouvrages, rien d'autre. Un seul de « nom, prénom,
 * entreprise » suffit : le nom d'affichage en est déduit (voir works/contactName.ts).
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveMyContact } from "@/marketplace/services/binderWorks.data.functions";
import { contactInput } from "@/marketplace/works/workInput";
import type { ContactView } from "@/marketplace/works/workViews";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/marketplace/pages/binder/quotes/quoteUi";
import { CLIENTS_KEY } from "@/marketplace/pages/binder/quotes/quoteQueryKeys";
import { CONTACT_KEY, CONTACTS_KEY } from "./workKeys";

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

export function ContactForm({
  initial,
  onSaved,
  onCancel,
  compact = false,
}: {
  initial: ContactView | null;
  onSaved: (contact: ContactView) => void;
  onCancel?: () => void;
  /** Dans une autre page (la fiche d'un ouvrage) : moins de champs visibles d'emblée. */
  compact?: boolean;
}) {
  const save = useServerFn(saveMyContact);
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? (initial && !initial.firstName && !initial.organization ? initial.name : ""),
    organization: initial?.organization ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    postalCode: initial?.postalCode ?? "",
    city: initial?.city ?? "",
    notes: initial?.notes ?? "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = contactInput.safeParse({
        id: initial?.id ?? null,
        firstName: blank(values.firstName),
        lastName: blank(values.lastName),
        organization: blank(values.organization),
        email: blank(values.email),
        phone: blank(values.phone),
        addressLine1: blank(values.addressLine1),
        postalCode: blank(values.postalCode),
        city: blank(values.city),
        country: initial?.country ?? null,
        notes: blank(values.notes),
      });
      if (!parsed.success) throw Object.assign(new Error("invalid"), { local: parsed.error.issues[0]?.message ?? "Vérifiez les champs." });
      return save({ data: parsed.data });
    },
    onSuccess: (contact) => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTACT_KEY });
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      onSaved(contact);
    },
    onError: (error) =>
      setProblem((error as { local?: string }).local ?? "Le contact n'a pas pu être enregistré. Réessayez."),
  });

  return (
    <form
      className={`${CARD} space-y-3`}
      onSubmit={(event) => {
        event.preventDefault();
        setProblem(null);
        mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="contact-first-name">
          <input id="contact-first-name" className={FIELD} autoComplete="off" value={values.firstName} onChange={set("firstName")} />
        </Field>
        <Field label="Nom" htmlFor="contact-last-name">
          <input id="contact-last-name" className={FIELD} autoComplete="off" value={values.lastName} onChange={set("lastName")} />
        </Field>
      </div>
      <Field label="Entreprise ou institution (facultatif)" htmlFor="contact-organization">
        <input id="contact-organization" className={FIELD} autoComplete="off" value={values.organization} onChange={set("organization")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="contact-email">
          <input id="contact-email" type="email" inputMode="email" className={FIELD} autoComplete="off" value={values.email} onChange={set("email")} />
        </Field>
        <Field label="Téléphone" htmlFor="contact-phone">
          <input id="contact-phone" type="tel" inputMode="tel" className={FIELD} autoComplete="off" value={values.phone} onChange={set("phone")} />
        </Field>
      </div>
      <details open={!compact}>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Adresse et notes (facultatif)</summary>
        <div className="space-y-3 pb-1">
          <Field label="Adresse" htmlFor="contact-address">
            <input id="contact-address" className={FIELD} autoComplete="off" value={values.addressLine1} onChange={set("addressLine1")} />
          </Field>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Field label="Code postal" htmlFor="contact-postal">
              <input id="contact-postal" inputMode="numeric" className={FIELD} autoComplete="off" value={values.postalCode} onChange={set("postalCode")} />
            </Field>
            <Field label="Ville" htmlFor="contact-city">
              <input id="contact-city" className={FIELD} autoComplete="off" value={values.city} onChange={set("city")} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="contact-notes">
            <textarea id="contact-notes" rows={3} className={`${FIELD} h-auto py-2`} value={values.notes} onChange={set("notes")} />
          </Field>
        </div>
      </details>
      {problem && <ErrorNote>{problem}</ErrorNote>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`} disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement…" : initial ? "Enregistrer" : "Créer le contact"}
        </button>
        {onCancel && (
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
