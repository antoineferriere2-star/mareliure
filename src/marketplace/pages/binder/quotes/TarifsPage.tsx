/**
 * Paramètres documentaires et grille tarifaire de l'atelier. La grille Ma Reliure
 * est disponible immédiatement ; les overrides ne valent que pour les futurs ajouts.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { clearMyDocumentLogo, getBillingProfile, getMyCatalog, saveMyBillingProfile, uploadMyDocumentLogo } from "@/marketplace/services/binderQuotes.data.functions";
import { getMyPricingCatalog } from "@/marketplace/services/binderPricingCatalog.data.functions";
import { FRANCHISE_MENTION_SUGGESTION, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { bpsToPercentInput, parsePercentToBps } from "@/marketplace/quotes/quoteFormat";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON } from "./quoteUi";
import { PricingCatalogEditor } from "./catalog/PricingCatalogEditor";
import { OperationPhotoLibrary } from "./catalog/OperationPhotoLibrary";
import { CATALOG_KEY, PRICING_CATALOG_KEY, PROFILE_QUERY_KEY, profileToInput } from "./quoteQueryKeys";
import { BinderPageHeader } from "../BinderPageUi";
import { DOCUMENT_ACCENT_COLORS, DOCUMENT_LOGO_MAX_BYTES, DOCUMENT_LOGO_MIME_TYPES, type DocumentLogoMime } from "@/marketplace/quotes/documentBranding";

const HEADINGS = {
  documents: { tab: "Devis & documents", title: "Devis & documents", description: "Configurez ce que vos clients verront. Les devis déjà créés conservent toujours leur snapshot." },
  services: { tab: "Prestations & tarifs", title: "Mes prestations et mes prix", description: "Adaptez la grille Ma Reliure à votre atelier. Vos documents existants restent inchangés." },
  photos: { tab: "Photos d'exemple", title: "Photos des prestations", description: "Des illustrations fournies par défaut, à remplacer librement par vos propres réalisations pour vos prochains devis." },
} as const;

export function TarifsPage() {
  const fetchProfile = useServerFn(getBillingProfile);
  const fetchCatalog = useServerFn(getMyCatalog);
  const fetchPricingCatalog = useServerFn(getMyPricingCatalog);
  const profile = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: () => fetchProfile() });
  const catalog = useQuery({ queryKey: CATALOG_KEY, queryFn: () => fetchCatalog({ data: {} }) });
  const pricingCatalog = useQuery({ queryKey: PRICING_CATALOG_KEY, queryFn: () => fetchPricingCatalog() });
  const [section, setSection] = useState<"documents" | "services" | "photos">("documents");

  if (profile.isPending || catalog.isPending || pricingCatalog.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (profile.error || catalog.error || pricingCatalog.error || !profile.data || !catalog.data || !pricingCatalog.data) return <ErrorNote>Impossible de charger vos tarifs. Rechargez la page.</ErrorNote>;

  return (
    <div className="space-y-8">
      <BinderPageHeader eyebrow="Paramètres atelier" title={HEADINGS[section].title} description={HEADINGS[section].description} />
      <div role="tablist" aria-label="Paramètres de l'atelier" className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-[#cfc5b6]">
        {(["documents", "services", "photos"] as const).map((key) => (
          <button key={key} role="tab" aria-selected={section === key} type="button" onClick={() => setSection(key)} className={`-mb-px min-h-12 shrink-0 border-b-2 text-sm font-semibold ${section === key ? "border-[#7a2230] text-[#241a12]" : "border-transparent text-[#74695d]"}`}>{HEADINGS[key].tab}</button>
        ))}
      </div>
      {section === "documents" ? <ProfileForm profile={profile.data} /> : section === "services" ? <PricingCatalogEditor items={pricingCatalog.data} services={catalog.data.services} /> : <OperationPhotoLibrary items={pricingCatalog.data} services={catalog.data.services} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

function ProfileForm({ profile }: { profile: BillingProfile }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyBillingProfile);
  const uploadLogo = useServerFn(uploadMyDocumentLogo);
  const clearLogo = useServerFn(clearMyDocumentLogo);
  const logoInput = useRef<HTMLInputElement>(null);
  const [p, setP] = useState({
    ...profile,
    defaultVat: bpsToPercentInput(profile.defaultVatRateBps),
    validity: String(profile.quoteValidityDays),
  });
  const set = (patch: Partial<typeof p>) => setP((s) => ({ ...s, ...patch }));
  const text = (key: keyof BillingProfile) => (p[key] as string | null) ?? "";
  const [saved, setSaved] = useState(false);

  const applySavedProfile = (next: BillingProfile) => {
    setP({ ...next, defaultVat: bpsToPercentInput(next.defaultVatRateBps), validity: String(next.quoteValidityDays) });
    queryClient.setQueryData(PROFILE_QUERY_KEY, next);
  };

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

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!DOCUMENT_LOGO_MIME_TYPES.includes(file.type as DocumentLogoMime) || file.size > DOCUMENT_LOGO_MAX_BYTES) throw new Error("invalid");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return uploadLogo({ data: { mimeType: file.type as DocumentLogoMime, imageBase64: dataUrl.split(",")[1] ?? "" } });
    },
    onSuccess: applySavedProfile,
  });
  const clearLogoMutation = useMutation({ mutationFn: () => clearLogo(), onSuccess: applySavedProfile });

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
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">Identité</p>
        <h2 id="identity-title" className="mt-1 font-serif text-xl">En-tête de vos documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">Imprimée sur vos devis et vos factures. Une facture exige l'adresse et le SIRET.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {input("workshopName", "Nom de l'atelier")}
          {input("binderName", "Nom du relieur ou de la relieuse")}
          {input("legalName", "Raison sociale")}
          {input("legalForm", "Forme juridique")}
          {input("shareCapital", "Capital social (si applicable)")}
          {input("siren", "SIREN")}
          {input("addressLine1", "Adresse", { autoComplete: "street-address" })}
          {input("addressLine2", "Complément d'adresse")}
          {input("postalCode", "Code postal", { autoComplete: "postal-code" })}
          {input("city", "Ville", { autoComplete: "address-level2" })}
          {input("siret", "SIRET")}
          {input("vatNumber", "Numéro de TVA (si assujetti)")}
          {input("email", "E-mail", { type: "email" })}
          {input("phone", "Téléphone", { type: "tel" })}
          {input("website", "Site internet", { type: "url" })}
        </div>
        <div className="mt-5 grid gap-5 border-t border-[#d8d0c4] pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div>
            <p className="text-sm font-semibold text-[#30261d]">Logo de l'atelier</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">PNG ou JPEG, 2 Mo maximum. Il reste privé et apparaît uniquement sur vos documents.</p>
            <input ref={logoInput} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) logoMutation.mutate(file);
              event.currentTarget.value = "";
            }} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="min-h-11 border border-[#b9ad9d] bg-white px-4 text-sm font-semibold" onClick={() => logoInput.current?.click()} disabled={logoMutation.isPending}>{p.logoUrl ? "Remplacer le logo" : "Ajouter un logo"}</button>
              {p.logoStoragePath && <button type="button" className="min-h-11 px-3 text-sm font-semibold text-[#7a2230]" onClick={() => clearLogoMutation.mutate()} disabled={clearLogoMutation.isPending}>Retirer</button>}
            </div>
            {(logoMutation.isError || clearLogoMutation.isError) && <p role="alert" className="mt-2 text-xs text-red-700">Le logo n'a pas pu être enregistré. Vérifiez le format et la taille.</p>}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#30261d]">Couleur des documents</p>
            <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Couleur des documents">
              {DOCUMENT_ACCENT_COLORS.map((color) => <label key={color} className="cursor-pointer"><input className="sr-only" type="radio" name="document-accent" checked={p.documentAccentColor === color} onChange={() => set({ documentAccentColor: color })} /><span className={`block h-11 w-11 rounded-full border-4 ${p.documentAccentColor === color ? "border-[#c39a59]" : "border-white"} shadow-[0_0_0_1px_#b9ad9d]`} style={{ backgroundColor: color }}><span className="sr-only">{color}</span></span></label>)}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Mentions légales (forme juridique, capital, RCS…)" htmlFor="profile-legalNotes">
            <textarea id="profile-legalNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("legalNotes")} onChange={(e) => set({ legalNotes: e.target.value || null })} />
          </Field>
        </div>
        <div className="mt-6 border-t border-[#d8d0c4] pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#74695d]">Aperçu en direct</p>
          <div className="mt-3 grid max-w-2xl gap-5 border border-[#cfc5b6] bg-white p-5 sm:grid-cols-[5rem_minmax(0,1fr)]" style={{ borderTopColor: p.documentAccentColor, borderTopWidth: 4 }}>
            {p.logoUrl ? <img src={p.logoUrl} alt="Logo de l'atelier" className="h-16 w-16 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center border border-[#cfc5b6] bg-[#f4efe6] font-editorial text-2xl" style={{ color: p.documentAccentColor }}>{(p.workshopName || p.legalName || "A").slice(0, 1).toUpperCase()}</div>}
            <div><strong className="font-editorial text-xl font-normal">{p.workshopName || "Nom de l'atelier"}</strong>{p.binderName && <p className="mt-1 text-sm text-[#4a4036]">{p.binderName}</p>}{p.legalName && p.legalName !== p.workshopName && <p className="mt-1 text-xs text-[#74695d]">{p.legalName}</p>}<p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#685d51]">{[p.addressLine1, [p.postalCode, p.city].filter(Boolean).join(" "), p.phone, p.email, p.website].filter(Boolean).join("\n") || "Adresse et coordonnées de l'atelier"}</p></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="vat-title" className={CARD}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">Devis</p>
        <h2 id="vat-title" className="mt-1 font-serif text-xl">TVA par défaut</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ma Reliure ne choisit pas votre régime : c'est à vous (ou à votre comptable) de le déclarer.</p>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Régime de TVA</legend>
          {(
            [
              ["VAT_LIABLE", "Je facture la TVA"],
              ["FRANCHISE", "Franchise en base de TVA (aucune TVA facturée)"],
              ["EXEMPT", "Exonération ou autre régime sans TVA"],
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
          <Field label="TVA appliquée aux nouveaux devis (%)" htmlFor="profile-default-vat" hint="Chaque nouveau devis reprend ce taux. Il reste modifiable dans le Workbench.">
            <input id="profile-default-vat" inputMode="decimal" className={FIELD} value={p.defaultVat} onChange={(e) => set({ defaultVat: e.target.value })} />
          </Field>
          <Field label="Mention de TVA imprimée" htmlFor="profile-vatMention" hint={p.vatRegime === "FRANCHISE" ? "Obligatoire sur une facture en franchise." : undefined}>
            <input id="profile-vatMention" className={FIELD} value={text("vatMention")} onChange={(e) => set({ vatMention: e.target.value || null })} />
          </Field>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={p.vatOnDebits} onChange={(event) => set({ vatOnDebits: event.target.checked })} />
          Option pour le paiement de la TVA d'après les débits
        </label>
      </section>

      <section aria-labelledby="quotes-title" className={CARD}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">Document</p>
        <h2 id="quotes-title" className="mt-1 font-serif text-xl">Numérotation et pied de page</h2>
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
          <Field label="Délai de paiement (jours)" htmlFor="profile-paymentDelayDays">
            <input id="profile-paymentDelayDays" inputMode="numeric" className={FIELD} value={p.paymentDelayDays ?? ""} onChange={(e) => set({ paymentDelayDays: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Conditions d'escompte" htmlFor="profile-earlyPaymentDiscountTerms" hint="Ex. Aucun escompte pour paiement anticipé.">
            <textarea id="profile-earlyPaymentDiscountTerms" rows={2} className={`${FIELD} h-auto py-2`} value={text("earlyPaymentDiscountTerms")} onChange={(e) => set({ earlyPaymentDiscountTerms: e.target.value || null })} />
          </Field>
          <Field label="Pénalités de retard" htmlFor="profile-latePenaltyTerms">
            <textarea id="profile-latePenaltyTerms" rows={2} className={`${FIELD} h-auto py-2`} value={text("latePenaltyTerms")} onChange={(e) => set({ latePenaltyTerms: e.target.value || null })} />
          </Field>
          {input("iban", "IBAN (facultatif)")}
          <Field label="Mention de bas de devis" htmlFor="profile-quoteNotes" hint="Conditions, délai ou information propre à votre atelier. Aucun texte juridique n'est ajouté automatiquement.">
            <textarea id="profile-quoteNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("quoteNotes")} onChange={(e) => set({ quoteNotes: e.target.value || null })} />
          </Field>
          <Field label="Mentions des factures (pénalités de retard, indemnité de recouvrement…)" htmlFor="profile-invoiceNotes">
            <textarea id="profile-invoiceNotes" rows={2} className={`${FIELD} h-auto py-2`} value={text("invoiceNotes")} onChange={(e) => set({ invoiceNotes: e.target.value || null })} />
          </Field>
          <Field label="Texte de pied de page commun" htmlFor="profile-documentFooter" hint="Une courte signature d'atelier ou une information pratique, sur devis et facture.">
            <textarea id="profile-documentFooter" rows={2} className={`${FIELD} h-auto py-2`} value={text("documentFooter")} onChange={(e) => set({ documentFooter: e.target.value || null })} />
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
