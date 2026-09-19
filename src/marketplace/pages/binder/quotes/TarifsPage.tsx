/**
 * « Devis et tarifs » — configurer UNE fois ce que le relieur retrouvera à chaque
 * devis : ses prestations et ses prix (à lui seul : Ma Reliure n'en impose aucun),
 * son régime de TVA, son identité, ses mentions.
 *
 * Les prix s'enregistrent en quittant un champ : pas de bouton « Enregistrer » à
 * chercher sur soixante-dix lignes. Une prestation importée du catalogue de
 * départ n'a pas de prix : elle reste « à tarifer », inactive, et s'active dès
 * que le relieur en saisit un.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  archiveMyService,
  getBillingProfile,
  getMyCatalog,
  importMyStarterCatalog,
  saveMyCategory,
  saveMyService,
  saveMyBillingProfile,
} from "@/marketplace/services/binderQuotes.data.functions";
import { FRANCHISE_MENTION_SUGGESTION, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { bpsToPercentInput, parsePercentToBps } from "@/marketplace/quotes/quoteFormat";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, MoneyInput, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./quoteUi";
import { CATALOG_KEY, PROFILE_QUERY_KEY, profileToInput } from "./quoteQueryKeys";

type Service = { id: string; categoryId: string | null; name: string; description: string | null; unitPriceCents: number; vatRateBps: number | null; unit: string | null; isActive: boolean };

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
// Catalogue
// ---------------------------------------------------------------------------

function CatalogEditor({ categories, services }: { categories: { id: string; name: string; sortOrder: number }[]; services: Service[] }) {
  const queryClient = useQueryClient();
  const importStarter = useServerFn(importMyStarterCatalog);
  const saveCategory = useServerFn(saveMyCategory);
  const [newCategory, setNewCategory] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY });

  const starter = useMutation({ mutationFn: () => importStarter(), onSuccess: refresh });
  const addCategory = useMutation({
    mutationFn: () => saveCategory({ data: { id: null, name: newCategory.trim(), sortOrder: categories.length } }),
    onSuccess: () => {
      setNewCategory("");
      return refresh();
    },
  });

  const uncategorised = services.filter((s) => s.categoryId === null || !categories.some((c) => c.id === s.categoryId));

  return (
    <section aria-labelledby="catalog-title" className="space-y-4">
      <h2 id="catalog-title" className="font-serif text-xl">Mes prestations et mes prix</h2>

      {categories.length === 0 && services.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-medium">Votre catalogue est vide.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Partez d'une liste de prestations de reliure courantes (des noms seulement : aucun prix n'est imposé), puis saisissez les vôtres. Ou créez votre première catégorie ci-dessous.
          </p>
          <button type="button" className={`${PRIMARY_BUTTON} mt-4`} disabled={starter.isPending} onClick={() => starter.mutate()}>
            {starter.isPending ? "Chargement…" : "Partir d'un catalogue de reliure"}
          </button>
          {starter.isError && <div className="mt-3"><ErrorNote>Le catalogue n'a pas pu être chargé. Réessayez.</ErrorNote></div>}
        </div>
      )}

      {categories.map((category) => (
        <CategoryBlock key={category.id} category={category} services={services.filter((s) => s.categoryId === category.id)} />
      ))}
      {uncategorised.length > 0 && <CategoryBlock category={{ id: "none", name: "Autres prestations", sortOrder: 9999 }} services={uncategorised} />}

      <div className={`${CARD} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[220px] flex-1">
          <Field label="Nouvelle catégorie" htmlFor="new-category">
            <input id="new-category" className={FIELD} value={newCategory} placeholder="ex. Étuis sur mesure" onChange={(e) => setNewCategory(e.target.value)} />
          </Field>
        </div>
        <button type="button" className={SECONDARY_BUTTON} disabled={!newCategory.trim() || addCategory.isPending} onClick={() => addCategory.mutate()}>
          Ajouter la catégorie
        </button>
      </div>
    </section>
  );
}

function CategoryBlock({ category, services }: { category: { id: string; name: string; sortOrder: number }; services: Service[] }) {
  const queryClient = useQueryClient();
  const saveCategory = useServerFn(saveMyCategory);
  const [name, setName] = useState(category.name);
  const rename = useMutation({
    mutationFn: () => saveCategory({ data: { id: category.id, name: name.trim(), sortOrder: category.sortOrder } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
  const toPrice = services.filter((s) => s.unitPriceCents === 0 && !s.isActive).length;
  const real = category.id !== "none";

  return (
    <details open={services.length > 0 && toPrice < services.length ? true : undefined} className={`${CARD} group`}>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{category.name}</span>
        <span className="text-xs text-muted-foreground">
          {services.length} prestation{services.length > 1 ? "s" : ""}
          {toPrice > 0 ? ` · ${toPrice} à tarifer` : ""}
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {real && (
          <div className="mb-3 flex items-end gap-2">
            <Field label="Nom de la catégorie" htmlFor={`cat-${category.id}`}>
              <input id={`cat-${category.id}`} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== category.name && rename.mutate()} />
            </Field>
          </div>
        )}
        <div className="hidden grid-cols-[1fr_120px_84px_70px_44px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
          <span>Prestation</span><span className="text-right">Prix HT (€)</span><span className="text-right">TVA (%)</span><span className="text-center">Actif</span><span />
        </div>
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
        {real && <AddServiceRow categoryId={category.id} />}
      </div>
    </details>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const queryClient = useQueryClient();
  const saveService = useServerFn(saveMyService);
  const archive = useServerFn(archiveMyService);
  const [name, setName] = useState(service.name);
  const [cents, setCents] = useState(service.unitPriceCents);
  const [active, setActive] = useState(service.isActive);
  const [vat, setVat] = useState(service.vatRateBps === null ? "" : bpsToPercentInput(service.vatRateBps));
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (over: Partial<{ name: string; cents: number; active: boolean; vat: string }> = {}) => {
      const values = { name, cents, active, vat, ...over };
      return saveService({
        data: {
          id: service.id,
          categoryId: service.categoryId,
          name: values.name.trim(),
          description: service.description,
          unitPriceCents: values.cents,
          vatRateBps: values.vat.trim() === "" ? null : parsePercentToBps(values.vat),
          unit: service.unit,
          isActive: values.active,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    },
  });
  const remove = useMutation({
    mutationFn: () => archive({ data: { id: service.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }),
  });

  const dirty = name !== service.name || cents !== service.unitPriceCents || vat !== (service.vatRateBps === null ? "" : bpsToPercentInput(service.vatRateBps));
  const commit = () => {
    if (dirty && name.trim()) save.mutate({});
  };
  const toPrice = cents === 0 && !active;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_120px_84px_70px_44px] sm:border-0 sm:p-0">
      <input aria-label={`Nom de la prestation ${service.name}`} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
      <div className="flex items-center gap-2 sm:contents">
        <MoneyInput
          id={`price-${service.id}`}
          label={`Prix HT de ${service.name}`}
          cents={cents}
          invalid={toPrice}
          onChange={(next) => {
            // La première fois qu'un prix est saisi, la prestation devient utilisable.
            if (cents === 0 && !active && next > 0) setActive(true);
            setCents(next);
          }}
        />
        <input aria-label={`TVA de ${service.name} (vide : taux par défaut)`} placeholder="défaut" inputMode="decimal" className={`${FIELD} text-right`} value={vat} onChange={(e) => setVat(e.target.value)} onBlur={commit} />
        <label className="flex h-11 items-center justify-center gap-1 text-xs">
          <input
            type="checkbox"
            aria-label={`${service.name} actif`}
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              save.mutate({ active: e.target.checked });
            }}
          />
          <span className="sm:sr-only">Actif</span>
        </label>
        <button
          type="button"
          aria-label={`Retirer ${service.name} du catalogue`}
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          onClick={() => window.confirm(`Retirer « ${service.name} » du catalogue ? Vos devis existants ne changent pas.`) && remove.mutate()}
        >
          ×
        </button>
      </div>
      {(toPrice || saved || save.isError) && (
        <p className="col-span-full text-xs" role={save.isError ? "alert" : "status"}>
          {save.isError ? <span className="text-destructive">Non enregistré. Réessayez.</span> : saved ? <span className="text-emerald-700">Enregistré ✓</span> : <span className="text-amber-800">À tarifer : saisissez votre prix pour la proposer dans vos devis.</span>}
        </p>
      )}
    </div>
  );
}

function AddServiceRow({ categoryId }: { categoryId: string }) {
  const queryClient = useQueryClient();
  const saveService = useServerFn(saveMyService);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(0);
  const add = useMutation({
    mutationFn: () => saveService({ data: { id: null, categoryId, name: name.trim(), description: null, unitPriceCents: cents, vatRateBps: null, unit: null, isActive: true } }),
    onSuccess: () => {
      setName("");
      setCents(0);
      return queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });
  return (
    <div className="grid grid-cols-[1fr_120px] items-center gap-2 border-t border-dashed border-border pt-3 sm:grid-cols-[1fr_120px_auto]">
      <input aria-label="Nouvelle prestation" placeholder="Nouvelle prestation…" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
      <MoneyInput id={`new-price-${categoryId}`} label="Prix HT de la nouvelle prestation" cents={cents} onChange={setCents} />
      <button type="button" className={`${SECONDARY_BUTTON} col-span-2 sm:col-span-1`} disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
        Ajouter
      </button>
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
