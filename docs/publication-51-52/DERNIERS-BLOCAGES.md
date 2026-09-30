# Derniers blocages #53 — 30 septembre 2026

## Verdict

**Bloqué par une seule décision de capacité : autoriser Workers Paid, minimum 5 USD/mois et dépassements éventuels.** Aucun forfait changé. Gel métier et lanceur éprouvés ; décision de publication toujours nécessaire avant toute fusion ou écriture en production. Execute demeure matériellement désactivé.

Les recettes fonctionnelles #51/#52 et la clôture de l'incident sont conservées, sans nouvel audit. Périmètre : règlement externe déclaré + journal atelier. Carte 3 %, commission 25 %, conciergerie payante, abonnement et suivi client après paiement restent verrouillés/exclus. Aucune migration distante ou opération payante ici.

## CPU : coût localisé, abandon de la refonte Free

Worker privé `mareliure-ops-qa-20260930-v2`, uniquement qwf, sans route personnalisée, previews fermées. Versions création `2d2c923f-b015-44ea-837c-707de1b57b83`, secrets qwf `670d91e5-6a0f-4e31-b214-a0f63d02777d`. Huit probes espacées de quatre secondes ; métriques Cloudflare `workersInvocationsAdaptive` en microsecondes converties en ms, pas durée réseau. Voir `evidence-final/qa-cpu-*`.

| Chemin cumulatif | 4 Mio | 5 Mio |
|---|---:|---:|
| request.json, lecture base64 | 9,926 ms | 14,403 ms |
| + décodage Buffer | 10,399 ms | 17,923 ms |
| + réencodage canonique | 19,705 ms | 21,141 ms |
| + SHA256 pour reprise/idempotence | 23,703 ms | 25,415 ms |

Huit invocations, pas des percentiles de charge ni des coûts unitaires par soustraction fiable. Pas encore de framework/Auth/SQL/Storage. **La lecture JSON seule dépasse 10 ms à 5 Mio** : retirer validation/hash ne résout pas ce point et dégrade les garanties. Free exige un autre transport binaire/upload signé avec finalisation et traitement des objets isolés : refonte importante, piste arrêtée conformément à la consigne. Aucun code produit modifié. Confidentialité, validation, huit photos et reprises restent le parcours déjà éprouvé.

Le vrai parcours déjà mesuré dans RECETTE-HEBERGEE-20260930.md a réussi fichiers 4/5 Mio, reprises, refus et lecture privée exacte. CPU des reprises : 33,993 à 121,839 ms selon les fenêtres. Les dépassements tolérés temporairement ne garantissent pas Free. Les probes ne déposent aucun objet.

