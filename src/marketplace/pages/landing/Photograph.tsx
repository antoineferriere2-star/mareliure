/**
 * Une photographie de la landing — ou, tant qu'elle n'existe pas, l'emplacement
 * qui l'attend.
 *
 * Ma Reliure vend un savoir-faire manuel : le site tient ou tombe sur ses
 * images. Or nous n'en avons aucune. Deux mauvaises réponses étaient
 * possibles — une banque d'images générique, qui aurait fait mentir la page dès
 * la première seconde, ou des blocs vides, qui l'auraient fait paraître
 * inachevée. Ce composant en propose une troisième : un emplacement composé,
 * qui porte le brief de la photo à faire et se signale comme provisoire.
 *
 * Le jour où la photo arrive, on passe `src` et rien d'autre ne change.
 *
 * Performance : chaque emplacement impose son ratio en CSS, donc aucune image
 * n'entraîne de décalage de mise en page. Seul le hero est chargé en priorité ;
 * tout le reste est différé.
 */
import type { CSSProperties } from "react";

export type PhotographRatio = "portrait" | "tall" | "landscape" | "square" | "wide";

const RATIOS: Record<PhotographRatio, string> = {
  tall: "3 / 4.4",
  portrait: "3 / 4",
  square: "1 / 1",
  landscape: "4 / 3",
  wide: "16 / 10",
};

export interface PhotographProps {
  /** La vraie photographie, quand elle existe. Absente, l'emplacement s'affiche. */
  src?: string;
  /** Jeu de tailles pour les écrans à densité variable. */
  srcSet?: string;
  sizes?: string;
  /** Texte alternatif. Obligatoire même sur un emplacement : il décrit l'intention. */
  alt: string;
  /**
   * Ce que la photographie doit montrer. Imprimé sur l'emplacement, et c'est
   * la raison d'être de ce composant : le brief voyage avec la maquette au lieu
   * de vivre dans un document que personne ne rouvre.
   */
  shotBrief: string;
  ratio?: PhotographRatio;
  /** Le hero seul. Charge l'image immédiatement au lieu de la différer. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Photograph({
  src,
  srcSet,
  sizes,
  alt,
  shotBrief,
  ratio = "portrait",
  priority = false,
  className = "",
  style,
}: PhotographProps) {
  const frame = { aspectRatio: RATIOS[ratio], ...style };

  if (src) {
    return (
      <figure className={`relative overflow-hidden bg-mr-paper-deep ${className}`} style={frame}>
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          // `fetchPriority` n'est pas encore dans les types React ; l'attribut
          // est pourtant compris par tous les navigateurs qui nous intéressent,
          // et c'est lui qui fait démarrer l'image du hero avant le reste.
          {...(priority ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
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
      <figcaption className="relative z-10 max-w-[26ch] px-6 text-center">
        <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mr-bordeaux/70">
          Photographie à fournir
        </span>
        <span className="mt-3 block text-sm leading-6 text-mr-muted">{shotBrief}</span>
      </figcaption>
    </figure>
  );
}
