/**
 * Candidature sans compte, conservée pour les ateliers qui souhaitent d'abord
 * être recontactés. La création directe de l'espace atelier passe par /auth.
 *
 * Cette candidature ne crée pas de compte ni d'atelier — seulement une ligne
 * `marketplace_binder_applications` que l'admin lit et traite à la main
 * (`/marketplace/binders`). La création réelle de l'atelier et son
 * invitation restent un acte humain distinct (Phase A).
 */
import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { submitBinderApplication } from "@/marketplace/services/binderApplications.data.functions";
import {
  LEGAL_ENTITY_LABELS,
  LEGAL_ENTITY_TYPES,
  REVENUE_BANDS,
  REVENUE_BAND_LABELS,
  type LegalEntityType,
  type RevenueBand,
} from "@/marketplace/binders/application";
import { LandingFooter, LandingHeader } from "@/marketplace/pages/landing/LandingChrome";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Candidature atelier partenaire — Ma Reliure";
const DESCRIPTION =
  "Présentez votre atelier à Ma Reliure : prénom, nom, e-mail, type d'entreprise. Nous lisons chaque candidature et vous recontactons.";

// Rendue côté serveur : la page figure au plan du site, et un moteur qui ne
// lisait qu'un document vide ne pouvait rien en indexer.
export const Route = createFileRoute("/candidature-atelier")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${MARELIURE_CANONICAL_HOME}candidature-atelier` },
    ],
    links: [
      { rel: "canonical", href: `${MARELIURE_CANONICAL_HOME}candidature-atelier` },
      EDITORIAL_FONT_PRELOAD,
    ],
  }),
  component: CandidatureAtelierPage,
});

const labelClass = "mr-small block font-semibold text-mr-ink";
const inputClass =
  "mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink";
const submitClass =
  "mt-8 inline-flex w-full items-center justify-center rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-graphite disabled:opacity-60 sm:w-auto";

function CandidatureAtelierPage() {
  const submit = useServerFn(submitBinderApplication);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [legalEntityType, setLegalEntityType] = useState<LegalEntityType>("auto_entrepreneur");
  const [city, setCity] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [revenueBand, setRevenueBand] = useState<RevenueBand | "">("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setProblem(null);
    try {
      await submit({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          workshopName,
          legalEntityType,
          city: city || undefined,
          yearsExperience: yearsExperience ? Number.parseInt(yearsExperience, 10) : undefined,
          averageAnnualRevenueBand: revenueBand || undefined,
          message: message || undefined,
        },
      });
      setSent(true);
    } catch (err) {
      setProblem(
        err instanceof Error
          ? "Votre candidature n'a pas pu être envoyée. Réessayez dans un instant."
          : "Une erreur est survenue.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">Ateliers partenaires</p>
        <h1 className="mr-title mt-4 text-mr-ink">Créer mon espace atelier</h1>
        <p className="mr-lead mt-5">
          Créez votre compte avec votre adresse e-mail, puis renseignez le nom de votre atelier.
          Votre espace ouvre immédiatement ; Ma Reliure décide ensuite quels ateliers reçoivent des projets.
        </p>
        <a href="/auth?space=atelier" className={submitClass}>Créer mon espace atelier</a>
        <h2 className="mr-heading mt-12 border-t border-mr-rule pt-8 text-mr-ink">
          Ou présenter mon atelier sans créer de compte
        </h2>

        {sent ? (
          <p role="status" className="mr-body mt-8">
            Candidature envoyée. Nous la lisons et revenons vers vous.
          </p>
        ) : (
          <>
            <p className="mr-body mt-5">
              Cette candidature parvient à Ma Reliure sans ouvrir d'espace connecté.
              Si vous souhaitez utiliser les outils atelier dès maintenant, choisissez « Créer mon espace atelier » ci-dessus.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="ca-first-name" className={labelClass}>
                    Prénom
                  </label>
                  <input
                    id="ca-first-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="ca-last-name" className={labelClass}>
                    Nom
                  </label>
                  <input
                    id="ca-last-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ca-email" className={labelClass}>
                  Adresse e-mail
                </label>
                <input
                  id="ca-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="ca-phone" className={labelClass}>
                  Téléphone <span className="font-normal text-mr-muted">(facultatif)</span>
                </label>
                <input
                  id="ca-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="ca-workshop" className={labelClass}>
                  Nom de l'atelier
                </label>
                <input
                  id="ca-workshop"
                  required
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="ca-legal-type" className={labelClass}>
                    Type d'entreprise
                  </label>
                  <select
                    id="ca-legal-type"
                    value={legalEntityType}
                    onChange={(e) => setLegalEntityType(e.target.value as LegalEntityType)}
                    className={inputClass}
                  >
                    {LEGAL_ENTITY_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {LEGAL_ENTITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ca-city" className={labelClass}>
                    Ville <span className="font-normal text-mr-muted">(facultatif)</span>
                  </label>
                  <input
                    id="ca-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="ca-years" className={labelClass}>
                    Années d'expérience <span className="font-normal text-mr-muted">(facultatif)</span>
                  </label>
                  <input
                    id="ca-years"
                    type="number"
                    min={0}
                    max={100}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="ca-revenue" className={labelClass}>
                    Chiffre d'affaires moyen annuel{" "}
                    <span className="font-normal text-mr-muted">(facultatif)</span>
                  </label>
                  <select
                    id="ca-revenue"
                    value={revenueBand}
                    onChange={(e) => setRevenueBand(e.target.value as RevenueBand)}
                    className={inputClass}
                  >
                    <option value="">Non précisé</option>
                    {REVENUE_BANDS.filter((b) => b !== "undisclosed").map((value) => (
                      <option key={value} value={value}>
                        {REVENUE_BAND_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ca-message" className={labelClass}>
                  Votre atelier, en quelques mots{" "}
                  <span className="font-normal text-mr-muted">(facultatif)</span>
                </label>
                <textarea
                  id="ca-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} resize-none`}
                  placeholder="Savoir-faire, spécialités, ce que vous cherchez en rejoignant Ma Reliure…"
                />
              </div>

              {problem && (
                <p role="alert" className="mr-small text-mr-bordeaux">
                  {problem}
                </p>
              )}

              <button type="submit" disabled={sending} className={submitClass}>
                {sending ? "Envoi…" : "Envoyer ma candidature"}
              </button>
            </form>
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
