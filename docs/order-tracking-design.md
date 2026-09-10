# Suivi de commande Ma Reliure — audit et conception

> 10 septembre 2026. Livrable A–J demandé avant implémentation. Constaté sur la
> branche `feat/pricing-admin-console` (commit `e0b595e`) et sur la base de
> développement `qwfhebtxeubfmvvdsqdt`.

Principe retenu : **aucun système parallèle.** Les espaces `/mes-livres` et
`/atelier` existants deviennent les espaces de suivi ; la machine à états des
dossiers, les offres, les événements, les URL signées et l'envoi d'e-mails
existants sont réutilisés. Quatre objets manquent réellement — messages,
décisions, pièces jointes, lectures — et un cinquième, les imprévus, parce
qu'ils ne doivent pas atteindre le client.

---

## A. `/mes-livres` aujourd'hui

| Élément | État |
| --- | --- |
| Routes | `_authenticated/mes-livres/route.tsx` (en-tête « Ma Reliure »), `index.tsx`, `$caseId.tsx`. `ssr: false`, garde d'authentification dans `_authenticated/route.tsx`. |
| Liste | `CustomerCaseListPage` : formulaire « Rattacher un projet » en tête, puis cartes (titre de la Mission, référence, phrase d'étape, prix TTC s'il est validé). |
| Fiche | `CustomerCasePage` : `CaseBriefPanel` complet (réponses, photos signées, coordonnées), bloc prix, parcours `journey.ts` (3 étapes visibles sur 5 : commande et voyage masquées tant qu'elles n'existent pas), carte de l'atelier retenu. |
| Serveur | `listMyCustomerCases` (rattache d'abord les dossiers au compte par e-mail vérifié), `getMyCustomerCase` (autorisé par `customer_user_id`), `claimMarketplaceCase` (jeton du lien de récapitulatif). |

Ce qui manque : photo du livre sur la carte, atelier, dernière activité,
séparation en cours / en étude / terminés, action attendue, messages, décisions,
photos d'avancement, archive. Les couleurs sont codées en dur (`#f7f2e8`,
`#241a12`…) au lieu des tokens `mr-*` de la direction artistique.

Corrigé dans `e0b595e` : la liste renvoyait au client un prix suggéré par le
calcul automatique, **avant** toute validation humaine.

## B. `/atelier` aujourd'hui

| Élément | État |
| --- | --- |
| Routes | `_authenticated/atelier/route.tsx` (en-tête « Ma Reliure · atelier »), `index.tsx`, `cases.$caseId.tsx`. |
| Tableau | `BinderDashboardPage` : groupes par état d'offre (nouvelles, disponibilités confirmées, commandes en cours, refusées, clôturées). Carte : titre, résumé sans budget, nombre de photos, rémunération. |
| Fiche | `BinderCasePage` : Brief (`project_only`, puis `assigned` une fois retenu), rémunération fixe, accepter / refuser avec motif et plancher de rémunération. |
| Serveur | `getMyBinderProfile`, `listMyBinderCases`, `getBinderCase`, `respondToBinderOffer` (fonction SQL atomique). |

Après « atelier retenu », **il n'existe plus rien** : ni réception, ni
avancement, ni échange, ni imprévu. Les statuts `received_by_binder`,
`in_progress`, `awaiting_approval`, `shipping_to_customer`, `delivered`,
`completed` sont déclarés dans `cases/state.ts`, avec leurs transitions, mais
aucune fonction ne les produit.

**Faille d'accès constatée.** `loadCaseContext` range dans `invitedBinderIds`
*toutes* les lignes `marketplace_case_matches`, quel que soit leur état, et
`canViewCase` ouvre le dossier à tout atelier de cette liste. Un atelier qui a
refusé, dont l'offre a été clôturée, ou qui n'a pas été retenu, garde
indéfiniment le Brief et les photos du livre. À corriger en P0.

Côté admin, `CaseMatchingPage` porte le Brief, le triage, le prix (panneau de
composition depuis `e0b595e`), les invitations et la sélection. Aucun échange.

## C. Tables et briques réutilisables

