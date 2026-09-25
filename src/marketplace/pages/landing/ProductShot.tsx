/**
 * Une capture réelle de l'espace atelier.
 *
 * Pas de maquette : chaque image vient de l'application, rendue avec des
 * données d'exemple fictives (clients, livres et montants inventés pour la
 * démonstration — voir docs/content-assets.md). La légende le dit, toujours :
 * un montant sur une capture ne doit jamais se lire comme un tarif publié.
 */

export const PRODUCT_SHOTS = {
  aujourdhui: { file: "atelier-aujourdhui", width: 1600, height: 1000, alt: "L'écran Aujourd'hui de l'espace atelier : nouvelles demandes, messages non lus, devis à relancer, ouvrages en cours et paiements attendus, puis la liste des actions à traiter." },
  devis: { file: "atelier-devis", width: 1600, height: 1457, alt: "Le constructeur de devis : prestations favorites et fréquentes avec les prix de l'atelier, catégories, lignes du devis, TVA du devis et résumé en direct." },
  projets: { file: "atelier-projets", width: 1600, height: 904, alt: "La liste des projets confiés par Ma Reliure, chacun avec son statut et sa prochaine action." },
  ouvrages: { file: "atelier-ouvrages", width: 1600, height: 1071, alt: "La liste des ouvrages de l'atelier : titre, client, dimensions, état et nombre de devis de chaque livre." },
  factures: { file: "atelier-factures", width: 1600, height: 793, alt: "La liste des factures : numéro, client, ouvrage, statut de paiement et montant." },
  tarifs: { file: "atelier-tarifs", width: 1600, height: 967, alt: "L'écran Mes prestations et mes prix : 45 prestations, dont 41 tarifées et 4 sur étude, avec recherche, favoris et ajustement de plusieurs tarifs." },
  pdf: { file: "devis-pdf", width: 1310, height: 1140, alt: "Un devis PDF généré par l'outil : en-tête de l'atelier, client, ouvrage et dimensions, puis le détail des prestations." },
} as const;

export type ProductShotKey = keyof typeof PRODUCT_SHOTS;

export function ProductShot({
  shot,
  sizes = "(min-width: 1024px) 720px, 100vw",
  caption = "Espace atelier — données d'exemple",
  priority = false,
  className = "",
}: {
  shot: ProductShotKey;
  sizes?: string;
  caption?: string | null;
  priority?: boolean;
  className?: string;
}) {
  const { file, width, height, alt } = PRODUCT_SHOTS[shot];
  const base = `/photos/product/${file}`;
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[3px] border border-mr-rule-strong/70 bg-mr-paper shadow-[0_1px_2px_rgba(23,19,15,0.05),0_18px_40px_-24px_rgba(23,19,15,0.35)]">
        <img
          src={`${base}-960.webp`}
          srcSet={`${base}-960.webp 960w, ${base}-1600.webp ${width}w`}
          sizes={sizes}
          width={width}
          height={height}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
      {caption && <figcaption className="mr-meta mt-3">{caption}</figcaption>}
    </figure>
  );
}
