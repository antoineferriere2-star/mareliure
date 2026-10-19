# Réduction des droits Marketplace préparée — 19 octobre 2026

## Livraison et statut

Migration proposée : [`20261020100000_marketplace_grants_hardening.sql`](../supabase/migrations/20261020100000_marketplace_grants_hardening.sql), issue des recommandations P2/P3 de l'audit #132. **Répétée sur une copie PostgreSQL native ; jamais appliquée en production.** Aucun enregistrement de cette migration dans l'historique de production. L'historique de la copie conserve également les 122 migrations d'origine, dernière `20261016100000` : cette répétition exécute le SQL sans simuler une livraison de production.

La branche part de `8737677` et a été actualisée sur `origin/main 9d7ac9d1c8c3548755cedddeb26ed45a6b40bc9a` après les fusions externes #135–137. L'analyse d'usage a été régénérée sur ce nouveau code ; le manifeste des droits et les octets de la migration restent identiques. Aucun fichier de ces trois PR ni aucun fichier produit de transport n'est modifié ici.

## Droits avant / après

Les instantanés [`before.json`](marketplace-grants-20261019/before.json) et [`after.json`](marketplace-grants-20261019/after.json) exposent seulement le catalogue des droits, configurations de fonctions et RLS, sans lignes client ni corps SQL de production. Ils couvrent 78 tables `public.marketplace_*`, les métadonnées Storage de contrôle et les fonctions publiques inspectées.

- **`anon`, `authenticated`, `PUBLIC`** : suppression de tous les droits de table **et de colonne** sur les 78 tables. Les 40 tables du groupe A perdent leurs droits effectifs ; celles du groupe B restent fermées. Les RLS et politiques sont strictement conservées.
- **`service_role`** : conservation des opérations S/I/U/D justifiées par le code ou les fonctions SQL ; retrait de toute autre opération DML, ainsi que `TRUNCATE`, `REFERENCES`, `TRIGGER` et `MAINTAIN` (PostgreSQL ≥ 17). Aucun droit DML nouveau n'est accordé. Les restrictions existantes, notamment l'absence d'UPDATE direct des approbations de tarifs, restent effectives.
- **55 fonctions trigger Marketplace** : retrait d'EXECUTE à `PUBLIC`, `anon`, `authenticated`; EXECUTE effectif du service préservé. Les triggers continuent à s'exécuter lors des écritures autorisées : le test vérifie cette distinction avec l'appel direct.
- **Quatre triggers exposés sans `search_path` fixé** : `marketplace_cases_forbid_brand_change`, `marketplace_commercial_proposals_forbid_change_after_acceptance`, `marketplace_logistics_immutable`, `marketplace_settlement_immutable` reçoivent `public, pg_temp`. Ni corps de fonction, ni attribut SECURITY DEFINER, ni logique métier modifiés.

Précision par rapport au résumé de #132 : le catalogue contient **huit** fonctions trigger sans configuration `search_path`, dont **quatre exécutables par les rôles navigateur**. La migration traite ces quatre exposées ; elle ne prétend pas que les quatre autres, déjà réservées au service, ont une configuration explicite. Les tableaux de l'audit permettent de retrouver cette distinction.

L'inventaire statique détaillé est [`usage.json`](marketplace-grants-20261019/usage.json) : pour chaque table et chaque opération conservée, fichiers/lignes/expressions de code et fonctions SQL correspondantes. Analyse AST des accès Supabase, constantes de noms de table, lectures génériques du tableau de bord et DML/lectures des fonctions SQL ; **zéro table dynamique non résolue** dans cette analyse. SELECT est conservé prudemment pour WHERE/RETURNING et les écritures SQL, même si certaines fonctions SECURITY DEFINER s'exécutent sous le propriétaire. Les `INSERT ... ON CONFLICT DO UPDATE` des compteurs conservent bien UPDATE. Cette preuve est une sur-approximation statique, pas une mesure exhaustive des appels en exploitation.

DELETE reste nécessaire sur sept tables : `marketplace_binder_operation_photos`, `marketplace_binder_portfolio`, `marketplace_binder_quote_item_photos`, `marketplace_binder_quote_items`, `marketplace_binder_quotes`, `marketplace_binder_skills`, `marketplace_case_matches`. Les autres DELETE sont retirés. Aucun usage applicatif/SQL trouvé sur `marketplace_binder_work_photos`, `marketplace_reference_price_operation_links`, `marketplace_work_items` : leurs quatre droits DML du service sont retirés. Le dernier catalogue de prestations est lu depuis les constantes du code, et non cette ancienne table.

