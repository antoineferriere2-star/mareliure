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
 *
 * `locale` defaults to French — the admin and atelier call sites never pass
 * it, and stay exactly as they were. Only CustomerCasePage passes "en-US",
 * for a Fine Bindery customer.
 */
import type { BriefLine } from "@/build/schema/brief";
import type { CaseView, CaseViewLine } from "@/marketplace/cases/dossierProjection";

type Locale = "fr-FR" | "en-US";

const SOURCE_LABELS: Record<Locale, Record<BriefLine["source"], string>> = {
  "fr-FR": {
    visitor_answer: "Déclaré par le client",
    calculated_value: "Calculé",
    deterministic_rule: "Règle du playbook",
    assumed_default: "Hypothèse par défaut",
    image_hypothesis: "Hypothèse IA (photo, non confirmée)",
  },
  "en-US": {
    visitor_answer: "Stated by the customer",
    calculated_value: "Calculated",
    deterministic_rule: "Playbook rule",
    assumed_default: "Default assumption",
    image_hypothesis: "AI hypothesis (photo, unconfirmed)",
  },
};

function Lines({ lines, locale }: { lines: CaseViewLine[]; locale: Locale }) {
  if (lines.length === 0) {
    return <p className="text-sm text-[#8a7663]">{locale === "en-US" ? "None." : "Aucune."}</p>;
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
                {SOURCE_LABELS[locale][line.source]}
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

export function CaseBriefPanel({ view, locale = "fr-FR" }: { view: CaseView; locale?: Locale }) {
  const en = locale === "en-US";
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
            ? en
              ? "This type of book requires specific validation by a professional before it can be taken on."
              : "Ce type d'ouvrage nécessite une validation spécifique par un professionnel avant prise en charge."
            : en
              ? "This project is awaiting manual review before it is shared further."
              : "Ce dossier est en attente de revue manuelle avant diffusion."}
        </p>
      )}

      {view.photos.length > 0 && (
        <Section title={en ? `Photos (${view.photos.length})` : `Photos (${view.photos.length})`}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {view.photos.map((photo, index) =>
              photo.url ? (
                <li
                  key={photo.url}
                  className="overflow-hidden rounded-lg border border-[#3b2a1d]/15"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? (en ? `Photo ${index + 1} of the book` : `Photo ${index + 1} de l'ouvrage`)}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      )}

      <Section title={en ? "The project" : "Le projet"}>
        <Lines lines={view.project} locale={locale} />
      </Section>

      {view.budgetAndTiming.length > 0 && (
        <Section title={en ? "Budget and timing" : "Budget et délai"}>
          <Lines lines={view.budgetAndTiming} locale={locale} />
        </Section>
      )}

      {view.constraints.length > 0 && (
        <Section title={en ? "Reservations and constraints" : "Réserves et contraintes"}>
          <Lines lines={view.constraints} locale={locale} />
        </Section>
      )}

      <Section title={en ? "Missing information" : "Informations manquantes"}>
        <Lines lines={view.missingInformation} locale={locale} />
      </Section>

      <Section title={en ? "Location" : "Localisation"}>
        <p className="text-[#241a12]">{view.area ?? (en ? "Not provided" : "Non communiquée")}</p>
      </Section>

      {view.contact ? (
        <Section title={en ? "Customer contact" : "Contact client"}>
          <ul className="space-y-1 text-[#241a12]">
            {view.contact.name && <li>{view.contact.name}</li>}
            {view.contact.email && <li>{view.contact.email}</li>}
            {view.contact.phone && <li>{view.contact.phone}</li>}
            {view.contact.location && <li>{view.contact.location}</li>}
          </ul>
        </Section>
      ) : (
        <p className="mt-8 text-sm text-[#8a7663]">
          {en
            ? "The customer's contact details will be shared with you if your workshop is selected."
            : "Les coordonnées du client vous seront transmises si Ma Reliure retient votre atelier."}
        </p>
      )}
    </div>
  );
}
