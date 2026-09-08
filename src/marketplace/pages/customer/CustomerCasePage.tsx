/**
 * Where the customer compares up to three proposals and chooses an artisan.
 *
 * There is no "meilleur prix" badge and no ordering by amount (§37): the
 * offers arrive in the order they were written, and each one leads with the
 * workshop and what it proposes to do, because that is what the customer is
 * actually choosing between.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCustomerCase, selectQuote } from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/orders/commission";
import { QUOTE_CAVEAT } from "@/marketplace/quotes/rules";
import { Button } from "@/components/ui/button";

export function CustomerCasePage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMyCustomerCase);
  const choose = useServerFn(selectQuote);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "customer", "case", caseId] as const;

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const pick = useMutation({
    mutationFn: (quoteId: string) => choose({ data: { caseId, quoteId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] });
    },
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const chosen = data.offers.find((offer) => offer.state === "selected") ?? null;

  return (
    <div className="space-y-10">
      <CaseBriefPanel view={data.view} />

      <section>
        <h2 className="font-serif text-2xl">
          {chosen ? "Votre relieur" : `Les propositions (${data.offers.length})`}
        </h2>

        {data.offers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nous sélectionnons les relieurs les plus adaptés à votre projet. Vous recevrez leurs
            propositions par e-mail.
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 lg:grid-cols-3">
            {(chosen ? [chosen] : data.offers).map((offer) => (
              <li
                key={offer.id}
                className="flex flex-col rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6"
              >
                <p className="font-serif text-xl text-[#241a12]">
                  {offer.binder?.workshop_name ?? offer.binder?.display_name ?? "Atelier"}
                </p>
                <p className="mt-0.5 text-sm text-[#6b5847]">
                  {[
                    offer.binder?.city,
                    offer.binder?.years_experience
                      ? `${offer.binder.years_experience} ans de métier`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {offer.binder?.skills && offer.binder.skills.length > 0 && (
                  <p className="mt-3 text-xs text-[#6b5847]">
                    {offer.binder.skills.map(binderSkillLabel).join(", ")}
                  </p>
                )}

                <p className="mt-5 text-sm leading-6 text-[#4b3a2c]">{offer.description}</p>

                {offer.materials && (
                  <p className="mt-3 text-sm text-[#4b3a2c]">
                    <span className="text-[#6b5847]">Matériaux : </span>
                    {offer.materials}
                  </p>
                )}
                {offer.technique && (
                  <p className="mt-1 text-sm text-[#4b3a2c]">
                    <span className="text-[#6b5847]">Technique : </span>
                    {offer.technique}
                  </p>
                )}

                <p className="mt-6 font-serif text-2xl text-[#241a12]">
                  {formatEuros(offer.amount_cents)}
                </p>
                <p className="text-sm text-[#6b5847]">{offer.lead_time_weeks} semaines</p>

                {offer.caveats && (
                  <p className="mt-3 text-xs leading-5 text-[#6b5847]">{offer.caveats}</p>
                )}
                <p className="mt-2 text-xs leading-5 text-[#8a7663]">{QUOTE_CAVEAT}</p>

                <div className="mt-6 grow" />
                {chosen ? (
                  <p className="text-sm font-medium text-[#241a12]">
                    Vous avez choisi cet atelier.
                  </p>
                ) : (
                  <Button
                    className="w-full"
                    disabled={pick.isPending}
                    onClick={() => pick.mutate(offer.id)}
                  >
                    Choisir cet atelier
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!chosen && data.offers.length > 1 && (
          <p className="mt-6 text-sm text-[#6b5847]">
            Les propositions sont présentées dans l'ordre où elles sont arrivées. À vous de décider
            ce qui compte le plus : l'atelier, la technique proposée, le délai ou le prix.
          </p>
        )}
      </section>
    </div>
  );
}
