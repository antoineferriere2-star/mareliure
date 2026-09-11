import { useMemo, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MissionRuntime } from "@/build/pages/public/MissionRuntime";
import { CustomerSpaceOffer } from "@/marketplace/pages/customer/CustomerSpaceOffer";
import { REFERRAL_ANSWER_KEY } from "@/marketplace/binders/referral";
import { isMaReliure } from "@/brand";

/**
 * Le titre de l'onglet pendant tout le parcours.
 *
 * Il annonçait « Métré Build AI — Mission runtime » sur les deux marques. Sur
 * Ma Reliure, quelqu'un décrivait le livre auquel il tient pendant huit
 * étapes en ayant sous les yeux le nom d'un produit dont il n'a jamais
 * entendu parler, et le mot « runtime ».
 *
 * Un visiteur n'a pas à savoir quel moteur fait tourner la page.
 */
const TITLE = isMaReliure ? "Présenter mon livre — Ma Reliure" : "Project Intake — Métré Build";

/**
 * Ce qui suit l'envoi du projet, propre à la marque.
 *
 * Sur Ma Reliure, la proposition de suivre son livre. Le runtime n'en sait
 * rien : il offre un emplacement et l'adresse saisie, la route le remplit — la
 * Mission ne connaît pas la marketplace.
 */
const afterSubmission = isMaReliure
  ? ({ visitorEmail }: { visitorEmail: string | null }): ReactNode => (
      <CustomerSpaceOffer email={visitorEmail} />
    )
  : undefined;

export const Route = createFileRoute("/m/$publicToken")({
  ssr: false,
  // `?ref=` carries an atelier's referral slug through the tunnel (§55-§56) —
  // set only by the server-side redirect at /a/:slug, never trusted as an
  // attribution on its own. The runtime forwards it as an opaque answer;
  // reconcileCaseTriage is what actually resolves it, once, server-side.
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" && search.ref.length <= 64 ? { ref: search.ref } : {},
  head: () => ({
    meta: [{ title: TITLE }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: RuntimePage,
});

function RuntimePage() {
  const { publicToken } = Route.useParams();
  const { ref } = Route.useSearch();
  const seedAnswers = useMemo(
    () => (ref ? { [REFERRAL_ANSWER_KEY]: ref } : undefined),
    [ref],
  );
  return (
    <MissionRuntime
      publicToken={publicToken}
      renderAfterSubmission={afterSubmission}
      seedAnswers={seedAnswers}
    />
  );
}
