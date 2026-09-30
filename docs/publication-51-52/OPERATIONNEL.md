# Préparation opérationnelle — 30 septembre 2026

## Décision possible aujourd'hui

La sauvegarde/restauration et la répétition SQL locale sont réussies ; le build configuré production est figé. **L'exécution en production reste bloquée** : le forfait/CPU effectif et la couverture complète du dispositif de maintenance distant ne sont pas prouvés. Les composants locaux ne constituent pas cette preuve. Aucun projet hébergé n'a reçu de migration, aucun gel distant n'a été activé, aucune PR n'a été fusionnée, aucun Worker n'a été publié, aucune opération payante n'a été lancée. qwf n'a pas été modifié.

## Références contrôlées

Au début de cette préparation, GitHub confirme main `bbd4b57aed33722837ae4a6316560b4ee341df39` ; #51 `26035dc2cf17d3d80a36712b99e670bd3eab51e0`, #52 `6e0e7972170a9386363d05d4500310328fba0428`, #53 brouillon `ea09dba9af91d677fb0a326271da5f4e72a10f5e`, toutes ouvertes et CI quality SUCCESS. Aucune branche source modifiée. Le build ci-dessous provient de ea09dba ; les ajouts de ce dossier ne changent pas `src`, les dépendances ou les migrations.

**Chemin recommandé : publication par #53 seulement**, après approbation et sortie explicite du brouillon. Fusion normale de #53, puis clôture administrative des #51/#52 sans les fusionner. Ne jamais fusionner ensuite les PR sources : #53 contient leurs instantanés et les résolutions examinées, pas leur ascendance Git. Avant fusion future, comparer l'arbre applicatif et les trois migrations au manifeste, puis fast-forward de main et comparaison de l'arbre résultant. Un changement concurrent de main impose nouvelle intégration/CI/revue. La présente recommandation ne réalise aucune de ces actions.

## Sauvegarde réellement réalisée

Stockage privé : `D:/CodexProjects/publication-ops-private`, ACL protégées, hors dépôt. Aucun dump, octet Storage, jeton, identité nominative ou URL signée dans le dossier de revue.

- Cible contrôlée : `hljxohondjvrkzqicexl`, pooler indiqué par la CLI `aws-1-eu-west-1.pooler.supabase.com:5432`, login CLI limité à ce projet, rôle `postgres`, base `postgres`, TLS `verify-full` avec CA, `default_transaction_read_only=on`.
- Le `db dump` standard de la CLI exclut Auth/Storage : **il n'a pas été utilisé comme sauvegarde complète**. Sa connexion temporaire a servi à `pg_dump --format=custom --role=postgres`, sans exclusion de schéma ni de données.
- Export final et empreintes partagent **le même snapshot PostgreSQL**, tenu dans une transaction REPEATABLE READ READ ONLY pendant l'export. Archive `production-snapshot.dump`, SHA256 `29E8E3813001C44420DB86C9093E707EEE3FAFEC086A0B3E5F1A06E9A236120B`.
- Restauration intégrale `pg_restore --exit-on-error --single-transaction` dans `production_ops_20260930`, conteneur local `supabase_db_qwf-archive-isolated`, réseau Docker interne, aucun port publié. Le nom historique du conteneur ne désigne pas une connexion au projet qwf hébergé. Aucune base préexistante effacée.
- **96 relations : comptes et empreintes identiques** au snapshot, dont Auth, identités, Métré, historique et métadonnées Storage. 6 comptes/6 identités, 4 ateliers, 8 dossiers, 4 devis, 2 factures. Ces nombres décrivent le snapshot de production, pas les anciens fixtures qwf.
- Schéma : comparaison du DDL exporté avant migration ; seules 51 lignes `REVOKE ... FROM postgres` sur extensions ne sont pas réémises à l'identique. Aucun autre ajout/suppression de ligne de DDL après normalisation des en-têtes et marqueurs pg_dump. Les **57 contrôles de privilèges effectifs** postgres/anon/authenticated sont identiques. Ne pas présenter les dumps texte comme identiques octet pour octet.
- `supabase_vault` 0.3.1 présent ; **0 secret Vault** dans le snapshot. Pas de preuve de récupération d'une clé maître ou de déchiffrement d'un secret non présent. Les secrets de services/runtime ne font pas partie de pg_dump et doivent rester disponibles dans le coffre existant.
- Storage : **20 objets, 6 buckets, 3 456 574 octets**, tous téléchargés et réouverts avec taille/SHA256 vérifiées ; manifeste privé, inventaires identiques avant/après. Ceci n'est pas un snapshot atomique commun DB/Storage ni un test de réimport via l'API Storage. La répétition hors maintenance ne remplace pas la sauvegarde fraîche sous gel avec comparaison des métadonnées et inventaires.

