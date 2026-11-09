/**
 * Le cadre « Proposition de projet » de la page atelier. Partagé avec l'aperçu de l'admin pour que
 * ce que l'admin vérifie avant l'envoi soit exactement ce que l'atelier lira.
 */
import { formatEuros } from "@/marketplace/pricing/money";

export function WorkshopOfferCard({
  payoutCents,
  serviceDescription,
  leadTimeDays,
  brandName,
}: {
  payoutCents: number | null;
  serviceDescription: string | null;
  leadTimeDays?: number | null;
  brandName: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-serif text-lg">Proposition de projet</h2>
      {payoutCents ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Votre rémunération fixe (HT)</p>
          <p className="mt-1 text-3xl font-medium">{formatEuros(payoutCents)}</p>
          {serviceDescription && (
            <p className="mt-3 whitespace-pre-line text-sm leading-6"><span className="text-muted-foreground">Prestation : </span>{serviceDescription}</p>
          )}
          {leadTimeDays ? (
            <p className="mt-1 text-sm"><span className="text-muted-foreground">Votre délai : </span>{leadTimeDays} jours</p>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Oppe vend ce projet au client sous sa marque et vous confie sa réalisation. Vous facturez cette rémunération à
            Oppe ; vous n'émettez ni devis ni facture au client.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Cette sollicitation historique ne contient pas de rémunération validée. {brandName}
          doit la reprendre avant toute réponse.
        </p>
      )}
    </section>
  );
}
