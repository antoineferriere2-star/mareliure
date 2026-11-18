# Fine Bindery — traductions des pages légales, 15 octobre 2026

**Traduction à relire par un juriste avant publication.**

Les mentions légales, la confidentialité, les conditions d’utilisation et les conditions de vente anglaises de `LegalPages.tsx`, sur main fb32fe1, servent de référence. Les versions FR/DE/IT/ES reprennent chaque section et chaque paragraphe, sans révision des clauses. L’identité d’OPPE, les prestataires, le contact et la durée de validité du récapitulatif restent lus depuis `legalEntity.ts`. La forme sociale française reste son nom officiel.

Les réserves `LEGAL REVIEW REQUIRED` et `BLOCKED — MEDIATOR DETAILS REQUIRED` sont conservées et traduites ; aucune revue juridique ni désignation de médiateur n’est prétendue. Les formulations anciennes du texte anglais sur l’ouverture des ventes sont traduites telles quelles : leur révision éventuelle est un chantier juridique distinct.

Chaque document possède cinq URL `/{en,fr,de,it,es}/{legal-notice,privacy-policy,terms-of-use,terms-of-sale}`. Les quatre anciennes adresses anglaises redirigent en 301 vers `/en/...`, dans la même redirection que HTTPS et le domaine canonique sur les domaines connus. Les nouvelles routes statiques ont priorité sur la route de profil `/$locale/$slug`.

Les pages utilisent `fineBinderyLocalizedHead`, le `lang` régional déjà résolu à la racine, et le gabarit légal existant. Le sélecteur de langue conserve le document et les paramètres de requête ; pied de page et liens de renvoi restent dans la langue active. Le sitemap liste les vingt documents canoniques et retire les quatre anciennes URL.

Contrôles : égalité du nombre de sections et paragraphes avec l’anglais pour chaque document, résolution de tous les marqueurs de contenu, identité et chiffres conservés, trois mentions de revue et une mention du médiateur dans chaque CGV ; vingt titres/descriptions uniques, canonical, hreflang cinq langues plus x-default réciproques, liens et sitemap. Les nombres seuls et les comptes de paragraphes ne constituent pas une validation juridique ou une preuve automatique d’équivalence sémantique : relecture humaine requise.

Branche indépendante `feat/finebindery-legal-locales`, sans changement des contrats acceptés, de la base, du transport ou de `src/marketplace/config.ts`. Aucune fusion ni publication.
