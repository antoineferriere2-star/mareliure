/**
 * The matching screen (§33): the Project Brief on the left, the relieurs who
 * could take it on the right, and a hard ceiling of three.
 *
 * The score orders the right-hand column and explains itself; it never ticks a
 * box. The admin decides, which is the whole point of a concierge MVP — and of
 * the CLAUDE.md rule that the system proposes and the human disposes.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  clearCaseManualReview,
  generateMarketplacePricing,
  getMarketplaceCase,
  saveMarketplacePricing,
  selectBinderOffer,
  sendCaseToBinders,
  validateMarketplacePricing,
} from "@/marketplace/services/marketplace.data.functions";
import {
  acceptCommercialProposal,
  applyAutomaticFranceTaxPolicy,
  createCommercialProposal,
  getPaymentPreflight,
  listCaseCommercialProposals,
  resetProposalTaxToManualReview,
  validateCommercialProposalTax,
} from "@/marketplace/services/commercialProposal.data.functions";
import {
  resolveAutomaticTaxPolicy,
  suggestTaxPolicyForCountry,
  TAX_POLICIES,
} from "@/marketplace/commercial/taxPolicy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { CASE_STATUS_LABELS, isCaseStatus, offerStateLabel } from "@/marketplace/cases/state";
import { formatEuros } from "@/marketplace/pricing/money";
import { validateManagedPrice } from "@/marketplace/pricing/pricing.engine";
import { workItemLabel } from "@/marketplace/pricing/catalog";
import { CONFIDENCE_LABELS, type PricingConfidence } from "@/marketplace/pricing/confidence";
import type { PricingComponent } from "@/marketplace/pricing/pricing.types";
import { PRICING_POLICY } from "@/marketplace/pricing/pricing.rules";
import { MARKETPLACE_BRAND_CONFIGS, isMarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { Button } from "@/components/ui/button";
import { AdminConversations } from "@/marketplace/pages/admin/AdminConversations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toCents(euros: string): number {
  return Math.round(Number.parseFloat(euros.replace(",", ".")) * 100);
}

function PricingPanel({
  caseId,
  row,
  refresh,
}: {
  caseId: string;
  row: {
    manual_review_required: boolean;
    pricing_status: string;
    suggested_customer_price_cents: number | null;
    suggested_binder_payout_cents: number | null;
    customer_price_cents: number | null;
    binder_payout_cents: number | null;
    price_includes: string[];
    pricing_confidence: string | null;
    pricing_reason_codes: string[];
    pricing_components: PricingComponent[] | null;
    pricing_low_estimate_cents: number | null;
    pricing_high_estimate_cents: number | null;
    pricing_reference_count: number | null;
  };
  refresh: () => Promise<unknown>;
}) {
  const generate = useServerFn(generateMarketplacePricing);
  const save = useServerFn(saveMarketplacePricing);
  const validate = useServerFn(validateMarketplacePricing);
  const initialCustomer = row.customer_price_cents ?? row.suggested_customer_price_cents;
  const initialPayout = row.binder_payout_cents ?? row.suggested_binder_payout_cents;
  const [customer, setCustomer] = useState(initialCustomer ? String(initialCustomer / 100) : "");
  const [payout, setPayout] = useState(initialPayout ? String(initialPayout / 100) : "");
  const [includes, setIncludes] = useState(row.price_includes.join(", "));
  const customerCents = toCents(customer);
  const payoutCents = toCents(payout);
  const result = validateManagedPrice(
    Number.isFinite(customerCents) ? customerCents : 0,
    Number.isFinite(payoutCents) ? payoutCents : 0,
  );
  const payload = {
    caseId,
    customerPriceCents: customerCents,
    binderPayoutCents: payoutCents,
    priceIncludes: includes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  const generation = useMutation({
    mutationFn: () => generate({ data: { caseId } }),
    onSuccess: refresh,
  });
  const saving = useMutation({ mutationFn: () => save({ data: payload }), onSuccess: refresh });
  const validation = useMutation({
    mutationFn: () => validate({ data: payload }),
    onSuccess: refresh,
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Prix Ma Reliure
        </h2>
        <span className="text-xs text-muted-foreground">
          {row.pricing_status === "validated" ? "Validé" : "À valider"}
        </span>
      </div>
      {/* La décomposition, réservée à l'administration. Un client n'a pas à
          lire ce que nous payons l'atelier — mais quiconque valide un prix
          doit pouvoir dire d'où vient chaque euro, et sur combien d'ateliers
          il repose. */}
      {row.pricing_status === "manual_review" ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Le moteur n’a pas chiffré ce projet.</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Il ne dispose pas des tarifs de référence nécessaires, ou le projet demande une étude.
            Le prix doit être arrêté à la main.
          </p>
        </div>
      ) : (
        row.pricing_confidence && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Confiance{" "}
              {CONFIDENCE_LABELS[row.pricing_confidence as PricingConfidence] ??
                row.pricing_confidence}
              {row.pricing_reference_count
                ? ` · ${row.pricing_reference_count} ateliers de référence`
                : ""}
            </p>
            {(row.pricing_components ?? []).length > 0 && (
              <table className="w-full text-xs">
                <tbody>
                  {(row.pricing_components ?? []).map((component) => (
                    <tr key={component.workItemKey} className="border-b border-border/50">
                      <td className="py-1 pr-2">
                        {component.label ?? workItemLabel(component.workItemKey)}
                        {component.approximated && (
                          <span
                            className="ml-1 text-amber-700"
                            title={component.approximationNote ?? ""}
                          >
                            ≈
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right text-muted-foreground">
                        {component.referenceCount} ate.
                      </td>
                      <td className="py-1 pl-2 text-right tabular-nums">
                        {formatEuros(component.referencePayoutCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {row.pricing_low_estimate_cents !== null &&
              row.pricing_high_estimate_cents !== null && (
                <p className="text-xs text-muted-foreground">
                  Fourchette observée : {formatEuros(row.pricing_low_estimate_cents)} –{" "}
                  {formatEuros(row.pricing_high_estimate_cents)}
                </p>
              )}
          </div>
        )
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="customer-price">Prix client (€)</Label>
          <Input
            id="customer-price"
            className="mt-1"
            inputMode="decimal"
            value={customer}
            disabled={row.pricing_status === "validated"}
            onChange={(event) => setCustomer(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="binder-payout">Rémunération atelier (€)</Label>
          <Input
            id="binder-payout"
            className="mt-1"
            inputMode="decimal"
            value={payout}
            disabled={row.pricing_status === "validated"}
            onChange={(event) => setPayout(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="price-includes">Ce que le prix comprend</Label>
        <Input
          id="price-includes"
          className="mt-1"
          value={includes}
          disabled={row.pricing_status === "validated"}
          onChange={(event) => setIncludes(event.target.value)}
          placeholder="Reliure, matériaux, expédition retour"
        />
      </div>
      <p className={`mt-3 text-sm ${result.valid ? "text-emerald-700" : "text-destructive"}`}>
        Marge : {formatEuros(result.marginCents)} · {(result.marginBps / 100).toFixed(1)} %
      </p>
      {!result.valid && customer !== "" && payout !== "" && (
        <p className="mt-1 text-xs text-destructive">{result.errors.join(" ")}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(row.pricing_status === "pending" || row.pricing_status === "manual_review") && (
          <Button
            variant="outline"
            disabled={generation.isPending}
            onClick={() => generation.mutate()}
          >
            {/* Une abstention n'est pas définitive : dès qu'un relieur a
                rempli sa grille, le même dossier peut être rechiffré. */}
            {row.pricing_status === "manual_review"
              ? "Reprendre le calcul"
              : "Calculer une suggestion"}
          </Button>
        )}
        {row.pricing_status !== "validated" && (
          <Button
            variant="outline"
            disabled={!result.valid || saving.isPending}
            onClick={() => saving.mutate()}
          >
            Enregistrer
          </Button>
        )}
        {row.pricing_status !== "validated" && (
          <Button
            disabled={!result.valid || validation.isPending || row.manual_review_required}
            onClick={() => validation.mutate()}
          >
            Valider le prix
          </Button>
        )}
      </div>
      {(generation.error || saving.error || validation.error) && (
        <p className="mt-3 text-sm text-destructive">
          {(generation.error ?? saving.error ?? (validation.error as Error)).message}
        </p>
      )}
    </section>
  );
}

/**
 * La lecture économique du dossier (audit du 15 septembre 2026, §15) : ce
 * que Ma Reliure/Fine Bindery achète à l'atelier, ce qu'elle vend au
 * client, et ce qu'il en reste — jamais de comptabilité Stripe ici, cette
 * phase ne fait que rendre lisible ce que le pricing a déjà décidé.
 */
/**
 * Six blocs, dans l'ordre où le prix se construit — jamais mélangés : le
 * jour où quelque chose a l'air faux, il faut pouvoir dire lequel des six
 * l'explique (brief du 16 septembre 2026, §5). Interne/admin uniquement :
 * aucun client ne voit cet écran.
 */
function line(label: string, value: string) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function EconomicsPanel({
  row,
}: {
  row: {
    brand: string;
    brand_multiplier_bps: number | null;
    base_service_price_cents: number | null;
    service_price_cents: number | null;
    binder_payout_cents: number | null;
    tax_status: string;
    pricing_pricebook_reference_cents: number | null;
    pricing_price_bound_by: string | null;
  };
}) {
  const brand = isMarketplaceBrand(row.brand) ? row.brand : "MA_RELIURE";
  const grossMarginCents =
    row.service_price_cents !== null && row.binder_payout_cents !== null
      ? row.service_price_cents - row.binder_payout_cents
      : null;
  const grossMarginRate =
    grossMarginCents !== null && row.service_price_cents ? grossMarginCents / row.service_price_cents : null;
  const brandReferenceCents =
    row.pricing_pricebook_reference_cents !== null && row.brand_multiplier_bps !== null
      ? Math.round((row.pricing_pricebook_reference_cents * row.brand_multiplier_bps) / 10_000)
      : null;
  const boundByLabel: Record<string, string> = {
    reference: "la référence Pricebook",
    margin_floor: "le plancher de marge",
    contribution_floor: "le plancher de contribution",
  };

  const group = (title: string, children: ReactNode) => (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Économie
      </h2>
      <div className="mt-3 text-sm">
        {group(
          "Pricebook",
          line(
            "Référence (HT)",
            row.pricing_pricebook_reference_cents !== null
              ? formatEuros(row.pricing_pricebook_reference_cents)
              : "Non couverte — aucune entrée publiée pour tous les travaux du dossier",
          ),
        )}

        {group(
          "Marque",
          <>
            {line("Marque", MARKETPLACE_BRAND_CONFIGS[brand].displayName)}
            {line(
              "Multiplicateur",
              row.brand_multiplier_bps !== null ? `×${(row.brand_multiplier_bps / 10_000).toFixed(2)}` : "—",
            )}
            {brand === "FINE_BINDERY" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Le ×1,30 est une politique de prix de marque (Brand Pricing Policy) — il ne
                change ni ce que l'atelier reçoit, ni le transport.
              </p>
            )}
            {brandReferenceCents !== null &&
              line("Référence Pricebook × marque", formatEuros(brandReferenceCents))}
          </>,
        )}

        {group(
          "Atelier",
          line(
            "Rémunération (HT)",
            row.binder_payout_cents !== null ? formatEuros(row.binder_payout_cents) : "—",
          ),
        )}

        {group(
          "Garde-fous",
          <>
            {line("Marge cible", `${(PRICING_POLICY.targetMarginBps / 100).toFixed(1)} %`)}
            {line("Contribution minimale", formatEuros(PRICING_POLICY.minimumContributionCents))}
            {row.pricing_price_bound_by &&
              line(
                "Prix retenu par",
                boundByLabel[row.pricing_price_bound_by] ?? row.pricing_price_bound_by,
              )}
          </>,
        )}

        {group(
          "Client",
          line(
            "Prix service suggéré (HT)",
            row.service_price_cents !== null ? formatEuros(row.service_price_cents) : "—",
          ),
        )}

        {group(
          "Économie",
          grossMarginCents !== null
            ? line(
                "Marge brute",
                `${formatEuros(grossMarginCents)} · ${grossMarginRate !== null ? (grossMarginRate * 100).toFixed(1) : "—"} %`,
              )
            : line("Marge brute", "—"),
        )}

        {line("Statut fiscal", row.tax_status === "TAX_REVIEW_REQUIRED" ? "À valider" : row.tax_status)}
      </div>
    </section>
  );
}

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  proposed: "Proposée",
  accepted: "Acceptée",
  superseded: "Remplacée",
  cancelled: "Annulée",
};

const TAX_POLICY_LABELS: Record<string, string> = {
  MANUAL_TAX_REVIEW: "À valider manuellement",
  FR_B2C: "France — particulier",
  EU_B2C: "UE (hors France) — particulier",
  NON_EU_B2C: "Hors UE — particulier",
  NON_EU_TEMPORARY_IMPORT_REEXPORT: "Hors UE — admission temporaire, réexport",
};

/**
 * La seule écriture qui fait passer une proposition de `MANUAL_TAX_REVIEW`
 * à une catégorie fiscale nommée (§6, §9-10 du brief du 17 septembre 2026) —
 * une décision humaine à chaque fois, jamais une règle automatique : le pays
 * ne fait que pré-remplir une suggestion (`suggestTaxPolicyForCountry`),
 * l'admin choisit et valide explicitement.
 */
function TaxValidationForm({
  proposal,
  caseId,
}: {
  proposal: { id: string; version: number };
  caseId: string;
}) {
  const validate = useServerFn(validateCommercialProposalTax);
  const applyAutoFrance = useServerFn(applyAutomaticFranceTaxPolicy);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "case", caseId, "commercial-proposals"] as const;
  const [country, setCountry] = useState("");
  const [policy, setPolicy] = useState<string>("MANUAL_TAX_REVIEW");
  const [vatRate, setVatRate] = useState("");
  // CUSTOMER par défaut (§10 du brief du 17 septembre 2026) : Fine Bindery
  // recevra des antiquaires, libraires, hôtels, sociétés — jamais présumé
  // particulier ni professionnel sans décision explicite de l'admin.
  const [customerType, setCustomerType] = useState<"CUSTOMER" | "BUSINESS">("CUSTOMER");
  const [businessName, setBusinessName] = useState("");
  const [businessVatNumber, setBusinessVatNumber] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  const validating = useMutation({
    mutationFn: () =>
      validate({
        data: {
          proposalId: proposal.id,
          taxPolicy: policy,
          taxCountry: country,
          customerVatRateBps:
            vatRate.trim() === ""
              ? null
              : Math.round(Number.parseFloat(vatRate.replace(",", ".")) * 100),
          customerType,
          businessName: customerType === "BUSINESS" ? businessName.trim() : null,
          businessVatNumber:
            customerType === "BUSINESS" && businessVatNumber.trim() ? businessVatNumber.trim() : null,
          billingCountry: billingCountry.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "payment-preflight"] });
    },
  });

  // Décision opérationnelle temporaire de l'utilisateur (18 septembre
  // 2026) : la TVA française standard s'applique automatiquement — cette
  // fonction ne renvoie rien pour tout ce qui n'est pas la France,
  // Fine Bindery et l'UE hors France restent donc MANUAL_TAX_REVIEW.
  const automaticFrance = resolveAutomaticTaxPolicy(billingCountry || null);
  const applyingAutoFrance = useMutation({
    mutationFn: () =>
      applyAutoFrance({
        data: {
          proposalId: proposal.id,
          billingCountry,
          customerType,
          businessName: customerType === "BUSINESS" ? businessName.trim() : null,
          businessVatNumber:
            customerType === "BUSINESS" && businessVatNumber.trim() ? businessVatNumber.trim() : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "payment-preflight"] });
    },
  });

  return (
    <div className="mt-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Valider la fiscalité — v{proposal.version}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Type de client</Label>
          <Select value={customerType} onValueChange={(v) => setCustomerType(v as "CUSTOMER" | "BUSINESS")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CUSTOMER">Particulier</SelectItem>
              <SelectItem value="BUSINESS">Professionnel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {customerType === "BUSINESS" && (
          <>
            <div>
              <Label className="text-xs">Raison sociale</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">N° TVA (facultatif)</Label>
              <Input value={businessVatNumber} onChange={(e) => setBusinessVatNumber(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <Label className="text-xs">Pays de facturation</Label>
          <Input
            value={billingCountry}
            maxLength={2}
            placeholder="FR"
            onChange={(e) => setBillingCountry(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {automaticFrance && (
        <div className="mt-3 rounded-md border border-emerald-600/30 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-900">
            France détectée — TVA standard 20 % applicable automatiquement (décision
            opérationnelle temporaire du 18 septembre 2026).
          </p>
          {applyingAutoFrance.error && (
            <p className="mt-2 text-xs text-destructive">
              {(applyingAutoFrance.error as Error).message}
            </p>
          )}
          <Button
            size="sm"
            className="mt-2"
            disabled={
              applyingAutoFrance.isPending || (customerType === "BUSINESS" && !businessName.trim())
            }
            onClick={() => applyingAutoFrance.mutate()}
          >
            Appliquer TVA France 20 % (automatique)
          </Button>
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Ou valider manuellement une autre catégorie (UE, hors UE, cas particulier…)
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Pays de taxation</Label>
            <Input
              value={country}
              maxLength={2}
              placeholder="FR"
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setCountry(value);
                setPolicy(suggestTaxPolicyForCountry(value || null));
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Catégorie</Label>
            <Select value={policy} onValueChange={setPolicy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_POLICIES.filter((p) => p !== "MANUAL_TAX_REVIEW").map((p) => (
                  <SelectItem key={p} value={p}>
                    {TAX_POLICY_LABELS[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">TVA (%, laisser vide si non applicable)</Label>
            <Input value={vatRate} placeholder="20" onChange={(e) => setVatRate(e.target.value)} />
          </div>
        </div>
        {validating.error && (
          <p className="mt-2 text-xs text-destructive">{(validating.error as Error).message}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={
            validating.isPending || !country.trim() || (customerType === "BUSINESS" && !businessName.trim())
          }
          onClick={() => validating.mutate()}
        >
          Valider cette fiscalité manuellement
        </Button>
      </details>
    </div>
  );
}

/**
 * L'écran de vérification avant le premier vrai paiement (§13) : les mêmes
 * champs que `checkoutEligibility` plus les à-côtés (compte Stripe,
 * Products, webhook) qu'elle ne connaît pas — rien n'est recalculé côté
 * navigateur, tout vient de `getPaymentPreflight`.
 */
function PreflightPanel({ caseId }: { caseId: string }) {
  const fetchPreflight = useServerFn(getPaymentPreflight);
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["marketplace", "case", caseId, "payment-preflight"] as const,
    queryFn: () => fetchPreflight({ data: caseId }),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Préflight paiement
        </h2>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
          Rafraîchir
        </Button>
      </div>
      {isPending && <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>}
      {error && <p className="mt-2 text-xs text-destructive">{(error as Error).message}</p>}
      {data && !data.found && (
        <p className="mt-2 text-xs text-destructive">Dossier introuvable.</p>
      )}
      {data && data.found && (
        <div className="mt-3 text-sm">
          {line("Marque", data.brand ?? "—")}
          {line("Dossier", data.caseReference ?? "—")}
          {line("Client", [data.customerName, data.customerEmail].filter(Boolean).join(" · ") || "—")}
          {line(
            "Type de client",
            data.customerType === "BUSINESS"
              ? `Professionnel — ${data.businessName ?? "raison sociale manquante"}`
              : data.customerType === "CUSTOMER"
                ? "Particulier"
                : "—",
          )}
          {line("Pays de facturation", data.billingCountry ?? "—")}
          {line("Service (HT)", data.serviceHtCents !== null ? formatEuros(data.serviceHtCents) : "—")}
          {line("Transport (HT)", data.shippingHtCents !== null ? formatEuros(data.shippingHtCents) : "—")}
          {line(
            "Fiscalité",
            data.taxPolicy ? (TAX_POLICY_LABELS[data.taxPolicy] ?? data.taxPolicy) : "—",
          )}
          {line(
            "Source",
            data.taxValidationSource === "FR_STANDARD_VAT_20"
              ? "Auto-validée par la politique système (FR_STANDARD_VAT_20)"
              : (TAX_VALIDATION_SOURCE_LABELS[data.taxValidationSource ?? ""] ??
                data.taxValidationSource ??
                "—"),
          )}
          {line(
            "TVA",
            data.customerVatRateBps !== null
              ? `${(data.customerVatRateBps / 100).toFixed(1)} % (${
                  data.customerVatAmountCents !== null ? formatEuros(data.customerVatAmountCents) : "—"
                })`
              : "—",
          )}
          {line("Total TTC", data.totalTtcCents !== null ? formatEuros(data.totalTtcCents) : "—")}
          {line("Compte Stripe attendu", data.stripeExpectedAccountId ?? "—")}
          {line("Compte Stripe joignable", data.stripeAccountOk ? "Oui" : "Non")}
          {line("Products Stripe configurés", data.stripeProductIds ? "Oui" : "Non")}
          {line("Descripteur relevé (suffixe)", data.statementDescriptorSuffix ?? "—")}
          {line("Webhook configuré", data.webhookConfigured ? "Oui" : "Non")}
          {line("Déjà payé", data.alreadyPaid ? "Oui" : "Non")}
          <div
            className={`mt-3 rounded-md p-3 text-sm font-medium ${
              data.ready ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
            }`}
          >
            {data.ready ? "READY FOR PAYMENT" : `BLOCKED — ${data.blockedReasons.join(", ") || "raison inconnue"}`}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * La couche commerciale immuable (audit §2-3) : chaque version figée d'une
 * proposition pour ce dossier. « Accepter » est réservé à l'administration
 * dans cette phase — aucun parcours client ne le fait encore lui-même.
 */
const TAX_VALIDATION_SOURCE_LABELS: Record<string, string> = {
  manual_admin_review: "Validation manuelle (admin)",
  FR_STANDARD_VAT_20: "Automatique — TVA France standard 20 %",
};

function CommercialProposalPanel({ caseId }: { caseId: string }) {
  const list = useServerFn(listCaseCommercialProposals);
  const create = useServerFn(createCommercialProposal);
  const accept = useServerFn(acceptCommercialProposal);
  const resetTax = useServerFn(resetProposalTaxToManualReview);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "case", caseId, "commercial-proposals"] as const;

  const { data: proposals, isPending } = useQuery({
    queryKey,
    queryFn: () => list({ data: caseId }),
  });

  const creating = useMutation({
    mutationFn: () =>
      create({ data: { caseId, shipping: { outboundCents: 0, returnCents: 0, otherCents: 0 } } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const accepting = useMutation({
    mutationFn: (proposalId: string) => accept({ data: proposalId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const resetting = useMutation({
    mutationFn: (proposalId: string) => resetTax({ data: proposalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "payment-preflight"] });
    },
  });

  const hasAccepted = (proposals ?? []).some((p) => p.status === "accepted");

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Proposition commerciale
        </h2>
        <Button size="sm" variant="outline" disabled={creating.isPending} onClick={() => creating.mutate()}>
          {(proposals ?? []).length === 0 ? "Créer la proposition" : "Nouvelle version"}
        </Button>
      </div>
      {isPending && <p className="mt-2 text-xs text-muted-foreground">Chargement…</p>}
      {creating.error && (
        <p className="mt-2 text-xs text-destructive">{(creating.error as Error).message}</p>
      )}
      {accepting.error && (
        <p className="mt-2 text-xs text-destructive">{(accepting.error as Error).message}</p>
      )}
      {resetting.error && (
        <p className="mt-2 text-xs text-destructive">{(resetting.error as Error).message}</p>
      )}
      <ul className="mt-3 space-y-2 text-sm">
        {(proposals ?? []).map((proposal) => (
          <li key={proposal.id} className="rounded-md border border-border p-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p>
                  v{proposal.version} · {PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status} ·{" "}
                  {formatEuros(proposal.customerServicePriceCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Rémunération atelier {formatEuros(proposal.binderPayoutCents)} · plancher :{" "}
                  {proposal.priceBoundBy === "reference"
                    ? "référence Pricebook"
                    : proposal.priceBoundBy === "margin_floor"
                      ? "marge"
                      : "contribution minimale"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fiscalité :{" "}
                  {proposal.taxValidatedAt
                    ? `${TAX_POLICY_LABELS[proposal.taxPolicy] ?? proposal.taxPolicy} · ${proposal.taxCountry} · TVA ${
                        proposal.customerVatRateBps !== null
                          ? `${(proposal.customerVatRateBps / 100).toFixed(1)} %`
                          : "non applicable"
                      } · ${
                        TAX_VALIDATION_SOURCE_LABELS[proposal.taxValidationSource ?? ""] ??
                        proposal.taxValidationSource
                      }`
                    : "à valider"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Client :{" "}
                  {proposal.customerType === "BUSINESS"
                    ? `Professionnel — ${proposal.businessName ?? "raison sociale à renseigner"}`
                    : "Particulier"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {proposal.status === "proposed" && !hasAccepted && proposal.taxValidatedAt && (
                  <Button
                    size="sm"
                    disabled={accepting.isPending}
                    onClick={() => accepting.mutate(proposal.id)}
                  >
                    Accepter
                  </Button>
                )}
                {proposal.status === "proposed" && !hasAccepted && proposal.taxValidatedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    disabled={resetting.isPending}
                    onClick={() => resetting.mutate(proposal.id)}
                  >
                    Revenir à MANUAL_TAX_REVIEW
                  </Button>
                )}
              </div>
            </div>
            {proposal.status === "proposed" && !hasAccepted && !proposal.taxValidatedAt && (
              <TaxValidationForm proposal={proposal} caseId={caseId} />
            )}
          </li>
        ))}
      </ul>
      {(proposals ?? []).length === 0 && !isPending && (
        <p className="mt-2 text-xs text-muted-foreground">Aucune proposition figée pour l'instant.</p>
      )}
    </section>
  );
}

export function CaseMatchingPage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMarketplaceCase);
  const send = useServerFn(sendCaseToBinders);
  const selectOffer = useServerFn(selectBinderOffer);
  const clearReview = useServerFn(clearCaseManualReview);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const queryKey = ["marketplace", "case", caseId] as const;
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const invite = useMutation({
    mutationFn: () => send({ data: { caseId, binderIds: selected } }),
    onSuccess: async () => {
      setSelected([]);
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "cases"] });
    },
    onError: (err: Error) => setProblem(err.message),
  });

  const release = useMutation({
    mutationFn: () => clearReview({ data: { caseId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const choose = useMutation({
    mutationFn: (binderId: string) => selectOffer({ data: { caseId, binderId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err: Error) => setProblem(err.message),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const remaining = data.remainingInvitations;
  const held = data.case.manual_review_required;
  const canInvite =
    !held &&
    data.case.pricing_status === "validated" &&
    data.case.status === "matching" &&
    remaining > 0 &&
    selected.length > 0;

  function toggle(id: string) {
    setProblem(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length >= remaining
          ? current
          : [...current, id],
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div>
        <CaseBriefPanel view={data.view} />
      </div>

      <aside className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Statut
          </h2>
          <p className="mt-2 text-lg">
            {isCaseStatus(data.case.status)
              ? CASE_STATUS_LABELS[data.case.status]
              : data.case.status}
          </p>
          {held && (
            <div className="mt-4 rounded-md border border-amber-600/30 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-medium">Revue manuelle requise</p>
              {/* Rendered from the stored codes by triageMessages, never by
                  splitting prose out of a column. */}
              {data.triageMessages.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {data.triageMessages.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={release.isPending}
                onClick={() => release.mutate()}
              >
                J'ai vérifié : préparer le prix
              </Button>
            </div>
          )}
          {data.requiredSkills.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Compétences attendues : {data.requiredSkills.map(binderSkillLabel).join(", ")}.
            </p>
          )}
        </section>

        <PricingPanel
          key={`${data.case.pricing_status}-${data.case.pricing_generated_at ?? "new"}`}
          caseId={caseId}
          row={data.case}
          refresh={() => queryClient.invalidateQueries({ queryKey })}
        />

        <EconomicsPanel row={data.case} />

        {data.case.pricing_status === "validated" && (
          <>
            <CommercialProposalPanel caseId={caseId} />
            <PreflightPanel caseId={caseId} />
          </>
        )}

        <AdminConversations
          caseId={caseId}
          brand={data.case.brand}
          workshopSelected={data.matches.some((offer) => offer.state === "selected")}
        />

        {data.matches.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Offres atelier
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              {data.matches.map((offer) => {
                const candidate = data.candidates.find((item) => item.id === offer.binder_id);
                return (
                  <li key={offer.binder_id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">
                        {candidate?.workshopName ?? candidate?.displayName ?? "Atelier"}
                      </span>
                      <span className="shrink-0">{offerStateLabel(offer.state)}</span>
                    </div>
                    {offer.binder_payout_cents && (
                      <p className="mt-1 text-muted-foreground">
                        Rémunération : {formatEuros(offer.binder_payout_cents)}
                      </p>
                    )}
                    {offer.decline_reason_code && (
                      <p className="mt-1 text-amber-700">Refus : {offer.decline_reason_code}</p>
                    )}
                    {offer.state === "accepted" && (
                      <Button
                        className="mt-3"
                        size="sm"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate(offer.binder_id)}
                      >
                        Retenir cet atelier
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Relieurs compatibles
            </h2>
            <span className="text-xs text-muted-foreground">
              {remaining} invitation(s) restante(s)
            </span>
          </div>

          {data.candidates.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun relieur approuvé pour le moment.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.candidates.map((candidate) => {
                const checked = selected.includes(candidate.id);
                return (
                  <li key={candidate.id}>
                    <label
                      className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                        checked
                          ? "border-foreground bg-muted/60"
                          : "border-border hover:border-foreground/30"
                      } ${candidate.alreadyInvited ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        disabled={
                          candidate.alreadyInvited ||
                          held ||
                          data.case.pricing_status !== "validated" ||
                          data.case.status !== "matching"
                        }
                        onChange={() => toggle(candidate.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">
                            {candidate.workshopName ?? candidate.displayName}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {candidate.score}/100
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[
                            candidate.city,
                            candidate.yearsExperience ? `${candidate.yearsExperience} ans` : null,
                            candidate.ratingCount > 0 && candidate.ratingAvg
                              ? `${candidate.ratingAvg}/5 (${candidate.ratingCount})`
                              : null,
                            `${candidate.activeLoad}/${candidate.capacitySlots} en cours`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {candidate.skills.length > 0 && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {candidate.skills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.missingSkills.length > 0 && (
                          <span className="mt-1 block text-xs text-amber-700">
                            Ne déclare pas :{" "}
                            {candidate.missingSkills.map(binderSkillLabel).join(", ")}
                          </span>
                        )}
                        {candidate.alreadyInvited && (
                          <span className="mt-1 block text-xs">Déjà invité</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {problem && <p className="mt-4 text-sm text-destructive">{problem}</p>}

          <Button
            className="mt-5 w-full"
            disabled={!canInvite || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? "Envoi…" : "Envoyer le projet à ces relieurs"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Un dossier est envoyé à trois relieurs au maximum.
          </p>
        </section>
      </aside>
    </div>
  );
}
