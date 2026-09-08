/**
 * La vitrine d'un atelier.
 *
 * Elle est écrite avant d'avoir un seul atelier à montrer, et c'est
 * volontaire : la question « qu'est-ce qu'on affiche d'un relieur ? » se
 * tranche mieux à froid qu'au moment où le premier signe. Photographie de
 * l'atelier, nom, ville, savoir-faire, deux ou trois pièces — rien de plus.
 * Pas de note, pas d'avis, pas de compteur de projets : rien de tout cela
 * n'existe, et une vitrine qui ment coûte plus cher qu'une vitrine sobre.
 *
 * `ARTISANS` est vide tant qu'aucun atelier réel n'a rejoint la plateforme,
 * donc ce composant ne rend rien en production aujourd'hui (§59).
 */
import type { ArtisanProfile } from "./content";
import { Photograph } from "./Photograph";

export function ArtisanCard({ artisan }: { artisan: ArtisanProfile }) {
  const portfolio = (artisan.portfolio ?? []).slice(0, 3);

  return (
    <article className="flex flex-col">
      <Photograph
        photo={artisan.portrait}
        alt={`L'atelier de ${artisan.name}, à ${artisan.city}`}
        shotBrief="Portrait de l'artisan à l'établi, dans son atelier, lumière naturelle."
        ratio="landscape"
      />

      <h3 className="mr-title mt-6 text-2xl">{artisan.name}</h3>
      <p className="mt-1 text-sm text-mr-muted">{artisan.city}</p>

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
              key={piece.src}
              photo={piece}
              alt={`Une reliure réalisée par ${artisan.name}`}
              shotBrief="Pièce réalisée par l'atelier."
              ratio="square"
            />
          ))}
        </div>
      )}
    </article>
  );
}
