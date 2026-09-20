/**
 * « Devis et tarifs » — configurer UNE fois ce que le relieur retrouvera à chaque
 * devis : ses prestations et ses prix (à lui seul : Ma Reliure n'en impose aucun),
 * son régime de TVA, son identité, ses mentions.
 *
 * Le catalogue (favoris, prestations, ajout depuis le référentiel Ma Reliure) vit dans
 * `catalog/` ; cette page garde le profil : identité, TVA, devis et factures.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBillingProfile, getMyCatalog, saveMyBillingProfile } from "@/marketplace/services/binderQuotes.data.functions";
import { FRANCHISE_MENTION_SUGGESTION, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { bpsToPercentInput, parsePercentToBps } from "@/marketplace/quotes/quoteFormat";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON } from "./quoteUi";
import { CatalogEditor } from "./catalog/CatalogEditor";
import { CATALOG_KEY, PROFILE_QUERY_KEY, profileToInput } from "./quoteQueryKeys";

export function TarifsPage() {
  const fetchProfile = useServerFn(getBillingProfile);
  const fetchCatalog = useServerFn(getMyCatalog);
  const profile = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: () => fetchProfile() });
  const catalog = useQuery({ queryKey: CATALOG_KEY, queryFn: () => fetchCatalog({ data: {} }) });

  if (profile.isPending || catalog.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (profile.error || catalog.error || !profile.data || !catalog.data) return <ErrorNote>Impossible de charger vos tarifs. Rechargez la page.</ErrorNote>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-2xl">Devis et tarifs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Vos prestations, vos prix, votre TVA. Vous les configurez une fois ; ils sont proposés à chaque devis, et changer un prix ici ne modifie jamais un devis déjà fait.
        </p>
      </header>
      <CatalogEditor categories={catalog.data.categories} services={catalog.data.services} />
      <ProfileForm profile={profile.data} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

function ProfileForm({ profile }: { profile: BillingProfile }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyBillingProfile);
  const [p, setP] = useState({
    ...profile,
    defaultVat: bpsToPercentInput(profile.defaultVatRateBps),
    validity: String(profile.quoteValidityDays),
  });
  const set = (patch: Partial<typeof p>) => setP((s) => ({ ...s, ...patch }));
  const text = (key: keyof BillingProfile) => (p[key] as string | null) ?? "";
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const vatRate = parsePercentToBps(p.defaultVat);
      const validity = Number(p.validity);
      if (vatRate === null || !Number.isInteger(validity) || validity < 1 || validity > 365) throw new Error("invalid");
      const { defaultVat: _d, validity: _v, ...rest } = p;
      return save({ data: { ...profileToInput(rest), defaultVatRateBps: vatRate, quoteValidityDays: validity } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const input = (key: keyof BillingProfile, label: string, extra: { type?: string; autoComplete?: string } = {}) => (
    <Field label={label} htmlFor={`profile-${key}`}>
      <input id={`profile-${key}`} className={FIELD} type={extra.type} autoComplete={extra.autoComplete} value={text(key)} onChange={(e) => set({ [key]: e.target.value || null } as never)} />
    </Field>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <section aria-labelledby="identity-title" className={CARD}>
        <h2 id="identity-title" className="font-serif text-xl">Identité de l'atelier</h2>
        <p className="mt-1 text-sm text-muted-foreground">Imprimée sur vos devis et vos factures. Une facture exige l'adresse et le SIRET.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {input("workshopName", "Nom de l'atelier")}
          {input("legalName", "Raison sociale")}
          {input("addressLine1", "Adresse", { autoComplete: "street-address" })}
          {input("addressLine2", "Complément d'adresse")}
          {input("postalCode", "Code postal", { autoComplete: "postal-code" })}
          {input("city", "Ville", { autoComplete: "address-level2" })}
          {input("siret", "SIRET")}
          {input("vatNumber", "Numéro de TVA (si assujetti)")}
          {input("email", "E-mail", { type: "email" })}
          {input("phone", "Téléphone", { type: "tel" })}
        </div>
        <div className="mt-4">
          <Field label="Mentions légales (forme juridique, capital, RCS…)" htmlFor="profile-legalNotes">
            <textarea id="profile-legalNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("legalNotes")} onChange={(e) => set({ legalNotes: e.target.value || null })} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="vat-title" className={CARD}>
        <h2 id="vat-title" className="font-serif text-xl">TVA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ma Reliure ne choisit pas votre régime : c'est à vous (ou à votre comptable) de le déclarer.</p>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Régime de TVA</legend>
          {(
            [
              ["VAT_LIABLE", "Je facture la TVA"],
              ["FRANCHISE", "Franchise en base de TVA (aucune TVA facturée)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <input
                type="radio"
                name="profile-vat-regime"
                checked={p.vatRegime === value}
                onChange={() => set({ vatRegime: value, vatMention: value === "FRANCHISE" && !p.vatMention ? FRANCHISE_MENTION_SUGGESTION : p.vatMention })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Taux de TVA par défaut (%)" htmlFor="profile-default-vat" hint="Proposé aux prestations qui n'ont pas de taux propre. Ignoré en franchise.">
            <input id="profile-default-vat" inputMode="decimal" className={FIELD} value={p.defaultVat} onChange={(e) => set({ defaultVat: e.target.value })} />
          </Field>
          <Field label="Mention de TVA imprimée" htmlFor="profile-vatMention" hint={p.vatRegime === "FRANCHISE" ? "Obligatoire sur une facture en franchise." : undefined}>
            <input id="profile-vatMention" className={FIELD} value={text("vatMention")} onChange={(e) => set({ vatMention: e.target.value || null })} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="quotes-title" className={CARD}>
        <h2 id="quotes-title" className="font-serif text-xl">Devis et factures</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Préfixe des devis" htmlFor="profile-quotePrefix" hint="ex. D → D-2026-0001">
            <input id="profile-quotePrefix" className={FIELD} value={p.quotePrefix} onChange={(e) => set({ quotePrefix: e.target.value })} />
          </Field>
          <Field label="Préfixe des factures" htmlFor="profile-invoicePrefix" hint="ex. F → F-2026-0001">
            <input id="profile-invoicePrefix" className={FIELD} value={p.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} />
          </Field>
          <Field label="Validité d'un devis (jours)" htmlFor="profile-validity">
            <input id="profile-validity" inputMode="numeric" className={FIELD} value={p.validity} onChange={(e) => set({ validity: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Conditions de paiement" htmlFor="profile-paymentTerms">
            <textarea id="profile-paymentTerms" rows={2} className={`${FIELD} h-auto py-2`} value={text("paymentTerms")} onChange={(e) => set({ paymentTerms: e.target.value || null })} />
          </Field>
          <Field label="Mentions par défaut des devis" htmlFor="profile-quoteNotes">
            <textarea id="profile-quoteNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("quoteNotes")} onChange={(e) => set({ quoteNotes: e.target.value || null })} />
          </Field>
          <Field label="Mentions des factures (pénalités de retard, indemnité de recouvrement…)" htmlFor="profile-invoiceNotes">
            <textarea id="profile-invoiceNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("invoiceNotes")} onChange={(e) => set({ invoiceNotes: e.target.value || null })} />
          </Field>
        </div>
      </section>

      {mutation.isError && <ErrorNote>Vérifiez les champs (préfixes de 1 à 8 lettres ou chiffres, taux et validité valides), puis réessayez.</ErrorNote>}
      <div className="flex items-center gap-3">
        <button type="submit" className={PRIMARY_BUTTON} disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span role="status" className="text-sm text-emerald-700">Enregistré ✓</span>}
      </div>
    </form>
  );
}
