/**
 * One rendering of a case, shared by the admin's matching screen, the
 * relieur's dossier view and the customer's own page.
 *
 * The `CaseView` it receives has already had whatever the viewer may not see
 * removed by `dossierProjection.ts` — this component never decides disclosure,
 * it only renders what it was handed. That is why the same component can serve
 * three different audiences without a single `if (role === ...)`.
 *
 * Line provenance is shown, not hidden: a value the vision agent proposed from
 * a photo must never read like something the customer confirmed.
 */
import type { BriefLine } from "@/build/schema/brief";
import type { CaseView, CaseViewLine } from "@/marketplace/cases/dossierProjection";

const SOURCE_LABELS: Record<BriefLine["source"], string> = {
  visitor_answer: "Déclaré par le client",
  calculated_value: "Calculé",
  deterministic_rule: "Règle du playbook",
  assumed_default: "Hypothèse par défaut",
  image_hypothesis: "Hypothèse IA (photo, non confirmée)",
};

function Lines({ lines }: { lines: CaseViewLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-[#8a7663]">Aucune.</p>;
  }
  return (
    <dl className="divide-y divide-[#3b2a1d]/10">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-[#6b5847]">{line.label}</dt>
          <dd className="sm:col-span-2">
            <span className="text-[#241a12]">{line.value}</span>
            {line.source !== "visitor_answer" && (
              <span className="ml-2 text-[11px] uppercase tracking-wide text-[#8a7663]">
                {SOURCE_LABELS[line.source]}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className="font-serif text-lg text-[#241a12]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function CaseBriefPanel({ view }: { view: CaseView }) {
  return (
    <div className="rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl text-[#241a12]">{view.title}</h2>
        <span className="font-mono text-sm text-[#8a7663]">{view.reference}</span>
      </div>
      <p className="mt-3 leading-7 text-[#4b3a2c]">{view.summary}</p>

      {(view.manualReviewRequired || view.heritage) && (
        <p className="mt-4 rounded-lg border border-[#8a5a2b]/30 bg-[#f3e6d3] px-4 py-3 text-sm leading-6 text-[#5b3a17]">
          {view.heritage
            ? "Ce type d'ouvrage nécessite une validation spécifique par un professionnel avant prise en charge."
            : "Ce dossier est en attente de revue manuelle avant diffusion."}
        </p>
      )}

      {view.photos.length > 0 && (
        <Section title={`Photos (${view.photos.length})`}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {view.photos.map((photo, index) =>
              photo.url ? (
                <li
                  key={photo.url}
                  className="overflow-hidden rounded-lg border border-[#3b2a1d]/15"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `Photo ${index + 1} de l'ouvrage`}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      )}

      <Section title="Le projet">
        <Lines lines={view.project} />
      </Section>

      {view.budgetAndTiming.length > 0 && (
        <Section title="Budget et délai">
          <Lines lines={view.budgetAndTiming} />
        </Section>
      )}

      {view.constraints.length > 0 && (
        <Section title="Réserves et contraintes">
          <Lines lines={view.constraints} />
        </Section>
      )}

      <Section title="Informations manquantes">
        <Lines lines={view.missingInformation} />
      </Section>

      <Section title="Localisation">
        <p className="text-[#241a12]">{view.area ?? "Non communiquée"}</p>
      </Section>

      {view.contact ? (
        <Section title="Contact client">
          <ul className="space-y-1 text-[#241a12]">
            {view.contact.name && <li>{view.contact.name}</li>}
            {view.contact.email && <li>{view.contact.email}</li>}
            {view.contact.phone && <li>{view.contact.phone}</li>}
            {view.contact.location && <li>{view.contact.location}</li>}
          </ul>
        </Section>
      ) : (
        <p className="mt-8 text-sm text-[#8a7663]">
          Les coordonnées du client vous seront transmises s'il retient votre proposition.
        </p>
      )}
    </div>
  );
}
