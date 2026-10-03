/**
 * Une planche : la photographie posée entière dans un passe-partout,
 * numérotée et légendée comme une notice de catalogue.
 *
 * Les prises de vue de l'atelier sont documentaires — fond gris, flash,
 * balance des blancs variable. Recadrées pour remplir un 4:3 (`object-cover`),
 * elles perdaient un dos ou un coin et leur fond venait buter contre la page.
 * Posées entières sur un papier, elles se lisent comme une série : le défaut
 * de la prise de vue cesse d'être celui de la page.
 *
 * Rien n'est retouché : ni filtre, ni recadrage. Le cadre impose son ratio en
 * CSS, donc aucune image n'entraîne de décalage de mise en page.
 */
import type { ReactNode } from "react";
import type { PhotoSources } from "./photos";

export type PlateRatio = "landscape" | "portrait" | "square" | "wide";

const RATIOS: Record<PlateRatio, string> = {
  landscape: "aspect-[4/3]",
  portrait: "aspect-[4/5]",
  square: "aspect-square",
  wide: "aspect-[3/2]",
};

export function Plate({
  photo,
  alt,
  sizes,
  number,
  caption,
  credit,
  ratio = "landscape",
  priority = false,
  mat = "mat",
  tight = false,
  numberLabel = "Pl.",
  className = "",
}: {
  photo: PhotoSources;
  alt: string;
  sizes: string;
  /** Numéro de planche, affiché « Pl. n ». Omis pour une vignette. */
  number?: number | string;
  caption?: ReactNode;
  credit?: ReactNode;
  ratio?: PlateRatio;
  /**
   * Le héros seul : chargement immédiat mais en priorité basse. Le plus grand
   * élément du premier écran est le titre, pas la planche. En priorité haute,
   * et préchargée par React (qui précharge toute image non différée sauf en
   * `fetchPriority="low"`), l'image disputait sur mobile la bande passante à la
   * feuille de style dont dépend l'affichage du titre.
   */
  priority?: boolean;
  /** `ink` : passe-partout posé sur une section sombre. */
  mat?: "mat" | "ink";
  /** Vignette : passe-partout réduit, pour que l'image garde de la place. */
  tight?: boolean;
  /** Abréviation de « planche » dans la langue de la page (Pl., Taf., Tav., Lám.). */
  numberLabel?: string;
  className?: string;
}) {
  const ground = mat === "ink" ? "bg-mr-paper/[0.07]" : "bg-mr-mat";
  return (
    <figure className={className}>
      <div className={`${RATIOS[ratio]} ${ground} ${tight ? "p-[5%]" : "p-[7%]"}`}>
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "low" : undefined}
          className="h-full w-full object-contain"
        />
      </div>
      {(number !== undefined || caption || credit) && (
        <figcaption className="mt-3 flex items-baseline gap-3">
          {number !== undefined && (
            <span className={`mr-folio shrink-0 text-[0.9375rem] ${mat === "ink" ? "text-mr-paper/80" : "text-mr-bordeaux"}`}>{numberLabel} {number}</span>
          )}
          <span className="mr-meta">
            {caption}
            {caption && credit ? " — " : null}
            {credit}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
