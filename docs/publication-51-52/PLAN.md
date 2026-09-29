# Publication coordonnée #51 / #52 — revue après audit contradictoire

Actualisé le 29 septembre 2026 après correction des régressions. Le précédent assemblage a30a8e9 et ses 3 138 tests ne valident pas ce candidat. **Aucune autorisation d'exécuter n'est déduite de ce document.** Aucune PR fusionnée, migration ou donnée de production écrite. Les correctifs autorisés ont été poussés sur #51/#52 ; aucune opération Stripe/Sendcloud. Seuls des SELECT en transactions `READ ONLY` ont été exécutés sur la production via la CLI Supabase. Les recettes utilisent le projet qwf et le Worker local ; les CI sont exécutées par GitHub.

## 1. Résultat et références contrôlées

| Référence | SHA / état vérifié |
|---|---|
| `origin/main` | `bbd4b57aed33722837ae4a6316560b4ee341df39` |
| #51 `fix/payment-circuits-reconciliation` | `26035dc2cf17d3d80a36712b99e670bd3eab51e0`, ouverte, mergeable, CI complète verte |
| #52 `feat/work-logistics-manual` | `6e0e7972170a9386363d05d4500310328fba0428`, ouverte, mergeable, CI complète verte |
| Assemblage applicatif local | `4783f5ef6affc6a84fc27a53b338de438e44ba33` sur `review/publication-51-52-v2` |
| Production DB | `hljxohondjvrkzqicexl`, `ACTIVE_HEALTHY`, région `eu-west-1`, PostgreSQL 17.6 |
| Recette hébergée | `qwfhebtxeubfmvvdsqdt`, aucun rejeu de sa réconciliation |
| Worker `mareliure` actif, 100 % | `bdddc8b4-2d9a-4193-a477-87e7df682c70`, déploiement du 25 septembre 21:23:14 UTC |

Les métadonnées Worker consultées ne prouvent pas son SHA Git ; ne pas assimiler cette version à `main` par hypothèse. Les SHA ci-dessus sont à revérifier à l'ouverture de la fenêtre. #50 reste hors périmètre.

L'assemblage est un instantané de revue, poussé dans la PR brouillon #53 : changement de #51 puis de #52, sans enregistrer une fusion de PR. Cinq conflits résolus : `types.ts`, handoff, rapport hébergé, état de recette et avis de publication. Pour `types.ts`, conservation intégrale de #51 puis ajout des deux tables et de la RPC de #52 depuis son SHA exact. Pas de génération depuis l'ancien test pour écraser les types de production, pas de changement métier supplémentaire. Les quatre documents conservent distinctement les deux rapports. Les modifications des PR sont limitées aux correctifs documentés dans leurs rapports d’audit. Aucun autre changement fonctionnel dans l’assemblage.

### Résultats et gates du nouveau candidat

