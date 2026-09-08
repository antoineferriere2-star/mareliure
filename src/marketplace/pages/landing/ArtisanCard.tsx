/**
 * La vitrine d'un atelier.
 *
 * Ce qu'elle montre d'un relieur : une de ses pièces, son nom, sa ville, ses
 * savoir-faire, deux ou trois réalisations. Rien de plus. Pas de note, pas
 * d'avis, pas de compteur de projets — rien de tout cela n'existe, et une
 * vitrine qui invente coûte plus cher qu'une vitrine sobre (§59).
 *
 * L'année d'installation est le seul chiffre affiché, et seulement parce
 * qu'elle est vérifiable auprès de l'atelier.
 */
import type { ArtisanProfile } from "./content";
import { Photograph } from "./Photograph";
import { PHOTO_SIZES } from "./photos";

export function ArtisanCard({ artisan }: { artisan: ArtisanProfile }) {
  const portfolio = (artisan.portfolio ?? []).slice(0, 3);
  const place = artisan.since ? `${artisan.city}, depuis ${artisan.since}` : artisan.city;

  return (
    <article className="flex flex-col">
      {/* Les deux cas s'écrivent séparément parce que le type l'impose : sans
          photographie, le brief de prise de vue devient obligatoire. Un
          ternaire sur `photo` seul ne compile pas, et c'est voulu. */}
      {artisan.image ? (
        <Photograph
          photo={artisan.image}
          sizes={PHOTO_SIZES.artisanCard}
          alt={artisan.imageAlt ?? `Une reliure de l'atelier ${artisan.name}`}
          ratio="landscape"
        />
      ) : (
        <Photograph
          alt={`L'atelier ${artisan.name}`}
          shotBrief="Portrait de l'artisan à l'établi, dans son atelier, lumière naturelle."
          ratio="landscape"
        />
      )}

      <h3 className="mr-title mt-6 text-[1.625rem]">{artisan.name}</h3>
      <p className="mt-1 text-sm text-mr-muted">
        {artisan.artisan ? `${artisan.artisan} · ${place}` : place}
      </p>

      {artisan.specialties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
          {artisan.specialties.map((specialty) => (
            <li
              key={specialty}
              className="border-b border-mr-brass/40 pb-0.5 text-[0.8125rem] text-mr-walnut"
            >
              {specialty}
            </li>
          ))}
        </ul>
      )}

      {portfolio.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          {portfolio.map((piece) => (
            <Photograph
              key={piece.photo.src}
              photo={piece.photo}
              sizes={PHOTO_SIZES.artisanPiece}
              alt={piece.alt}
              ratio="square"
            />
          ))}
        </div>
      )}
    </article>
  );
}