## Droits par défaut : portée et limites

Pour les **futurs objets créés par `postgres` dans `public`**, les droits de table par défaut `anon`/`authenticated`/`PUBLIC` sont supprimés ; les droits structurels du service sont retirés, ses quatre droits DML par défaut conservés. Toutes les tables Marketplace actuelles ont ce propriétaire. Les valeurs par défaut des autres créateurs ne sont pas modifiées.

PostgreSQL ne propose pas de droits par défaut filtrés par préfixe de table. Cette réduction concerne donc aussi une **future table `build_*` créée par `postgres` dans `public`** : sa migration devra accorder explicitement les accès navigateur nécessaires. Les tables existantes du moteur et leurs RLS/ACL, ainsi que Storage, restent identiques avant/après. Les droits par défaut globaux EXECUTE des futures fonctions ne sont pas changés, afin de ne pas toucher implicitement des RPC d'autres périmètres ; chaque futur trigger devra continuer à révoquer ses accès directs inutiles. Les 55 triggers existants sont, eux, fermés explicitement.

La migration vérifie la liste exacte des 78 tables avant de modifier les droits ; une nouvelle table non revue interrompt la transaction. Verrouillage limité à 5 s, durée de requête à 120 s, transaction unique. Un changement de propriétaire, de rôles ou de code après cette revue demande un nouvel examen avant toute éventuelle application.

## Sauvegarde et répétition native

Catalogue de production relevé le **19 octobre à 09:00:07 UTC**, connexions vérifiées TLS et transactions READ ONLY. Sauvegarde personnalisée PostgreSQL fraîche : **1 364 291 octets**, SHA-256 **`55f0c165ed8ff65170ecec3e2da8c31790f8b3cfda839a3d300df4925aa16ea5`**. Archive vérifiée par `pg_restore --list`, empreinte recontrôlée avant restauration. Le dump et les journaux bruts restent privés ; ils ne sont pas joints à la PR.

Restauration dans **`acl_rehearsal_20261019`**, serveur PostgreSQL **17.11**, exclusivement `127.0.0.1:55432`. Comparaison des nombres de lignes et empreintes déterministes des **98 tables** public/Auth/Storage retenues : toutes identiques entre source et copie. Les contenus des objets Storage ne sont pas téléchargés ; les métadonnées sont incluses.

La restauration comporte **14 erreurs connues et examinées**, pas une restauration sans erreur : huit liées à l'extension Supabase Vault indisponible localement et six changements de propriétaire des event triggers Supabase refusés par PostgreSQL local. Le périmètre métier nécessaire est restauré et vérifié par les empreintes et le catalogue. Vault, l'exécution de ces event triggers comme sur l'hébergement Supabase, PostgREST et les fournisseurs externes ne sont pas certifiés par cette répétition.

SQL répété à **09:22:32 UTC** ; SHA-256 de la migration **`50976985f579266d02bf704ebbf67a812c0af40c120075c8adb3cdbac12ef556`**. Après application locale : 98 empreintes de données conservées, 78 ACL conformes au manifeste, politiques inchangées, ACL/RLS du moteur et de Storage identiques, fonctions inchangées hormis les quatre configurations prévues. Les droits EXECUTE effectifs du service sont conservés. L'inventaire régénéré après intégration de #135–137 produit exactement ce même SQL.

## Vérifications

