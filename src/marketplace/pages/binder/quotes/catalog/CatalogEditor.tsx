/**
 * « Mes prestations et mes prix » — le catalogue PERSONNEL de l'atelier.
 *
 * Ordre : Mes favoris → Mes prestations (par catégorie) → Ajouter une prestation (recherche dans le
 * référentiel, ou prestation personnalisée). Pour un atelier vide : « Ajouter mes premières prestations » en
 * tête, dix suggestions facultatives, aucun prix, zéro prestation possible.
 *
 * Le relieur reste propriétaire du libellé, de l'unité, du prix, de la TVA, du favori, de la visibilité :
 * les prix s'enregistrent en quittant un champ (pas de bouton « Enregistrer » à chercher sur soixante-dix
 * lignes). Ajouter, masquer, retirer ou renommer une prestation ne touche jamais le référentiel ni un devis
 * déjà fait.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { archiveMyService, saveMyCategory, saveMyService } from "@/marketplace/services/binderQuotes.data.functions";
import { setMyServiceFavorite } from "@/marketplace/services/binderReferenceCatalog.data.functions";
import { bpsToPercentInput, euros, parsePercentToBps } from "@/marketplace/quotes/quoteFormat";
import { REFERENCE_UNITS, unitLabel } from "@/marketplace/reference/units";
import { CARD, FIELD, Field, MoneyInput, SECONDARY_BUTTON } from "../quoteUi";
import { CATALOG_KEY } from "../quoteQueryKeys";
import { AddServicePanel } from "./AddServicePanel";
import type { Category, Service } from "./catalogTypes";

export function CatalogEditor({ categories, services }: { categories: Category[]; services: Service[] }) {
  const queryClient = useQueryClient();
  const saveCategory = useServerFn(saveMyCategory);
  const [newCategory, setNewCategory] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY });

  const addCategory = useMutation({
    mutationFn: () => saveCategory({ data: { id: null, name: newCategory.trim(), sortOrder: categories.length } }),
    onSuccess: () => {
      setNewCategory("");
      return refresh();
    },
  });

  const empty = services.length === 0;
  const favorites = services.filter((s) => s.isFavorite);
  const uncategorised = services.filter((s) => s.categoryId === null || !categories.some((c) => c.id === s.categoryId));

  const panel = (
    <AddServicePanel
      services={services}
      firstTime={empty && categories.length === 0}
      notice={notice}
      onAdded={(service) => setNotice(`« ${service.name} » a été ajoutée à vos prestations.`)}
    />
  );

  return (
    <section aria-labelledby="catalog-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="catalog-title" className="font-serif text-xl">Mes prestations et mes prix</h2>
        {!empty && (
          <a href="#add-service" className="inline-flex min-h-11 items-center text-sm underline">
            Ajouter une prestation
          </a>
        )}
      </div>

      {/* Les unités proposées à la saisie libre d'une ligne : le vocabulaire propose, l'atelier n'est jamais enfermé. */}
      <datalist id="unit-suggestions">
        {REFERENCE_UNITS.map((u) => (
          <option key={u.key} value={u.value} />
        ))}
      </datalist>

      {empty && panel}

      {favorites.length > 0 && <FavoritesSection favorites={favorites} />}

      {categories.map((category) => (
        <CategoryBlock key={category.id} category={category} services={services.filter((s) => s.categoryId === category.id)} />
      ))}
      {uncategorised.length > 0 && <CategoryBlock category={{ id: "none", name: "Autres prestations", sortOrder: 9999 }} services={uncategorised} />}

      {!empty && panel}

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

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

