/**
 * Candidature atelier partenaire (§7) — remplace le mailto: qui ne laissait
 * aucune trace structurée. Publique, sans authentification : c'est le seul
 * point d'entrée d'un atelier qui n'a encore aucun compte.
 *
 * Ne crée jamais de compte ni d'atelier — seulement une ligne
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

export const Route = createFileRoute("/candidature-atelier")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Devenir atelier partenaire — Ma Reliure" },
      {
        name: "description",
        content:
          "Rejoindre le réseau d'ateliers indépendants de Ma Reliure : présentez votre atelier.",
      },
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
        <h1 className="mr-title mt-4 text-mr-ink">Devenir atelier partenaire</h1>

        {sent ? (
          <p role="status" className="mr-body mt-8">
            Candidature envoyée. Nous la lisons et revenons vers vous — aucun compte n'est créé
            avant que Ma Reliure ne vous contacte.
          </p>
        ) : (
          <>
            <p className="mr-lead mt-5">
              Présentez votre atelier. Ma Reliure lit chaque candidature et vous recontacte — aucun
              compte n'est créé immédiatement.
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
