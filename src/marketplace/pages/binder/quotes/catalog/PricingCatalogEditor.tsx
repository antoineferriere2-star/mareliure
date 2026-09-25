import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Star } from "lucide-react";
import {
  bulkAdjustMyPrices,
  resetMyPrices,
  saveMyPriceOverride,
  setMyBasePriceFavorite,
} from "@/marketplace/services/binderPricingCatalog.data.functions";
import {
  archiveMyService,
  saveMyService,
} from "@/marketplace/services/binderQuotes.data.functions";
import {
  adjustPriceCents,
  bulkPricePreview,
  priceDifferenceBps,
  type BinderPricingCatalogItem,
  type BulkPriceSource,
} from "@/marketplace/pricing/binderPricingCatalog";
import { WORK_FAMILIES, type WorkFamilyKey } from "@/marketplace/pricing/catalog";
import { centsToEuroInput, euros, parseEurosToCents } from "@/marketplace/quotes/quoteFormat";
import { normalizeSearch } from "@/marketplace/reference/search";
import { CARD, ErrorNote, FIELD, MoneyInput, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../quoteUi";
import { CATALOG_KEY, PRICING_CATALOG_KEY } from "../quoteQueryKeys";
import { ServiceForm } from "./ServiceForm";
import { OperationThumbnail } from "./OperationThumbnail";
import type { Service } from "./catalogTypes";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { serviceFamilyName, serviceName } from "@/marketplace/i18n/fineBinderyGlossary";
import { formatFineBinderyMoney, formatFineBinderyPrice } from "@/marketplace/i18n/fineBinderyFormat";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

type Filter = "all" | "favorites" | "custom" | "manual";
type BulkMode = "adjust" | "reset";
type Scope = "all" | "category" | "selected";

const formatPrice = (cents: number | null, mode: string, locale?: FineBinderyLocale) =>
  locale
    ? formatFineBinderyPrice(cents, mode, locale)
    : cents === null
      ? "Sur étude"
      : `${mode === "starting_from" ? "À partir de " : ""}${euros(cents)}`;

const formatDifference = (bps: number | null) =>
  bps === null || bps === 0 ? "—" : `${bps > 0 ? "+" : ""}${String(bps / 100).replace(".", ",")} %`;

export function PricingCatalogEditor({
  items,
  services,
}: {
  items: BinderPricingCatalogItem[];
  services: Service[];
}) {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const localizedItems = useMemo(() => items.map((item) => isFineBindery ? { ...item, label: serviceName(item.pricingKey, locale), familyLabel: serviceFamilyName(item.family, locale) } : item), [items, isFineBindery, locale]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const customServices = services;
  const refresh = async (next?: BinderPricingCatalogItem[]) => {
    if (next) queryClient.setQueryData(PRICING_CATALOG_KEY, next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PRICING_CATALOG_KEY }),
      queryClient.invalidateQueries({ queryKey: ["binder", "base-prices", "v1"] }),
    ]);
  };
  const needle = normalizeSearch(search);
  const visible = localizedItems.filter((item) => {
    if (
      needle &&
      !normalizeSearch(`${item.label} ${item.familyLabel} ${item.hint ?? ""}`).includes(needle)
    )
      return false;
    if (filter === "favorites") return item.isFavorite;
    if (filter === "custom") return item.hasOverride;
    if (filter === "manual") return item.basePricingMode === "manual_review";
    return true;
  });
  const groups = WORK_FAMILIES.map((family) => ({
    ...family,
    label: isFineBindery ? serviceFamilyName(family.key, locale) : family.label,
    items: visible.filter((item) => item.family === family.key),
  })).filter((group) => group.items.length);
  const customCount = localizedItems.filter((item) => item.hasOverride).length;
  const favoriteCount = localizedItems.filter((item) => item.isFavorite).length;

  return (
    <section aria-labelledby="pricing-catalog-title" className="space-y-6">
      <div>
        <h2 id="pricing-catalog-title" className="font-serif text-2xl">
          Mes prestations et mes prix
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les tarifs Ma Reliure servent de point de départ. Vous pouvez personnaliser vos prix à
          tout moment.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Résumé du catalogue">
        <Metric value="45" label="prestations" />
        <Metric value="41" label="tarifées" />
        <Metric value="4" label="sur étude" />
        <Metric value={`${customCount} · ${favoriteCount}`} label="personnalisés · favoris" />
      </div>

      <div className={`${CARD} space-y-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              aria-label="Rechercher une prestation"
              className={`${FIELD} pl-9`}
              placeholder="Rechercher une prestation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => setBulkMode("adjust")}
            >
              Ajuster plusieurs tarifs
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setBulkMode("reset")}>
              Réinitialiser des tarifs
            </button>
          </div>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filtrer les prestations"
        >
          {(
            [
              ["all", "Toutes"],
              ["favorites", "Favoris"],
              ["custom", "Prix personnalisés"],
              ["manual", "Sur étude"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === value ? "border-[#7a2230] bg-[#f7eff0] text-[#681d29]" : "border-[#cfc5b6] bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {bulkMode && (
        <BulkPanel
          mode={bulkMode}
          items={localizedItems}
          selected={selected}
          onClose={() => setBulkMode(null)}
          onSaved={refresh}
        />
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`pricing-${group.key}`}
          className="overflow-hidden rounded-sm border border-[#d8d0c4] bg-[#fffdf8]"
        >
          <div className="flex items-center justify-between border-b border-[#d8d0c4] bg-[#f4efe6] px-4 py-3">
            <h3
              id={`pricing-${group.key}`}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5f1b27]"
            >
              {group.label}
            </h3>
            <span className="text-xs text-muted-foreground">{group.items.length}</span>
          </div>
          <div className="hidden grid-cols-[36px_minmax(180px,1fr)_150px_150px_90px_190px] gap-3 border-b border-[#e5ded3] px-4 py-2 text-xs font-semibold text-muted-foreground md:grid">
            <span />
            <span>Prestation</span>
            <span>Base Ma Reliure</span>
            <span>Mon tarif</span>
            <span>Écart</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-[#e5ded3]">
            {group.items.map((item) => (
              <PricingRow
                key={item.pricingKey}
                item={item}
                checked={selected.has(item.pricingKey)}
                onCheck={(checked) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked) next.add(item.pricingKey);
                    else next.delete(item.pricingKey);
                    return next;
                  })
                }
                onSaved={refresh}
              />
            ))}
          </div>
        </section>
      ))}
      {!groups.length && (
        <p className={`${CARD} text-sm text-muted-foreground`}>
          Aucune prestation ne correspond à cette recherche.
        </p>
      )}

      <section aria-labelledby="custom-services-title" className={`${CARD} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              id="custom-services-title"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5f1b27]"
            >
              Mes prestations personnalisées
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Vos créations propres restent séparées du référentiel Ma Reliure.
            </p>
          </div>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => setCustomOpen((open) => !open)}
          >
            + Créer une prestation
          </button>
        </div>
        {customOpen && (
          <ServiceForm
            target={{ kind: "custom" }}
            onCancel={() => setCustomOpen(false)}
            onSaved={() => {
              setCustomOpen(false);
              void queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
            }}
          />
        )}
        {customServices.length ? (
          <div className="divide-y divide-border">
            {customServices.map((service) => (
              <CustomServiceRow key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune prestation personnalisée.</p>
        )}
      </section>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-[#d8d0c4] bg-[#fffdf8] px-3 py-3">
      <strong className="block font-serif text-xl font-normal">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function PricingRow({
  item,
  checked,
  onCheck,
  onSaved,
}: {
  item: BinderPricingCatalogItem;
  checked: boolean;
  onCheck: (value: boolean) => void;
  onSaved: (next?: BinderPricingCatalogItem[]) => Promise<void>;
}) {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const priceLocale = isFineBindery ? locale : undefined;
  const savePrice = useServerFn(saveMyPriceOverride);
  const setFavorite = useServerFn(setMyBasePriceFavorite);
  const reset = useServerFn(resetMyPrices);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [manualChoice, setManualChoice] = useState<"study" | "amount">(
    item.hasOverride ? "amount" : "study",
  );
  const [amount, setAmount] = useState(centsToEuroInput(item.effectivePriceCents ?? 0));
  const [percent, setPercent] = useState("10");
  const [error, setError] = useState(false);
  const favoriteMutation = useMutation({
    mutationFn: () =>
      setFavorite({ data: { pricingKey: item.pricingKey, isFavorite: !item.isFavorite } }),
    onSuccess: onSaved,
  });
  const resetMutation = useMutation({
    mutationFn: () => reset({ data: { pricingKeys: [item.pricingKey] } }),
    onSuccess: (next) => {
      setEditing(false);
      void onSaved(next);
    },
  });
  const baseManual = item.basePricingMode === "manual_review";
  const percentBps = signedPercentToBps(percent);
  const entered = parseEurosToCents(amount);
  const nextCents =
    baseManual && manualChoice === "study"
      ? null
      : mode === "percent" && item.basePriceCents !== null && percentBps !== null
      ? adjustPriceCents(item.basePriceCents, percentBps)
      : entered;
  const saveMutation = useMutation({
    mutationFn: () => {
      if (nextCents === null) throw new Error("invalid");
      return savePrice({
        data: {
          pricingKey: item.pricingKey,
          unitPriceCents: nextCents,
        },
      });
    },
    onSuccess: (next) => {
      setEditing(false);
      setError(false);
      void onSaved(next);
    },
    onError: () => setError(true),
  });
  const difference = priceDifferenceBps(item.basePriceCents, item.effectivePriceCents);
  return (
    <div className="p-4">
      <div className="hidden grid-cols-[36px_minmax(180px,1fr)_150px_150px_90px_190px] items-center gap-3 md:grid">
        <input
          type="checkbox"
          aria-label={`Sélectionner ${item.label}`}
          checked={checked}
          onChange={(event) => onCheck(event.target.checked)}
        />
        <div className="flex min-w-0 items-center gap-2">
          <FavoriteButton
            item={item}
            pending={favoriteMutation.isPending}
            onClick={() => favoriteMutation.mutate()}
          />
          <OperationThumbnail pricingKey={item.pricingKey} label={item.label} />
          <span className="font-medium">{item.label}</span>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatPrice(item.basePriceCents, item.basePricingMode, priceLocale)}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatPrice(item.effectivePriceCents, item.effectivePricingMode, priceLocale)}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatDifference(difference)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-10 text-sm font-semibold text-[#681d29] underline"
            onClick={() => setEditing((open) => !open)}
          >
            {baseManual && !item.hasOverride ? "Définir un tarif" : "Modifier"}
          </button>
          {item.hasOverride && (
            <button
              type="button"
              className="min-h-10 text-xs text-muted-foreground underline"
              onClick={() => resetMutation.mutate()}
            >
              Revenir au tarif Ma Reliure
            </button>
          )}
        </div>
      </div>
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Sélectionner ${item.label}`}
              checked={checked}
              onChange={(event) => onCheck(event.target.checked)}
            />
            <OperationThumbnail pricingKey={item.pricingKey} label={item.label} />
            <h4 className="font-semibold">{item.label}</h4>
          </div>
          <FavoriteButton
            item={item}
            pending={favoriteMutation.isPending}
            onClick={() => favoriteMutation.mutate()}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="block text-xs text-muted-foreground">Base Ma Reliure</span>
            {formatPrice(item.basePriceCents, item.basePricingMode, priceLocale)}
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Mon tarif</span>
            <strong>{formatPrice(item.effectivePriceCents, item.effectivePricingMode, priceLocale)}</strong>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{formatDifference(difference)}</span>
          <button
            type="button"
            className="min-h-10 text-sm font-semibold text-[#681d29] underline"
            onClick={() => setEditing((open) => !open)}
          >
            {baseManual && !item.hasOverride ? "Définir un tarif" : "Modifier"}
          </button>
        </div>
        {item.hasOverride && (
          <button
            type="button"
            className="mt-1 min-h-10 text-xs text-muted-foreground underline"
            onClick={() => resetMutation.mutate()}
          >
            Revenir au tarif Ma Reliure
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-4 border-t border-dashed border-[#d8d0c4] pt-4">
          <p className="text-sm font-semibold">Comment souhaitez-vous modifier ce prix ?</p>
          {baseManual ? (
            <div className="mt-3 flex gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={manualChoice === "study"} onChange={() => setManualChoice("study")} /> Rester sur étude</label>
              <label className="flex items-center gap-2"><input type="radio" checked={manualChoice === "amount"} onChange={() => setManualChoice("amount")} /> Définir un montant</label>
            </div>
          ) : (
            <div className="mt-3 flex gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "amount"} onChange={() => setMode("amount")} /> Montant</label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={mode === "percent"}
                  onChange={() => setMode("percent")}
                />{" "}
                Pourcentage
              </label>
            </div>
          )}
          <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            {baseManual && manualChoice === "study" ? (
              <div className="text-sm"><span className="block text-xs text-muted-foreground">Votre tarif</span><strong>Sur étude</strong></div>
            ) : mode === "amount" ? (
              <label className="text-xs text-muted-foreground">
                Votre tarif (€)
                <input
                  className={`${FIELD} mt-1 text-right`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            ) : (
              <label className="text-xs text-muted-foreground">
                Ajustement (%)
                <input
                  className={`${FIELD} mt-1 text-right`}
                  inputMode="decimal"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
              </label>
            )}
            {(!baseManual || manualChoice === "amount") && <div className="text-sm">
              <span className="block text-xs text-muted-foreground">
                Nouveau tarif
              </span>
              <strong>
                {nextCents === null
                  ? "Saisie invalide"
                  : formatPrice(nextCents, baseManual ? "starting_from" : item.basePricingMode, priceLocale)}
              </strong>
            </div>}
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={(!(baseManual && manualChoice === "study") && nextCents === null) || saveMutation.isPending || resetMutation.isPending}
              onClick={() => baseManual && manualChoice === "study" ? resetMutation.mutate() : saveMutation.mutate()}
            >
              {baseManual && manualChoice === "study" ? "Conserver sur étude" : "Enregistrer"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              Le prix n’a pas pu être enregistré.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FavoriteButton({
  item,
  pending,
  onClick,
}: {
  item: BinderPricingCatalogItem;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={item.isFavorite}
      aria-label={
        item.isFavorite ? `Retirer ${item.label} des favoris` : `Mettre ${item.label} en favori`
      }
      disabled={pending}
      className="flex h-10 w-10 shrink-0 items-center justify-center"
      onClick={onClick}
    >
      <Star
        className={`h-5 w-5 ${item.isFavorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
    </button>
  );
}

function signedPercentToBps(value: string): number | null {
  const amount = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(amount) || amount < -90 || amount > 500) return null;
  return Math.round(amount * 100);
}

function BulkPanel({
  mode,
  items,
  selected,
  onClose,
  onSaved,
}: {
  mode: BulkMode;
  items: BinderPricingCatalogItem[];
  selected: Set<string>;
  onClose: () => void;
  onSaved: (next?: BinderPricingCatalogItem[]) => Promise<void>;
}) {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const adjust = useServerFn(bulkAdjustMyPrices);
  const reset = useServerFn(resetMyPrices);
  const [scope, setScope] = useState<Scope>("all");
  const [family, setFamily] = useState<WorkFamilyKey>("repair");
  const [percent, setPercent] = useState("10");
  const [source, setSource] = useState<BulkPriceSource>("base");
  const percentBps = signedPercentToBps(percent);
  const scopedKeys = useMemo(
    () =>
      scope === "all"
        ? items.map((item) => item.pricingKey)
        : scope === "category"
          ? items.filter((item) => item.family === family).map((item) => item.pricingKey)
          : [...selected],
    [scope, family, items, selected],
  );
  const preview =
    mode === "adjust" && percentBps !== null
      ? bulkPricePreview(items, scopedKeys, percentBps, source)
      : items
          .filter((item) => scopedKeys.includes(item.pricingKey) && item.hasOverride)
          .map((item) => ({
            pricingKey: item.pricingKey,
            label: item.label,
            currentPriceCents: item.effectivePriceCents!,
            newPriceCents: item.basePriceCents,
          }));
  const mutation = useMutation({
    mutationFn: () =>
      mode === "adjust"
        ? adjust({ data: { pricingKeys: scopedKeys, percentBps: percentBps!, source } })
        : reset({ data: { pricingKeys: preview.map((item) => item.pricingKey) } }),
    onSuccess: (next) => {
      onClose();
      void onSaved(next);
    },
  });
  return (
    <section
      aria-labelledby="bulk-title"
      className="border-2 border-[#7a2230]/35 bg-[#fffaf3] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="bulk-title" className="font-serif text-xl">
            {mode === "adjust" ? "Ajuster plusieurs tarifs" : "Réinitialiser des tarifs"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Vérifiez chaque montant avant de confirmer.
          </p>
        </div>
        <button type="button" className="min-h-10 px-2" onClick={onClose}>
          Fermer
        </button>
      </div>
      <fieldset className="mt-4 flex flex-wrap gap-4 text-sm">
        <legend className="mb-2 font-semibold">Appliquer à</legend>
        {(
          [
            ["all", "Toutes les prestations"],
            ["category", "Une catégorie"],
            ["selected", `Prestations sélectionnées (${selected.size})`],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" checked={scope === value} onChange={() => setScope(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      {scope === "category" && (
        <select
          aria-label="Catégorie"
          className={`${FIELD} mt-3 max-w-sm`}
          value={family}
          onChange={(event) => setFamily(event.target.value as WorkFamilyKey)}
        >
          {WORK_FAMILIES.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      {mode === "adjust" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Ajustement (%)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
            />
          </label>
          <fieldset className="text-sm">
            <legend className="mb-2 text-xs text-muted-foreground">Appliquer sur</legend>
            <label className="mr-4 inline-flex items-center gap-2">
              <input type="radio" checked={source === "base"} onChange={() => setSource("base")} />
              Tarifs Ma Reliure
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={source === "current"}
                onChange={() => setSource("current")}
              />
              Mes tarifs actuels
            </label>
          </fieldset>
        </div>
      )}
      <p className="mt-5 font-semibold">
        {preview.length} tarif{preview.length > 1 ? "s" : ""}{" "}
        {mode === "adjust" ? "vont être modifiés" : "vont revenir à la base Ma Reliure"}.
      </p>
      <div className="mt-3 max-h-64 overflow-y-auto border border-[#d8d0c4] bg-white">
        <ul className="divide-y divide-[#e5ded3]">
          {preview.map((item) => (
            <li
              key={item.pricingKey}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>{item.label}</span>
              <span className="shrink-0 tabular-nums">
                {isFineBindery ? formatFineBinderyMoney(item.currentPriceCents, locale) : euros(item.currentPriceCents)} →{" "}
                {item.newPriceCents === null
                  ? (isFineBindery ? formatFineBinderyPrice(null, "manual_review", locale) : "Sur étude")
                  : (isFineBindery ? formatFineBinderyMoney(item.newPriceCents, locale) : euros(item.newPriceCents))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {mutation.isError && (
        <div className="mt-3">
          <ErrorNote>La modification n’a pas pu être appliquée.</ErrorNote>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
          Annuler
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={!preview.length || percentBps === null || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mode === "adjust"
            ? `Appliquer à ${preview.length} prestations`
            : `Réinitialiser ${preview.length} tarifs`}
        </button>
      </div>
    </section>
  );
}

function CustomServiceRow({ service }: { service: Service }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyService);
  const archive = useServerFn(archiveMyService);
  const [name, setName] = useState(service.name);
  const [unit, setUnit] = useState(service.unit ?? "");
  const [price, setPrice] = useState(service.unitPriceCents);
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: service.id,
          categoryId: service.categoryId,
          name: name.trim(),
          description: service.description,
          unitPriceCents: price,
          vatRateBps: service.vatRateBps,
          unit: unit.trim() || null,
          isActive: true,
          isFavorite: !service.isFavorite,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
  const remove = useMutation({
    mutationFn: () => archive({ data: { id: service.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }),
  });
  const persist = () =>
    save({
      data: {
        id: service.id,
        categoryId: service.categoryId,
        name: name.trim(),
        description: service.description,
        unitPriceCents: price,
        vatRateBps: service.vatRateBps,
        unit: unit.trim() || null,
        isActive: true,
        isFavorite: service.isFavorite,
      },
    }).then(() => queryClient.invalidateQueries({ queryKey: CATALOG_KEY }));
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(180px,1fr)_140px_130px_44px_80px] sm:items-center">
      <input
        aria-label={`Nom de ${service.name}`}
        className={FIELD}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => {
          if (name.trim() && name !== service.name) void persist();
        }}
      />
      <input
        aria-label={`Unité de ${service.name}`}
        className={FIELD}
        placeholder="unité"
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        onBlur={() => {
          if (unit !== (service.unit ?? "")) void persist();
        }}
      />
      <MoneyInput
        id={`custom-price-${service.id}`}
        label={`Prix de ${service.name}`}
        cents={price}
        onChange={setPrice}
        onCommit={() => {
          if (price !== service.unitPriceCents) void persist();
        }}
      />
      <button
        type="button"
        aria-label={service.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="h-11"
        onClick={() => mutation.mutate()}
      >
        <Star
          className={`mx-auto h-5 w-5 ${service.isFavorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
        />
      </button>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => remove.mutate()}>
        Retirer
      </button>
    </div>
  );
}
