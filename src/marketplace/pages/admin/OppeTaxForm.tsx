/**
 * Validation fiscale d'un devis Oppe : on qualifie la prestation, on fixe le taux de chaque ligne et
 * on justifie. La matrice propose, l'administrateur décide ; rien ne s'applique tant qu'il n'a pas
 * confirmé. Une catégorie ou un taux non confirmé bloque l'envoi du devis au client.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import { SHIPPING_SUGGESTION, TAX_MATRIX, computeLineTax, SERVICE_TAX_CATEGORIES, type ServiceTaxCategory } from "@/marketplace/commercial/taxMatrix";
import { suggestTaxPolicyForCountry } from "@/marketplace/commercial/taxPolicy";
import { validateOppeProposalTax } from "@/marketplace/services/commercialProposal.data.functions";

const pct = (bps: number) => (bps / 100).toString().replace(".", ",");

export function OppeTaxForm({
  proposal,
  caseId,
  defaultCountry,
}: {
  proposal: { id: string; version: number; customerServicePriceCents: number; shippingTotalCents: number; shippingOfferKind: string };
  caseId: string;
  defaultCountry: string;
}) {
  const validate = useServerFn(validateOppeProposalTax);
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ServiceTaxCategory | "">("");
  const [serviceRate, setServiceRate] = useState("");
  const [shippingRate, setShippingRate] = useState(proposal.shippingTotalCents > 0 ? pct(SHIPPING_SUGGESTION.suggestedRateBps) : "");
  const [country, setCountry] = useState(defaultCountry);
  const [customerType, setCustomerType] = useState<"CUSTOMER" | "BUSINESS">("CUSTOMER");
  const [businessName, setBusinessName] = useState("");
  const [justification, setJustification] = useState("");
  const toBps = (value: string) => Math.round(Number.parseFloat(value.replace(",", ".")) * 100);
  const hasShipping = proposal.shippingTotalCents > 0;
  const serviceBps = toBps(serviceRate);
  const shippingBps = hasShipping ? toBps(shippingRate) : null;
  const ready =
    category !== "" && Number.isFinite(serviceBps) && (!hasShipping || Number.isFinite(shippingBps ?? Number.NaN)) &&
    country.trim().length === 2 && justification.trim().length >= 12 && (customerType !== "BUSINESS" || businessName.trim() !== "");
  const preview = ready
    ? computeLineTax({ serviceCents: proposal.customerServicePriceCents, shippingCents: proposal.shippingTotalCents, serviceRateBps: serviceBps, shippingRateBps: shippingBps })
    : null;
  const suggestion = category !== "" ? TAX_MATRIX[category] : null;
  const mutation = useMutation({
    mutationFn: () =>
      validate({
        data: {
          proposalId: proposal.id,
          taxPolicy: suggestTaxPolicyForCountry(country.toUpperCase()),
          taxCountry: country.toUpperCase(),
          serviceTaxCategory: category as ServiceTaxCategory,
          serviceVatRateBps: serviceBps,
          shippingVatRateBps: shippingBps,
          justification,
          customerType,
          businessName: customerType === "BUSINESS" ? businessName.trim() : null,
          businessVatNumber: null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "commercial-proposals"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace", "case", caseId, "payment-preflight"] });
    },
  });

  return (
    <div className="mt-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valider la fiscalité — v{proposal.version}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Le taux dépend de la nature de la prestation et de l'ouvrage. La matrice suggère, vous confirmez et justifiez ; à faire valider par l'expert-comptable.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`tax-cat-${proposal.id}`} className="text-xs">Nature de la prestation</Label>
          <select
            id={`tax-cat-${proposal.id}`}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={category}
            onChange={(event) => {
              const next = event.target.value as ServiceTaxCategory | "";
              setCategory(next);
              setServiceRate(next === "" ? "" : pct(TAX_MATRIX[next].suggestedRateBps));
            }}
          >
            <option value="">Choisir…</option>
            {SERVICE_TAX_CATEGORIES.map((key) => <option key={key} value={key}>{TAX_MATRIX[key].label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor={`tax-country-${proposal.id}`} className="text-xs">Pays de taxation (2 lettres)</Label>
          <Input id={`tax-country-${proposal.id}`} className="mt-1" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label htmlFor={`tax-service-${proposal.id}`} className="text-xs">Taux de la prestation (%)</Label>
          <Input id={`tax-service-${proposal.id}`} className="mt-1" inputMode="decimal" value={serviceRate} onChange={(e) => setServiceRate(e.target.value)} />
        </div>
        {hasShipping && (
          <div>
            <Label htmlFor={`tax-ship-${proposal.id}`} className="text-xs">Taux du transport (%)</Label>
            <Input id={`tax-ship-${proposal.id}`} className="mt-1" inputMode="decimal" value={shippingRate} onChange={(e) => setShippingRate(e.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor={`tax-type-${proposal.id}`} className="text-xs">Type de client</Label>
          <select id={`tax-type-${proposal.id}`} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={customerType} onChange={(e) => setCustomerType(e.target.value as typeof customerType)}>
            <option value="CUSTOMER">Particulier</option>
            <option value="BUSINESS">Professionnel</option>
          </select>
        </div>
        {customerType === "BUSINESS" && (
          <div>
            <Label htmlFor={`tax-biz-${proposal.id}`} className="text-xs">Raison sociale</Label>
            <Input id={`tax-biz-${proposal.id}`} className="mt-1" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
        )}
      </div>
      {suggestion && (
        <p className="mt-2 text-xs leading-5 text-amber-800">
          Suggestion à valider : {pct(suggestion.suggestedRateBps)} % — {suggestion.source}. {suggestion.caveat}
          {hasShipping ? ` Transport : ${pct(SHIPPING_SUGGESTION.suggestedRateBps)} % suggéré (${SHIPPING_SUGGESTION.caveat})` : ""}
        </p>
      )}
      <div className="mt-3">
        <Label htmlFor={`tax-why-${proposal.id}`} className="text-xs">Justification de cette qualification (obligatoire, conservée)</Label>
        <textarea
          id={`tax-why-${proposal.id}`}
          className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Ouvrage répondant à la définition fiscale du livre ; reliure complète ; validation de l'expert-comptable du…"
        />
      </div>
      {preview && (
        <p className="mt-2 text-sm tabular-nums">
          Total HT {formatEuros(preview.totalHtCents)} · TVA {formatEuros(preview.vatCents)} ({formatEuros(preview.serviceVatCents)} prestation
          {hasShipping ? ` + ${formatEuros(preview.shippingVatCents)} transport` : ""}) · <strong>TTC {formatEuros(preview.totalTtcCents)}</strong>
        </p>
      )}
      <Button size="sm" className="mt-3" disabled={!ready || mutation.isPending} onClick={() => mutation.mutate()}>
        Valider la fiscalité de ce devis
      </Button>
      {mutation.error && <p className="mt-2 text-xs text-destructive">{(mutation.error as Error).message}</p>}
    </div>
  );
}
