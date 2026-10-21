# Parcours des ateliers — 21 octobre 2026

**L'absence de candidature en attente est confirmée, mais les données ne permettent pas de calculer un taux d'abandon de visiteurs réels.** Sur 60 jours : trois candidatures acceptées, toutes rattachées à des ateliers exclus comme démonstration/test ou administrateur ; aucune candidature restante après ces exclusions. Un espace atelier échappe aux exclusions, sans attribution démontrée à cette page. Le parcours fonctionne jusqu'à l'accès par e-mail sans erreur 500 observée ; la candidature alternative est profondément enfouie sur mobile.

Branche documentaire depuis origin/main, actualisée sur **38ebd31**. Aucune modification de code. Identité de Worker/migrations fournie par le brief, non réinterrogée. SQL à **09:36:01 UTC**, parcours en ligne à **12:43:46–12:43:49 UTC** ; ces deux relevés ne sont pas simultanés.

## Relevé de production, lecture seule

Connexion PostgreSQL TLS vérifiée, `BEGIN READ ONLY`, délai 45 s ; retour `transaction_read_only=on`. Requêtes publiées dans [queries.sql](partners-funnel-20261021/queries.sql), [comptages](partners-funnel-20261021/counts.json). Seuls des agrégats sortent de la base : aucun nom, e-mail, téléphone, identifiant de compte ou empreinte visiteur publié.

Fenêtres glissantes à 09:36 UTC : 30 jours depuis le 21 septembre ; 60 jours depuis le 22 août. Une vue correspond au chemin exact /partenaires-relieurs, avec ou sans slash terminal. Une création d'espace correspond à une ligne marketplace_binders, pas à un membre ajouté, une connexion, un compte Auth ou un abonnement.

| Indicateur | 30 jours | 60 jours |
| --- | --- | --- |
| Vues brutes | 115 | 123 |
| Empreintes visiteur brutes | 21 | 27 |
| Vues après exclusions identifiables | 113 | 121 |
| Empreintes après ces exclusions | 20 | 26 |
| Candidatures brutes | 2 | 3 |
| Candidatures après exclusions | 0 | 0 |
| Candidatures en attente, brutes et filtrées | 0 | 0 |
| Espaces créés, bruts | 3 | 4 |
| Espaces après exclusions | 1 | 1 |

Deux vues ont un référent local 127.0.0.1 et sont exclues. Les candidatures sont exclues par rapprochement avec leur atelier converti identifié démo/test/administrateur ; le seul filtre d'adresse e-mail de test ne les repérait pas. Les espaces is_demo, adresses de recette explicites (test/qa/e2e/recette/playwright/codex, domaines example/test/invalid) et propriétaires admin sont exclus. Les critères exacts restent lisibles dans le SQL ; aucune donnée n'est nettoyée ni modifiée.

**Limites du dénominateur :** visitorFingerprint change chaque jour ; 21 empreintes ne signifient donc pas 21 personnes différentes sur le mois. Les anciennes lignes ne contiennent ni UA ni IP exploitable pour retirer nos autres recettes avec certitude. #160 filtre certaines signatures à l'entrée sans corriger l'historique et ne reconnaît pas une recette avec UA Chrome ordinaire. Sur 60 jours : **119 vues desktop / quatre mobile**, 109 sans référent, 11 avec mareliure.fr, deux locales et une avec www.google.com. Sans référent ne signifie pas nécessairement accès direct humain. La semaine du 28/09 concentre 58 vues pour sept empreintes journalières.

Les 115/21 du brief sont retrouvés. Le rang « deuxième » correspond au classement brut des chemins de la table commune ; celle-ci ne conserve pas le domaine visité. Un classement exclusivement Ma Reliure, des personnes uniques sur 60 jours, l'origine du dernier espace et un parcours vue → clic → candidature ne sont donc pas certifiés. **Aucun 0 % de conversion déduit de ces chiffres.** Les trois candidatures historiques sont accepted et converties, pas des candidatures oubliées en attente.

## Parcours observé sans envoi

Chrome isolé sans session, bureau **1 280 × 900** et mobile **375 × 812 CSS px réels**, même page de production. Aucun texte saisi dans les champs ; aucun bouton de candidature, d'envoi de lien ou de code actionné. Toutes les méthodes autres que GET/HEAD et le suivi sont interceptées avant envoi, ainsi que tout hôte externe. Journal : **uniquement GET réellement envoyés** sur mareliure.fr ; le POST track-view est bloqué une fois par largeur. Le GET de résolution de marque à l'ouverture de /auth est identifié et son handler relu : résolution d'hôte, sans écriture. Aucun compte existant utilisé ni compte créé.

| Observation | Bureau | Mobile 375 px |
| --- | --- | --- |
| Hauteur totale de la page | 10 977 px | 15 330 px |
| Début de la section candidature | 8 265 px | 11 517 px |
| Liens Créer mon espace atelier | 5 | 5 |
| Champs visibles de candidature | 10, plus dix choix de savoir-faire | identique |
| Champs obligatoires | 6 | 6 |
| Page et accès atelier | HTTP 200, pas d'écran vide persistant | identique |

Sur mobile, la candidature commence à environ **14,2 hauteurs d'écran**. Le premier écran présente clairement l'outil pour ses propres clients et le bouton de création d'espace ; l'alternative de candidature sans compte apparaît après les démonstrations, le réseau, les prix et la FAQ. Le renvoi des particuliers vers la présentation de leur livre est visible, conformément à #151.

