/**
 * Les trois blocs que Ma Reliure pose autour du parcours « Présenter mon livre » :
 * ce qu'on obtient avant de commencer, ce que l'envoi engage (ou pas) au dernier
 * regard, et ce qui se passe une fois le projet envoyé.
 *
 * Ils disent le trajet tel qu'il est : un prix avant tout engagement, un livre
 * qui ne voyage qu'après l'accord sur ce prix, un transport convenu au cas par
 * cas (l'expédition automatisée n'existe pas encore — voir ReliureLanding).
 * Aucune promesse de plus que la page d'accueil n'en fait déjà.
 */
import { Clock, FileText, Package } from "lucide-react";
import { RELIURE_INTAKE_MINUTES, RELIURE_REPLY_DELAY } from "./reliureIntakeGuidance";

/** Avant la première question : ce qu'on obtient, combien de temps, et le geste à ne pas faire. */
export function ReliureIntakeIntro() {
  return (
    <section
      aria-labelledby="reliure-intro-title"
      className="rounded-lg border border-stone-300 bg-[#fffdf8] p-5 sm:p-6"
    >
      <h2 id="reliure-intro-title" className="text-base font-semibold text-stone-950">
        Avant de commencer
      </h2>
      <ul className="mt-3 grid gap-3 text-[15px] leading-6 text-stone-700">
        <li className="flex gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--metre-accent)]" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-stone-950">Ce que vous obtenez.</strong> Une
            proposition chiffrée par Ma Reliure : le travail à réaliser et son prix, avant tout
            engagement.
          </span>
        </li>
        <li className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--metre-accent)]" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-stone-950">
              Environ {RELIURE_INTAKE_MINUTES} minutes.
            </strong>{" "}
            Quelques questions, quelques photos et, si possible, trois mesures : gardez le livre
            sous la main.
          </span>
        </li>
        <li className="flex gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--metre-accent)]" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-stone-950">
              N’envoyez pas votre livre maintenant.
            </strong>{" "}
            Il ne voyage qu’après votre accord sur la proposition, et le transport est convenu
            avec vous à ce moment-là.
          </span>
        </li>
      </ul>
    </section>
  );
}

/** Au dernier regard, juste au-dessus d'« Envoyer mon projet ». */
export function ReliureReviewNotice() {
  return (
    <div className="rounded-lg border border-stone-300 bg-[#fffdf8] p-4 text-sm leading-6 text-stone-700">
      <p className="font-semibold text-stone-950">Envoyer ne vous engage à rien.</p>
      <p className="mt-1">
        Vous ne payez rien maintenant et vous n’expédiez pas encore votre livre. Ma Reliure vous
        répond avec une proposition chiffrée, que vous êtes libre d’accepter ou non.
      </p>
    </div>
  );
}

const STEPS: { title: string; who: string; detail: string }[] = [
  {
    title: "Ma Reliure étudie votre projet",
    who: "Ma Reliure",
    detail: `Délai indicatif : ${RELIURE_REPLY_DELAY}.`,
  },
  {
    title: "Vous recevez une proposition chiffrée",
    who: "À vous de jouer",
    detail: "Par e-mail et dans votre espace. Vous êtes libre de l’accepter ou non.",
  },
  {
    title: "Si vous acceptez : paiement, puis envoi du livre",
    who: "À vous de jouer",
    detail: "Le transport est convenu avec vous à ce moment-là. N’envoyez rien avant.",
  },
];

/** Après l'envoi : la suite, qui la fait, et quand. */
export function ReliureNextSteps() {
  return (
    <section
      aria-labelledby="reliure-next-title"
      className="rounded-lg border border-stone-300 bg-[#fffdf8] p-5"
    >
      <h2 id="reliure-next-title" className="text-lg font-semibold text-stone-950">
        Et maintenant ?
      </h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        Pour l’instant, vous n’avez rien à faire : surveillez votre boîte mail (et vos courriers
        indésirables).
      </p>
      <ol className="mt-4 grid gap-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--metre-accent-soft)] text-sm font-semibold text-[color:var(--metre-accent)]"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-6 text-stone-950">{step.title}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {step.who}
              </p>
              <p className="mt-0.5 text-sm leading-6 text-stone-600">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
