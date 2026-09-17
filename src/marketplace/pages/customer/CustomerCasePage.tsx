import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCustomerCase } from "@/marketplace/services/marketplace.data.functions";
import { createCommercialCheckoutSession } from "@/marketplace/stripe/checkoutSession.server";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { DecisionsPanel } from "@/marketplace/pages/DecisionsPanel";
import { binderSkillLabel, binderSkillLabelEn } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/pricing/money";
import { visibleJourney } from "@/marketplace/cases/journey";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { Button } from "@/components/ui/button";

/**
 * Le seul déclencheur d'un Checkout réel — appelle uniquement la server
 * function existante (§11 du brief du 17 septembre 2026), qui recharge la
 * proposition acceptée et fige le montant côté serveur. Le navigateur ne
 * transmet jamais de montant, ici pas même un `caseId` de plus que celui déjà
 * affiché.
 */
function PayButton({ caseId, en }: { caseId: string; en: boolean }) {
  const createSession = useServerFn(createCommercialCheckoutSession);
  const [error, setError] = useState<string | null>(null);
  const pay = useMutation({
    mutationFn: () => createSession({ data: { caseId } }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="mt-5">
      <Button className="w-full" disabled={pay.isPending} onClick={() => pay.mutate()}>
        {pay.isPending ? (en ? "Redirecting…" : "Redirection…") : en ? "Pay securely" : "Payer"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function customerMessage(status: string, en: boolean): string {
  switch (status) {
    case "under_review":
    case "pricing":
      return en
        ? "Fine Bindery is reviewing your project and preparing its price."
        : "Ma Reliure étudie votre projet et prépare son prix.";
    case "matching":
    case "awaiting_binder_response":
      return en
        ? "We are looking for the most suitable workshop and checking its availability."
        : "Nous recherchons l’atelier le plus adapté et vérifions sa disponibilité.";
    case "binder_accepted":
      return en
        ? "A workshop is available. Fine Bindery is finalising your project's handover."
        : "Un atelier est disponible. Ma Reliure finalise votre prise en charge.";
    case "binder_selected":
      return en ? "Your workshop is confirmed." : "Votre atelier est confirmé.";
    default:
      return en
        ? "Your project is moving forward. Fine Bindery keeps you informed at every step."
        : "Votre projet avance. Ma Reliure vous tient informé à chaque étape.";
  }
}

export function CustomerCasePage({
  caseId,
  brand,
}: {
  caseId: string;
  brand: MarketplaceBrand | null;
}) {
  const en = brand === "FINE_BINDERY";
  const locale = en ? "en-US" : "fr-FR";
  const fetchCase = useServerFn(getMyCustomerCase);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "case", caseId] as const,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  if (isPending)
    return <p className="text-sm text-muted-foreground">{en ? "Loading…" : "Chargement…"}</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10">
      <CaseBriefPanel view={data.view} locale={locale} />

      {/* Décisions avant conversation : une confirmation attendue prime sur
          l'historique du fil (§10 : « que se passe-t-il maintenant ? »). */}
      <DecisionsPanel caseId={caseId} role="customer" locale={locale} />
      <ConversationPanel caseId={caseId} viewerRole="customer" locale={locale} />
      {/* Un prix n'apparaît ici qu'une fois validé par un humain — le serveur
          ne renvoie même pas les autres. Tant qu'il n'y en a pas, on dit ce
          qui se passe réellement plutôt que d'afficher un montant provisoire :
          un chiffre lu une fois devient une promesse, et personne ne retient
          qu'il était « en cours ». Pas de prix vaut mieux qu'un faux prix. */}
      <section className="rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6">
        <p className="text-sm text-[#6b5847]">
          {data.case.customerPriceCents
            ? en
              ? "Price set by Fine Bindery"
              : "Prix fixé par Ma Reliure"
            : en
              ? "Your estimate"
              : "Votre estimation"}
        </p>
        {data.case.customerPriceCents ? (
          <p className="mt-1 font-serif text-3xl text-[#241a12]">
            {formatEuros(data.case.customerPriceCents, locale)}
          </p>
        ) : (
          <>
            <p className="mt-2 font-serif text-xl text-[#241a12]">
              {en ? "Your project is under review." : "Votre projet est en cours d’étude."}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#4b3a2c]">
              {en
                ? "We need to confirm the work required before presenting your price."
                : "Nous devons confirmer le travail nécessaire avant de vous présenter votre prix."}
            </p>
          </>
        )}
        {data.case.priceIncludes.length > 0 && (
          <p className="mt-3 text-sm leading-6 text-[#6b5847]">
            {en ? "Includes" : "Comprend"}: {data.case.priceIncludes.join(", ")}.
          </p>
        )}
        <p className="mt-5 text-sm leading-6 text-[#4b3a2c]">
          {customerMessage(data.case.status, en)}
        </p>
        {data.case.paymentEligible && <PayButton caseId={caseId} en={en} />}
      </section>

      {/* Le parcours, réduit aux étapes qui existent : `journey.ts` retire
          d'office la commande et l'expédition tant qu'elles ne sont pas
          construites. Une étape franchie porte un filet laiton plein, une
          étape à venir un filet creux — pas de coche, pas de pourcentage : on
          raconte où en est un livre, on ne remplit pas une barre. */}
      <section>
        <h2 className="font-serif text-2xl">{en ? "Where your book stands" : "Où en est votre livre"}</h2>
        <ol className="mt-5 space-y-6">
          {visibleJourney(data.case.status, locale).map((stage) => (
            <li key={stage.id} className="flex gap-4">
              <span
                aria-hidden="true"
                className={`mt-2 h-px w-8 shrink-0 ${stage.done ? "bg-[#a98c55]" : "bg-[#3b2a1d]/20"}`}
              />
              <div>
                <p
                  className={`font-serif text-lg ${stage.done ? "text-[#241a12]" : "text-[#6b5847]"}`}
                >
                  {stage.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-[#4b3a2c]">
                  {stage.done ? stage.reached : stage.upcoming}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {data.selectedBinder && (
        <section>
          <h2 className="font-serif text-2xl">{en ? "The selected workshop" : "L’atelier retenu"}</h2>
          <div className="mt-4 rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6">
            <p className="font-serif text-xl text-[#241a12]">
              {data.selectedBinder.workshop_name ?? data.selectedBinder.display_name}
            </p>
            <p className="mt-1 text-sm text-[#6b5847]">
              {[
                data.selectedBinder.city,
                data.selectedBinder.years_experience
                  ? en
                    ? `${data.selectedBinder.years_experience} years' experience`
                    : `${data.selectedBinder.years_experience} ans de métier`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {data.selectedBinder.skills.length > 0 && (
              <p className="mt-3 text-sm text-[#6b5847]">
                {data.selectedBinder.skills.map(en ? binderSkillLabelEn : binderSkillLabel).join(", ")}
              </p>
            )}
            {data.selectedBinder.bio && (
              <p className="mt-4 text-sm leading-6 text-[#4b3a2c]">{data.selectedBinder.bio}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
