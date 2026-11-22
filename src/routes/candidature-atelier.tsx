/**
 * « Créer mon compte atelier » depuis le pivot du 22 novembre 2026 : la page où
 * un relieur ou un atelier de restauration ouvre son compte. La création passe
 * par /auth?space=atelier et l'espace s'ouvre immédiatement (aucune validation
 * manuelle à cette étape).
 *
 * L'URL reste /candidature-atelier (plan du site, liens existants). Le dépôt
 * d'une demande de contact, pour qui veut d'abord être recontacté, est conservé :
 * il ne crée ni compte ni atelier, seulement une ligne
 * `marketplace_binder_applications` que l'admin lit et traite à la main
 * (`/marketplace/binders`).
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
import { LandingFooter, LandingHeader, WORKSHOP_SIGNUP_HREF, WORKSHOP_SIGNUP_LABEL } from "@/marketplace/pages/landing/LandingChrome";
import { RELIEUR_STEPS } from "@/marketplace/pages/landing/relieurContent";
import { MARELIURE_CANONICAL_HOME } from "@/marketplace/config";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Créer mon compte atelier — Ma Reliure";
const DESCRIPTION =
  "Ouvrez votre compte atelier Ma Reliure : partagez votre lien à vos clients, recevez une fiche prête à chiffrer et suivez chaque projet jusqu'à la livraison.";

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
  const [consent, setConsent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setProblem(null);
    try {
      const result = await submit({
        data: {
          consent,
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          workshopName,
          legalEntityType,
          city: city || undefined,
          yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
          averageAnnualRevenueBand: revenueBand || undefined,
          message: message || undefined,
        },
      });
      if (!result.ok) { setProblem(Object.values(result.fieldErrors).join(" ")); return; }
      setSent(true);
    } catch (err) {
      setProblem(
        err instanceof Error
          ? "Votre demande n'a pas pu être envoyée. Réessayez dans un instant."
          : "Une erreur est survenue.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main id="contenu" className="mx-auto w-full max-w-[36rem] flex-1 px-5 py-14 sm:px-8 sm:py-20">
        <p className="mr-eyebrow">Pour les relieurs et ateliers de restauration</p>
        <h1 className="mr-title mt-4 text-mr-ink">{WORKSHOP_SIGNUP_LABEL}</h1>
        <p className="mr-lead mt-5">
          Créez votre compte avec votre adresse e-mail : le lien et le code reçus la vérifient, puis vous renseignez le nom de votre atelier.
          Votre espace s'ouvre immédiatement. Les tarifs arrivent bientôt.
        </p>
        <ol className="mt-8 space-y-5 border-y border-mr-rule py-8">
          {RELIEUR_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span aria-hidden="true" className="mr-title text-mr-bordeaux">{index + 1}</span>
              <div>
                <h2 className="mr-heading text-mr-ink">{step.title}</h2>
                <p className="mr-body mt-1">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <a href={WORKSHOP_SIGNUP_HREF} className={submitClass}>{WORKSHOP_SIGNUP_LABEL}</a>
        <h2 className="mr-heading mt-12 border-t border-mr-rule pt-8 text-mr-ink">
          Vous préférez être recontacté d'abord ?
        </h2>

        {sent ? (
          <p role="status" className="mr-body mt-8">
            Demande envoyée. Nous la lisons et revenons vers vous.
          </p>
        ) : (
          <>
            <p className="mr-body mt-5">
              Laissez-nous vos coordonnées : votre demande parvient à Ma Reliure sans ouvrir d'espace connecté.
              Pour utiliser l'outil dès maintenant, choisissez « {WORKSHOP_SIGNUP_LABEL} » ci-dessus.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="ca-first-name" className={labelClass}>
                    Prénom
                  </label>
                  <input
                    id="ca-first-name" maxLength={100}
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
                    id="ca-last-name" maxLength={100}
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
                  id="ca-email" maxLength={200}
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
                  id="ca-phone" maxLength={30}
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
                  id="ca-workshop" maxLength={200}
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
                    id="ca-city" maxLength={100}
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
                  id="ca-message" maxLength={2000}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} resize-none`}
                  placeholder="Spécialités, volume de projets, ce que vous attendez d'un logiciel de devis et factures…"
                />
              </div>

              <label className="mr-small flex items-start gap-3">
                <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 accent-mr-ink" />
                <span>J'accepte que ces informations soient utilisées par Ma Reliure pour me recontacter au sujet de ma demande, conformément à la <a href="/confidentialite" className="mr-link">politique de confidentialité</a>.</span>
              </label>

              {problem && (
                <p role="alert" className="mr-small text-mr-bordeaux">
                  {problem}
                </p>
              )}

              <button type="submit" disabled={sending} className={submitClass}>
                {sending ? "Envoi…" : "Envoyer ma demande"}
              </button>
            </form>
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}
