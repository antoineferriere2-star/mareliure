import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCustomerCase } from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/pricing/money";
import { visibleJourney } from "@/marketplace/cases/journey";

function customerMessage(status: string): string {
  switch (status) {
    case "under_review":
    case "pricing":
      return "Ma Reliure étudie votre projet et prépare son prix.";
    case "matching":
    case "awaiting_binder_response":
      return "Nous recherchons l’atelier le plus adapté et vérifions sa disponibilité.";
    case "binder_accepted":
      return "Un atelier est disponible. Ma Reliure finalise votre prise en charge.";
    case "binder_selected":
      return "Votre atelier est confirmé.";
    default:
      return "Votre projet avance. Ma Reliure vous tient informé à chaque étape.";
  }
}

export function CustomerCasePage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getMyCustomerCase);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "case", caseId] as const,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-10">
      <CaseBriefPanel view={data.view} />
      <section className="rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6">
        <p className="text-sm text-[#6b5847]">Prix fixé par Ma Reliure</p>
        {data.case.customerPriceCents ? (
          <p className="mt-1 font-serif text-3xl text-[#241a12]">
            {formatEuros(data.case.customerPriceCents)}
          </p>
        ) : (
          <p className="mt-2 font-serif text-xl text-[#241a12]">Prix en cours de préparation</p>
        )}
        {data.case.priceIncludes.length > 0 && (
          <p className="mt-3 text-sm leading-6 text-[#6b5847]">
            Comprend : {data.case.priceIncludes.join(", ")}.
          </p>
        )}
        <p className="mt-5 text-sm leading-6 text-[#4b3a2c]">{customerMessage(data.case.status)}</p>
      </section>

      {/* Le parcours, réduit aux étapes qui existent : `journey.ts` retire
          d'office la commande et l'expédition tant qu'elles ne sont pas
          construites. Une étape franchie porte un filet laiton plein, une
          étape à venir un filet creux — pas de coche, pas de pourcentage : on
          raconte où en est un livre, on ne remplit pas une barre. */}
      <section>
        <h2 className="font-serif text-2xl">Où en est votre livre</h2>
        <ol className="mt-5 space-y-6">
          {visibleJourney(data.case.status).map((stage) => (
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
          <h2 className="font-serif text-2xl">L’atelier retenu</h2>
          <div className="mt-4 rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6">
            <p className="font-serif text-xl text-[#241a12]">
              {data.selectedBinder.workshop_name ?? data.selectedBinder.display_name}
            </p>
            <p className="mt-1 text-sm text-[#6b5847]">
              {[
                data.selectedBinder.city,
                data.selectedBinder.years_experience
                  ? `${data.selectedBinder.years_experience} ans de métier`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {data.selectedBinder.skills.length > 0 && (
              <p className="mt-3 text-sm text-[#6b5847]">
                {data.selectedBinder.skills.map(binderSkillLabel).join(", ")}
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
