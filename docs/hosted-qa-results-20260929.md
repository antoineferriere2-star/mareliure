# Recette hébergée PR #52 — 29 septembre 2026

**Synthèse actuelle : [avis de publication](qa/20260929/publication-review.md).** Ce rapport conserve les étapes et blocages rencontrés ; leurs résolutions ultérieures (mobile, concurrence, reprises et traduction) sont documentées dans les compléments. Ne pas interpréter ses anciennes listes « non exécuté » comme l'état final.

## Complément : échecs de photos et bandeau d'autorisation

- Tests HTTP applicatifs avec Auth réelle sur `qwfhebtxeubfmvvdsqdt` : SVG refusé, dépassement de 5 Mo refusé, envoi depuis B vers le constat de A refusé. Inventaire réel des objets Storage avant/après : aucun objet ajouté dans ces trois cas.
- Requête d'envoi interrompue pendant le corps HTTP, avant traitement complet : aucun objet Storage créé. Reprise avec PNG valide : un objet privé supplémentaire effectivement présent. Cette preuve ne couvre pas une coupure entre l'écriture Storage et l'association SQL, ni une réponse perdue après COMMIT ; ces cas restent distincts et non validés.
- Les preuves privées sont dans `photo-failure-storage-evidence.json` ; aucun jeton ou lien signé ne doit être publié. Les tests antérieurs d'accès direct refusé et d'expiration du lien signé après 60 secondes restent applicables.
- Bandeau : le compte A est membre actif d'un atelier `draft`. Le détail d'un ouvrage propre est permis, l'appel réseau `getBinderCase` refuse cet atelier avant approbation. Il n'y a pas de contournement de droit constaté. Le texte ambigu est remplacé dans les cinq langues par la distinction entre projets du réseau et clients/ouvrages/devis propres ; aucun droit modifié.
- Contrôle navigateur du texte corrigé et du journal à 390 px : largeur de document 390 px, pas de débordement horizontal ; capture mobile conservée. L'application locale avait l'habillage atelier Ma Reliure ; ne pas la présenter comme une validation complète de l'habillage Fine Bindery.
- La mission publique Fine Bindery manquait sur l'instance : une fixture additive a été créée. La reprise navigateur a expiré ; le parcours public de bout en bout des deux marques reste non validé.

**Gate : aucune décision de publication positive tant que les contrôles restants et la CI du commit final ne sont pas verts.** Aucun rejeu de réconciliation ni migration supplémentaire, production, fusion, déploiement ou dépense.

## Environnement

Projet `qwfhebtxeubfmvvdsqdt`, ancien développement/test, explicitement réautorisé par le propriétaire après revue de la réconciliation V3.1. L'ancienne exclusion du 28 septembre est supersédée pour cette seule cible. Production `hljxohondjvrkzqicexl` exclue.

Une seule tentative Execute : `committed-postchecks-passed`. Sauvegarde fraîche restaurée avant écriture ; après COMMIT, 73 projections d'origine identiques, 62 migrations historiques conservées avec leur contenu et 33 ajouts, dont 0900 → 1100 → 1300. Ni effacement ni réécriture de l'histoire. Preuves détaillées hors Git dans `qa-reconciliation-qwf/EXECUTION-V31-20260929.md`, exécution `review-20260929T072055-e70b9a24`.

Application PR #52 locale, HEAD de départ `2494cfe`, reliée aux services Supabase hébergés de test. Aucun Worker publié. Deux comptes Auth et deux ateliers indépendants de recette, préfixe `QA-20260929-86e72b2d`, sont ajoutés aux données conservées. Les identifiants, justificatifs fictifs, objets privés et événements restent inventoriés hors Git ; aucune donnée historique supprimée.

## Scénarios réellement réussis

- Auth par mot de passe et JWT réels ; connexion atelier dans l'interface.
- RPC/table directement inaccessibles à anon/A/B ; service RPC avec acteur ou atelier croisé refusé.
- Aller colis, déclaration de livraison transporteur, retour prématuré refusé, réception physique avec écart ; description d'écart obligatoire.
- Deux appels HTTP concurrents sur la même version : une seule transition retenue, autre appel refusé pour version périmée. Retry exact : un seul événement.
- Retour colis, remise finale déclarée par l'atelier avec référence de preuve. Parcours séparé main propre aller/réception/retour/fin, puis incident après remise.
- PNG réellement déposé dans Storage privé et rattaché au constat ; accès direct/public refusé aux JWT anon/A/B. URL signée 60 secondes : HTTP 200 et octets identiques, puis accès refusé après expiration.
- Fonctions HTTP de l'application : lecture A réussie, lecture B/anon refusée ; SVG rejeté, puis PNG valide accepté ; dépôt par l'autre atelier refusé. Membre A désactivé temporairement : accès refusé, statut actif restauré ensuite.
- Interface : incident saisi et enregistré depuis le navigateur, historique précédent conservé ; ouvrage de B introuvable depuis la session A. Capture bureau et mobile 390 px ; aucun débordement horizontal, distinction transporteur/réception et preuve atelier visibles.