- #51 : deux régressions confirmées et corrigées ; CI verte sur 26035dc ([exécution](https://github.com/antoineferriere2-star/mareliure/actions/runs/36594067295)). Suite locale : 3 140 tests ; un premier timeout de lecture de bundle Windows, second passage complet vert sans hausse de délai. TypeScript/lint/build réussis.
- #51, qwf : 24 variantes par Auth réelle/fonctions HTTP et contrôle SQL ; deux émissions de facture historiques par RPC ; 12 scénarios navigateur (deux marques, bureau/mobile, acompte/expiré/externe). Accords acceptés et historique préservés lors du remplacement test-only de deux fonctions, aucun rejeu de migrations. [Rapport contradictoire](../qa/20260929/audit/REVIEW.md).
- #52 : [CI complète verte sur 6e0e797](https://github.com/antoineferriere2-star/mareliure/actions/runs/36594772862), 3 085 tests locaux/229 fichiers, TypeScript/lint/build réussis. Buffer natif avec rejet base64 invalide. Bundle applicatif sous workerd local, Auth et Storage qwf : fichiers 4/5 Mio identiques après téléchargement, deux associations/deux objets ; rejeu, refus autre atelier/anon, base64 invalide et dépassement. [Preuves](../qa/20260929/worker-audit/REVIEW.md). Les temps réseau ne prouvent pas la consommation CPU du forfait de production.
- Types régénérés depuis qwf : dix membres publics (tables/RPC concernés) identiques. Conflit résolu par union des deux tables et de la RPC logistiques dans les types #51 ; ne pas importer les écarts historiques Métré de qwf.
- **Nouveau candidat combiné** : npm ci neuf (répertoire indépendant), Node 24.14/npm 11.9 ; TypeScript réussi ; lint standard 0 erreur/17 avertissements existants ; **234 fichiers, 3 168 tests réussis en 175,79 s**, maxWorkers=1 sous Windows. [CI Ubuntu/Node 24 du code combiné verte](https://github.com/antoineferriere2-star/mareliure/actions/runs/36595518507). Build générique réussi ; dix contrôles post-build PDF/secrets réussis sur les artefacts réels. Voir integration-checks.json. Ce build générique n’est pas un artefact de production.

Les quatre conflits documentaires conservent les rapports complets des deux PR ; leur avis antérieur ne prime pas sur la présente revue. #50 demeure explicitement exclue. Le dernier SHA applicatif combiné est indiqué ci-dessus ; la CI de revue doit aussi couvrir les derniers commits documentaires.

### Limites du produit confirmées par l’audit

- Le journal #52 est **atelier seulement** : aucun code ne fait progresser les statuts réseau après paiement vers envoi/réception/retour. L’écran client ne doit pas être présenté comme un suivi logistique livré.
- Les acceptations historiques des devis avec acompte, expirés ou brouillons restent possibles, mais sans accord own-external-v1 ni journal de règlements. L’accord externe exige envoyé + validité à Paris + sans acompte. Aucun refus après accord accepté/facturé ; aucune annulation bancaire.
- CGV provisoires, distinction vendeur OPPE/atelier, preuve de version des conditions et promesses de transport : revue éditoriale/contractuelle avant communication sur de nouveaux circuits. Le présent périmètre n’active ni nouvelle vente réseau ni paiement. Pas de conclusion juridique définitive.
- Si #51 redevenait bloquée, un correctif Stripe séparé peut être examiné avec ses tests et dépendances SQL. Aucun découpage automatique/cherry-pick incomplet, aucun débit ni accès Stripe requis ici.

Npm ci signale six alertes de dépendances (trois modérées, trois élevées). Les six versions concernées sont déjà présentes sur main : voir dependency-audit.json. Aucun npm audit fix ni changement de version ; suivi de dépendances séparé, sans assimiler cette recette fonctionnelle à un audit de sécurité complet.

## 2. Migrations exactes et dépendances

| Ordre | Fichier | Effet |
|---:|---|---|
| 1 | `20260928090000_marketplace_payment_circuits.sql` | Qualification indépendante du contrat ; snapshots devis/facture/proposition ; maintien `legacy_resale` ; unicité des paiements réussis |
| 2 | `20260928110000_own_client_external_settlement.sql` | Accord externe référencé, journal immuable de règlements/remboursements/litiges, statut partiel, contrôles du solde |
| 3 | `20260928130000_work_logistics_manual.sql` | Événements/photos privés, transitions sérialisées, bucket et politique restrictive Storage |

SHA256 des **fichiers exacts à appliquer**, sans réécriture :

```text
0900 B5259DBA1A453D02B8183F22F57D79576AE5DD7D964EBA36F1BFFBC48224DEF6
1100 D367A183CD61B7DD7158A4B013BD845E686438FF31ED674B4451A4C9F3A2C63E
1300 1129357F312E12572B7C36E4C97F8E9C97A48D9FB0E7731BF10AD0D3C565CC0C
```

0900 dépend des dossiers/événements/propositions, devis/factures, ouvrages/clients, membres et rôles de `main`. Pour les devis/factures : migrations `20260919090000`, `20260920100000`, `20260921090000`, `20260923100000`, `20260923110000`, `20260923120000`. 1100 dépend strictement des snapshots de 0900. 1300 dépend des ouvrages/membres/Auth/Storage ; elle ne modifie aucune table de paiements. Pour cette publication coordonnée, respecter **0900 → 1100 → 1300**, même si 1300 est indépendante fonctionnellement.

### État réel de production

Lecture renouvelée après audit le 29 septembre 2026 comme `postgres`, `transaction_read_only=on` :

- **91 migrations**, exactement les versions de `main` ; dernière `20260924160000_marketplace_binder_operation_photos`. Aucun ajout hors dépôt, seules les trois versions ci-dessus manquent.
- Pas de collision avec leurs tables, colonnes, fonctions, triggers, index ou bucket. Colonnes prérequises présentes. La contrainte facture actuelle autorise `unpaid/deposit_paid/paid`, conforme à l'état attendu avant ajout de `partial`.
- Aucun groupe de doublons `CUSTOMER_PAYMENT_SUCCEEDED` sur `metadata.payment_intent_id` : création de l'index unique possible au regard des données observées.
- 8 dossiers réseau, 1 proposition commerciale acceptée, 4 devis dont 2 acceptés/invoiced, 2 factures émises non payées. Ces nombres sont un **relevé**, à actualiser sous maintenance, pas des constantes à imposer à une base vivante.
- Droits de propriétaire sur les tables métier/historique nécessaires ; référence à `auth.users.id` permise ; insertion dans `storage.buckets` permise. `postgres` n'est pas propriétaire d'Auth/Storage, et aucun verrou général sur ces tables n'est prévu. `supautils.policy_grants` autorise explicitement `postgres` sur `storage.objects`, ce qui explique le droit de gérer sa politique sans changer de propriétaire ([mécanisme Supabase](https://github.com/supabase/supautils#manage-policies)). Ceci est un contrôle de configuration, pas un essai DDL en production.

Les empreintes des 91 entrées historiques sont conservées dans la preuve. Les empreintes des contrats sont conservées localement sans leur contenu. Les SELECT de catalogue et de données ont des transactions distinctes : ils devront être refaits sous maintenance avant écriture.

**La réconciliation V3.1, sa collision 20260911120000, ses 33 ajouts et ses scripts appartiennent au projet de test ancien. Aucun de ces scripts n'est applicable à cette production.** Ne pas lancer `db push --include-all`, réinitialisation, réparation d'historique ou régénération globale à partir de qwf.

## 3. Périmètre commercial verrouillé

- Le Checkout commercial vérifie `paymentCircuit === legacy_resale` avant création d'une session ; les circuits cibles ne peuvent pas employer ce Checkout.
- La migration 0900 refuse tout contrat cible avec `target_payment_contract_required`. La qualification `network_sale` d'un dossier n'active ni commission ni nouveau vendeur. Les nouveaux dossiers des deux marques continuent le parcours de revente historique.
- `platformRevenue` reste un calcul pur, appelé uniquement par ses tests dans ce périmètre ; il ne crée ni facture ni débit. Carte 3 %, commission 25 %, conciergerie et abonnement 15 € ne sont pas ouverts.
- 1100 ouvre seulement les devis de clients propres éligibles, sans acompte, avec accord référencé `own-external-v1`, collection `external`, rémunération plateforme nulle. Règlement/remboursement **déclaré après réalisation hors plateforme**, sans lien bancaire ni remboursement automatique.
- Aucun Price, Product, contrat existant ou configuration Stripe n'est modifié. Le Checkout historique reste un parcours existant distinct ; ne pas le déclencher pendant les smoke tests.
- Les propositions acceptées conservent montants, vendeur et conditions. Les nouveaux champs restent leur valeur initiale autorisée (`legacy_resale`, provenance nulle ; snapshots anciens nuls). Les empreintes post-migration excluent uniquement les colonnes ajoutées et doivent égaler les empreintes pré-migration.

## 4. Sauvegarde vérifiable — condition préalable, non exécutée ici

Responsable opérateur désigné et stockage chiffré/ACL privé, hors Git. Identifier le projet dans le dashboard/CLI et épingler la connexion : hôte direct `db.hljxohondjvrkzqicexl.supabase.co`, port 5432, base `postgres`, rôle prévu `postgres`, TLS `verify-full`. Si connexion directe indisponible, relever **le pooler exact dans Connect** et l'identifiant `postgres.hljxohondjvrkzqicexl` ; aucun hôte de pooler supposé ni repli automatique. Mot de passe dans un fichier protégé, jamais dans une commande, un journal ou le chat.

1. Faire une répétition de sauvegarde/restauration avant la fenêtre pour mesurer sa durée, puis une sauvegarde fraîche sous maintenance. `pg_dump` PostgreSQL 17, format custom, schémas **et données complets**, sans limiter à `public` ; garder Auth, `supabase_migrations`, Storage metadata, extensions et fonctions. Session de sauvegarde en lecture seule. Arrêt à tout objet omis ou erreur de permission ; pas de contournement par exclusion silencieuse.
2. Inventorier séparément rôles/privilèges sans mots de passe, version PostgreSQL/extensions (dont `supabase_vault`), configurations Auth/URL de retour et secrets nécessaires au redémarrage dans le coffre existant. Ne pas prétendre qu'un dump contient tous les secrets de services ou les clés de déchiffrement Vault.
3. Calculer SHA256 du dump et vérifier le catalogue `pg_restore --list` : données Auth, historique des migrations, dossiers, propositions, devis, factures, ouvrages, Métré et métadonnées Storage inclus. Vérifier les comptes et empreintes par table depuis le même snapshot d'export, pas contre une base modifiée après export.
4. Les sauvegardes DB **n'incluent pas les octets Storage** ([documentation Supabase](https://supabase.com/docs/guides/platform/backups)). Faire un manifeste privé par bucket/objet, taille et empreinte, exporter les objets via l'API de lecture avec pagination, vérifier les octets. Aucun lien signé dans les preuves publiques. Arrêter si un objet nécessaire au rétablissement manque.
5. Restaurer le dump dans une **nouvelle base vide locale**, dans une pile Supabase/PostgreSQL 17 Docker isolée sans accès sortant. Préparer les rôles/extensions correspondants ; ne pas écraser le projet de recette hébergé. `pg_restore --exit-on-error --single-transaction` vers cette seule base locale. Désactiver les tâches planifiées/envois dans la copie avant toute possibilité de sortie réseau.
6. Comparer schéma, contraintes, politiques, fonctions, 91 entrées d'historique et données de **toutes** les tables restaurées (comptes/empreintes selon colonnes du snapshot), pas seulement les tables marketplace. Vérifier Auth/identités et manifestes Storage. Documenter séparément la présence de Vault chiffré et l'absence éventuelle de preuve de déchiffrement ; un secret runtime indispensable sans moyen de récupération est bloquant.
7. Sur cette copie, répéter les trois migrations exactes avec un rôle représentatif de l'exécuteur, puis les contrôles de conservation et les tests de compatibilité. Garder le dump intact. La recette qwf antérieure ne remplace pas cette répétition de restauration de la sauvegarde fraîche de production.

**Gate sauvegarde :** empreintes, restauration et comparaison réussies, manifestes d'objets complets, secrets de redémarrage récupérables. Sans cela, aucune migration. Ni dump de production, ni restauration de production n'ont été effectués dans cette préparation.

## 5. Déroulé proposé après décision distincte

| Étape | Action concrète | Maintenance | Arrêt obligatoire |
|---|---|---|---|
| A | Revérifier SHA/CI/main ; faire relire les résolutions locales ; intégrer #51 puis #52 par commits de merge normaux, branches conservées, et rejouer la CI complète sur le résultat final | Non | HEAD ou base différents, conflit non relu, CI rouge |
| B | `npm ci` et build de production **sans déployer** ; contrôler configuration privée pointant exclusivement vers hlj, marque, bundle navigateur et Worker, secret absent du client ; conserver l'artefact et son manifeste SHA256 | Non | Autre référence Supabase, interop PDF/tslib invalide, clé serveur dans le client, build rouge |
| C | Annoncer l'indisponibilité en écriture sur les deux marques ; bloquer les mutations de l'application et arrêter tâches/scripts/opérateurs DDL ; vérifier absence de requêtes d'écriture en cours | Oui | Pas de responsable, pas de gel effectif ou écriture concurrente inconnue |
| D | Sauvegarde fraîche + restauration/comparaison ; refaire les fichiers `preflight-*-readonly.sql`, comparer le catalogue/historique, contrôler doublons et collisions | Oui | Échec restauration, dérive DDL/historique, doublon, droit manquant |
| E | Appliquer **uniquement 0900 → 1100 → 1300**, sous une transaction contrôlée et avec enregistrement atomique des trois migrations dans l'historique ; `ON_ERROR_STOP`, délais de verrouillage bornés | Oui | Première erreur, timeout ou COMMIT incertain ; aucun rejeu automatique |
| F | Exécuter `postflight-readonly.sql` avant toute réouverture : invariants, 91 anciennes entrées intactes + 3 nouvelles, RLS/grants/RPC/index/bucket/politique ; régénérer les types depuis production vers fichier intermédiaire et relire le diff (le remplacement des deux fonctions de test ne change aucune signature) | Oui | Perte/altération métier, historique incorrect, politique manquante, type inattendu |
| G | Déployer l'artefact final validé sur **Worker `mareliure`**, une fois pour les deux marques ; consigner version, SHA et digest ; vérifier routes et paramètres runtime | Oui | Configuration divergente, version non confirmée, réponse 500 |
| H | Smoke tests ci-dessous avec accès opérateur contrôlé ; lever ensuite le gel et surveiller erreurs/latence/refus ; rouvrir la réception des événements en attente sans en générer de nouveaux | Oui jusqu'au feu vert | Contrôle de droits/PDF/transition en échec, duplication ou perte de données |

### Précisions de maintenance et exécution

Le mécanisme de maintenance doit être choisi et vérifié avant C : règle d'accès en périphérie permettant seulement l'opérateur de recette sur les deux domaines, refus des mutations pour les autres sessions, et arrêt des écrivains directs connus. **Aucun interrupteur de maintenance applicatif complet n'a été ajouté par ces PR.** Un écran “maintenance” seul ne suffit pas. Si aucun dispositif disponible ne permet ce gel, ne pas commencer la fenêtre de migration.

Les webhooks historiques doivent recevoir un échec temporaire permettant leur nouvelle livraison, jamais un HTTP 200 sans enregistrement. Ne pas désactiver Stripe, modifier ses abonnements ni déclencher un paiement pour éprouver cette règle. Après réouverture, vérifier le rapprochement d'éventuels événements réels arrivés pendant la fenêtre sans action payante de recette.

La transaction de E doit verrouiller les tables métier concernées dans un ordre déterministe (notamment dossiers, événements, propositions, devis, factures et historique des migrations), avec `lock_timeout` court et `statement_timeout` borné. La création d'index et les ALTER ne sont pas « sans verrou ». Pas de `LOCK` général sur Auth/Storage. La nouvelle politique Storage requiert ses verrous DDL normaux, dont tout échec arrête la transaction. Un verrou applicatif ne bloque pas les services Supabase ; les écritures Auth/Storage gérées peuvent continuer, ne doivent jamais être écrasées ou interprétées automatiquement comme une perte due à la migration.

Choix proposé : exécuteur `psql -X -v ON_ERROR_STOP=1 --single-transaction` sur connexion vérifiée, avec les trois fichiers immuables et insertion de leurs versions/noms/contenus SQL dans `supabase_migrations.schema_migrations` **dans la même transaction**. Le lanceur final devra refuser une cible ou une empreinte différente et une entrée déjà présente. Aucun `migration repair`, réécriture des 91 entrées ni `db push --include-all`. Le lanceur de réconciliation qwf est explicitement exclu. Cette préparation livre les fichiers SQL et les gates ; elle ne contient pas de commande de mutation distante à exécuter maintenant.

Ne pas déployer entre 0900 et 1100 : l'ancienne interface ne sait pas référencer les nouveaux accords externes. Laisser les écritures fermées entre COMMIT et validation du nouveau Worker.

Build final : vérifier littéralement `VITE_SUPABASE_URL=https://hljxohondjvrkzqicexl.supabase.co`, `VITE_PUBLIC_BRAND=mareliure` et les valeurs runtime correspondantes, puis `npm run build:mareliure`. Ne pas seulement se fier au nom du fichier d'environnement : le script de build valide la cohérence avec l'URL fournie, il n'épingle pas à lui seul l'identité de production. Déploiement ultérieur depuis le `main` approuvé avec `wrangler deploy --name mareliure`, depuis la sortie finale ; ne pas utiliser le build générique de cette préparation. Les deux marques sont résolues par leur hôte ; pas de second Worker à inventer.

Le diff des types est confronté au manifeste de 0900/1100/1300 : trois tables paiements, deux tables logistiques, champs snapshots/circuit/provenance et RPC correspondantes. Les types de fonctions internes générés par le schéma sont des changements à expliquer, pas à supprimer arbitrairement. Tout écart historique indépendant : arrêt pour revue, jamais remplacement global aveugle de `types.ts`.

## 6. Contrôles après migration et smoke tests

Avant réouverture, les cinq nouvelles tables ont RLS ; anon/authenticated n'ont pas d'accès direct aux journaux ; les RPC applicatives sont service_role seulement. Index de paiement unique valide. Bucket logistique privé, 5 Mo, JPEG/PNG/WebP, politique restrictive excluant anon/authenticated. Journal logistique et accords/règlements immuables. `postflight-readonly.sql` compare les empreintes historiques en excluant seulement les nouvelles colonnes ; il attend des journaux encore vides **avant** tout smoke test qui les remplit. Historique attendu : 94 entrées, dont les 91 anciennes inchangées.

| Parcours | Preuve à collecter / critère |
|---|---|
| Deux domaines et Auth | `/auth?space=atelier`, espace atelier et pages publiques sans 500 ; session valide ouvre l'atelier correct, session absente refusée par les fonctions privées |
| Régressions acceptation | Tester envoyé valide sans acompte avec référence ; acompte, expiré et brouillon restent historiques sans journal ; refus après acceptation/facture impossible |
| Devis/accord externe | Atelier QA autorisé, client propre identifié, devis envoyé, montant/devise/vendeur relus, justificatif réel de recette référencé ; pas d'accord au nom d'un client réel |
| Facture et PDF/avoir | Document téléchargé depuis le bouton, octets `%PDF`, numéro/montants/mentions corrects, autre atelier et session absente refusés ; aucune émission sur un dossier client réel |
| Règlement externe | Déclaration partielle puis totale, retry/justificatif doublon refusés ; remboursement déclaré, litige et avoir ne déclenchent aucun mouvement bancaire |
| Réseau Ma Reliure/Fine Bindery | Lecture des contrats existants inchangés ; scénario de recette contrôlé de nouvelle proposition → accord conserve `legacy_resale`, aucune commission créée, aucun clic Checkout |
| Logistique | Aller colis et main propre, transporteur ≠ réception, écart impose description, retour après réception, preuve finale attribuée à l'atelier, historique conservé |
| Photos/droits | Fichier refusé sans objet, PNG privé lu ; autre atelier/anon refusés ; URL expirée après 60 s ; reprise sans doublon ; contrôle SQL/Storage conjoint |
| Langues/mobile | Journal EN/FR/DE/IT/ES à 390 px, erreurs/dates traduites et saisie libre intacte ; accès aux propres ouvrages distinct de l'approbation réseau |

Les tests qui créent devis/factures/accords/objets sont des **écritures**, donc doivent faire partie de l'autorisation de publication et d'un jeu QA explicitement identifié. Ne pas inventer une recette production « sans écriture » : aujourd'hui aucune de ces actions n'a été faite en production. Pour ne pas créer de pièces fiscales fictives dans les séquences réelles, le scénario complet d'émission/avoir reste obligatoire sur recette avec le **bundle final** ; en production, lire/télécharger des pièces existantes autorisées et vérifier les refus. Toute émission QA en production nécessite une décision comptable et un atelier/séquence adaptés explicitement autorisés. L'absence de ce choix interdit l'émission QA, pas les smoke tests en lecture.

## 7. Retour arrière réaliste

1. **Erreur avant COMMIT confirmé :** arrêt immédiat ; la transaction doit avoir annulé les trois migrations. Vérifier versions/objets/empreintes en lecture seule avant de reprendre le service. Si l'état du COMMIT est inconnu, garder la maintenance, inspecter depuis une nouvelle connexion, aucun rejeu.
2. **DB validée, nouveau Worker défectueux :** remettre si nécessaire la version connue `bdddc8b4-2d9a-4193-a477-87e7df682c70` pour les surfaces compatibles, **sans rouvrir les écritures**. Ce rollback applicatif ne retire ni les triggers d'accord ni les contraintes nouvelles : les anciens boutons d'accord client propre peuvent échouer. Priorité à un correctif compatible en avant, validé sur la copie restaurée, puis nouvelle décision de déploiement. Pas de promesse « ancien Worker = ancien fonctionnement complet ».
3. **Des opérations ont eu lieu après migration :** conserver les nouveaux journaux, snapshots et objets. Aucun DROP de table/colonne ni retour global au dump qui perdrait ces opérations. Geler, exporter le delta et examiner chaque écart ; correction additive prioritaire.
4. **Dommage DB avéré exigeant restauration :** restaurer d'abord la sauvegarde vérifiée dans une cible isolée, comparer, inventorier les écritures et objets postérieurs, établir le RPO exact et faire approuver séparément le rétablissement/bascule. La restauration globale en place est le dernier recours, avec indisponibilité et perte potentielle depuis le snapshot explicitement acceptées. Elle ne restaure pas les octets Storage manquants. Les données Auth/Storage apparues après le snapshot ne sont jamais écrasées automatiquement.

La référence Worker, la sauvegarde et ses preuves doivent donc être disponibles avant E. Aucun retour arrière destructif automatique n'est préparé ni autorisé.

## 8. Limites résiduelles, décision par périmètre

| Limite | Bloque le périmètre visé ? | Justification / suite |
|---|---|---|
| Délivrabilité réelle des e-mails | Non pour le circuit externe avec comptes existants et justificatifs obtenus hors plateforme ; **bloquante avant de promettre un onboarding ou un envoi de devis dépendant exclusivement du mail** | Prévoir essai de réception dans une boîte autorisée, vérification fournisseur et suivi des refus ; ne pas assimiler HTTP accepté à e-mail reçu |
| Ancien résumé narratif Fine Bindery français et lien historique Ma Reliure | Non pour le suivi atelier/règlement externe et l'accord structuré testé ; suivi éditorial prioritaire | Préexistant, pas une activation de commission ni un changement de contrat ; ne pas annoncer une traduction intégrale de tous les contenus |
| Safari/iOS physique | Non pour une ouverture contrôlée sur navigateurs éprouvés ; reste un risque mobile à traiter rapidement | Chromium émulé ne prouve ni sélecteur iOS ni téléchargement Safari ; essai réel avant généralisation mobile |
| Budget CPU Cloudflare de production | À vérifier avant activation opérationnelle des fichiers volumineux | Workerd local prouve le bundle et les octets Storage, pas le temps CPU facturé ni le plafond du compte ; aucun forfait gratuit présumé |
| Suivi logistique client réseau | Bloquant pour annoncer un suivi client, pas pour le journal atelier | Les statuts post-paiement ne sont pas pilotés par #52 ; chantier distinct |
| CGV/vendeur/transport et contenus historiques | Bloquants avant communication sur une nouvelle offre payante | Revue contractuelle/éditoriale ; les quatre circuits monétaires restent verrouillés |
| Panne hébergée du nettoyage Storage | Non : erreur propagée et absence de suppression en cas d'incertitude, branche unitaire couverte | Surveiller objets sans association et reprises ; nettoyage manuel seulement après preuve de non-association et autorisation, jamais suppression massive |

### Avis techniques distincts

| Périmètre | Avis | Preuves et limites |
|---|---|---|
| #51 — client propre, règlement externe déclaré | **PRÊT pour décision** | Deux régressions corrigées, matrice SQL/Auth et navigateur MR/FB, factures historiques préservées, CI 26035dc verte. Pas de nouvel encaissement ni de journal sur acompte/expiré/historique. |
| #52 — journal manuel de l’atelier | **PRÊT pour décision** | CI 6e0e797 verte ; photos 4/5 Mio éprouvées dans le vrai bundle workerd local et Storage qwf. Pas de suivi client ni de garantie de transport. Budget CPU du compte Cloudflare à vérifier à l’étape opérationnelle. |
| Assemblage commun | **PRÊT pour examen du plan** | npm ci neuf, TypeScript/lint, 3 168 tests, build, dix scans post-build ; CI du code 4783f5e verte. Revue brouillon #53 : contrôler aussi sa CI au dernier HEAD documentaire avant décision. 92 membres publics de types conservés, 25 précontrôles READ ONLY réussis. |

**L’exécution reste bloquée sans décision distincte du propriétaire**, maintenance réellement vérifiée, sauvegarde fraîche restaurée/comparée, budget/limites Worker connus, artefact production épinglé et smoke tests autorisés sans pièces fiscales fictives. Aucune de ces opérations futures n’est réputée faite par ce rapport. Arrêt obligatoire à toute dérive, erreur ou COMMIT incertain ; aucune écriture de production effectuée ici.

Les régressions bloquantes signalées par l’audit sont levées dans le périmètre défini. Ne pas transformer cet avis en validation de la vente réseau complète, des CGV provisoires, de la délivrabilité e-mail, de Safari/iOS physique ou d’une nouvelle offre monétaire. Les conditions de sauvegarde et de retour arrière des sections 4–7 restent obligatoires. La CI de revue n’autorise aucune fusion automatique de #53 ni des PR sources.
