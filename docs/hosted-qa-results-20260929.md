# Recette hébergée PR #51 — 29 septembre 2026

## Cible et conservation

Projet autorisé explicitement par le propriétaire : `qwfhebtxeubfmvvdsqdt`, ancien développement/test. L'exclusion de cette référence dans les procédures du 28 septembre est supersédée par cette autorisation ciblée. La production `hljxohondjvrkzqicexl` n'a pas été utilisée.

Une seule exécution du lanceur V3.1 approuvé, résultat `committed-postchecks-passed`, le 29 septembre de 07:20:55 à 07:26:36 UTC. Sauvegarde fraîche restaurée localement avant écriture. Contrôle indépendant après COMMIT : 73 projections d'origine identiques, 62 migrations historiques conservées avec leur contenu, 33 ajouts (95 au total), ordre 0900 → 1100 → 1300 respecté. Les 6 comptes, 6 ateliers, 9 dossiers réseau, 2 devis historiques et les données Métré étaient conservés avant ajout des fixtures.

Lanceur SHA256 `86D1609C065E023927F368FCEBDA06D8E5FB599D8BA4067F599FC961A58B791D`. SQL SHA256 `6DFB4879B7F57B70EED9615AC0EF67A8047CBC6706F1CF9EE182FAC855578071`. Le rapport complet et les preuves privées sont conservés hors Git dans `qa-reconciliation-qwf/EXECUTION-V31-20260929.md` et `review-20260929T072055-e70b9a24`. Aucun secret, dump, JWT ou lien signé ne doit être joint à la PR.

## Fonctionnel réellement exercé

Base/API/Auth/Storage Supabase hébergés ; application PR #51 servie localement, HEAD de départ `0a89d8f`. Ce n'est pas un Worker de recette déployé. Fixtures identifiées `QA-20260929-86e72b2d` : deux nouveaux comptes Auth indépendants avec sessions réelles, deux ateliers, contacts/ouvrages fictifs. Pas d'e-mail envoyé ni de paiement. Les fixtures restent identifiées dans un manifeste privé ; aucune donnée d'origine supprimée.

- Connexion atelier réelle dans l'application ; facture et journal affichés sur bureau et mobile (375 px, aucune largeur débordante constatée).
- Devis de fixture inséré à l'état envoyé : refus d'acceptation sans accord, refus de révision périmée, accord référencé sur révision courante, création et émission d'une facture par RPC hébergées.
- Déclarations 40 puis 60 EUR ; deux appels HTTP simultanés avec la même clé ne créent qu'un règlement. Justificatif doublonné et dépassement refusés.
- Remboursements déclarés 30 puis 70 EUR ; remboursement excessif refusé. Litige ouvert/clos et refus de règlement pendant litige.
- Avoir intégral, refus de nouvelle recette après avoir, remboursement du solde de 10 EUR et net final nul.
- RPC de journal directement refusées aux JWT anon/A/B ; lectures directes de facture sans fuite ; acteur d'un autre atelier refusé.
- Fonctions HTTP applicatives : devis et facture PDF répondent 200 avec octets PDF pour A ; aucun PDF pour B ou sans session. Les fichiers sont conservés dans les preuves privées. Le téléchargement par bouton n'a pas fourni une preuve navigateur exploitable (timeouts de l'outil) ; ne pas confondre avec le contrôle HTTP réussi.
- Deux nouveaux dossiers réseau de fixture, un par marque : transitions backend brouillon → proposé → accepté ; circuit `legacy_resale`, qualification `review_required`, montant conservé. L'acceptation sans validation fiscale a été refusée ; la fixture a ensuite reçu ses champs fiscaux fictifs avant acceptation. Mutation des termes acceptés refusée. **Ces dossiers ont été créés via API de recette, pas par les parcours publics.**

## Types et vérifications

Types régénérés via CLI depuis la référence explicite de recette, schémas `public,graphql_public`. Le fichier complet contient les deux PR et des écarts historiques (grille tarifaire, messages/décisions/projets) ; aucune table existante n'y manque. Report uniquement des trois tables paiements, colonnes de snapshots/circuit et signatures RPC de #51. Aucun ajout logistique intégré à cette branche. TypeScript passe après ce report.

Build générique réussi. Premier test complet : 3093 réussis, 6 expirations de délai, 9 non exécutés après expiration du hook PGlite et une erreur worker ; ce passage n'est pas vert. Reprise ciblée avec un worker : 19/19 tests PostgreSQL paiements réussis, sans augmenter les délais. Lint global initial : une erreur dans une ancienne fixture **non suivie** sous `output/home-condition/fixture-route.tsx`, préservée ; contrôle des sources suivies séparé. Les nouveaux résultats complets sont consignés ci-dessous lorsqu'ils terminent.

## Conditions encore ouvertes — pas de feu vert publication

- Recette publique complète des deux marques (création/envoi/accord depuis leurs écrans), et contrôle avec membre désactivé sur les PDF.
- Export PDF d'avoir : la tentative par la fonction PDF de facture retourne « Introuvable » ; ce chemin n'est pas validé. L'avoir existe et ses effets comptables ont été testés. Il faut vérifier/livrer son chemin documentaire dédié, sans présenter cet appel à la mauvaise ressource comme une fuite ou une 500.
- Inspection visuelle du contenu des PDF et téléchargement par l'interface à terminer.
- Suite complète verte et revue finale des changements locaux avant mise à jour de la PR/CI.

