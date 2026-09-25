import { ArrowRight, Check, BookOpen, FileText, MessageSquare } from "lucide-react";
import {
  LandingFooter,
  LandingHeader,
  SectionHead,
  SHELL,
} from "@/marketplace/pages/landing/LandingChrome";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";

const captureSizes = {
  workbench: [1240, 1430],
  tarifs: [970, 1085],
  ouvrage: [970, 765],
  devis: [920, 1300],
  dashboard: [729, 305],
  messages: [960, 320],
} as const;

const JOIN = "/auth?space=atelier";
const primary =
  "inline-flex items-center justify-center gap-3 rounded-[2px] bg-mr-bordeaux px-6 py-4 text-center text-base font-semibold text-white transition hover:bg-mr-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";
const features = [
  "Prestations fréquentes et favoris",
  "Catégories et tarifs de votre atelier",
  "Lignes libres pour un travail particulier",
  "TVA globale, remise et acompte",
  "Photos des opérations et PDF",
];

export function ProductCapture({
  name,
  alt,
  caption,
  eager = false,
}: {
  name: keyof typeof captureSizes;
  alt: string;
  caption: string;
  eager?: boolean;
}) {
  return (
    <figure className="min-w-0">
      <a
        href={`/product/${name}.webp`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block overflow-hidden rounded-sm border border-mr-rule-strong bg-white shadow-[0_18px_60px_-30px_rgba(44,30,22,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        aria-label={`Agrandir : ${alt}`}
      >
        <img
          src={`/product/${name}.webp`}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-auto w-full"
          width={captureSizes[name][0]}
          height={captureSizes[name][1]}
        />
      </a>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs leading-relaxed text-mr-muted">
        <span>{caption}</span>
        <span>Agrandir la capture ↗</span>
      </figcaption>
    </figure>
  );
}

function Join({ light = false }: { light?: boolean }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-5">
      <a href={JOIN} className={primary}>
        Créer mon espace atelier <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </a>
      <a
        href="#outil-devis"
        className={`mr-link mr-tap py-3 text-sm ${light ? "!text-mr-paper" : "text-mr-ink"}`}
      >
        Découvrir l’outil de devis
      </a>
    </div>
  );
}

export function PartnersLandingPage() {
  usePageViewTracking();
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader workshop />
      <main>
        <section className={`${SHELL} py-16 sm:py-24`}>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="mr-eyebrow">L’outil métier gratuit des relieurs</p>
              <h1 className="mr-display mt-5 text-mr-ink">
                Vos ouvrages, vos devis, vos clients.
                <br />
                <span className="text-mr-bordeaux">Dans un seul outil.</span>
              </h1>
              <p className="mr-lead mt-6">
                Ma Reliure vous donne un espace métier conçu autour de votre travail : clients,
                ouvrages, prestations, devis, factures et demandes entrantes.
              </p>
              <p className="mt-6 border-l-2 border-mr-bordeaux pl-4 text-base leading-7 text-mr-ink">
                Pas d’abonnement.
                <br />
                Pas de commission sur vos propres clients.
              </p>
              <Join />
            </div>
            <ProductCapture
              name="workbench"
              alt="Le véritable outil de devis Ma Reliure, avec ses prestations et son récapitulatif"
              caption="L’outil actuel · saisie de démonstration, non enregistrée."
              eager
            />
          </div>
        </section>
        <section className="border-y border-mr-rule bg-mr-paper-warm">
          <div className={`${SHELL} grid gap-8 py-10 sm:grid-cols-3`}>
            {[
              {
                icon: BookOpen,
                title: "Un ouvrage, un dossier",
                body: "Le client, les dimensions et les documents réunis.",
              },
              {
                icon: FileText,
                title: "Des devis à votre façon",
                body: "Vos prix, vos photos, vos conditions.",
              },
              {
                icon: MessageSquare,
                title: "Le suivi au même endroit",
                body: "Vos demandes et vos échanges restent accessibles.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon aria-hidden="true" className="h-5 w-5 text-mr-bordeaux" />
                <h2 className="mr-heading mt-4 text-mr-ink">{title}</h2>
                <p className="mr-small mt-2">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="outil-devis" className={`${SHELL} scroll-mt-28 py-section-sm sm:py-section`}>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="Un devis prêt en quelques clics"
                title="Le temps de choisir le bon travail."
                lead="Retrouvez vos prestations fréquentes, ajoutez celles du livre et ajustez votre proposition. Le montant se construit au fil de vos choix."
              />
              <ul className="mt-7 space-y-3">
                {features.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-mr-bordeaux" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mr-small mt-6">
                Plusieurs tailles de livres ? Créez un bloc par format, avec sa quantité et ses
                prestations.
              </p>
              <a href={JOIN} className={`${primary} mt-8`}>
                Créer mon espace atelier
              </a>
            </div>
            <ProductCapture
              name="workbench"
              alt="Prestations, formats et total du devis"
              caption="Capture du logiciel en fonctionnement · les montants restent modifiables."
            />
          </div>
        </section>
        <section id="tarifs-atelier" className="bg-mr-paper-warm">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <div className="grid gap-10 lg:grid-cols-2">
              <SectionHead
                eyebrow="Vos prix restent vos prix"
                title="Une base pour commencer. Votre savoir-faire pour chiffrer."
                lead="45 prestations de départ, des tarifs modifiables et des prestations personnalisées. Ajustez plusieurs prix par montant ou par pourcentage, puis adaptez chaque devis au livre."
              />
              <div className="border-y border-mr-rule-strong py-5">
                <p className="mr-meta">Exemple de personnalisation · plein cuir</p>
                <dl className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["Tarif Ma Reliure", "350 €"],
                    ["Votre tarif", "385 €"],
                    ["Pour ce devis", "420 €"],
                  ].map(([label, price]) => (
                    <div key={label}>
                      <dt className="text-xs leading-5 text-mr-muted">{label}</dt>
                      <dd className="mt-2 font-serif text-2xl text-mr-ink sm:text-3xl">{price}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mr-small mt-5">
                  Vous décidez du prix final. Ce sont trois niveaux de prix possibles, pas des
                  montants imposés.
                </p>
              </div>
            </div>
            <div className="mt-10">
              <ProductCapture
                name="tarifs"
                alt="La grille des prestations et tarifs personnalisables de l’atelier"
                caption="Le catalogue actuel · 45 prestations, vos tarifs et vos favoris."
              />
            </div>
          </div>
        </section>
        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <ProductCapture
              name="ouvrage"
              alt="Création d’une fiche ouvrage avec client et dimensions"
              caption="Un ouvrage de démonstration saisi dans l’écran réel, sans enregistrement."
            />
            <div>
              <SectionHead
                eyebrow="Tout part d’un ouvrage"
                title="Le livre reste le fil conducteur."
                lead="Retrouvez le client, les dimensions, les photos disponibles et les documents liés. Depuis la fiche de l’ouvrage, préparez un devis sans ressaisir ce que vous connaissez déjà."
              />
              <div className="mt-7 flex items-center gap-4 border-y border-mr-rule py-5 text-lg font-semibold text-mr-ink">
                <span>Ouvrage</span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-mr-bordeaux" />
                <span>Devis</span>
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-mr-bordeaux" />
                <span>Facture</span>
              </div>
              <p className="mr-small mt-5">
                Les devis et factures gardent leur historique. Pour les projets reçus, photos et
                messages restent dans le dossier du projet.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-mr-paper-warm">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <SectionHead
                  eyebrow="Des devis à votre image"
                  title="Votre atelier signe ses documents."
                  lead="Logo, coordonnées, TVA, conditions et pied de document : préparez votre présentation une fois, retrouvez-la sur vos PDF."
                />
                <h3 className="mr-heading mt-10 text-mr-ink">
                  Du devis à la facture sans ressaisie
                </h3>
                <p className="mr-body mt-3">
                  À partir d’un devis accepté, préparez la facture, vérifiez ses informations puis
                  émettez-la. Le suivi des paiements reste dans votre espace.
                </p>
                <p className="mr-small mt-5">
                  Les réglages documentaires restent sous votre responsabilité. L’outil ne remplace
                  pas la validation de votre situation par votre comptable.
                </p>
                <Join />
              </div>
              <div className="mx-auto w-full max-w-md">
                <ProductCapture
                  name="devis"
                  alt="Une page d’un véritable PDF exporté par le moteur de devis Ma Reliure"
                  caption="PDF exporté par le moteur du produit · données de démonstration."
                />
              </div>
            </div>
          </div>
        </section>
        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <SectionHead
            eyebrow="L’atelier, au quotidien"
            title="Savoir où reprendre votre travail."
            lead="Aujourd’hui rassemble les éléments à traiter. Vos demandes et vos messages ont leur place, sans se perdre parmi les devis."
          />
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <ProductCapture
              name="dashboard"
              alt="La vue Aujourd’hui de l’espace atelier"
              caption="Capture du tableau de bord actuel, cadrée sans coordonnées privées."
            />
            <ProductCapture
              name="messages"
              alt="L’espace des messages de l’atelier"
              caption="L’écran réel de messagerie · aucun échange privé affiché."
            />
          </div>
        </section>
        <section id="offre-atelier" className="bg-mr-ink text-mr-paper">
          <div className={`${SHELL} py-section-sm sm:py-section`}>
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <p className="mr-eyebrow !text-mr-paper/70">Un outil gratuit, sans abonnement</p>
                <h2 className="mt-5 font-serif text-6xl sm:text-7xl">
                  0 € <span className="font-sans text-lg text-mr-paper/70">/ mois</span>
                </h2>
                <p className="mt-6 max-w-md text-lg leading-8">
                  Vos ouvrages, vos clients, vos tarifs, vos devis et vos factures. Pas de
                  commission sur vos propres clients.
                </p>
                <p className="mt-5 text-sm leading-7 text-mr-paper/75">
                  Si votre client vous paie par un moyen externe :<br />
                  <strong className="text-mr-paper">0 € de frais Ma Reliure.</strong>
                </p>
                <Join light />
              </div>
              <div
                id="paiement-atelier"
                className="scroll-mt-28 border border-mr-paper/25 p-6 sm:p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-mr-paper/70">
                  Paiement en ligne · prochainement disponible
                </p>
                <h3 className="mt-4 font-serif text-3xl">Facultatif. Et clairement chiffré.</h3>
                <p className="mt-5 text-sm leading-7">
                  Tarification prévue pour le paiement Stripe Ma Reliure :{" "}
                  <strong>3 % du montant réellement encaissé.</strong> Aucun frais Ma Reliure si
                  vous choisissez un paiement externe.
                </p>
                <dl className="mt-7 divide-y divide-mr-paper/20">
                  {[
                    ["Facture client", "500 €"],
                    ["Paiement Stripe Ma Reliure · 3 %", "− 15 €"],
                    ["Versement atelier", "485 €"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-4 text-sm">
                      <dt>{label}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs leading-6 text-mr-paper/70">
                  Exemple selon les conditions prévues à l’activation de cette option. Le paiement
                  en ligne est facultatif.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className={`${SHELL} py-section-sm sm:py-section`}>
          <div className="max-w-3xl">
            <SectionHead
              eyebrow="Et aussi, des projets pour votre atelier"
              title="Un outil pour vos clients. Un réseau en complément."
              lead="Ma Reliure peut également vous transmettre des projets correspondant à votre activité. Vous choisissez ceux qui conviennent à vos savoir-faire et à vos disponibilités."
            />
            <p className="mr-body mt-5">
              La réception de projets Ma Reliure reste soumise à l’autorisation de l’administration.
              Elle est distincte de l’utilisation de votre outil et de la gestion de vos propres
              clients.
            </p>
          </div>
          <div className="mt-12 border-t border-mr-rule pt-10">
            <h2 className="mr-heading text-mr-ink">Votre prochain devis commence ici.</h2>
            <Join />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