Les tests API de transport utilisent des références explicitement fictives. Aucun suivi transporteur réel ni achat d'étiquette. La fiche Sendcloud demeure préparatoire ; prix, signature et couverture ne sont pas confirmés.

## Types et contrôles locaux

Types régénérés sur ce projet via CLI (`public,graphql_public`). Report limité aux tables événements/photos et à la RPC de #52 ; ajouts paiements et écarts historiques de l'ancien projet exclus du diff de cette branche. TypeScript passe après ce report. Build générique réussi ; lint réussi avec 17 avertissements préexistants.

Premier passage complet : 3058 tests réussis, 8 expirations de délai et une erreur worker ; ce passage n'est pas vert. Les résultats des reprises sont ajoutés lorsqu'ils terminent. Aucune modification des seuils ou des assertions pour masquer ces expirations.

## Contrôles encore nécessaires

- Recette navigateur complète sous contexte Fine Bindery, et saisie de toutes les transitions sur mobile (le journal et un incident sont vérifiés, pas chaque action).
- Dépôt par le sélecteur de fichiers du navigateur, limite de huit photos, fichier trop volumineux et panne Storage/réponse perdue : le test HTTP SVG puis PNG ne couvre pas ces cas.
- Relecture finale et suite complète verte ; environnement Worker non testé, application locale seulement.

**Pas de feu vert publication global.** La recette réelle confirme Auth/RLS/Storage, expiration, accès croisés et concurrence décrits ci-dessus, sans se substituer aux contrôles restants. Aucune fusion, publication, migration production, opération Stripe ou dépense Sendcloud.

## Résultats finaux locaux

Reprise complète avec un worker et seuils inchangés : **226 fichiers, 3066 tests réussis**, zéro échec (282,95 s). Lint : zéro erreur, 17 avertissements. Build générique : réussi. Les modifications des types ont été limitées à 78 lignes environ, sans reformatage global du fichier.

Types bruts hébergés SHA256 : B3C032E51E0FD96723A7B3A510875A316D738EF8798050E208C7061665585DE4. Les branches restent séparées. Les rapports et types sont préparés localement ; aucune nouvelle CI distante ni publication annoncée.

## Complément de reprise Storage/SQL

Une injection de panne dans le serveur local, sur le seul RPC logistique du projet de test, a reproduit un défaut : Storage écrivait le fichier, puis la panne avant SQL laissait un objet isolé ; une nouvelle tentative créait un second objet. Le correctif dérive désormais l’identifiant de la photo de son contenu et de son atelier/ouvrage/constat/auteur. Un objet existant est relu et comparé octet par octet, jamais écrasé. La RPC existante reste idempotente. Aucune migration ajoutée.

Après correctif, essais hébergés réussis : panne avant SQL (1 objet, 0 association), reprise (1 objet, 1 association) ; réponse perdue après SQL (1 objet, 1 association), reprise inchangée ; deux reprises simultanées dans chacun de ces cas, toujours 1 objet et 1 association. Les inventaires sont lus dans Storage et dans le journal SQL, pas déduits de l’interface. L’objet isolé du test avant correction est conservé et identifié dans les preuves privées ; aucun nettoyage destructif.

Tests ciblés du calcul d’identité et de la comparaison des octets : 2/2 ; TypeScript et lint ciblé réussis. Les contrôles complets du nouveau commit sont à lire dans la CI associée.

Parcours public Fine Bindery : saisie des neuf étapes et dépôt par le sélecteur de fichiers, puis confirmation affichée. Une illustration de devis fictif remplace le livre de recette. L’envoi est lent dans le serveur local ; aucun second envoi déclenché. Anomalies distinctes : libellés du récapitulatif encore français (correctif partagé porté sur #51) ; phrase narrative du playbook historique français ; lien de résumé absolu vers Ma Reliure, non suivi depuis la recette. Ces observations ne constituent pas une recette complète de l’accès public au résumé ni de l’habillage atelier Fine Bindery.

Restent non exécutés : limite de huit fichiers distincts et course au dernier emplacement, toutes les transitions depuis les contrôles mobiles, parcours public Ma Reliure complet et accès public jusqu’à proposition/accord. Les scénarios HTTP déjà réussis ne les remplacent pas. Aucun feu vert publication tant que ces limites ne sont pas levées.