Obligatoires : prénom, nom, atelier, ville, e-mail et consentement. Facultatifs : téléphone, site/réseau social, expérience, message ; aucun savoir-faire imposé. Les contraintes natives vides renvoient bien « Veuillez renseigner ce champ » ou la demande de cocher le consentement, **sans soumettre**. Le serveur considère pourtant city facultatif et les limites de longueur serveur ne sont pas reportées dans les maxlength HTML. Ces écarts viennent de la relecture de code, pas d'un envoi testé. Le rattrapage serveur/réseau n'a pas été provoqué : son texte générique est relu dans PartnersLanding.tsx, sans verdict de fonctionnement inventé.

Le clic de création ouvre **/auth?space=atelier**, onglet Atelier partenaire déjà sélectionné, un seul e-mail obligatoire et une explication du lien/code et de la validation séparée. Le titre d'onglet reste toutefois **Retrouver mes livres — Ma Reliure** et l'en-tête mobile propose Présenter mon livre : le contexte devient celui du client alors que le parcours est professionnel. Arrêt avant Recevoir mon lien et mon code ; aucun e-mail, création d'espace, souscription ou règlement testé.

Le navigateur ne relève aucune exception JS, aucune réponse HTTP >=400 et aucun 500 dans ce parcours. La seule erreur de console de chaque largeur est net::ERR_FAILED pour le suivi délibérément bloqué ; elle n'est pas classée comme panne du site. [Journal UI](partners-funnel-20261021/ui.json), [script exécuté](partners-funnel-20261021/browser-check-executed.txt), captures [mobile accueil](partners-funnel-20261021/mobile-hero.png), [candidature](partners-funnel-20261021/mobile-candidature.png), [accès](partners-funnel-20261021/mobile-auth.png) et leurs versions bureau jointes.

## Offre et réassurance

Le premier écran annonce **15 € HT/mois**, les propres clients de l'atelier et l'absence de volume garanti. Plus bas, prix et FAQ précisent **18 € TTC en France métropolitaine**, page vitrine incluse, nouvel atelier et transition des anciens ; paiement direct sans frais plateforme, paiement en ligne facultatif à **3 % du TTC encaissé**, frais Stripe distincts à la charge de l'atelier. Pour les projets confiés, Oppe vend au client et l'atelier accepte une rémunération puis facture Oppe ; ce n'est pas la même opération que les frais de paiement de ses propres clients.

Ces informations existent, mais leur répartition sur une page très longue demande un effort de rapprochement. Rien n'autorise à conclure que le prix ou la commission cause les abandons : aucun entretien relieur ni suivi de clic n'a été réalisé. Les captures réelles de l'outil, documents au nom de l'atelier, liberté de refuser un projet et absence de volume garanti apportent déjà de la réassurance. Aucun avis, chiffre de réseau, gratuité ou délai nouveau à inventer.

## Propositions classées, à traiter dans des chantiers séparés

| Rang | Proposition | Constat qui la justifie et critère de vérification |
| --- | --- | --- |
| 1 | Fiabiliser le suivi des deux parcours : vue, clic création, ouverture candidature, début et résultat d'envoi, création réelle d'espace ; distinguer marque et recettes identifiables. | 115 vues ne donnent ni personnes uniques mensuelles ni clics, et trois candidatures historiques étaient des recettes. Mesurer des événements rapprochables dans une même visite avant de publier un taux d'abandon ; ne pas supprimer l'historique sur une simple supposition. |
| 2 | Proposer dès le haut deux intentions lisibles : utiliser l'espace atelier, ou présenter son atelier au réseau sans compte ; ajouter un accès direct à la candidature. | Cinq CTA de création, mais candidature à 11 517 px sur 375. Vérifier qu'un relieur atteint chaque option sans parcourir toute la page, puis suivre les deux choix séparément. |
| 3 | Rapprocher du CTA une synthèse des trois situations commerciales déjà décrites : abonnement, paiement en ligne facultatif, projets confiés par le réseau. | 15 € HT est visible immédiatement ; TVA, frais 3 %/Stripe et rémunération réseau sont expliqués beaucoup plus bas. Tester la compréhension de ces trois coûts avec quelques relieurs, sans changer les montants ni ajouter de promesse. |
| 4 | Harmoniser les champs obligatoires avec le serveur et rendre les erreurs de saisie précises avant envoi. | Six obligations visibles, city facultatif au serveur, URL exigée pour un site/réseau social et limites serveur sans maxlength HTML. Clarifier les formats et longueurs, préciser les erreurs de champ ; vérifier localement les refus sans e-mail réel. |
| 5 | Garder le contexte atelier à l'accès et rappeler les étapes réelles qui suivent le lien e-mail. | Onglet Atelier bien sélectionné, mais titre Retrouver mes livres et CTA Présenter mon livre. Vérifier titre/en-tête et explication des étapes sans laisser croire que l'e-mail a déjà créé, validé ou payé l'atelier. |

Ces propositions sont des hypothèses étayées par les observations ; aucune hausse de candidature garantie. Ce chantier reste **strictement documentaire et en lecture seule en production**, sans modification de code, envoi, compte, achat, paiement, migration, fusion ou déploiement.
