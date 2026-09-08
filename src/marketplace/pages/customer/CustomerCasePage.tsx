import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCustomerCase } from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { binderSkillLabel } from "@/marketplace/binders/skills";
import { formatEuros } from "@/marketplace/pricing/money";

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