**Alternative minimale vérifiée :** Workers Paid, 5 USD/mois minimum, 10 millions de requêtes et 30 millions CPU-ms inclus ; extras 0,30 USD/million de requêtes et 0,02 USD/million CPU-ms. Allocations partagées avec les autres Workers du compte, taxes/change et trafic futur non garantis. Usage septembre déjà relevé : 33,01k requêtes / 503 298 CPU-ms, inférieur aux inclusions, pas une prévision. [Tarification officielle](https://developers.cloudflare.com/workers/platform/pricing/), vérifiée le 30 septembre.

Paid : 30 000 ms CPU/requête par défaut. Maximum observé 121,839 ms : marge arithmétique 29 878,161 ms (~246 fois), pas mesure Paid ni garantie de charge. [Limites officielles](https://developers.cloudflare.com/workers/platform/limits/). Après accord seulement, vérifier forfait effectif et absence d'override restrictif ; choisir explicitement un plafond borné, par exemple 1 000 ms (marge 878,161 ms, ~8,2 fois). Si ce réglage est ajouté, reconstruire le conditionnement/manifeste. Aucun achat automatique.

## Maintenance métier hébergée réussie

Cible de la fenêtre **qwfhebtxeubfmvvdsqdt**, aucune autre. Première commande READ ONLY arrêtée sur stderr informatif CLI « Initialising login role », avant installation ; inspection puis correction du traitement native CLI avec contrôle exit. Ce n'était pas une tentative de migration. Garde retiré à 16:16:48 UTC, reprise/cleanup vérifiés à 16:18:31 UTC ; les preuves ne garantissent pas la durée exacte de toute la fenêtre.

53 tables `marketplace_*` + `user_roles` protégées par statement triggers BEFORE INSERT/UPDATE/DELETE/TRUNCATE, opérateur postgres. Métré/Auth/Storage non gelés. `business-guard-*.REVIEW.sql` sont des corps examinables, **pas des commandes distantes autonomes** : connexion cible/TLS vérifiée et nouvelle autorisation obligatoires. Aucun droit accordé ; retrait précis sans CASCADE.

- Neuf INSERT REST service-role réels refusés SQLSTATE **55000** : dossiers, propositions, devis, factures, règlements, événements, photos, ouvrages et journal webhook. REST 500 attendu pour ce refus SQL ; front public garde HTTP 503. Corps incomplets : trigger exécuté avant NOT NULL, aucune ligne créée.
- PATCH réel d'un ouvrage QA refusé ; deux appends RPC logistiques concurrents valides refusés, zéro événement ajouté. Écriture acteur aussi refusée, sans confondre cette assertion avec une nouvelle recette RLS ordinaire.
- Empreinte métier avant/pendant/après identique `10e8009b66808189b4091facec7a150f`. **95 migrations qwf** conservées, aucune réconciliation rejouée.
- Auth et upload Storage privé continuent volontairement : sessions 92 → 93, objets 40 → 41 ; dérive des empreintes détectée. Octets privés relus identiques. Seul objet créé ici retiré ; session Auth conservée.
- Retrait des 53 gardes puis PATCH du même ouvrage réussi : valeurs métier conservées, changement attendu de `updated_at`. Aucune donnée métier existante supprimée.

Preuves `evidence-final/qwf-*.json`. Maintenance HTTP/previews/webhooks déjà éprouvés, non répétés ; aucun appel Stripe. Les deux marques partagent ces tables. Un autre opérateur postgres reste capable d'écrire : fenêtre sans DDL/scripts administratifs ni autre recette impérative. Aucun faux gel global Auth/Storage.

Transposition : garde HTTP quatre domaines + workers.dev + previews/alias, vérifier refus sans acquittement webhook, garde métier, drain des transactions avant sauvegarde. Inventaire précédent : aucune Edge Function déployée, cron.job absent ; coordonner tout écrivain administratif supplémentaire. Retirer le garde et restaurer les réglages exportés seulement après publication validée, jamais entre SQL et Worker.

## Lanceur final, protections éprouvées localement

Entrée `run-production-preparation.ps1` : Validate génère uniquement ; ValidateConnected impose READ ONLY ; Execute refusé avant lecture d'un secret. `productionExecuteEnabled=false`, CLI sans Execute ; ni variable ni configuration ne peuvent armer la mutation. Chemin dormant disponible pour revue, inutilisable aujourd'hui.

Connexion épinglée : production `hljxohondjvrkzqicexl`, `aws-1-eu-west-1.pooler.supabase.com:5432`, `postgres.hljxohondjvrkzqicexl`, base postgres, verify-full. CA et binaire psql SHA256 épinglés ; PG héritées supprimées, pas de service/hostaddr alternatif. Mot de passe fichier ACL protégé, jamais argument/log public. Session/current postgres non superutilisateur et TLS 1.2/1.3 contrôlés dans SQL.

Sauvegarde fraîche : snapshot ET restauration de moins de 30 minutes, six preuves SHA256, archive et manifeste Storage liés au résultat de restauration source/copie ; 96 relations /91 migrations et gates maintenance obligatoires. Un vieux dump ou un booléen ne suffit pas. ValidateConnected relit schéma/historique/métier en READ ONLY ; non exécuté en production ici car nouveau reçu sous maintenance non disponible (maintenance production non autorisée).

Exécution : nouvelle empreinte **dans la même connexion après verrouillage métier/historique, avant migration**. Schéma couvre colonnes/propriétaires/ACL/RLS/index/contraintes/triggers/politiques/fonctions. Gardes obligatoires. Trois SQL exacts + historique dans une seule transaction ; 91 anciennes entrées conservées +3 =94 ; données anciennes identiques ; cinq nouvelles tables RLS et gardées avant COMMIT. Auth/Storage comparés, sans verrou abusif/écrasement. Dérive gérée après COMMIT : `committed-managed-drift-STOP-review`, conserver état et preuves ; pas de rejeu/restauration automatique.

Tests réels sur nouvelle copie locale isolée de la sauvegarde production déjà vérifiée, postgres **non superutilisateur**, Docker réseau interne sans port publié :

| Scénario | Résultat |
|---|---|
| Colonne ajoutée | schema_drift, zéro migration écrite |
| Entrée historique ajoutée | history_drift, zéro migration écrite |
| Ligne métier ajoutée | business_drift, zéro migration écrite |
| Exception après trois SQL avant COMMIT | rollback DDL/historique complet |
| Transaction correcte | 91 +3, métier et anciens buckets conservés, nouvelles tables gardées |
| Second lancement | refus avant connexion |
| Connexion terminée réellement après COMMIT avant marqueur | arrêt sans rejeu ; inspection READ ONLY : 94 entrées, métier conservé |

Preuves `runner-local-v3-*.json`, sans SQL hébergé. Les 91/94 production sont distincts des 95 qwf.

## Artefact et ordre futur

Diff src/public/dépendances/migrations vide depuis e4805fb. Archive production issue du code ea09dba toujours SHA256 **1E1C60528C09D21E4C82AFB443979AA76E35574F529B4ECF9C0AC585528C2994**, manifeste **6C560B8F405801E2FF27A1C7FF03777A1D58E08C0A58020409BB332A819E126D**. Bundle QA jamais substitué. Changement ultérieur de plafond/config : nouvel artefact/empreintes.

Migrations inchangées épinglées dans publication-contract.mjs : **20260928090000 → 20260928110000 corrigée → 20260928130000** ; SHA exacts dans OPERATIONNEL.md. Pas de réconciliation qwf transposée.

1. Décision capacité puis autorisation distincte de publication SHA/lanceur. CI finale/main/config contrôlés ; arrêt si dérive ou plafond 10 ms.
2. **#53 uniquement**, merge normal après accord, clôture #51/#52 sans double fusion. Arbre comparé au manifeste.
3. Fenêtre coordonnée, garde HTTP toutes entrées, garde métier et refus réels ; drain. Échec de couverture/autre opérateur/DDL/lock timeout : arrêt avant migration.
4. Sauvegarde fraîche DB+Storage, restauration isolée, 96 relations et 91 migrations comparées, reçu lié au snapshot/fichiers. Dérive : arrêt, aucun vieux reçu.
5. ValidateConnected READ ONLY, revue SQL ; armer le dormant seulement par changement de code explicitement approuvé/retesté. Une seule tentative atomique. Erreur/COMMIT incertain : gel maintenu, inspection READ ONLY, aucun rejeu.
6. Postchecks 94 migrations/conservation/contraintes/index/RLS/Storage, types depuis production/diff attendu. Dérive Auth/Storage : préserver leur état et examiner delta avant poursuite.
7. Déploiement unique artefact approuvé depuis main. Smokes **en lecture** : deux marques/Auth, devis/accords/PDF existants autorisés, refus autre atelier/session absente, journal/photos existants. Aucune facture/avoir fictif, accord ou règlement de recette en production.
8. Retrait des gardes après décision opérateur ; surveiller reprise/webhooks naturels. Avant COMMIT rollback. Après COMMIT correction compatible ; restauration uniquement par décision distincte et comparaison delta/RPO, jamais écrasement Auth/Storage post-snapshot.

## Contrôles et nettoyage

18 tests Node ciblés réussis ; ajout Publication safeguards à la CI complète. Les injections PostgreSQL sont distinctes des unités. URL et HEAD CI finale consignés dans la PR.

Worker v2 supprimé, absence API vérifiée (`qa-v2-cleanup.json`). Ressources créées ici retirées ; session Auth gérée conservée volontairement. Aucun secret, dump ou octet Storage publié. Worker production inchangé.

Limites déjà examinées : délivrabilité e-mail réelle, ancien contenu libre Fine Bindery français, Safari/iOS physique, panne hébergée du nettoyage Storage restent suivi explicite, non bloquants pour ce périmètre atelier sous les conditions PLAN.md. Ni retestés ni déclarés levés ici.

## Actualisation après décision de capacité

Le blocage de capacité ci-dessus est maintenant levé : Workers Paid actif, recette CPU1000 qwf réussie et cleanup confirmé. Voir **WORKERS-PAID.md** pour état final, nouvel artefact et déroulé exact. Aucun autre audit rejoué, aucune autorisation de publication reçue ; Execute production reste désactivé.
