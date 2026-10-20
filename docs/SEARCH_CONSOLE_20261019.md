# Search Console — 19 octobre 2026

## État constaté

**`https://finebindery.com/en` n'est toujours pas indexée.** Google la classe comme doublon et retient `https://finebindery.com/` comme canonique, alors que la canonique déclarée est `/en`. L'inspection de la racine indique qu'elle est indexée ; sa dernière exploration affichée date du **7 octobre 2026 à 03:54:48**. Celle de `/en` date du **13 octobre 2026 à 10:47:48**. Ces horodatages sont recopiés tels qu'affichés par Search Console, sans conversion de fuseau.

Consultation du 19 octobre dans le navigateur du compte propriétaire, après changement de compte par le propriétaire. Le connecteur GSC Wizard refuse l'accès pour abonnement expiré ; les constats ci-dessous proviennent directement de l'interface officielle Search Console. Aucun abonnement souscrit, aucune demande d'indexation, validation de correction, modification de propriété ou de site.

## Inspections Fine Bindery

| URL inspectée | Indexation | Canonique déclarée | Canonique Google | Dernière exploration affichée |
|---|---|---|---|---|
| `https://finebindery.com/en` | Non : Google a choisi une autre canonique | `https://finebindery.com/en` | `https://finebindery.com/` | 13/10/2026, 10:47:48 |
| `https://finebindery.com/` | Indexée | `https://finebindery.com/en` | URL inspectée, donc la racine | 07/10/2026, 03:54:48 |

Les deux inspections indiquent Googlebot pour smartphone, exploration autorisée, récupération réussie et indexation autorisée. Dans l'inspection de la racine, la ligne Sitemaps porte « Erreur de traitement temporaire » ; cela ne constitue pas à lui seul un diagnostic d'erreur actuelle du sitemap publié. Dans le détail de `/en`, la validation antérieure est affichée en échec : début le 12 octobre, échec le 13 octobre. Aucun nouveau lancement de validation n'a été effectué.

Preuves consultables avec le compte autorisé : [inspection de /en](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afinebindery.com&id=E1vjRTR_8ef0Q6C0QYz2qQ), [inspection de la racine](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afinebindery.com&id=O8B74QraZFH4BudnJJid4A), [détail du doublon](https://search.google.com/search-console/index/drilldown?resource_id=sc-domain%3Afinebindery.com&item_key=CAMYECAC).

Ce sont les données de l'index et des explorations antérieures. Aucun test de l'URL active ni nouveau relevé HTTP des canoniques actuellement servies n'a été réalisé ici. Ces dates ne permettent pas de conclure que Google a déjà relu une version publiée après le 13 octobre, ni de garantir une date d'indexation de `/en`.

## Rapport Pages des deux domaines

Les deux rapports affichent une **dernière mise à jour au 12 octobre 2026**, malgré la consultation du 19. Périmètre sélectionné : toutes les pages connues, et non uniquement celles du sitemap.

| Domaine | Pages indexées | Non indexées | Motifs non nuls affichés |
|---|---:|---:|---|
| [mareliure.fr](https://search.google.com/search-console/index?resource_id=sc-domain%3Amareliure.fr) | 12 | 4 | robots.txt : 1 ; redirection : 1 ; détectées non indexées : 2 |
| [finebindery.com](https://search.google.com/search-console/index?resource_id=sc-domain%3Afinebindery.com) | 13 | 23 | canonique différente choisie par Google : 1 ; robots.txt : 7 ; redirections : 5 ; noindex : 4 ; autres pages avec canonique correcte : 2 ; 404 : 1 ; détectées non indexées : 3 |

Sur Ma Reliure, aucune catégorie de doublon n'est signalée dans la liste affichée ; la ligne « explorée, actuellement non indexée » vaut zéro. L'unique redirection citée est `http://mareliure.fr/`, dernière exploration le 5 octobre. La présence d'une URL HTTP dans cette catégorie ne prouve pas un défaut de la destination HTTPS.

Les cinq exemples Fine Bindery du [détail des redirections](https://search.google.com/search-console/index/drilldown?resource_id=sc-domain%3Afinebindery.com&item_key=CAMYCyAC) sont :

| URL source | Dernière exploration affichée |
|---|---|
| `http://www.finebindery.com/` | 13/10/2026 |
| `https://www.finebindery.com/` | 13/10/2026 |
| `https://finebindery.com/partenaires-relieurs` | 09/10/2026 |
| `https://finebindery.com/mentions-legales` | 09/10/2026 |
| `http://finebindery.com/` | 09/10/2026 |

Le rapport classe ces sources comme redirections ; leurs chaînes et codes HTTP actuels n'ont pas été testés. Les deux « autres pages avec canonique correcte » sont distinctes du doublon problématique `/en` : leur nombre n'est pas additionné à celui des canoniques contestées. Les exemples de ces deux pages, des exclusions robots/noindex et de la 404 n'ont pas été ouverts ; aucun diagnostic individuel n'est inventé.

## Core Web Vitals

[Fine Bindery](https://search.google.com/search-console/core-web-vitals?resource_id=sc-domain%3Afinebindery.com) et [Ma Reliure](https://search.google.com/search-console/core-web-vitals?resource_id=sc-domain%3Amareliure.fr) affichent une dernière mise à jour au **17 octobre 2026**. Pour chacun, sur mobile et ordinateur : « Pas assez de données d'utilisation ces 90 derniers jours pour ce type d'appareil » ; ouverture des rapports détaillés désactivée.

Il n'y a donc aucun classement terrain exploitable dans ces rapports. Ce constat ne signifie ni réussite ni échec des Core Web Vitals et ne remplace pas une mesure Lighthouse.

## Point à suivre

La priorité documentaire reste le désaccord canonique racine/`/en`, avec une exploration de la racine plus ancienne que celle de `/en`. Lors d'un prochain point demandé par le propriétaire, comparer ces deux dates et canoniques avant de déclarer le problème résolu. Aucun suivi automatique n'est créé et aucune action d'indexation ou de modification n'est effectuée dans ce chantier.

## Complément du 20 octobre 2026 (Claude Code, inspection d'URL en lecture seule)

`https://finebindery.com/en` est désormais **indexée** (« Cette URL est sur Google ») : dernière exploration le 13 octobre 2026, URL canonique déclarée `https://finebindery.com/en`. Le rapport « Pages » (données au 12/10) affiche encore 13 pages indexées, 23 non indexées et l'échec de validation « Page en double » ouvert avant cette exploration. Le seul 404 relevé, `https://finebindery.com/$locale/`, provient du manifeste du routeur sérialisé dans les pages, pas d'un lien ; la réponse 404 est correcte. Aucune demande d'indexation ni modification.