| Besoin | Existant | Décision |
| --- | --- | --- |
| État du livre | `marketplace_cases.status` et `cases/state.ts` | **Réutiliser.** Un seul statut manque (voir J). |
| Qui est l'atelier | `marketplace_case_matches.state = 'selected'` (unique par dossier), `marketplace_quotes` | **Réutiliser** comme fait d'autorisation du fil. |
| Journal, analytics | `marketplace_events` (`case_id` facultatif depuis `e0b595e`) | **Réutiliser** pour les événements — **jamais** pour le contenu d'un message. |
| Photos du livre | `build_dossiers` + réponses du runtime, `signCasePhotos` | **Réutiliser** (photo de carte, archive « avant »). |
| Fichiers | Buckets privés, taille et MIME bornés, URL signées d'une heure | **Même motif, bucket dédié** `marketplace-project-files` : les buckets `build-*` appartiennent au moteur Métré, `marketplace-binder-photos` au portfolio des ateliers. |
| E-mails | `send-email.ts` + registre React Email | **Réutiliser**, nouveaux gabarits. |
| Messages, décisions, pièces jointes, lectures | **Rien.** Recherche dans les 60 migrations : seule `build_knowledge_notes` (mémoire métier Métré), sans rapport. | **Créer**, voir E. |

Temps réel : aucun usage de Supabase Realtime dans le code (voir I).

## D. Modèle de permissions

**Aujourd'hui.** `permissions.ts`, pur et testé : `Viewer` (`admin`, `binder`,
`customer`, `anonymous`), `canViewCase` puis `caseDisclosure` (`full`,
`assigned`, `project_only`, `none`). Chaque server function prouve l'identité
(`assertAdmin`, `findBinderForUser`, `customer_user_id`), décide avec ces
fonctions, puis lit avec la clé service. Toutes les tables `marketplace_*`
refusent `anon` et `authenticated`. **Ce modèle est conservé tel quel.**

**Proposé**, dans `permissions.ts`, sans rien ouvrir en base :

1. `canViewCase` pour un atelier : offre en cours (`offered`, `accepted`) **ou**
   atelier retenu. Refus, expiration, clôture ou sélection d'un autre atelier :
   plus d'accès au Brief ni aux photos. Le tableau garde une carte « Offre
   clôturée » sans contenu.