- **PGlite : 7/7** tests de la véritable migration : droits table et colonne, DML du service sans élargissement, refus TRUNCATE, fonctionnement d'un trigger après retrait d'EXECUTE direct, préservation moteur/RLS, droits futurs, répétition idempotente et données conservées.
- **PostgreSQL natif, copie uniquement** : vérification des droits des 78 tables, refus de lecture pour `anon` et `authenticated`, refus de TRUNCATE pour les trois rôles, droits par défaut sur une table temporaire de recette créée dans `public`. Transaction annulée après assertions.
- **Neuf assertions natives de résolution d'étiquette**, sous **`SET LOCAL ROLE service_role`** : preuves d'absence invalides, résolution valide, déduplication, échec depuis claimed, refus de confirmation sans PDF. Transactions annulées ; empreintes des 98 tables inchangées après ces essais.
- **Suite complète : 310 fichiers / 3 806 tests réussis** sur `main 9d7ac9d` avec les sept tests supplémentaires de cette branche, configuration privée limitant la résolution tsconfig au worktree, un worker et délai par test de 30 s. `npm run typecheck` réussi ; `npm run lint` : zéro erreur, 19 avertissements existants. La CI conserve la configuration standard du dépôt.
- **Recette navigateur sur copie : 4/4 réussis**, FR/EN, bureau 1 280 px et iframe réellement mesurée à 375 px ; quatre plans avec téléphone français enregistrés et relus sous `service_role`. Reçu : [`native-recipe-receipt.json`](marketplace-grants-20261019/native-recipe-receipt.json). Les premières tentatives ont nécessité de corriger les fixtures (claim incomplet, ancienne origine de port) ; un lancement concurrent trop chargé a expiré au démarrage. Ces tentatives ne sont pas comptées comme succès. Le rejeu final a réussi en 1,9 minute.

## Recette locale issue de #134, reliée à la copie

Commande et prérequis dans [`marketplace-grants-20261019/README.md`](marketplace-grants-20261019/README.md). Les quatre parcours FR/EN, bureau/mobile de 375 px, reprennent les server functions simulées de #134 et l'adaptation de #137 (numéro invalide bloqué avant RPC). La sauvegarde et la relecture du plan de transport utilisent cette fois les véritables `planInput`, `planColumns`, `planFromRow` puis **INSERT/UPDATE/SELECT natifs sous `service_role` dans la copie**. Identifiants/dossiers de recette synthétiques ; référence locale à un acteur déjà présent dans la copie, sans création de compte.

Les autres server functions, la connexion, les propositions, paiements et états fournisseur restent simulés. Cette recette vérifie que les droits réduits permettent les opérations SQL du plan dans le parcours ; elle ne prétend pas appeler les server functions hébergées, tester leur contrôle d'appartenance réel, ni constituer une intégration Supabase/PostgREST complète. Les neuf dossiers synthétiques des tentatives et du rejeu final, leurs plans et circuits créés par trigger ont été supprimés **dans la seule copie**, avec dérogation transactionnelle locale aux triggers d'historique immuable pendant le nettoyage, puis retour au comportement normal. Les empreintes des **98 tables correspondent de nouveau à la sauvegarde**. Cette dérogation n'est utilisée ni pendant les tests de droits, ni dans la migration, ni en production.

## Application future : non autorisée par cette livraison

Cette PR prépare seulement le SQL. Avant une éventuelle application explicitement demandée par le propriétaire : revoir le code/inventaire alors courant, reprendre une sauvegarde vérifiée, répéter sur sa copie avec les mêmes rôles puis comparer le catalogue. L'application et l'enregistrement dans `supabase_migrations.schema_migrations` feraient l'objet de cette instruction distincte. Ne pas lancer une commande générique qui appliquerait les migrations en attente à l'ouverture de cette PR.

Une erreur pendant la transaction annule ses changements. Après validation/commit, un retour arrière doit restaurer **les ACL exactes de l'instantané antérieur**, y compris les colonnes, fonctions, configurations et droits par défaut : ne pas remplacer cela par `GRANT ALL` généralisé. Le dump privé vérifié et `before.json` servent de références ; un tel retour arrière demande une procédure relue et une autorisation distincte. Aucun script de production n'est exécuté ici.

## Matrice des opérations du service

S = SELECT, I = INSERT, U = UPDATE, D = DELETE. La colonne « conservé » est l'intersection du besoin documenté et des droits antérieurs ; les preuves de chaque opération sont dans `usage.json`. Aucun TRUNCATE/REFERENCES/TRIGGER/MAINTAIN ne reste sur ces tables.