## Répétition des migrations

Fichiers inchangés et ordre strict :

| Ordre | Version | SHA256 |
|---|---|---|
| 1 | 20260928090000_marketplace_payment_circuits.sql | B5259DBA1A453D02B8183F22F57D79576AE5DD7D964EBA36F1BFFBC48224DEF6 |
| 2 | 20260928110000_own_client_external_settlement.sql corrigée | D367A183CD61B7DD7158A4B013BD845E686438FF31ED674B4451A4C9F3A2C63E |
| 3 | 20260928130000_work_logistics_manual.sql | 1129357F312E12572B7C36E4C97F8E9C97A48D9FB0E7731BF10AD0D3C565CC0C |

`rehearse-migrations.ps1` ne peut viser qu'une base locale explicitement nommée. Hashes contrôlés avant exécution, transaction unique, verrous déterministes, lock_timeout 5 s / statement_timeout 120 s, historique inséré dans le même COMMIT, ON_ERROR_STOP. Fichier de tentative créé avant appel, nouvel appel refusé. Toute absence de confirmation de COMMIT impose inspection ; aucun rejeu automatique. Ce lanceur local n'est **pas un lanceur production armé** : son adaptation distante reste conditionnée au gel validé et aux preuves fraîches. Ne pas lui ajouter simplement une URL distante.

Deux défauts du banc d'essai ont été conservés comme preuves : premier appel vers un nom de base inexistant (aucun SQL exécuté), puis CREATE refusé car la base locale créée par supabase_admin n'avait pas le propriétaire réel. Lecture de production : propriétaire de base postgres, propriétaire de public pg_database_owner, postgres non superutilisateur avec CREATE. Après alignement **local uniquement** du propriétaire, essai distinct réussi. Aucun droit de production modifié, aucun superutilisateur pour les migrations.

Résultat : COMMIT confirmé ; **94 migrations = 91 anciennes strictement intactes + 3 nouvelles**. Les empreintes de toutes les colonnes métier antérieures restent égales. Seules différences des relations antérieures : historique +3 et bucket Storage +1 attendus. RLS active sur les cinq nouvelles tables, anon/authenticated sans lecture directe, index de paiement unique valide, politique Storage restrictive, bucket privé 5 Mio et JPEG/PNG/WebP ; journaux encore vides, aucun changement de modèle des contrats historiques. Deuxième lancement refusé avant SQL.

## Build et preuves

Configuration publique épinglée sur `https://hljxohondjvrkzqicexl.supabase.co`, marque `mareliure`. `npm run build:mareliure` réussi. Paquet local ensuite configuré avec nom `mareliure` et date de compatibilité **2026-09-25** relevée sur le Worker actif, plutôt que le nom générique et la date courante générés par Nitro. `nodejs_compat` conservé ; aucune limite CPU inventée. Ces deux réglages de conditionnement sont explicites ; aucun changement applicatif.

- 830 fichiers dans `artifact-manifest.json`, source ea09dba, scans des valeurs privées runtime réussis.
- Archive protégée `worker-production-ea09dba.zip` : SHA256 `1E1C60528C09D21E4C82AFB443979AA76E35574F529B4ECF9C0AC585528C2994`.
- Manifeste : SHA256 `6C560B8F405801E2FF27A1C7FF03777A1D58E08C0A58020409BB332A819E126D`.
- Dix tests sur le bundle PDF/secrets : premier passage 9/10, timeout de scan disque 5,485 s pour 5 s ; second passage identique **10/10**, sans changement de délai ni de code. Les CI applicatives antérieures restent distinctes de cette mesure locale. Pas de nouveau résultat prétendu pour une suite complète non relancée dans cette étape documentaire.
- TypeScript et lint relancés après préparation : réussis, 0 erreur et 17 avertissements lint préexistants. Diff applicatif, dépendances et migrations vide par rapport à ea09dba.

| Opération mesurée | Durée / résultat |
|---|---|
| Premier export complet | 20,87 s |
| Export Storage | 13,09 s |
| Restauration intégrale du snapshot | 2,03 s |
| Transaction des trois migrations, rôle représentatif | 0,51 s |
| Build production | 890,93 s, machine sous contention disque |
| Garde HTTP local, cinq tests | 0,68 s |

L'initialisation/récupération de Docker a pris plusieurs minutes. Aucune de ces durées locales ne mesure le CPU Cloudflare ni ne garantit la durée d'une restauration distante.

## Maintenance et accès encore nécessaires

Voir [MAINTENANCE.md](MAINTENANCE.md) et [CLOUDFLARE-CPU-PROCEDURE.md](CLOUDFLARE-CPU-PROCEDURE.md).