function FavoriteStar({ service }: { service: Service }) {
  const queryClient = useQueryClient();
  const setFavorite = useServerFn(setMyServiceFavorite);
  const toggle = useMutation({
    mutationFn: () => setFavorite({ data: { id: service.id, isFavorite: !service.isFavorite } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
  return (
    <button
      type="button"
      aria-pressed={service.isFavorite}
      aria-label={service.isFavorite ? `Retirer ${service.name} des favoris` : `Mettre ${service.name} en favori`}
      disabled={toggle.isPending}
      className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => toggle.mutate()}
    >
      <Star aria-hidden="true" className={`h-5 w-5 ${service.isFavorite ? "fill-amber-400 text-amber-500" : ""}`} />
    </button>
  );
}

function FavoritesSection({ favorites }: { favorites: Service[] }) {
  return (
    <section aria-labelledby="favorites-title" className={CARD}>
      <h3 id="favorites-title" className="font-serif text-lg">Mes favoris</h3>
      <p className="text-sm text-muted-foreground">Ce que vous facturez le plus souvent, à portée de main dans vos devis.</p>
      <ul className="mt-3 divide-y divide-border">
        {favorites.map((service) => (
          <li key={service.id} className="flex items-center justify-between gap-2 py-1">
            <span className="min-w-0">
              <span className="block truncate font-medium">{service.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {!service.isActive && service.unitPriceCents === 0 ? "À tarifer" : `${euros(service.unitPriceCents)} HT`}
                {service.unit ? ` · ${unitLabel(service.unit)}` : ""}
                {service.isActive ? "" : " · masquée"}
              </span>
            </span>
            <FavoriteStar service={service} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Catégories et lignes
// ---------------------------------------------------------------------------

function CategoryBlock({ category, services }: { category: Category; services: Service[] }) {
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
        <div className="hidden grid-cols-[1fr_120px_120px_84px_44px_60px_44px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
          <span>Prestation</span><span>Unité</span><span className="text-right">Prix HT (€)</span><span className="text-right">TVA (%)</span><span /><span className="text-center">Actif</span><span />
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
  const [unit, setUnit] = useState(service.unit ?? "");
  const [cents, setCents] = useState(service.unitPriceCents);
  const [active, setActive] = useState(service.isActive);
  const [vat, setVat] = useState(service.vatRateBps === null ? "" : bpsToPercentInput(service.vatRateBps));
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (over: Partial<{ name: string; unit: string; cents: number; active: boolean; vat: string }> = {}) => {
      const values = { name, unit, cents, active, vat, ...over };
      return saveService({
        data: {
          id: service.id,
          categoryId: service.categoryId,
          name: values.name.trim(),
          description: service.description,
          unitPriceCents: values.cents,
          vatRateBps: values.vat.trim() === "" ? null : parsePercentToBps(values.vat),
          unit: values.unit.trim() === "" ? null : values.unit.trim(),
          isActive: values.active,
          // Enregistrer un prix ne change jamais le favori, et le lien au référentiel n'est pas modifiable ici.
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

  const dirty =
    name !== service.name ||
    unit !== (service.unit ?? "") ||
    cents !== service.unitPriceCents ||
    vat !== (service.vatRateBps === null ? "" : bpsToPercentInput(service.vatRateBps));
  const commit = () => {
    if (dirty && name.trim()) save.mutate({});
  };
  const toPrice = cents === 0 && !active;

  return (
    <div className="grid items-center gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_120px_120px_84px_44px_60px_44px] sm:border-0 sm:p-0">
      <input aria-label={`Nom de la prestation ${service.name}`} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
      <div className="flex flex-wrap items-center gap-2 sm:contents">
        <div className="w-32 sm:w-auto">
          <input
            aria-label={`Unité de ${service.name}`}
            list="unit-suggestions"
            placeholder="unité"
            className={FIELD}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div className="w-32 sm:w-auto">
          <MoneyInput
            id={`price-${service.id}`}
            label={`Prix HT de ${service.name}`}
            cents={cents}
            invalid={toPrice}
            onCommit={commit}
            onChange={(next) => {
              // La première fois qu'un prix est saisi, la prestation devient utilisable.
              if (cents === 0 && !active && next > 0) setActive(true);
              setCents(next);
            }}
          />
        </div>
        <div className="w-24 sm:w-auto">
          <input aria-label={`TVA de ${service.name} (vide : taux par défaut)`} placeholder="défaut" inputMode="decimal" className={`${FIELD} text-right`} value={vat} onChange={(e) => setVat(e.target.value)} onBlur={commit} />
        </div>
        <FavoriteStar service={service} />
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
