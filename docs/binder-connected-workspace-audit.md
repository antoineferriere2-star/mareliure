# Espace relieur connecté — audit et découpage (22 septembre 2026)

## A. Existant

- `/atelier` liste les projets confiés (`marketplace_case_matches`) ; la fiche `/atelier/cases/:caseId` montre le dossier projeté, l'offre et la conversation lorsque l'atelier est retenu.
- `marketplace_cases` est le dossier commercial unique. Ses statuts, l'attribution et les événements existent. `marketplace_messages` et `marketplace_conversation_reads` constituent déjà la messagerie et le lu/non lu, avec audiences distinctes selon le rôle et la marque.
- Contacts, ouvrages, devis, factures et catalogue de l'atelier existent. Les ouvrages possèdent déjà `source` et `case_id` ; les contacts `origin` et `origin_case_id` ; les devis `work_id`. Le Quote Workbench sait préremplir depuis un ouvrage.
- L'admin dispose du back-office `/marketplace` (dossiers, relieurs, tarifs) et de la conversation d'un dossier. `requireBuildAdmin` et les contrôles serveur conditionnent ses accès.
- Les tables concernées ont une RLS qui refuse `anon` et `authenticated` ; les fonctions serveur utilisent le service role après résolution de la session, de l'atelier et du dossier. La lecture des coordonnées et des messages d'un projet dépend de l'attribution, de la sélection et de l'audience.

## B. Manques

- Accueil « Aujourd'hui » transversal, navigation métier compacte, listes opérationnelles des dossiers et conversations, compteurs visibles, liens contextuels entre dossier, ouvrage et devis.
- Création atomique du contact et de l'ouvrage Ma Reliure à partir d'un dossier sélectionné. Les colonnes de provenance existent, mais l'unique fonction de création d'ouvrage impose `mon_client`.
- Supervision admin par atelier, avec métriques et détail des projets, sans exposer par défaut les clients privés d'atelier.
- Mode support audité si une lecture du contenu privé devient nécessaire. La V1 n'en a pas besoin pour afficher les métriques agrégées.

## C. Réemploi

Conserver `marketplace_cases` et ses statuts, `marketplace_case_matches`, `marketplace_events`, `marketplace_messages`, `marketplace_conversation_reads`, les projections du dossier, `ConversationPanel`, les modules atelier existants et le Quote Workbench. Les « clients personnels » restent dans les tables de l'atelier ; ils ne deviennent jamais des dossiers Ma Reliure ni des conversations marketplace.

## D. Migration

Une fonction SQL minimale, invocable seulement par `service_role`, crée dans une transaction contact et ouvrage marqués `ma_reliure` **après** vérification de l'attribution `selected`. Elle retourne l'ouvrage existant si le dossier a déjà été importé. Pas de nouvelle table de dossiers, de messages ou de statuts. Aucun accès admin aux messages personnels n'est ajouté ; si un futur mode support le nécessite, une migration d'audit dédiée sera obligatoire avant son activation.

## E. Routes

- Atelier : `/atelier` (« Aujourd'hui »), `/atelier/leads`, `/atelier/leads/:leadId`, `/atelier/messages`, `/atelier/messages/:conversationId`, `/atelier/devis`, `/atelier/ouvrages`, `/atelier/contacts`, `/atelier/factures`, `/atelier/tarifs`. L'ancienne fiche `/atelier/cases/:caseId` reste compatible.
- Admin : étendre `/marketplace` et proposer `/admin/ateliers`, `/admin/ateliers/:binderId`, `/admin/leads`, `/admin/messages`, en conservant les anciennes routes.

## F. Règles d'accès

- Un membre actif d'un atelier ne lit que les matches de son atelier. Seul l'atelier `selected` peut lire ou écrire la conversation client et importer un dossier dans ses ouvrages. Les server functions dérivent toujours `binder_id` de la session ; l'ID du dossier n'autorise rien.
- Les clients d'atelier `mon_client` ne sont pas des leads Ma Reliure : pas de commission automatique, pas de changement de provenance, pas de messagerie marketplace implicite.
- L'admin lit les dossiers et conversations Ma Reliure nécessaires à l'exploitation. Pour les clients personnels, seuls des comptes et états agrégés sont présentés ; aucun accès silencieux aux contenus privés ni aucune impersonation.

## Découpage

1. Espace relieur, listes des dossiers, accueil et conversion dossier → ouvrage → devis.
2. Boîte de messages contextualisée, compteurs et états de lecture.
3. Supervision admin par atelier et globale, avec vérification de confidentialité.

Chaque PR doit préserver les anciennes routes et passer CI, E2E et isolation avant fusion. Le déploiement production n'intervient qu'après la dernière PR validée.