2. `projectThreadAccess(viewer, facts)` → `none | read | write` :
   - admin : `write` ;
   - client propriétaire : `write` tant que le dossier n'est ni annulé ni
     terminé depuis plus de 30 jours, `read` ensuite (l'archive reste lisible) ;
   - atelier **retenu** : `write` de `binder_selected` à `delivered`, `read`
     ensuite ; aucun autre atelier, jamais ;
   - le fil n'existe pas avant qu'un atelier soit retenu (le client échange
     avec Ma Reliure par le support d'ici là — hors P0).
3. Ce qui ne sort jamais du serveur, par audience :
   - client : rémunération atelier, notes admin, notes de pricing, imprévus
     signalés par l'atelier ;
   - atelier : prix client, budget annoncé, notes de pricing, photographie du
     prix ;
   - tous : e-mail et téléphone de l'autre partie. Le fil nomme « Vous »,
     l'atelier par son nom d'atelier, et « Ma Reliure ».
4. Garde anti-coordonnées, volontairement simple : une fonction pure repère
   adresse e-mail, numéro de téléphone français ou international, lien
   WhatsApp / Telegram, et **refuse l'envoi** avec une phrase qui explique
   pourquoi (« Les coordonnées ne passent pas par la conversation : Ma Reliure
   organise le transport et le paiement »). L'admin en est exempté. Pas de
   modération IA.

## E. Base de données minimale

Une migration additive, tables fermées à `anon` / `authenticated`, accès par
server functions uniquement.

**`marketplace_project_messages`** — le fil, messages et mises à jour
d'avancement confondus (même lecture, même ordre) :
`id`, `case_id`, `author_role` (`customer` | `binder` | `admin`),
`author_user_id`, `binder_id` (si atelier), `kind` (`message` | `update`),
`update_type` (`RECEIVED` | `IN_PROGRESS` | `DETAIL` | `FINISHED` |
`BEFORE_RETURN`, seulement pour `update`), `body` (1 à 5 000 caractères),
`important` (l'atelier signale une question qui mérite un e-mail),
`created_at`, `edited_at`, `deleted_at`. Suppression logique seulement : un
message retiré disparaît du fil des parties, l'admin le voit barré.

**`marketplace_project_decisions`** — une question fermée, tranchée une fois :
`id`, `case_id`, `created_by_role` (`binder` | `admin`), `created_by_user_id`,
`decision_type` (`COLOR` | `MATERIAL` | `PAPER` | `GILDING_TEXT` |
`GILDING_STYLE` | `DECOR` | `FORMAT_DETAIL` | `TECHNICAL_CHOICE` | `OTHER`),
`question`, `description`, `options` (JSONB figé à la création :
`[{ id, label, description }]`), `gilding_text` (JSONB pour `GILDING_TEXT` :
titre, auteur, tomaison, date, lignes de dos), `allow_free_text`, `status`
(`OPEN` | `ANSWERED` | `CANCELLED`), `selected_option_id`,
`free_text_answer`, `answered_at`, `answered_by`, `cancelled_at`,
`cancelled_by`, `supersedes_decision_id`, `created_at`.
Contraintes : une décision répondue porte sa date et son auteur ; une option
choisie existe dans `options`. Réponse par fonction SQL
`marketplace_answer_project_decision` qui n'écrit **que si** `status = 'OPEN'`
— aucune modification silencieuse ; changer d'avis crée une nouvelle décision
qui remplace la précédente.

**`marketplace_project_files`** — pièces jointes : `id`, `case_id`,
`owner_kind` (`message` | `decision_option` | `scope_issue`), `owner_id`,
`option_id` (pour une proposition de décision), `storage_path`, `mime_type`,
`size_bytes`, `uploaded_by`, `uploaded_role`, `created_at`. Bucket privé
`marketplace-project-files` : 10 Mo, `image/jpeg`, `image/png`, `image/webp`,
`image/heic`, `image/heif`, `application/pdf`. Contrôle du type et de la taille
côté serveur **et** par le bucket ; lecture par URL signée d'une heure après
contrôle d'accès au fil.

**`marketplace_project_reads`** — `case_id`, `user_id`, `role`,
`last_read_at`, clé `(case_id, user_id)`. Non lus = messages et mises à jour
d'autrui postérieurs à `last_read_at`.

**`marketplace_scope_issues`** — les imprévus, entre l'atelier et Ma Reliure
seulement : `id`, `case_id`, `binder_id`, `reason` (`SEWING_WORSE` |
`PAPER_FRAGILE` | `EXTRA_RESTORATION` | `MATERIAL_UNAVAILABLE` |
`NOT_FEASIBLE` | `OTHER`), `description`, `status` (`OPEN` | `IN_REVIEW` |
`RESOLVED`), `resolution_note`, `resolved_at`, `resolved_by`, `created_at`.
Aucun champ de montant : l'imprévu ne transporte pas de prix. L'avenant, le
jour où il existe, passera par le Pricebook et une nouvelle photographie du
prix.

**Pas de nouveau statut global pour « attente client ».**
`customer_action_required` est **dérivé** à la lecture (au moins une décision
`OPEN`), jamais stocké : un drapeau stocké finit par mentir.

Événements (`marketplace_events`, métadonnées sans contenu de message) :
`message_sent`, `message_read`, `decision_requested`, `decision_answered`,
`project_update_posted`, `scope_issue_reported`, `scope_review_required`,
`customer_action_required`, `customer_action_completed`, plus les avancements
`book_received`, `work_started`, `work_finished`.

## F. Maquette textuelle — espace client

```
MES LIVRES

À FAIRE
┌──────────────────────────────────────────────────────────────┐
│ [photo] LES MISÉRABLES                                        │
│         Demi-cuir · Recouture complète · Titrage             │
│         Atelier Martin · Lyon                                │
│         Votre réponse est attendue                           │
│         L'atelier vous demande de choisir la couleur du cuir.│
│                                               [Répondre]      │
└──────────────────────────────────────────────────────────────┘

EN COURS
  [photo] LES MISÉRABLES      Travail en atelier
          Atelier Martin      Dernière nouvelle : aujourd'hui, 10:42
                              ● 1 message non lu          Voir mon livre →

EN ÉTUDE
  [photo] ATLAS 1890          Ma Reliure prépare le prix de votre projet.

TERMINÉS — votre bibliothèque Ma Reliure
  [avant][après] CANDIDE · relié en demi-cuir · Atelier Martin · mars 2026
```

Fiche `/mes-livres/:caseId`, bureau (mobile : même ordre, en colonne) :

```
┌─ COLONNE PRINCIPALE ─────────────────────────┐ ┌─ BARRE LATÉRALE ────────┐
│ [photo]  LES MISÉRABLES                       │ │ Votre livre             │
│          Demi-cuir · Recouture · Titrage      │ │ photos du Dossier       │
│ Votre livre est à l'atelier                   │ │                         │
│ L'atelier travaille sur la nouvelle reliure.  │ │ Prix                    │
│ Mise à jour : 10 septembre, 11:25             │ │ 520,00 € TTC            │
│                                               │ │ Comprend : …            │
│ ✓ Projet étudié   ✓ Prix validé               │ │                         │
│ ✓ Atelier retenu  ✓ Reçu à l'atelier          │ │ Atelier                 │
│ ● Travail en cours ○ Terminé                  │ │ Atelier Martin · Lyon   │
│   (Paiement, envoi, retour : affichés le jour │ │                         │
│    où ils existent)                           │ │ Commande                │
│                                               │ │ RL-007 · 2 sept. 2026   │
│ VOTRE RÉPONSE EST ATTENDUE                    │ │                         │
│ Quelle couleur de cuir souhaitez-vous ?       │ │ Transport               │
│ [ Bordeaux  (photo) ]  [ Cognac  (photo) ]    │ │ (bientôt)               │
│            [Confirmer Bordeaux]               │ └─────────────────────────┘
│                                               │
│ CONVERSATION AVEC L'ATELIER                   │
│ Échanges tenus dans le cadre du service Ma    │
│ Reliure, qui peut les consulter.              │
│ ─ ATELIER MARTIN · aujourd'hui 10:42          │
│   J'ai fait deux essais de cuir…  [photo][photo]
│ ─ VOUS · 11:03                                │
│   Je préfère également le bordeaux.           │
│ ─ MA RELIURE · 11:20                          │
│   Aucun changement de prix n'est nécessaire.  │
│ [ Écrire…                        ] [📷] [Envoyer]
│                                               │
│ DÉCISIONS                                     │
│ Couleur du cuir — Bordeaux · 10 sept. 14:32   │
│ Titrage — « LES MISÉRABLES / VICTOR HUGO »    │
│   confirmé le 10 sept. 15:02                  │
└───────────────────────────────────────────────┘
```

Direction : tokens `mr-*`, serif pour les titres, filets plutôt que cartes,
statuts écrits, pas de badges colorés, pas de pourcentage.

## G. Maquette textuelle — espace atelier

```
MON ATELIER                         3 en cours · 1 réponse client attendue
                                    2 nouveaux messages · 1 livre à confirmer reçu

À FAIRE AUJOURD'HUI
  RL-007 Les Misérables    Confirmer la réception du livre      [Ouvrir]
  RL-009 Atlas 1890        1 réponse du client : Bordeaux        [Ouvrir]

PROPOSITIONS (à accepter ou refuser)
  RL-011 Candide  · demi-cuir · 440 € · 3 photos · expire le 14 sept.

EN COURS
  RL-007  Reçu · travail en cours      ● 2 messages      440 €
ATTENTE CLIENT
  RL-009  Choix du papier des gardes, demandé le 9 sept.
TERMINÉS
  RL-002  Livré le 2 août
```

Fiche projet atelier (dense, bureau d'abord ; mobile : actions en haut) :

```
RL-007 · LES MISÉRABLES · Travail en cours — en attente du choix couleur
[Confirmer réception] [Commencer] [Message] [Demander une décision]
[Ajouter une photo] [Signaler un imprévu] [Travail terminé]   ← selon l'état

1 Résumé du projet      Brief (niveau « atelier retenu », sans budget)
2 Travail commandé      Demi-cuir · Recouture complète · Titrage · Étui
                        (photographie du prix, sans prix client ; non modifiable)
3 Conversation          fil commun, composer + photo
4 Décisions             ouvertes / tranchées, avec horodatage
5 Photos                Dossier + photos d'avancement
6 Livraison             (le jour où l'expédition existe)
7 Avancement            Reçu 9 sept. · Commencé 9 sept.
8 Rémunération          440,00 €
```

## H. Notifications

Brique : `sendTemplateEmail` (React Email, API Lovable), gabarits Ma Reliure,
clé d'idempotence par objet (`decision-requested-<id>`…), envoi hors du chemin
critique (un e-mail qui échoue n'annule jamais le message).

| Événement | Destinataire | Objet | Contenu |
| --- | --- | --- | --- |
| Décision demandée | client | « L'atelier a une question concernant votre livre » | pas la question, un lien « Voir mon projet » |
| Message marqué important par l'atelier | client | « Un message de l'atelier vous attend » | idem |
| Livre reçu | client | « Votre livre est arrivé à l'atelier » | idem |
| Travail terminé | client | « Votre livre est terminé » | idem |
| Réponse du client | atelier | « Le client a répondu » | idem |
| Imprévu signalé | Ma Reliure | « Imprévu signalé sur RL-… » | raison, sans montant |
| Avenant, expédition retour | client | — | quand ces fonctions existeront |

Les simples photos d'avancement ne déclenchent pas d'e-mail en P0.

**Bloquant pour la production, pas pour le code** : le Worker `mareliure` n'a
**pas** de secret `LOVABLE_API_KEY` (liste des secrets vérifiée, noms
seulement), et l'expéditeur est codé « Métré Build <noreply@notify.metre-pro.fr> ».
Aucun e-mail ne part aujourd'hui de mareliure.fr. Le code enverra dès que la
clé et un domaine d'envoi Ma Reliure seront configurés ; en attendant il
journalise `email_skipped` au lieu d'échouer.

## I. Temps réel

Supabase Realtime (`postgres_changes`) exige que `authenticated` puisse lire
les tables par politique RLS. Ce serait réécrire en SQL le modèle d'accès de
`permissions.ts` — deux sources de vérité pour la même règle, et l'ouverture
de tables aujourd'hui fermées. Refusé pour P0.

Retenu : **React Query** avec
- envoi optimiste (le message apparaît immédiatement, marqué « envoi… ») ;
- invalidation après chaque action ;
- sondage léger d'un indicateur d'activité (`dernier message`, `dernière
  décision`) toutes les 8 s sur une fiche ouverte et visible, 60 s sur les
  tableaux, arrêt quand l'onglet est caché.

Si le besoin se confirme, Realtime *Broadcast* émis par le serveur après
autorisation, sans exposer de table.

## J. Migrations nécessaires

Une migration additive `20260911120000_project_thread.sql` :

1. `marketplace_project_messages`, `marketplace_project_decisions`,
   `marketplace_project_files`, `marketplace_project_reads`,
   `marketplace_scope_issues` — RLS fermée, droits `service_role` ;
2. bucket privé `marketplace-project-files` (10 Mo, liste MIME) ;
3. fonction `marketplace_answer_project_decision` (atomique, `OPEN` seulement,
   événements `decision_answered` et `customer_action_completed`) ;
4. selon arbitrage (voir ci-dessous) : statut `work_finished` ajouté à
   `marketplace_cases_status_check`, et le passage vers la phase atelier.

Côté code : `permissions.ts` (accès atelier resserré, accès au fil), module pur
`projectThread/` (garde anti-coordonnées, non-lus, action attendue, parcours
étendu), server functions dans le service des dossiers, trois écrans refondus
(liste client, fiche client, tableau et fiche atelier), panneau fil dans la
fiche admin, gabarits e-mail, mention dans `/confidentialite` et `/conditions`
(accès de Ma Reliure aux échanges liés à la commande, sans promesse juridique
non validée).

---

## À trancher avant d'implémenter

1. **Passer la phase « atelier retenu » sans paiement ni expédition.** La
   machine à états impose `binder_selected → awaiting_payment → paid →
   shipping_to_binder → received_by_binder`. Ni Stripe ni l'expédition
   n'existent : aujourd'hui, aucun livre ne peut atteindre l'atelier dans le
   système.
2. **« Travail terminé »** n'a pas de statut : `in_progress` mène à
   `shipping_to_customer`, qui annoncerait une expédition inexistante.
3. **Sessions pour les captures et l'E2E** : aucune session n'existe dans le
   navigateur intégré, et les specs E2E lisent leurs identifiants dans
   l'environnement.

## Constatés, hors périmètre de décision

- `/auth` s'affiche aux couleurs de Métré Build (« Create your account ») sur
  Ma Reliure : c'est la porte d'entrée des deux espaces.
- Les inscriptions sont fermées en production (`disable_signup = true`) : un
  client ne peut pas encore créer le compte qui lui donnerait accès à son
  livre.
- La console de prix (`e0b595e`) n'est pas encore sur `main` : sa migration
  doit d'abord être appliquée en production. Le suivi de commande partira de
  cette branche.
