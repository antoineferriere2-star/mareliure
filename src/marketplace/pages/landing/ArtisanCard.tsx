/**
 * La vitrine d'un atelier.
 *
 * Une grande planche à gauche, la notice à droite, puis trois pièces en
 * vignettes posées entières. Les images ne sont jamais recadrées : servies
 * dans un passe-partout, elles restent nettes et lisibles quelle que soit la
 * prise de vue d'origine.
 *
 * Ce n'est pas une carte de marketplace : pas de bouton « choisir cet
 * artisan », pas de note, pas de délai annoncé. Le client ne sélectionne pas
 * son relieur dans ce modèle, et une grille de vignettes cliquables lui dirait
 * le contraire.
 */
import { Photograph } from "./Photograph";
import { Plate } from "./Plate";
import type { ArtisanProfile } from "./content";

export function ArtisanCard({ artisan, firstPlate }: { artisan: ArtisanProfile; firstPlate?: number }) {
  const portfolio = (artisan.portfolio ?? []).slice(0, 3);
  const place = artisan.since ? `${artisan.city}, depuis ${artisan.since}` : artisan.city;
  const plate = (offset: number) => (firstPlate === undefined ? undefined : firstPlate + offset);

  return (
    <article className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">
        {/* Les deux cas s'écrivent séparément parce que le type l'impose : sans
            photographie, le brief de prise de vue devient obligatoire. */}
        {artisan.image ? (
          <Plate
            photo={artisan.image}
            sizes="(min-width: 1024px) 640px, 100vw"
            alt={artisan.imageAlt ?? `Une reliure de l'atelier ${artisan.name}`}
            number={plate(0)}
            caption={artisan.name}
          />
        ) : (
          <Photograph
            alt={`L'atelier ${artisan.name}`}
            shotBrief="Portrait de l'artisan à l'établi, dans son atelier, lumière naturelle."
            ratio="landscape"
          />
        )}
      </div>

      <div className="lg:col-span-5 lg:pt-2">
        <p className="mr-eyebrow text-mr-bordeaux">{place}</p>
        <h3 className="mr-title mt-3 text-[2rem] text-mr-ink">{artisan.name}</h3>
        {artisan.artisan && <p className="mr-small mt-2">{artisan.artisan}</p>}

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
              {portfolio.map((piece, index) => (
                <Plate
                  key={piece.photo.src}
                  photo={piece.photo}
                  sizes="(min-width: 1024px) 150px, 30vw"
                  alt={piece.alt}
                  ratio="square"
                  number={plate(index + 1)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
