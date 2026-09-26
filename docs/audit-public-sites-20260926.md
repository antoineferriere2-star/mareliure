# Audit public — Ma Reliure et Fine Bindery, 26 septembre 2026

## Périmètre et méthode

Un seul dépôt (`mareliure`) sert les deux marques : sélection de marque côté serveur, routes TanStack dans `src/routes`, pages Ma Reliure dans `src/marketplace/pages`, Fine Bindery dans `pages/fineBindery`, dictionnaires complets EN/FR/DE/IT/ES dans `marketplace/i18n/locales`. Le parcours projet et son récapitulatif utilisent le moteur partagé `src/build/pages/public` ; ses nouveaux paramètres de liens restent génériques.

Base vérifiée : `origin/main` bbd4b57, après lecture des PR récentes et du handoff. Audit joint lu intégralement et confronté aux sources avant modifications. Lecture seule de pages de production, puis recette du changement sur deux origines locales nouvelles, sans session client préexistante. Aucun compte créé, aucune demande envoyée, aucune suppression ni migration de production. Pas de fusion ni de déploiement dans ce lot.

## Constats et traitement

| Point de l’audit | Résultat de vérification | Traitement |
| --- | --- | --- |
| 1. CTA Fine Bindery vers annuaire vide | Confirmé : aucun profil publié retourné, malgré la présentation éditoriale Ferrière. | CTA principal vers le parcours projet localisé ; annuaire secondaire, état vide honnête. |
| 2. Prix ferme avant inspection | Confirmé dans plusieurs textes. | Accueil, tarifs, étapes, parcours, révision et textes contractuels concernés distinguent proposition sur photos, examen à réception et accord avant travail ou changement de prix. |
| 3. Plusieurs ateliers disponibles | Non démontré : une vitrine éditoriale Ferrière, aucun profil publié FB. | Présentation du réseau en construction et disponibilité à vérifier ; retrait de l’affirmation de publication de Ferrière. |
| 4. Absence de prix publics | Confirmé, mais aucune grille publique approuvée identifiée. | Aucun prix inventé ni tarif interne exposé. Décision ci-dessous. |
| 5. Transport, assurance, retour | Informations insuffisantes pour promettre ces conditions. | Ne pas envoyer avant instructions ; modalités à convenir. Pas de nouvelle promesse logistique. |
| 6. Visage, téléphone, contact | Coordonnées publiques limitées ; observation éditoriale confirmée. | Pas de personne, de téléphone ou de disponibilité inventés. |
| 7. Économie du réseau atelier | Conditions complètes non établies. | Gratuité de l’outil et réserve Stripe déjà approuvées conservées ; aucune commission ni échéance ajoutée. |
| 8. Entrée atelier Fine Bindery | Absente de la navigation publique. | Entrée espace atelier et explication distincte de l’examen préalable à publication du profil. |
| 9. Racine FB et /en incohérents | Confirmé : ancien positionnement dans les métadonnées de `/`. | Métadonnées partagées, canonical `/en`, racine retirée du sitemap. Pas de 301 : la racine traite aussi les retours d’authentification par fragment. |
| 10. Relation entre marques | Insuffisamment expliquée. | Liens réciproques et rôles explicites : France pour Ma Reliure, clientèle internationale et développement européen progressif pour Fine Bindery. |
| 11. Peu de pages prestations SEO | Confirmé, pas un défaut technique en soi. | Aucune page générique créée pour gonfler le nombre de pages. |
| 12. Français dans le parcours anglais | Confirmé pour des spécialités et libellés de récapitulatif. | Glossaire, statuts et libellés corrigés ; langue du récapitulatif issue du projet. Les contenus libres atelier restent dans leur langue d’origine. |
| 13. Délai de réponse absent | Confirmé, aucun engagement opérationnel trouvé. | Aucun délai numérique ajouté. |
| 14. Jargon du moteur projet | Confirmé : « Live project canvas », statut dérivé peu clair. | « Récapitulatif du projet » et équivalents localisés ; statut français « D’après vos réponses ». URLs techniques sécurisées conservées. |
| 15. Candidature ou espace atelier | Les deux chemins étaient déjà expliqués dans la refonte #47. | Entrées conservées, vocabulaire « Nouvelle reliure contemporaine » corrigé. Pas de refonte de l’inscription. |
| 16. Illustrations et grille | Certaines images importantes FB avaient un alt vide ; la grille interne n’est pas destinée au public. | Alternatives localisées pour disciplines et illustration Ferrière. Alts décoratifs conservés lorsqu’appropriés. |
| 17. Étapes succinctes | Confirmé comme manque éditorial. | Explication du prix ajoutée ; pas de scénario de transport inventé. |
| 18. Navigation mobile | Atelier absent sur Ma Reliure : confirmé. Langues/connexion FB déjà présentes dans le menu natif : constat de l’audit partiellement dépassé. | Lien Relieurs visible sur mobile ; menu FB vérifié visuellement, entrée atelier ajoutée. |
| 19. Composition des photos | Appréciation esthétique, pas un bug confirmé. | Photographies approuvées conservées, aucune refonte. |
| 20. Avis et chiffres d’activité | Absence confirmée, aucune preuve exploitable. | Aucun avis ni chiffre créé. |
| 21. Image OpenGraph FB | Manquante sur les pages générales. | Image Ferrière existante, enregistrée et autorisée, utilisée comme repli. |
| 22. Place de la connexion | Choix éditorial, pas une panne. | Connexion conservée ; accès atelier clarifié. |

