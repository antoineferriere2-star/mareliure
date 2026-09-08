/**
 * Une photographie de la landing — ou, tant qu'elle n'existe pas, l'emplacement
 * qui l'attend.
 *
 * Ma Reliure vend un savoir-faire manuel : le site tient ou tombe sur ses
 * images. Là où une vraie photographie a été fournie, on la sert. Là où il n'y
 * en a pas encore — les cas avant/après, les vitrines d'atelier — deux
 * mauvaises réponses étaient possibles : une banque d'images générique, qui
 * aurait fait mentir la page, ou des blocs vides, qui l'auraient fait paraître
 * inachevée. Ce composant en propose une troisième : un emplacement composé,
 * qui porte le brief de la photo à faire et se signale comme provisoire.
 *
 * Le jour où la photo arrive, on passe `photo` et rien d'autre ne change.
 *
 * Performance : chaque cadre impose son ratio en CSS, donc aucune image
 * n'entraîne de décalage de mise en page. Seul le hero est chargé en priorité ;
 * tout le reste est différé.
 */
import type { CSSProperties } from "react";
import type { PhotoSources } from "./photos";

export type PhotographRatio = "portrait" | "tall" | "landscape" | "square" | "wide";

const RATIOS: Record<PhotographRatio, string> = {
  tall: "3 / 4.4",
  portrait: "3 / 4",
  square: "1 / 1",
  landscape: "4 / 3",
  wide: "16 / 10",
};

interface PhotographBase {
  /** La place que l'image occupe dans cette mise en page — voir `PHOTO_SIZES`. */
  sizes?: string;
  /** Texte alternatif. Obligatoire même sur un emplacement : il décrit l'intention. */
  alt: string;
  ratio?: PhotographRatio;
  /** Le hero seul. Charge l'image immédiatement au lieu de la différer. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Ou bien une photographie existe, ou bien il faut dire laquelle commander.
 *
 * L'union est ce qui rend la règle exécutable : sans photo, `shotBrief` devient
 * obligatoire, et le compilateur refuse un cadre vide et muet — la seule chose
 * que ce composant existe pour empêcher.
 */
export type PhotographProps = PhotographBase &
  (
    | { photo: PhotoSources; shotBrief?: string }
    | {
        photo?: undefined;
        /**
         * Ce que la photographie doit montrer. Imprimé sur l'emplacement : le
         * brief voyage avec la maquette au lieu de vivre dans un document que
         * personne ne rouvre.
         */
        shotBrief: string;
      }
  );

export function Photograph({
  photo,
  sizes,
  alt,
  shotBrief,
  ratio = "portrait",
  priority = false,
  className = "",
  style,
}: PhotographProps) {
  const frame = { aspectRatio: RATIOS[ratio], ...style };

  if (photo) {
    return (
      <figure className={`relative overflow-hidden bg-mr-paper-deep ${className}`} style={frame}>
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          // React 19 connaît `fetchPriority`. L'écrire en minuscules comme
          // l'attribut HTML fait échouer la reconnaissance : React émet
          // « Invalid DOM property » et ne pose rien — la priorité du hero
          // était donc silencieusement perdue.
          fetchPriority={priority ? "high" : undefined}
          className="h-full w-full object-cover"
        />
      </figure>
    );
  }

  return (
    <figure
      className={`relative grid place-items-center overflow-hidden bg-mr-paper-deep ${className}`}
      style={frame}
      aria-label={alt}
      role="img"
    >
      {/* Trame très discrète : l'emplacement doit lire comme du papier tendu,
          pas comme une image cassée. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(28,21,17,0.045) 0 1px, transparent 1px 9px)",
        }}
      />
      <div aria-hidden="true" className="absolute inset-3 border border-mr-ink/10 sm:inset-4" />
      <figcaption className="relative z-10 max-w-[26ch] px-5 text-center">
        <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mr-bordeaux/70">
          Photographie à fournir
        </span>
        <span className="mt-3 block text-[0.8125rem] leading-5 text-mr-muted sm:text-sm sm:leading-6">
          {shotBrief}
        </span>
      </figcaption>
    </figure>
  );
}