Lecture distante : quatre domaines personnalisés mareliure.fr/www et finebindery.com/www ; workers.dev **et previews activés** ; aucune route Worker additionnelle ni schedule Worker ; aucune fonction Edge Supabase déployée ; cron.job absent. Les sessions dashboard, scripts ou intégrations externes non répertoriées exigent toujours coordination avec l'opérateur : leur absence ne se déduit pas du dépôt.

Manquent précisément : **lecture du forfait Workers/Billing** (API subscriptions 403), puis **autorisation distincte d'un Worker de recette hébergé** pour obtenir les CPU d'invocation et éprouver l'enveloppe de maintenance sur des domaines de recette. OAuth permet techniquement Workers, mais la consigne interdit sa publication. Aucun changement de forfait proposé automatiquement. Aucun test de charge sur mareliure ou finebindery en production.

Le repli par navigateur a également été vérifié : le tableau de bord Cloudflare arrive sur la page de connexion, sans session exploitable. Aucun mot de passe d'une autre application n'a été réutilisé. Une session Cloudflare authentifiée avec accès Billing permettrait ce contrôle en lecture, sans nouveau droit d'écriture.

## Ordre d'exécution futur et arrêts

1. Lever ces preuves manquantes ; relire le dossier, approuver séparément les SHA, la maintenance et la fenêtre. Revérifier main/PR/Worker/config et signer le manifeste final. Si drift : arrêt, nouvelle revue.
2. Une seule fusion #53 selon le chemin ci-dessus ; aucun double merge. Vérifier l'arbre résultant avant réutilisation du paquet. Rien n'est fusionné aujourd'hui.
3. Activer le gel couvrant tous les points d'entrée et écrivains ; vérifier refus applicatifs/webhooks/directs, drain des transactions, contrôles opérateur. Échec sur un alias ou écrivain : arrêt avant migration.
4. Sauvegarde fraîche cohérente DB + export Storage, restauration/comparaison. Vérifier les 91 entrées actuelles (ou arrêt si nouvelle migration légitime), schéma, contrats et rôles. Aucune reprise de la réconciliation qwf.
5. Exécuteur distant à faire examiner après ces gates : connexion cible/TLS épinglée, reçu de sauvegarde fraîche, mêmes trois octets SQL et transaction/historique atomique que la répétition. Première erreur ou COMMIT incertain : maintenir le gel, inspecter uniquement en lecture, aucun rejeu.
6. Après COMMIT confirmé : postflight, conservation, types régénérés et diff attendu ; déployer le paquet approuvé une seule fois. Aucune réouverture entre SQL et Worker validé.
7. Smokes production **en lecture** : pages des deux marques, Auth existante, atelier autorisé, lecture de devis/accords et documents existants autorisés, téléchargement PDF déjà émis, refus autre atelier/absence de session, lecture du journal/photos existants. Aucun checkout, facture/avoir fictif, accord au nom d'un client ou règlement de test en production. Les scénarios mutateurs complets restent en recette.
8. Réouverture après décision opérateur ; surveiller erreurs, refus et éventuelles nouvelles livraisons de webhooks réels. Aucun événement payant artificiel.

## Retour arrière et limites

Avant COMMIT : rollback transactionnel puis inspection. COMMIT incertain : aucun rejeu. Après COMMIT : maintenir le gel ; privilégier correction compatible en avant. Ancien Worker seul ne retire pas les nouvelles contraintes d'accord. Ne supprimer ni journaux, ni objets, ni triggers automatiquement. Restauration seulement après nouvelle décision, comparaison du delta post-snapshot et RPO explicite, d'abord dans une cible isolée ; ne jamais écraser les écritures Auth/Storage survenues depuis l'export.

Les circuits carte 3 %, commission 25 %, conciergerie payante et abonnement restent verrouillés ; aucune modification des contrats de revente acceptés. Suivi client après paiement exclu. Les limites délivrabilité réelle, ancien texte libre Fine Bindery, Safari/iOS physique et panne hébergée du nettoyage Storage restent celles de PLAN.md : elles ne sont pas levées par cette répétition SQL. CPU et gel distant sont, eux, des **gates opérationnels encore ouverts**.

## Actualisation après recette hébergée autorisée

Voir [RECETTE-HEBERGEE-20260930.md](RECETTE-HEBERGEE-20260930.md). L'accès dashboard et l'autorisation QA sont maintenant acquis ; le Worker temporaire a été déployé, testé puis supprimé. **La publication reste bloquée** : CPU photo supérieur au plafond Workers Free (10 ms), gel des écrivains Supabase directs non entièrement éprouvé. La maintenance HTTP est vérifiée. L'ancienne valeur CLI exposée est rejetée. Le préparateur distant refuse Execute ; ne pas considérer le présent dossier comme une autorisation ou un exécuteur prêt à lancer.