Le retour direct vers un ancien projet envoyé, observé dans le navigateur déjà utilisé de l’audit, n’est pas reproduit sur les nouvelles origines locales : le parcours s’ouvre à son début. Cela ne démontre pas que tous les scénarios de reprise de session sont exempts de défauts.

Deux défauts supplémentaires constatés pendant la recette sont corrigés : le sélecteur de langue utilisait des chemins différents entre HTML serveur et navigateur (perte du chemin profond et risque d’hydratation) ; la navigation bureau devenait trop serrée après ajout de l’entrée atelier. Les liens utilisent maintenant la localisation du routeur et les seuils responsive ont été ajustés.

## Parcours et fichiers concernés

- Ma Reliure : accueil, `/tarifs`, navigation publique, entrée mobile Relieurs, textes du parcours client et paragraphes de prix des pages légales. Principaux fichiers : `ReliureLanding.tsx`, `TarifsPage.tsx`, `landing/content.ts`, `LandingChrome.tsx`, `ReliureIntakeCopy.tsx`, `LegalPages.tsx`.
- Fine Bindery : `/`, les cinq accueils localisés, annuaire, CTA projet, navigation et footer, illustrations, cinq dictionnaires, glossaire et sélecteur de langue. Principaux fichiers : `FineBinderyLanding.tsx`, `FineBinderyChrome.tsx`, `FineBinderyLanguageSwitch.tsx`, `fineBinderySeo.ts`, routes localisées et sitemap.
- Moteur partagé : nom accessible du lien d’accueil pendant chargement, liens légaux paramétrables, intitulé du récapitulatif, statuts traduits et locale du résumé chargé. Aucun calcul de prix ni logique d’affectation modifié.
- SEO : métadonnées racine alignées, image OG, hreflang existants conservés, annuaire vide `noindex, follow` et absent du sitemap jusqu’à présence de profils publiés. Aucun profil fictif indexable.

## Vérifications réalisées

- TypeScript : succès, y compris dernière passe après corrections de recette.
- Suite complète exécutée avec un seul worker : **226 fichiers, 3 067 tests réussis**. Première exécution parallèle affectée par des timeouts sous Windows ; aucun délai de test assoupli. Après les dernières corrections de langue/navigation : **18 fichiers, 447 tests ciblés réussis**.
- Lint des zones modifiées : **0 erreur**, quatre avertissements existants. `git diff --check` propre.
- `npm run build:mareliure` : succès ; contrôles du projet Supabase client et de l’interopérabilité serveur inclus et réussis.
- HTML initial : 17 requêtes locales, toutes HTTP 200 ; titres, H1 rendus serveur, langue HTML, canonical, alternates, OG et sitemap examinés. Racine FB canonical `/en`, annuaire réellement vide non indexable.
- Accueils Fine Bindery : captures et contrôle géométrique des cinq langues sur bureau 1 365 × 900 et mobile 390 × 844 ; aucun débordement horizontal aux dimensions testées. Vérification visuelle des planches comparatives, du menu mobile allemand et du menu bureau italien.
- Parcours allemand neuf : texte d’introduction, consentement/prix, validation obligatoire traduite, liens légaux et accès atelier vérifiés. Aucune soumission finale.
- Ma Reliure : accueil et tarifs mobiles, accès Relieurs puis page atelier, page de connexion atelier sur bureau et mobile. Aucun compte créé ni e-mail déclenché.
- Langues profondes : changement DE vers IT dans l’annuaire conserve `/professionals`. Profils et résumés dans les cinq langues vérifiés avec fixtures temporaires locales ; profil italien et résumé allemand vus sur mobile. Filtre espagnol puis remise à zéro vérifiés. Routes QA retirées et `routeTree.gen.ts` restauré sans diff.
- Preuves locales, non committées : `output/audit-20260926/` (captures, `visual.json`, `http.json`) ; journaux `output/audit-*.log`.

## Décisions métier nécessaires