| Table | Besoin documenté | Conservé effectivement |
|---|---|---|
| marketplace_binder_applications | S/I/U | S/I/U |
| marketplace_binder_billing_profiles | S/I/U | S/I/U |
| marketplace_binder_clients | S/I/U | S/I/U |
| marketplace_binder_commercial_terms | S/I/U | S/I/U |
| marketplace_binder_credit_note_items | S/I | S/I |
| marketplace_binder_credit_notes | S/I | S/I |
| marketplace_binder_document_counters | S/I/U | S/I/U |
| marketplace_binder_invitations | S/I/U | S/I/U |
| marketplace_binder_invoice_items | S/I | S/I |
| marketplace_binder_invoices | S/I/U | S/I/U |
| marketplace_binder_members | S/I/U | S/I/U |
| marketplace_binder_operation_photos | S/I/U/D | S/I/U/D |
| marketplace_binder_portfolio | S/I/U/D | S/I/U/D |
| marketplace_binder_price_preferences | S/I/U | S/I/U |
| marketplace_binder_quote_item_photos | S/I/D | S/I/D |
| marketplace_binder_quote_items | S/I/D | S/I/D |
| marketplace_binder_quotes | S/I/U/D | S/I/U/D |
| marketplace_binder_rates | S/I/U | S/I/U |
| marketplace_binder_service_categories | S/I/U | S/I/U |
| marketplace_binder_services | S/I/U | S/I/U |
| marketplace_binder_skills | S/I/D | S/I/D |
| marketplace_binder_subscriptions | S/I/U | S/I/U |
| marketplace_binder_work_counters | S/I/U | S/I/U |
| marketplace_binder_work_photos | aucun | aucun |
| marketplace_binder_works | S/I/U | S/I/U |
| marketplace_binders | S/I/U | S/I/U |
| marketplace_case_logistics_plans | S/I/U | S/I/U |
| marketplace_case_matches | S/I/U/D | S/I/U/D |
| marketplace_case_payment_circuits | S/I/U | S/I/U |
| marketplace_cases | S/I/U | S/I/U |
| marketplace_commercial_proposal_payments | S/I/U | S/I/U |
| marketplace_commercial_proposals | S/I/U | S/I/U |
| marketplace_conversation_reads | S/I/U | S/I/U |
| marketplace_decisions | S/I/U | S/I/U |
| marketplace_events | S/I | S/I |
| marketplace_external_settlements | S/I | S/I |
| marketplace_intake_missions | S | S |
| marketplace_messages | S/I | S/I |
| marketplace_oppe_credit_notes | S/I | S/I |
| marketplace_oppe_disputes | S/I/U | S/I/U |
| marketplace_oppe_document_counters | S/I/U | S/I/U |
| marketplace_oppe_invoice_items | S/I | S/I |
| marketplace_oppe_invoices | S/I | S/I |
| marketplace_oppe_order_assignments | S/I/U | S/I/U |
| marketplace_oppe_orders | S/I/U | S/I/U |
| marketplace_oppe_refunds | S/I/U | S/I/U |
| marketplace_oppe_supplier_invoices | S/I/U | S/I/U |
| marketplace_oppe_supplier_payments | S/I | S/I |
| marketplace_own_agreement_identity_completions | S/I | S/I |
| marketplace_own_client_agreements | S/I | S/I |
| marketplace_pricebook | S/I/U | S/I/U |
| marketplace_proposal_acceptances | S/I | S/I |
| marketplace_proposal_billing_details | S/I | S/I |
| marketplace_quotes | S/I/U | S/I/U |
| marketplace_reference_default_prices | S/I/U | S/I/U |
| marketplace_reference_price_operation_links | aucun | aucun |
| marketplace_round_trip_automation | S/U | S/U |
| marketplace_round_trip_automation_changes | S/I | S/I |
| marketplace_round_trip_label_events | S/I | S/I |
| marketplace_round_trip_label_jobs | S/I/U | S/I/U |
| marketplace_round_trip_rate_approvals | S/I | S/I |
| marketplace_stripe_webhook_events | S/I/U | S/I/U |
| marketplace_work_items | aucun | aucun |
| marketplace_work_logistics_events | S/I | S/I |
| marketplace_work_logistics_labels | S/I | S/I |
| marketplace_work_logistics_photos | S/I | S/I |
| marketplace_workshop_billing_documents | S/I/U | S/I/U |
| marketplace_workshop_checkout_attempts | S/I | S/I |
| marketplace_workshop_connect_consent_history | S/I | S/I |
| marketplace_workshop_connect_consents | S/I/U | S/I/U |
| marketplace_workshop_fee_counters | S/I/U | S/I/U |
| marketplace_workshop_fee_documents | S/I | S/I |
| marketplace_workshop_notices | S/I/U | S/I/U |
| marketplace_workshop_offer_settings | S | S |
| marketplace_workshop_online_disputes | S/I/U | S/I/U |
| marketplace_workshop_online_payments | S/I/U | S/I/U |
| marketplace_workshop_online_refund_attempts | S/I | S/I |
| marketplace_workshop_online_refunds | S/I/U | S/I/U |
