# Reprise de recette hébergée #51 / #52 — 28 septembre 2026

**Décision : recette hébergée bloquée, aucune des deux PR ne dispose encore des preuves nécessaires à une publication.** Une CI verte ne valide pas Auth/Storage sur une instance réelle.

## Identité vérifiée avant toute écriture

Lecture du dashboard Supabase, organisation accessible « Oppe 2 » :

| Référence | Observation | Décision |
| --- | --- | --- |
| `hljxohondjvrkzqicexl` | Projet nommé « Ma Reliure - production ». Même référence dans SUPABASE_URL et VITE_SUPABASE_URL du fichier local `.env.production.mareliure` | Production actuelle : aucune écriture de recette |
| `qwfhebtxeubfmvvdsqdt` | Second projet, nom de compte personnel. Ancienne référence explicitement exclue dans les procédures | Ni conversion en QA ni présomption de données jetables |
| `imivilculbdgjvmfyohz` | Référence de `supabase/config.toml`, non identifiée comme test par le dashboard accessible | Inconnue : aucune utilisation de recette |

Aucun projet explicitement dédié au test identifié parmi les deux projets visibles. Aucune variable SUPABASE/DATABASE de recette dans le processus ; checkout paiements avec configuration production seulement, checkout logistique avec `.env.example` seulement ; pas de CLI Supabase installée détectée. Aucun secret lu dans le rapport ni copié dans Git. Une demande de référence de recette a été adressée au propriétaire.

**Défaut documentaire prouvé et corrigé sur les deux branches :** la commande de contrôle n'excluait que l'ancienne production. Elle exclut désormais aussi la production actuelle et la référence non qualifiée du dépôt. Cette liste de refus ne remplace pas une preuve positive : une référence différente n'est pas automatiquement un projet QA.

## Actions réellement réalisées dans cette reprise

- Lecture des deux procédures, contrôle des SHA/distances et CI des PR : #51 `3d19fcd`, #52 `ac02f26`, toutes deux ouvertes et vertes au début de la reprise.
- Inventaire dashboard et configuration en lecture seule, **aucun SQL exécuté à distance**, aucune donnée créée, aucune clé modifiée, aucun compte Auth créé.
- Précontrôle en lecture seule préparé : `docs/hosted-qa-preflight.sql` (historique de migrations, colonnes, RLS/grants, bucket et doublons de rapprochement). Son exécution exige d'abord l'identification positive de la cible QA.
- Les scénarios et fixtures des deux procédures restent la feuille d'exécution. Ordre combiné préparé : migrations antérieures vérifiées → 0900 corrigée → 1100 → 1300. Aucun historique de migration hébergé n'a été validé ; aucun fichier de types n'a été généré.
- Pas de défaut applicatif « constaté en recette hébergée » annoncé : cette recette n'a pas eu lieu. Les résultats locaux/CI antérieurs restent des preuves locales/CI uniquement. Les CI des commits documentaires de cette reprise seront consignées dans les PR.

## Accès exact manquant

1. Un projet Supabase **jetable de test**, identifié par nom, référence et organisation ; confirmation qu'il n'héberge aucune donnée métier réelle et que les migrations/fixtures y sont permises. Pas nécessaire d'acheter une offre dans cette mission.
2. Accès au dashboard de ce projet pour vérifier son identité et son historique, puis un moyen autorisé d'exécuter les migrations (SQL Editor/connexion PostgreSQL/CLI). Ne pas modifier le lien CLI du projet production.
3. URL API, clé publique et secret serveur de **ce projet test**, fournis via configuration locale protégée/gestionnaire de secrets, jamais en commentaire GitHub. Ils permettront au serveur de recette d'utiliser Auth, PostgREST et Storage sans retomber sur les valeurs par défaut du dépôt.
4. Deux comptes Auth de recette liés à deux ateliers, plus une boîte mail de test contrôlée pour l'envoi des devis. Ils peuvent être créés une fois l'instance et ses droits confirmés. Origines/URLs Auth autorisées pour les deux contextes de marque sur le serveur de recette.
5. Accès de génération des types depuis cette base (CLI/gestion Supabase). CLI actuellement absente : installation depuis le registre officiel possible quand la cible sera connue, mais elle ne remplace pas l'accès à cette cible.

Ne pas demander une clé de production comme substitut. Ne pas désigner l'ancien projet comme test sans vérification et accord explicites.

## Matrice de publication

| PR | Contrôles hébergés bloquants | État |
| --- | --- | --- |
| #51 | JWT/membre/autre atelier, devis envoyé → accord → facture et PDF HTTP/Storage, journal règlements/remboursements/litige/avoir, nouvelle revente des deux marques, types générés | Non exécutés ; pas prête à autoriser la publication |
| #52 | JWT/RLS/Storage, photos privées et expiration, deux ateliers, reprise après échec, concurrence multi-connexions, colis aller/retour et main propre en vrai contexte Auth, mobile connecté, types générés | Non exécutés ; pas prête à autoriser la publication |

Pour les types : sauvegarder un export après 1100 pour #51, puis un export après 1300 pour comparaison combinée. Ne pas introduire les types paiements dans #52 : générer également sur un schéma main + 1300 seul, ou isoler et justifier chaque différence du schéma combiné. Un export combiné n'est pas la preuve du schéma d'une branche indépendante.

La fiche Sendcloud, préparée dans #52 (`docs/sendcloud-book-roundtrip-trial.md`), ne débloque aucun de ces contrôles. Aucun merge, déploiement, migration production ou débit réel dans cette reprise.
