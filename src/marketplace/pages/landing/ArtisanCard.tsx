/**
 * La vitrine d'un atelier.
 *
 * Composée en deux colonnes plutôt qu'en bandeau pleine largeur. L'image
 * occupait auparavant les 1 216 px du conteneur pour une source de 800 —
 * agrandie de moitié, donc molle, sur la seule section censée prouver un
 * savoir-faire. À 6/12 elle est servie à sa taille et redevient nette.
 *
 * Ce n'est pas une carte de marketplace : pas de bouton « choisir cet
 * artisan », pas de note, pas de délai annoncé. Le client ne sélectionne pas
 * son relieur dans ce modèle, et une grille de vignettes cliquables lui dirait
 * le contraire.
 */
import { Photograph } from "./Photograph";
import { PHOTO_SIZES } from "./photos";
import type { ArtisanProfile } from "./content";

export function ArtisanCard({ artisan }: { artisan: ArtisanProfile }) {
  const portfolio = (artisan.portfolio ?? []).slice(0, 3);
  const place = artisan.since ? `${artisan.city}, depuis ${artisan.since}` : artisan.city;

  return (
    <article className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-6">
        {/* Les deux cas s'écrivent séparément parce que le type l'impose : sans
            photographie, le brief de prise de vue devient obligatoire. Un
            ternaire sur `photo` seul ne compile pas, et c'est voulu. */}
        {artisan.image ? (
          <Photograph
            photo={artisan.image}
            sizes={PHOTO_SIZES.artisan}
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
      </div>

      <div className="lg:col-span-6 lg:pt-2">
        <h3 className="mr-title text-[1.75rem] text-mr-ink">{artisan.name}</h3>
        <p className="mr-small mt-2">{artisan.artisan ? `${artisan.artisan} · ${place}` : place}</p>

        {artisan.specialties.length > 0 && (
          <>
            <h4 className="mr-eyebrow mt-8">Savoir-faire</h4>
            <ul className="mr-body mt-3 flex flex-wrap gap-x-2">
              {artisan.specialties.map((specialty, index) => (
                <li key={specialty}>
                  {specialty}
                  {index < artisan.specialties.length - 1 && (
                    <span aria-hidden="true" className="ml-2 text-mr-rule-strong">
                      ·
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {portfolio.length > 0 && (
          <>
            <h4 className="mr-eyebrow mt-8">Quelques pièces</h4>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {portfolio.map((piece) => (
                <Photograph
                  key={piece.photo.src}
                  photo={piece.photo}
                  sizes={PHOTO_SIZES.thumb}
                  alt={piece.alt}
                  ratio="square"
                />
              ))}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