**Réponse au risque de déploiement : la recette backend hébergée confirme que le circuit externe ne bloque plus les nouveaux dossiers réseau des deux marques. Cela ne suffit pas à déclarer toute la PR publiable.** Carte 3 %, commission 25 %, conciergerie payante et abonnement restent verrouillés. Aucun prix Stripe créé, aucune fusion, aucun déploiement.

## Résultats finaux locaux

- Nouvelle suite complète à deux workers : 3106 réussis sur 3108, deux timeouts de 5 secondes dans secretsContract.test.ts ; aucun échec d'assertion signalé. Ce passage complet n'est donc pas présenté comme vert.
- Reprise isolée de secretsContract.test.ts, mêmes délais : 6/6 réussis (dont les deux précédemment expirés).
- Reprise PostgreSQL ciblée : 19/19 réussis. TypeScript final : succès. Lint hors anciens artefacts non suivis output : succès, 17 avertissements.
- Fichier brut des types générés (conservé hors Git), SHA256 : B3C032E51E0FD96723A7B3A510875A316D738EF8798050E208C7061665585DE4.
- Changements conservés localement sur la branche actuelle ; aucune nouvelle CI distante, fusion ou publication annoncée.

## Complément de recette — export d'avoir et diagnostic des délais

- Défaut confirmé : aucun export dédié à l'avoir. Ajout de `getMyCreditNotePdf`, avec session authentifiée, membre actif et filtre atelier sur l'avoir, ses lignes et sa facture. Le PDF utilise les snapshots immuables, référence la facture, affiche le motif et ne demande aucun règlement. Boutons de téléchargement et impression ajoutés à la facture créditée. Aucune migration.
- HTTP réel sur la base hébergée : devis, facture et avoir répondent avec un PDF pour A ; aucun PDF pour B ou sans session (ne pas se limiter au code HTTP, certaines erreurs métier sont sérialisées). Les trois fichiers ont été rendus en PNG ; l'avoir a été inspecté visuellement, sans chevauchement visible sur la fixture à une ligne. Le téléchargement par le bouton reste non validé.
- Tests ciblés : 67 tests du service devis et 4 tests de géométrie PDF réussis. Le nouveau test couvre snapshot, référence, motif, absence d'appel au paiement et isolation entre ateliers.
- Scans de sécurité : deux timeouts reproduits en exécution ciblée sous le sandbox Windows ; les six tests passent hors sandbox en 1,85 s, avec les mêmes délais. Le parcours des fichiers utilise désormais les entrées typées de répertoire, sans retirer de fichier ni d'assertion. Ce résultat isolé n'est pas assimilé à une suite complète verte.
- Node 24.14.0, `CI=true`, commande CI `npm test -- --run` : 3 107 réussites / 3 109, deux timeouts (scan des sources et scan du bundle Worker). Reprise à deux workers : 3 105 réussites / 3 109, quatre échecs et une erreur worker ; diagnostic final à compléter avant validation. Aucun délai augmenté. Typecheck réussi.
- Parcours public Fine Bindery : la mission attendue était absente du projet de test, ce qui empêchait le chargement. Ajout identifié QA d'une mission et de son inscription Fine Bindery, sans modifier la mission Ma Reliure ni le Playbook historique. La reprise navigateur a expiré : aucune soumission publique complète n'est revendiquée. Ma Reliure public, confirmation finale et contrôle documentaire depuis leurs écrans restent ouverts.

**Gate : non publiable à ce stade.** La preuve HTTP du PDF d'avoir ne remplace ni le parcours public complet ni une CI complète verte sur le nouveau commit. Aucun rejeu de réconciliation, migration supplémentaire, accès production, fusion, déploiement ou paiement.

## Complément du récapitulatif public et état CI

Fine Bindery : un projet fictif a été saisi dans les neuf étapes du navigateur, avec dépôt via le sélecteur de fichiers, puis confirmation. Le dossier hébergé porte bien FINE_BINDERY ; cette saisie utilise le serveur local de #52 et la base combinée, pas le futur Worker. La vérification des propositions historiques/revente reste celle du scénario backend décrit plus haut. Le parcours public jusqu’à proposition et accord n’est pas encore couvert.

Le récapitulatif affichait les libellés de choix du playbook français dans le parcours anglais. Correction dans ReviewAnswers : traduction de chaque choix configuré, y compris listes, sans traduction du texte libre ni modification des données enregistrées. Régression couverte par le rendu des composants : 8 tests réussis. Le récit généré depuis le playbook historique et le lien absolu de résumé restent à qualifier ; aucun lien pointant vers la production n’a été suivi depuis cette recette.

La CI complète du précédent commit 1a36acd est verte (run 36550541664). Les timeouts locaux sont des lectures de fichiers sensibles à la charge Windows ; aucun seuil ni assertion n’a été assoupli. Le nouveau commit doit repasser sa propre CI. Le téléchargement de l’avoir depuis le bouton et le parcours public Ma Reliure complet ne sont toujours pas validés : le serveur local et les navigations expirent de façon intermittente. Les preuves HTTP de PDF, leur inspection visuelle et les refus inter-ateliers sont acquis séparément.

Aucune réconciliation rejouée, aucune migration supplémentaire et aucune action en production. Ce complément ne donne pas de feu vert publication.