1. **Prix publics** : rester sur proposition après photos, ou publier quelques exemples/planchers approuvés avec prestation, unité et limites précises. Fournir les montants avant publication ; la grille interne ne vaut pas validation marketing.
2. **Réponse** : rester sans délai chiffré, ou choisir un engagement mesurable en jours ouvrés et son responsable.
3. **Transport et retour** : organisation par le client ou par l’atelier ; préciser payeur aller/retour, assurance, valeur déclarée, procédure en cas de refus après examen et éventuelles formalités internationales.
4. **Conditions atelier** : outil et réseau à distinguer ; confirmer commissions éventuelles, paiement, responsabilité et publication. La fonctionnalité Stripe en préparation ne constitue pas une offre de paiement disponible.
5. **Présentation et contact** : approuver les personnes/coordonnées publiques et publier les vrais profils d’ateliers seulement après validation. Une photographie autorisée ne prouve pas la disponibilité d’un atelier dans l’annuaire.

## Limites et suites explicites

- Pas de recette physique iOS/Android ; viewport mobile de navigateur seulement. Pas d’audit exhaustif axe ou lecteur d’écran.
- Pas de test complet de création de compte, réception d’e-mail, autorisation atelier, affectation ou envoi client en production : ces actions créeraient des données ou messages réels. L’entrée et les écrans anonymes sont vérifiés, pas la livraison d’un projet.
- Les profils et la confirmation ont été testés avec données locales clairement identifiées ; ils ne prouvent pas une soumission serveur de bout en bout. Aucun profil publié FB n’était disponible pour cette recette en production.
- Pages légales FB encore en anglais, désormais annoncées comme telles ; pas de traduction juridique DE/IT/ES inventée. Les espaces connectés, courriels et textes libres ne sont pas certifiés intégralement traduits par ce lot.
- Le titre/les liens de marque de l’ancienne route sécurisée `/project-summary/$accessToken` et du chemin historique `/m/...` méritent encore une passe spécifique Fine Bindery. Le parcours principal `/{locale}/project` reçoit les bons liens ; le récapitulatif chargé utilise maintenant sa propre langue.
- Poids JavaScript public non optimisé ; changement ciblé sans chantier de découpage des bundles. `finebindery.eu` non testé, périmètre demandé : `.com`.
- Aucun nettoyage des anciens projets QA de production, conformément à l’interdiction de supprimer des données. Aucun engagement métier supplémentaire ajouté. Pas de certification juridique.

## Complément PR #50 — invitations vers l’annuaire

La racine Fine Bindery, les cinq accueils localisés et l’ancien aperçu `/fine-bindery` lisent désormais la même liste de profils approuvés/publiés que l’annuaire. La décision est calculée lors du chargement, pas inscrite dans un réglage manuel. Un échec de lecture masque les invitations sans empêcher l’accès au projet.

- **Zéro profil :** les quatre liens de découverte dans le contenu et la section à deux parcours sont masqués. Les CTA de projet restent présents. Les liens « Ateliers » de la navigation bureau, du menu mobile et du footer de l’accueil mènent à `/{locale}#workshops`, présentation qui explique le développement du réseau et distingue les photographies Ferrière d’un profil publié.
- **Au moins un profil :** les quatre liens du contenu et la section à deux parcours réapparaissent ; navigation et footer de l’accueil mènent à `/{locale}/professionals`. Si le dernier profil est retiré, le chargement suivant revient à l’état vide.
- Les autres pages conservent le libellé neutre « Ateliers » et les équivalents existants. L’accès direct à l’annuaire vide affiche son explication et son CTA de projet. Ses règles `noindex, follow` et d’exclusion du sitemap sont inchangées.
- Sept nouveaux tests couvrent publication/retrait, erreur de lecture et rendu des deux états dans les cinq langues (contenu, navigation bureau/mobile et footer). Les tests SEO et sitemap existants sont conservés.
- Recette : les cinq accueils réels locaux sans profil et cinq accueils avec disponibilité simulée localement, chacun sur bureau 1 365 × 900 et mobile 390 × 844. Aucun débordement horizontal ; 0 lien annuaire en état vide, 7 dans le DOM en état publié (4 contenu + navigation bureau/mobile + footer). Clic mobile « Ateliers » vérifié vers la section du réseau. Fixtures retirées et routeTree sans diff ; aucune donnée de production écrite.
- HTML initial de `/`, des cinq accueils, de l’annuaire et du sitemap : huit réponses 200, aucun lien d’annuaire sur les accueils vides, `noindex` présent sur l’annuaire vide, aucune entrée annuaire dans le sitemap. Preuves locales : `output/home-condition/` et `output/home-http.log`.
- Validation du complément : sept tests nouveaux verts ; TypeScript, lint et build verts. Suite complète : 3 070 tests réussis et quatre timeouts de lecture des sources/bundles ; trois passent à la relance, le contrôle de lecture du bundle Worker dépasse encore localement ses 5 s (même isolé). Aucun délai modifié. Le contrôle Worker inclus au build passe. La CI du nouveau SHA doit confirmer le gate complet.
