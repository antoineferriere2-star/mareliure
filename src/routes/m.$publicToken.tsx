import { useMemo, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import type { IntakeGuidance } from "@/build/pages/public/intakeGuidance";
import { CustomerSpaceOffer } from "@/marketplace/pages/customer/CustomerSpaceOffer";
import {
  ReliureIntakeIntro,
  ReliureNextSteps,
  ReliureReviewNotice,
} from "@/marketplace/pages/customer/ReliureIntakeCopy";
import {
  RELIURE_GLOSSARY,
  RELIURE_PHOTO_SHOTS,
} from "@/marketplace/pages/customer/reliureIntakeGuidance";
import { REFERRAL_ANSWER_KEY } from "@/marketplace/binders/referral";
import { isMaReliure } from "@/brand";
import { BOOKBINDING_PUBLIC_TOKEN, FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";

/**
 * Le titre de l'onglet pendant tout le parcours.
 *
 * Il annonçait « Métré Build AI — Mission runtime » sur les deux marques. Sur
 * Ma Reliure, quelqu'un décrivait le livre auquel il tient pendant huit
 * étapes en ayant sous les yeux le nom d'un produit dont il n'a jamais
 * entendu parler, et le mot « runtime ».
 *
 * Un visiteur n'a pas à savoir quel moteur fait tourner la page. Résolu par
 * `publicToken` directement (pas par le Host) : cette route sait déjà, sans
 * requête serveur, quelle Mission elle sert — FINE_BINDERY_PUBLIC_TOKEN
 * identifie Fine Bindery aussi sûrement qu'un Host résolu l'aurait fait.
 */
function titleFor(publicToken: string): string {
  if (!isMaReliure) return "Project Intake — Métré Build";
  return publicToken === FINE_BINDERY_PUBLIC_TOKEN
    ? "Start your project — Fine Bindery"
    : "Présenter mon livre — Ma Reliure";
}

export const Route = createFileRoute("/m/$publicToken")({
  ssr: false,
  // `?ref=` carries an atelier's referral slug through the tunnel (§55-§56) —
  // set only by the server-side redirect at /a/:slug, never trusted as an
  // attribution on its own. The runtime forwards it as an opaque answer;
  // reconcileCaseTriage is what actually resolves it, once, server-side.
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" && search.ref.length <= 64 ? { ref: search.ref } : {},
  head: ({ params }) => ({
    meta: [{ title: titleFor(params.publicToken) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: RuntimePage,
});

/**
 * Ce que Ma Reliure dit autour du parcours des particuliers : promesse au
 * départ, guide photo, vocabulaire, rappel avant l'envoi. Réservé à la Mission
 * « Présenter mon livre » : Fine Bindery (autre langue, autre parcours) n'en
 * reçoit rien tant que son propre chantier n'est pas ouvert.
 */
const RELIURE_GUIDANCE: IntakeGuidance = {
  intro: <ReliureIntakeIntro />,
  photoShots: RELIURE_PHOTO_SHOTS,
  glossary: RELIURE_GLOSSARY,
  reviewNotice: <ReliureReviewNotice />,
};

function RuntimePage() {
  const { publicToken } = Route.useParams();
  const { ref } = Route.useSearch();
  const seedAnswers = useMemo(
    () => (ref ? { [REFERRAL_ANSWER_KEY]: ref } : undefined),
    [ref],
  );
  const isReliureIntake = isMaReliure && publicToken === BOOKBINDING_PUBLIC_TOKEN;
  // Sur Ma Reliure et Fine Bindery, la proposition de suivre son livre —
  // CustomerSpaceOffer choisit sa langue depuis le même publicToken que
  // celui qui a déjà décidé le titre de l'onglet ci-dessus. Le runtime, lui,
  // n'en sait toujours rien : il offre un emplacement et l'adresse saisie,
  // la route le remplit — la Mission ne connaît pas la marketplace.
  const afterSubmission = isMaReliure
    ? ({ visitorEmail }: { visitorEmail: string | null }): ReactNode => (
        <>
          {isReliureIntake && <ReliureNextSteps />}
          <CustomerSpaceOffer email={visitorEmail} publicToken={publicToken} />
        </>
      )
    : undefined;
  return (
    <MissionRuntime
      publicToken={publicToken}
      renderAfterSubmission={afterSubmission}
      seedAnswers={seedAnswers}
      guidance={isReliureIntake ? RELIURE_GUIDANCE : undefined}
      initialLocale={isReliureIntake ? "fr-FR" : undefined}
    />
  );
}
