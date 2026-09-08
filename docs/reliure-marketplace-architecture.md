# Marketplace Reliure — architecture

> Document d'architecture produit **écrit après audit du moteur Métré Build**
> (`Antoineoppe/m-tr-build-ai`, branche `main`, 89 fichiers de test / 974 tests
> verts au moment de l'audit). Il fixe ce que la marketplace réutilise, ce
> qu'elle étend, ce qu'elle crée, et pourquoi.
>
> Règle de lecture : **le code du moteur est la source de vérité**. Là où
> l'intention produit divergeait de ce que le moteur fait réellement, c'est le
> moteur qui gagne et la divergence est documentée ici (section F).

---

## A. Architecture existante Métré (état constaté)

### A.1 Stack réelle

TanStack Start (Router + Start server functions) sur Vite 8 / React 19,
TypeScript, Tailwind 4, Supabase (Postgres + Auth + Storage), Zod 3, Stripe via
la **passerelle connecteur Lovable**, Vitest (node, `src/**/*.test.ts`),
Playwright pour l'e2e. Pas de Next.js, pas d'edge functions Supabase (interdites
par la plateforme, cf. `src/build/README.md`).

### A.2 La chaîne d'objets, telle qu'implémentée

```
build_playbooks.draft_schema      (brouillon éditable, JSONB)
   └─ publish ─► build_playbook_versions.schema   (version IMMUABLE, JSONB)
                    ▲
build_missions.playbook_version_id ┘   + public_token (lien public unique)
   │
   │  GET /m/:publicToken  ──► POST /api/public/build-runtime
   ▼
build_runtime_sessions (answers JSONB, session_secret_hash, statut
                        in_progress | submitted | abandoned)
   │  submit_session
   ▼
build_dossiers (content = ProjectBrief JSON, visitor_summary = DTO visiteur,
                next_questions, status draft|ready, workspace_id)
   ├─► build_dossier_access_tokens  → /project-summary/:accessToken
   └─► e-mail visiteur + notification workspace
```

### A.3 Playbook — le schéma (`src/build/schema/playbook.ts`)

`schemaVersion: 1`, puis `sections[] → steps[] → fields[]`.

Types de champs disponibles (union discriminée Zod, **12 types**) :
`single_choice`, `multi_choice`, `text`, `number`, `measurement`, `budget`,
`timeline`, `address`, `photo`, `coordinates`, `consent`, `inspiration_photo`.

Chaque champ porte : `key`, `label`, `helpText`, `desirability`
(`required | recommended | optional`), `missingMessage`, `allowNotSure`,
`displayWhen` (branchement conditionnel) et `briefMapping` (où la réponse
atterrit dans le Dossier).

Au niveau racine :
- `validationRules[]` — les règles de cohérence inter-champs (le
  « Vérificateur »), `severity: error` (bloque) ou `warning` (avertit une fois) ;
- `briefConfig` — `summaryFragments`, `calculatedFields`, `derivedLines`,
  `alwaysIncludeLines`, `suggestedNextActions`, `missionNameTemplate`,
  `statusLabel`.

**Aucune règle métier n'existe en TypeScript.** Le Playbook Deck
(`src/build/playbooks/deckPlaybookSchema.ts`, 600 lignes de données) est la
preuve : tout ce qui était autrefois `deckProjectBrief.ts` est devenu de la
donnée.

### A.4 Le moteur (`src/build/engine/`, pur, sans framework)

| Module | Rôle |
| --- | --- |
| `conditions.ts` | Évalue `ConditionGroup` (`all` = ET, `any` = OU). 10 opérateurs. |
| `validation.ts` | `validateField`, `computeVisibleSteps`, `getPlaybookPublishIssues` (contrôles sémantiques de publication). |
| `consistency.ts` | Le Vérificateur : n'évalue une règle **que** si tous les champs qu'elle lit ont déjà été présentés. |
| `brief.ts` | `generateProjectBrief` — 8 passes produisant le `ProjectBrief` canonique. |
| `visitorSummary.ts` | Transforme le `ProjectBrief` interne en `VisitorProjectSummary` visiteur (retire confiance + next action). |
| `fields/*.tsx` | 13 composants React, un par type, **aucun ne connaît de métier**. |

`conditions.ts`, `validation.ts` et `consistency.ts` sont importés **à la fois**
par le client (retour immédiat) et par le serveur (autorité au submit) : les
deux ne peuvent pas diverger.

### A.5 Runtime public

- Surface publique unique : `/m/:publicToken` (`src/routes/m.$publicToken.tsx`
  → `MissionRuntime.tsx`). `/demo/deck-project` est une Mission ordinaire, pas
  une route parallèle. **Aucune route `/build/run/:id` ne doit réapparaître.**
- API : `POST /api/public/build-runtime`, 7 actions —
  `get_mission`, `start_session`, `resume_session`, `save_session`,
  `submit_session`, `upload_project_photo`, `analyze_inspiration_photo`.
- Sécurité runtime : entrée **uniquement** par `public_token` (jamais par
  `mission_id`), `session_secret` de 32 octets comparé en temps constant,
  rate-limit par IP (60/h anonyme, 300/h par session), corps limité à 32 Ko
  (12 Mo pour une photo), IP hachée avec sel.
- Submit idempotent : trois garde-fous (statut, `UPDATE ... WHERE
  status='in_progress'`, index unique sur `session_id`).

### A.6 Photos

Deux buckets, deux usages, **les deux réellement implémentés** :

| Bucket | Type de champ | Limites | Lecture |
| --- | --- | --- | --- |
| `build-project-photos` | `photo` avec `storage: "supabase_storage"` | 8 Mo, 12 fichiers, jpeg/png/webp/heic/heif | workspace uniquement, URL signée |
| `build-inspiration-photos` | `inspiration_photo` | 8 Mo, jpeg/png/webp | agent vision + workspace |

> ⚠️ Le commentaire d'en-tête de `photoField` dans `schema/playbook.ts` affirme
> encore que seul `filename_only` est implémenté et que `supabase_storage` est
> refusé à la publication. **C'est faux depuis l'ajout de
> `handleUploadProjectPhoto`** : `validation.ts` et `PhotoField.tsx` gèrent les
> deux modes, et le Playbook Deck publie déjà en `supabase_storage`. Le
> commentaire est périmé, pas le code.

### A.7 Sécurité et autorisation

Le modèle est homogène et **doit être copié tel quel** :

1. Toutes les tables `build_*` sont `GRANT ALL TO service_role` + RLS
   `FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)`.
   Aucun accès direct via l'API Data, pour personne.
2. L'autorisation se fait dans des **server functions TanStack**
   (`createServerFn` + `requireSupabaseAuth`) : d'abord `assertAdmin` avec le
   client RLS **de l'appelant** (lecture de `user_roles`), ensuite seulement le
   client `service_role` (`admin()`).
3. Le rôle vient de `public.user_roles` + `public.has_role`, jamais d'une
   comparaison d'e-mail.
4. Exceptions volontaires : `build_workspace_members` et `user_roles`
   autorisent un `SELECT` de ses **propres** lignes, pour permettre le gating
   client des routes.

### A.8 Espaces authentifiés

- `/_authenticated/build/*` — back-office Métré, `requireBuildAdmin`.
- `/_authenticated/portal/*` — Espace Client (workspace), `requireWorkspaceAccess`.

### A.9 i18n

`SUPPORTED_LOCALES = ["en-US", "es-US"]`. La traduction publique est un
dictionnaire de chaînes entières indexé par la source anglaise
(`ES_PUBLIC_COPY` + `publicCopy(locale, text)`), avec repli sur la source.
**Il n'y a pas de français.**

### A.10 Verticales

`src/build/verticals/registry.ts` : registre **descriptif**, jamais un verrou.
`self_service` = un Playbook écrit à la main existe et a servi en production
(deck seul) ; `experimental` = reconnu, mais le Playbook livré est généré par
l'IA. `selfServiceSummary()` alimente la copie commerciale du SaaS Métré.

### A.11 Stripe

`src/lib/stripe.server.ts` : le client Stripe passe par
`https://connector-gateway.lovable.dev/stripe` avec des **identifiants de
connexion opaques**, pas des clés secrètes Stripe. `src/build/billing/*` traite
exclusivement l'abonnement SaaS Métré (plans, quotas, entitlements, sync).

---

## B. Ce que nous réutilisons tel quel

Aucune de ces briques n'est modifiée par la marketplace.

| Brique | Chemin |
| --- | --- |
| Schéma Playbook | `src/build/schema/playbook.ts` |
| Réponses / Brief / Résumé visiteur | `src/build/schema/{answers,brief,visitorSummary}.ts` |
| Moteur conditions | `src/build/engine/conditions.ts` |
| Moteur validation + contrôles de publication | `src/build/engine/validation.ts` |
| Vérificateur | `src/build/engine/consistency.ts` |
| Générateur de Dossier | `src/build/engine/brief.ts` |
| Résumé visiteur | `src/build/engine/visitorSummary.ts` |
| Les 13 composants de champ | `src/build/engine/fields/*` |
| Runtime public | `src/build/pages/public/MissionRuntime.tsx`, `/m/:publicToken` |
| API runtime (7 actions) | `src/routes/api/public/build-runtime.ts` |
| Project Canvas + projection | `src/build/pages/public/ProjectCanvas*.{tsx,ts}` |
| Stockage photos (2 buckets) | `src/build/storage/*` |
| Rendu de Dossier | `src/build/components/ProjectBriefView.tsx` |
| Lien sécurisé de résumé | `/project-summary/:accessToken` |
| Modèle d'autorisation | `assertAdmin` + `admin()` + RLS deny-all |
| Pattern de seed | `scripts/seedDeckPlaybook.ts` |

**Conséquence directe** : la marketplace ne code ni tunnel, ni conditions, ni
validation, ni upload photo, ni génération de dossier. Elle publie un Playbook
et lit un Dossier.

---

## C. Ce que nous étendons (et pourquoi)

### C.1 Registre des verticales — ajout de `bookbinding`

`src/build/verticals/registry.ts` reçoit une entrée `bookbinding`, en
`availability: "experimental"`.

**Pourquoi pas `self_service` alors qu'un Playbook écrit à la main existe ?**
Parce que `selfServiceVerticals()` alimente `selfServiceSummary()`, qui écrit
la copie commerciale montrée aux **clients SaaS de Métré** (« we can do deck »).
Basculer la reliure en `self_service` ferait dire au produit SaaS, devant des
poseurs de terrasses américains, qu'il sait aussi faire de la reliure. Le
registre lui-même documente la règle : `self_service` = « a hand-written
Playbook exists **and has been used in production** ». On bascule après les
premières transactions réelles, pas avant.

Le slug est `bookbinding` (anglais, minuscule, un mot) parce que c'est la
convention observée des identifiants internes (`deck`, `pergola`, `patio`,
`fence`) et que CLAUDE.md réserve le registre interne aux identifiants. Les
mots-clés couvrent les deux langues, comme `deck` couvre déjà `terrasse`.

### C.2 Publication d'une seconde verticale curatée

`scripts/seedBookbindingPlaybook.ts` est le **jumeau** de
`seedDeckPlaybook.ts` : mêmes tables, même validation Zod, même
`getPlaybookPublishIssues`, même idempotence (nouvelle version publiée
uniquement si le schéma a changé). Aucune abstraction de seed partagée n'est
créée : deux occurrences ne font pas une abstraction, et le script Deck est
volontairement autonome pour rester exécutable hors requête HTTP.

### C.3 Rien d'autre dans `src/build/engine/`

**Aucune extension du moteur n'est nécessaire pour le P0.** Vérifié champ par
champ contre le cahier des charges :

| Besoin marketplace | Couvert par | Vérification |
| --- | --- | --- |
| Intention de projet pilotant la suite | `single_choice` + `displayWhen` | Deck fait déjà `entryMode` |
| État du livre multi-sélection | `multi_choice` + `minSelected` | ✔ |
| Dimensions H × L × ép. | 3 × `measurement`, `unit: "cm"` | `cm` est dans `measurementUnit` |
| Budget en tranches € | `budget` `mode: "ranges"`, `currency: "EUR"` | `currency` est un `string`, pas un enum |
| Délai | `timeline` | ✔ |
| Photos du livre stockées | `photo` + `storage: "supabase_storage"` | ✔ (cf. A.6) |
| Photos d'inspiration | `inspiration_photo` | ✔ |
| Cas patrimonial → message | `derivedLines` + `alwaysIncludeLines` | ✔ |
| Cas > 1 000 € → revue manuelle | `derivedLines` (ligne de Dossier) **puis** lecture côté marketplace | cf. D.3 |
| Canvas « le projet prend forme » | `briefMapping.category` alimente les groupes du Canvas | ✔, zéro code |

> **`mm` n'existe pas** dans `measurementUnit` (`ft | in | m | cm | sqft | sqm`).
> Le brief d'intention demandait « cm ou mm selon ce que le moteur supporte
> proprement » : ce sera **cm**, avec une décimale, et l'exemple de Dossier du
> cahier des charges (`218 × 142 × 48 mm`) se lira `21,8 × 14,2 × 4,8 cm`.
> Aucun nouveau type de champ n'est créé pour ça.

### C.4 Extension différée : locale `fr-FR` (P2)

Le moteur ne connaît que `en-US` et `es-US`. Le Playbook Reliure est écrit
**en français dans sa donnée** (labels, options, aides, libellés de Dossier) —
c'est de la donnée, le moteur s'en moque. En revanche le *chrome* du runtime
(« Continue », « Back », « Your project ») reste anglais tant que `fr-FR`
n'existe pas.

L'extension propre, quand elle viendra, est en trois touches et **n'entre pas
dans le moteur** :
1. `fr-FR` dans `SUPPORTED_LOCALES` ;
2. un `FR_PUBLIC_COPY` et une branche dans `publicCopy` ;
3. une locale par défaut au niveau Mission (dans `missionProposalSchema`, qui
   est déjà le réceptacle des personnalisations non métier) — capacité
   générique, pas une exception Reliure.

`PUBLIC_LANGUAGE_OPTIONS` reste EN/ES : ajouter un bouton FR au sélecteur du
site marketing Métré serait une régression du produit SaaS.

---

## D. Ce que nous créons pour la marketplace

### D.1 Emplacement

```
src/marketplace/
  binders/       profils artisans, compétences, portfolio
  cases/         le pont Dossier Métré <-> transaction
  matching/      score + sélection admin (<= 3)
  quotes/        propositions des relieurs
  orders/        commandes, commission
  payments/      Stripe Connect — ISOLÉ de src/build/billing/
  shipments/     transport saisi manuellement
  inspections/   constats d'état
  messaging/     conversation par dossier
  reviews/       avis post-commande
```

**Aucune règle marketplace n'entre dans `src/build/engine/`.** Le moteur reste
générique ; il ne sait pas qu'une marketplace existe.

### D.2 Modèle de données

Toutes les tables sont `marketplace_*`, `service_role` only, RLS deny-all —
strictement le même modèle que `build_*` (A.7).

```
marketplace_binders            id, user_id, display_name, workshop_name, city,
                               postal_code, bio, years_experience, training,
                               avatar_path, status(draft|pending_review|approved|
                               rejected|suspended), capacity_slots, response_rate,
                               rating_avg, rating_count, stripe_account_id
marketplace_binder_skills      binder_id, skill_slug            <- slug libre, pas d'enum
marketplace_binder_portfolio   binder_id, title, description, before_photo_path,
                               after_photo_path, techniques[], materials[], year
marketplace_cases              id, dossier_id UNIQUE ──► build_dossiers(id),
                               mission_id, reference (RL-###), status,
                               manual_review_required, heritage_flag,
                               declared_value_band, admin_notes
marketplace_case_matches       case_id, binder_id, state(invited|declined|quoted|
                               selected), invited_at, responded_at   UNIQUE(case,binder)
marketplace_quotes             case_id, binder_id, description, technique,
                               materials, options, amount_cents, currency,
                               lead_time_weeks, caveats, valid_until, state
marketplace_orders             case_id, quote_id, binder_id, customer_user_id,
                               amount_cents, commission_bps, commission_cents,
                               status, stripe_payment_intent_id
marketplace_shipments          order_id, direction, carrier, tracking_number,
                               tracking_url, status, shipped_at, delivered_at
marketplace_inspections        order_id, kind(client_before_shipping|
                               binder_on_receipt|binder_before_return),
                               author_user_id, comment, photo_paths[], created_at
marketplace_order_amendments   order_id, explanation, extra_amount_cents,
                               new_lead_time_weeks, state(proposed|accepted|refused)
marketplace_messages           case_id, author_user_id, body, attachment_paths[]
marketplace_reviews            order_id UNIQUE, rating, quality, communication,
                               punctuality, comment
marketplace_disputes           order_id, opened_by, reason, state
```

**`marketplace_cases.dossier_id` est une référence, jamais une copie.** Les
réponses, les photos, le brief et le résumé visiteur restent dans
`build_dossiers` / `build_runtime_sessions` / les buckets Storage : une seule
source de vérité pour la qualification. Le seul instantané figé sera, plus
tard, celui du **devis accepté** au moment de la commande — parce que c'est un
document contractuel, pas parce que c'est pratique.

### D.3 Comment un Dossier devient un dossier marketplace

Le point le plus délicat de l'intégration. Trois options ont été examinées :

1. **Appeler la marketplace depuis `handleSubmitSession`** — refusé : cela fait
   entrer la marketplace dans le moteur générique (anti-pattern CLAUDE.md :
   « une Mission qui connaît le CRM »).
2. **Créer les cas paresseusement quand l'admin ouvre la liste** — acceptable
   pour un MVP concierge, mais l'instant de création n'est plus déterministe et
   l'analytics devient fausse.
3. **Un trigger Postgres `AFTER INSERT ON build_dossiers`** qui crée un
   `marketplace_case` **si et seulement si** la Mission est inscrite dans
   `marketplace_intake_missions` — retenu.

Le trigger est le seul choix qui laisse **zéro ligne de marketplace dans le
code du moteur** tout en restant atomique avec l'insertion du Dossier. La table
d'inscription rend l'appartenance explicite et donnée : une Mission Métré
ordinaire (Deck, client SaaS) n'y figure pas et ne produit aucun cas. Une
fonction serveur de réconciliation rattrape les Dossiers antérieurs à
l'inscription.

`manual_review_required` est calculé **côté marketplace** à l'ingestion, en
lisant les lignes du `ProjectBrief` déjà produites par le Playbook (le Playbook
pose une `derivedLine` « Valeur déclarée » ; la marketplace décide ce qu'elle en
fait). Le moteur n'apprend pas la règle des 1 000 €.

### D.4 Autorisations marketplace

| Acteur | Voit |
| --- | --- |
| Admin (`user_roles.admin`) | tout |
| Relieur | uniquement les cas où il a une ligne `marketplace_case_matches`, ou dont il est l'artisan de la commande |
| Client | uniquement ses propres cas (via `build_dossiers.visitor_email` / le compte lié) |

Le contrôle est **côté serveur**, dans les server functions marketplace, jamais
dans l'UI. Aucun relieur n'obtient un accès direct à `build_dossiers` : une
couche serveur marketplace projette le Dossier et ne renvoie que ce qui est
nécessaire.

**Données personnelles** : avant sélection du relieur, la projection retire
`visitor_email`, `visitor_name`, téléphone et adresse précise. Le relieur reçoit
le projet, les photos, le budget, le délai et la zone géographique (ville /
département), rien de plus.

### D.5 Modules purs et testés (le cœur de la logique marketplace)

- `matching/score.ts` — score 0–100 depuis le Brief + les compétences.
  Déterministe, pas d'IA. L'admin garde le dernier mot.
- `matching/selection.ts` — la règle des **3 relieurs maximum**.
- `orders/commission.ts` — **une seule** constante `DEFAULT_COMMISSION_BPS = 1500`
  (15 % en points de base, pour ne jamais manipuler de flottant sur de l'argent).
- `cases/state.ts` — transitions d'états, séparées des statuts de qualification.
- `cases/permissions.ts` — qui voit quoi, testable sans base.

### D.6 Statuts

Les statuts de **qualification** appartiennent à Métré et ne bougent pas :
`build_dossiers.status` (`draft | ready`) et `commercial_status`.

Les statuts de **transaction** appartiennent à la marketplace :
`under_review -> matching -> sent_to_binders -> quotes_received ->
binder_selected -> awaiting_payment -> paid -> shipping_to_binder ->
received_by_binder -> in_progress -> awaiting_approval -> shipping_to_customer
-> delivered -> completed`, plus `cancelled`. Aucun doublon avec les statuts
Métré : ils décrivent des choses différentes (« ce dossier est-il complet ? »
vs « où en est la transaction ? »).

---

## E. Mapping Métré → marketplace

| Objet Métré | Objet marketplace | Relation |
| --- | --- | --- |
| `build_playbooks` (Reliure) | — | l'expertise reliure, propriété de la plateforme |
| `build_playbook_versions` | — | version immuable pointée par la Mission |
| `build_missions` (Mission Reliure) | `marketplace_intake_missions` | inscription d'une Mission au flux marketplace |
| `/m/:publicToken` | CTA « Présenter mon livre » | la marketplace **lance** le runtime, ne le réimplémente pas |
| `build_runtime_sessions.answers` | — | jamais copié |
| `build_dossiers` | `marketplace_cases.dossier_id` | 1 ↔ 1, par référence |
| `ProjectBrief` (`content`) | vue dossier relieur | projeté, filtré, jamais dupliqué |
| `VisitorProjectSummary` | espace client « Mes livres » | réutilisé tel quel |
| Photos (`build-project-photos`) | galerie du dossier relieur | URL signée, même bucket |
| `build_dossier_access_tokens` | lien de suivi client | réutilisé |
| `next_questions` | « Informations manquantes » du dossier relieur | réutilisé |
| `build_workspaces` | le workspace **de la marketplace elle-même** | la marketplace est un client de Métré |
| `user_roles.admin` | back-office marketplace | réutilisé |
| — | `marketplace_binders` | n'existe pas côté Métré |
| `src/build/billing/*` (SaaS) | `src/marketplace/payments/*` | **strictement disjoints** |

---

## F. Risques

### F.1 Couplage

- **Risque** : la marketplace finit par lire directement des tables `build_*`
  partout, et le moteur devient impossible à extraire.
  **Mitigation** : un seul module de projection
  (`src/marketplace/cases/dossierProjection.ts`) a le droit de lire
  `build_dossiers`. Tout le reste passe par lui. Un test le vérifie.
- **Risque** : un besoin reliure pousse à ajouter un `if` dans le moteur.
  **Mitigation** : la table C.3 démontre que ce n'est pas nécessaire. Toute
  demande d'extension du moteur doit d'abord échouer à s'exprimer en donnée.

### F.2 Sécurité

- **Risque majeur** : donner aux relieurs un accès à `build_dossiers`.
  **Mitigation** : RLS deny-all conservée, projection serveur, et un test
  d'autorisation par acteur.
- **Risque** : fuite de données personnelles avant sélection du relieur.
  **Mitigation** : la projection « avant sélection » est une fonction distincte
  de la projection « après sélection », et c'est la restrictive qui est le
  défaut.
- **Risque** : un relieur devine l'id d'un cas.
  **Mitigation** : le contrôle est un `EXISTS` sur `marketplace_case_matches`,
  côté serveur, pas un filtre d'UI.

### F.3 Paiements — le risque le plus sérieux

`src/lib/stripe.server.ts` ne détient **pas** de clé secrète Stripe : il envoie
les requêtes à la passerelle connecteur Lovable avec un identifiant de connexion
opaque. Stripe **Connect** (comptes connectés, onboarding, `application_fee`,
`transfer_data`, payouts, webhooks Connect) n'est **pas démontré** sur ce
chemin.

**Conséquence pour le plan** : le P1 paiement commence par un *spike* qui
répond à une seule question — « la passerelle Lovable accepte-t-elle les appels
Connect ? ». Si non, il faudra une clé Stripe restreinte dédiée à la
marketplace, dans un module `src/marketplace/payments/` avec son **propre**
client Stripe, jamais celui du billing SaaS. Dans les deux cas, un test de
séparation garantit qu'une commande marketplace ne touche ni abonnement, ni
plan, ni entitlement (§66 du cahier des charges).

Aucun faux séquestre : l'UI dit « Paiement sécurisé », jamais « argent sous
séquestre ».

### F.4 Migrations

- Le dépôt est connecté à **Lovable** : ne jamais réécrire l'historique poussé
  (`AGENTS.md`).
- `src/integrations/supabase/types.ts` est un fichier généré : les tables
  marketplace doivent y être ajoutées dans le même format, sinon les server
  functions ne typent plus.
- Une migration qui touche une politique `build_*` est interdite. Les tables
  marketplace apportent leurs propres politiques.

### F.5 Langue

Le chrome du runtime restera anglais tant que `fr-FR` n'existe pas (C.4).
C'est **assumé pour le P0** : le premier jalon (§71) est « qualifier réellement
un livre et produire un Dossier correct », pas « tout est en français ». Le
Playbook, lui, est intégralement en français, donc l'écrasante majorité du
texte que lit le visiteur l'est aussi.

### F.6 Preuves sociales

En production, aucune note moyenne, aucun compteur de projets ou d'artisans
n'est affiché tant que les données ne sont pas réelles. Les données de
démonstration existent en seed uniquement et sont marquées comme telles.

---

## G. Plan d'implémentation

### P0 — Verticale Reliure (le moteur prouve qu'il sait faire une autre verticale)

1. Audit du moteur — **fait**, ce document.
2. `bookbinding` dans le registre des verticales (+ test).
3. `src/build/playbooks/bookbindingPlaybookSchema.ts` — le Playbook curaté.
4. Tests du Playbook : publiable, branches conditionnelles, règles de
   cohérence, Dossier généré conforme.
5. `scripts/seedBookbindingPlaybook.ts` + `npm run seed:bookbinding`.
6. Mission Reliure publiée sur `/m/:publicToken` (aucune route nouvelle).

### P0 — Marketplace (le Dossier devient une transaction)

7. Migration marketplace + types Supabase.
8. `marketplace_cases` + ingestion depuis `build_dossiers` (trigger + réconciliation).
9. Modules purs : score de matching, sélection <= 3, commission, transitions,
   permissions — tous testés.
10. Profils relieurs + compétences + portfolio.
11. Back-office admin : liste des demandes, écran de matching (Brief à gauche,
    relieurs à droite, 3 max).
12. Vue dossier relieur (projection filtrée, `ProjectBriefView` réutilisé).
13. Devis relieur.
14. Comparaison client (3 offres max, jamais « meilleur prix »).
15. Landing `/reliure` — « Donnez une nouvelle vie aux livres auxquels vous tenez ».

**Critère de sortie du P0** = le scénario §71 : ouvrir la Mission, qualifier un
livre, charger des photos, traverser des branches conditionnelles, soumettre,
obtenir un Project Brief correct, retrouver le dossier dans le back-office.
**Tant que ce scénario ne tourne pas, aucun code Stripe n'est écrit.**

### P1 — Transaction

16. Commande + commission.
17. *Spike* Stripe Connect via la passerelle Lovable (F.3), puis paiement.
18. Messagerie par dossier.
19. Transport saisi manuellement (`marketplace_shipments`).
20. Constats d'état (3 types).
21. Avenants.
22. Avis (uniquement après commande terminée et vérifiée).

### P2 — Finition

23. Locale `fr-FR` (C.4).
24. Analytics du tunnel marketplace, raccordée aux événements Métré existants
    plutôt que dupliquée.
25. SEO (`/reliure`, `/restauration-livre`, …).
26. E-mails transactionnels.
27. Optimisation du matching.

### Ce que nous ne construisons pas

Application native · matching IA · enchères · plus de 3 devis · pricing
automatique · diagnostic patrimonial IA · API transporteur · assurance ·
i18n complexe · abonnement relieur · wallet · séquestre maison · vidéo live.

---

---

## H. État de la livraison (8 septembre 2026)

### Livré sur `feat/reliure-marketplace-mvp`

| Point du plan | Où |
| --- | --- |
| 1. Audit | ce document |
| 2. Verticale `bookbinding` | `src/build/verticals/registry.ts` (+ test) |
| 3. Playbook Reliure | `src/build/playbooks/bookbindingPlaybookSchema.ts` |
| 4. Tests du Playbook | `bookbindingPlaybook.test.ts` (27 tests) |
| 5. Seed / publication | `scripts/seedBookbindingPlaybook.ts`, `npm run seed:bookbinding` |
| 6. Mission Reliure | seedée sur `/m/:publicToken`, aucune route nouvelle |
| 7. Migration marketplace | `supabase/migrations/20260908120000_marketplace_reliure.sql` + types |
| 8. Ingestion Dossier → cas | trigger `build_dossiers_marketplace_ingest` + `reconcileCaseTriage` |
| 9. Modules purs testés | `src/marketplace/{cases,matching,orders,quotes}` + `permissions.ts` |
| 10. Relieurs, compétences, portfolio | migration + `binders/skills.ts` + seed de démonstration |
| 11. Back-office matching | `/marketplace/cases`, `/marketplace/cases/:id` |
| 12. Vue dossier relieur | `/atelier`, `/atelier/cases/:id` |
| 13. Devis | `submitBinderQuote` + `quotes/rules.ts` |
| 14. Comparaison client | `/mes-livres`, `/mes-livres/:id` |
| 15. Landing | `/reliure` |
| 63. Seed de démonstration | `npm run seed:marketplace-demo` (6 relieurs, 8 projets) |

Tests : **1 102 verts sur 98 fichiers**, dont les **974 tests existants
inchangés** — non-régression Métré vérifiée avant et après (§65).

### Ce qui reste à faire à la main

Le dépôt local n'a pas de `SUPABASE_SERVICE_ROLE_KEY`, donc **aucun runtime de
Mission ne fonctionne en local** — y compris la démo Deck préexistante. Pour
dérouler le scénario §71 de bout en bout il faut, sur un projet Supabase réel :

1. appliquer `supabase/migrations/20260908120000_marketplace_reliure.sql` ;
2. `npm run seed:bookbinding` ;
3. `npm run seed:marketplace-demo` (facultatif, données de démonstration) ;
4. ouvrir `/m/reliure-marketplace-token-000001`.

Ces trois premières étapes touchent une base de données réelle : elles n'ont
pas été exécutées ici et attendent une décision explicite.

### Écarts assumés par rapport au cahier des charges

- **`mm` → `cm`** : le moteur ne connaît pas le millimètre (C.3).
- **Chrome du runtime en anglais** tant que `fr-FR` n'existe pas (C.4, F.5).
- **`storage: "supabase_storage"`** : le commentaire du schéma affirmait que ce
  mode n'était pas implémenté ; c'était faux et le commentaire a été corrigé
  (A.6). Aucun comportement n'a changé.
- **Commande, Stripe, transport, constats, avenants, avis** : P1, non
  construits — §71 interdit d'écrire du code Stripe avant que le premier jalon
  tourne, et §74 interdit de construire ce qui n'est pas nécessaire aux
  50 premières transactions.

---

## Règle de décision permanente

> Métré sait-il déjà faire cette partie ? Si oui, on la réutilise.
> Est-ce nécessaire aux 50 premières transactions ? Si non, on ne la construit
> pas maintenant.
