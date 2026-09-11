# Ma Reliure — passation entre agents

> Document de reprise. Il s'adresse à un agent (Codex, Claude Code, ou un
> humain) qui n'a aucun historique de conversation sur ce projet.
>
> **Lire d'abord le bloc [Latest handoff](#latest-handoff) en fin de document :
> il dit ce qui vient d'être fait et par quoi continuer.**
>
> Le code du dépôt est la source de vérité. Ce document décrit l'état réel
> constaté, pas l'état souhaité. Quand une chose n'existe qu'en spécification,
> elle est marquée `NON`.

---

## Start here

```bash
git clone https://github.com/antoineferriere2-star/mareliure.git
cd mareliure
git checkout feat/reliure-marketplace-mvp
npm install
cp .env.example .env
# remplir .env — voir §I. Aucune valeur n'est fournie dans ce dépôt.
npm run dev            # http://localhost:8080
```

Avant de coder :

```bash
git fetch --all --prune
git status
git log -5 --oneline
```

Avant de rendre la main :

```bash
npm test               # vitest run
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run build          # vite build (preset Nitro cloudflare-module)
```

Node 24.14 / npm 11.9 sur la machine de référence. Rien n'exige cette version
précise ; Node 20+ suffit.

> **Piège du premier lancement.** Sans `SUPABASE_SERVICE_ROLE_KEY` dans `.env`,
> les pages publiques s'affichent mais le runtime de Mission (`/m/:publicToken`)
> échoue : il lit la base côté serveur. Ce n'est pas une régression. Vérifier la
> variable avant de chercher un bug ailleurs.

---

## A. Produit

Ma Reliure est une **marketplace gérée** de reliure et de restauration de
livres. Site public : <https://mareliure.fr>.

Positionnement : _un projet compris, un prix clair et un artisan adapté._

Le parcours visé :

1. le visiteur présente son livre sur la landing ;
2. il répond au **Guided Project Intake** Métré (`/m/:publicToken`) ;
3. il ajoute ses photos ;
4. le moteur produit un **Project Brief** ;
5. Ma Reliure estime le projet ;
6. Ma Reliure sélectionne un atelier ;
7. l'atelier **accepte ou refuse** la rémunération proposée ;
8. le client paie Ma Reliure ;
9. Stripe Connect répartira ensuite les fonds.

Ma Reliure n'est **pas** un comparateur de devis, pas une enchère, et pas un
moteur où les artisans se battent sur le prix. Le client ne compare pas
plusieurs prix de relieurs.

> **Le code applique ce positionnement depuis le 9 septembre 2026.** Le modèle
> de devis — le relieur saisissait son prix, le client comparait — a été
> remplacé par l'offre gérée : Ma Reliure fixe `customer_price`, propose
> `binder_payout`, l'atelier accepte ou refuse. Voir §E.
>
> Ce qui reste à faire n'est plus le modèle mais son épreuve du réel : le
> parcours n'a pas encore été déroulé dans un navigateur, et la migration
> n'est appliquée que sur le projet de développement.

Contrainte éditoriale permanente : **ne rien fabriquer**. Aucun nombre de
clients, aucune note, aucun avis, aucune réalisation, aucun nom d'artisan,
aucune certification qui ne soit réel et vérifiable.
`src/marketplace/pages/landing/landingHonesty.test.ts` fait échouer la suite si
la landing se met à afficher une note, des étoiles, des avis, un compteur de
clients ou un tarif fixe.

---

## B. Architecture

| Couche      | Technologie                                                           |
| ----------- | --------------------------------------------------------------------- |
| Framework   | TanStack Start (Router + `createServerFn`)                            |
| Build       | Vite 8 · Nitro 3 (preset `cloudflare-module`)                         |
| UI          | React 19 · Tailwind 4 (`@theme` dans `src/styles.css`) · shadcn/Radix |
| Langage     | TypeScript strict · Zod 3                                             |
| Données     | Supabase (Postgres + Auth + Storage)                                  |
| Hébergement | Cloudflare Workers                                                    |
| Tests       | Vitest (node) · Playwright (e2e)                                      |

### Séparation absolue

```
src/build/        moteur générique Métré Build  — ne connaît aucun métier
src/marketplace/  logique Ma Reliure            — consomme le moteur
```

**Règle absolue : aucune règle commerciale Ma Reliure ne doit entrer dans le
moteur générique.** Concrètement, on ne doit jamais trouver `if (bookbinding)`,
`if (reliure)` ni aucune constante de reliure sous `src/build/engine/`,
`src/build/schema/` ou `src/build/pages/public/`.

Si un besoin métier apparaît, l'ordre des questions est :

1. **Le Playbook sait-il déjà l'exprimer ?** (questions, conditions, règles de
   validation, `briefConfig`) → l'écrire dans
   `src/build/playbooks/bookbindingPlaybookSchema.ts`, qui est de la **donnée**.
2. Sinon, **est-ce une capacité générique manquante du moteur ?** → l'ajouter
   au moteur sans mention du métier, avec ses tests.
3. Sinon, **c'est de la logique marketplace** → `src/marketplace/`.

Avant toute fonctionnalité, se demander : _« Métré sait-il déjà faire cette
partie ? »_ Le réflexe inverse — réécrire dans la marketplace ce que le moteur
fait déjà — est le principal risque de ce projet.

### Marque

Une seule base de code sert deux marques publiques. `src/brand.ts` lit la
constante de build `VITE_PUBLIC_BRAND` :

- non définie ou `metre` → `/` sert la page d'accueil Métré Build ;
- `mareliure` → `/` sert la landing Ma Reliure.

C'est une constante de **build**, pas d'exécution : le bundler supprime la
branche non retenue. Aucun reniflage d'hôte, aucune redirection.

---

## C. Métré Core — la chaîne d'objets

```
build_playbooks.draft_schema
  → build_playbook_versions.schema      (immuable, publiée)
    → build_missions                    (playbook_version_id + public_token)
      → /m/:publicToken                 (runtime public)
        → build_runtime_sessions.answers + photos (Storage)
          → build_dossiers              (Project Brief + visitor_summary)
            → marketplace_cases         (via trigger Postgres)
```

Fichiers réellement utilisés, tous vérifiés présents :

| Fichier                                            | Rôle                                                |
| -------------------------------------------------- | --------------------------------------------------- |
| `src/build/schema/playbook.ts`                     | schéma Zod d'un Playbook                            |
| `src/build/engine/conditions.ts`                   | affichage conditionnel des étapes                   |
| `src/build/engine/validation.ts`                   | validation des réponses                             |
| `src/build/engine/consistency.ts`                  | le « Vérificateur » (pièges métier déclarés)        |
| `src/build/engine/brief.ts`                        | fabrication du Project Brief                        |
| `src/build/engine/visitorSummary.ts`               | résumé rendu au visiteur                            |
| `src/build/engine/fields/`                         | types de champs (photo, mesure, choix…)             |
| `src/build/pages/public/MissionRuntime.tsx`        | le runtime public                                   |
| `src/build/playbooks/bookbindingPlaybookSchema.ts` | **le Playbook Reliure — de la donnée, pas du code** |
| `src/build/verticals/registry.ts`                  | registre des verticales                             |
| `src/build/constants.ts`                           | `BOOKBINDING_PUBLIC_TOKEN`                          |

### Vocabulaire imposé

Voir `CLAUDE.md` à la racine, qui s'applique à tout agent. En résumé :

- **interdits** partout (code, UI, commentaires, commits) : `Formulaire`,
  `Questionnaire`, `Lead`, `Conversion` (comme nom d'objet), `Prompt`,
  `Utilisateur` ;
- **registre interne** (tables, types, commits) : `Mission`, `Playbook`,
  `Dossier Commercial` ;
- **registre client** (tout ce qu'un visiteur lit) : `Project Intake`,
  `Playbook`, `Project Brief`.

`bookbinding` est un **identifiant technique** (`MARKETPLACE_VERTICAL_ID`,
tables `marketplace_*`). Le nom public est **Ma Reliure**, et seulement lui.
Ne pas renommer les identifiants stables pour une décision marketing.

---

## D. État fonctionnel

Constaté sur le code au commit `0e6f0b7`. `PARTIEL` signifie : le code existe
et les tests unitaires passent, mais quelque chose de nommé manque.

| Fonction                                                | État    | Chemin principal                                             | Tests                                                        |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Landing Ma Reliure                                      | **OK**  | `src/marketplace/pages/ReliureLanding.tsx`, `pages/landing/` | `landingHonesty.test.ts`                                     |
| Marque `/` par environnement                            | **OK**  | `src/brand.ts`, `src/routes/index.tsx`                       | —                                                            |
| Playbook Reliure                                        | **OK**  | `src/build/playbooks/bookbindingPlaybookSchema.ts`           | `playbookIntegrity.test.ts`                                  |
| Runtime Mission                                         | **OK**  | `src/build/pages/public/MissionRuntime.tsx`                  | plusieurs                                                    |
| Localisation `fr-FR`                                    | **OK**  | `src/build/i18n/runtimeChrome.ts`                            | `runtimeChrome.test.ts`                                      |
| Upload de photos                                        | **OK**  | `src/build/engine/fields/`, Supabase Storage                 | —                                                            |
| Project Canvas                                          | **OK**  | `src/build/pages/public/ProjectCanvas.tsx`                   | `ProjectCanvas.test.ts`                                      |
| Project Brief                                           | **OK**  | `src/build/engine/brief.ts`                                  | `brief.test.ts`                                              |
| Ingestion `marketplace_cases`                           | **OK**  | trigger `build_dossiers_marketplace_ingest`                  | `migrationContract.test.ts`                                  |
| Lecture du Dossier par la marketplace                   | **OK**  | `cases/caseProfile.ts`, `cases/dossierProjection.ts`         | `caseProfile.test.ts`, `dossierProjection.test.ts`           |
| Triage (drapeaux)                                       | **OK**  | `cases/triage.ts`                                            | `triage.test.ts`, `triageContract.test.ts`                   |
| Machine à états du dossier                              | **OK**  | `cases/state.ts`                                             | `state.test.ts`                                              |
| Propriété client (claim par jeton)                      | **OK**  | `cases/ownership.ts`, `permissions.ts`                       | `ownership.test.ts`, `permissions.test.ts`                   |
| Matching (score + sélection ≤ 3)                        | **OK**  | `matching/score.ts`, `matching/selection.ts`                 | `matching.test.ts`                                           |
| Commission (bps, centiemes entiers)                     | **OK**  | `orders/commission.ts`                                       | `commission.test.ts`                                         |
| Garde-fou secrets                                       | **OK**  | `secretsContract.test.ts`                                    | lui-même                                                     |
| Écran admin (dossiers, relieurs, matching)              | **OK**  | `pages/admin/`                                               | logique testée + parcours complet vérifié au navigateur      |
| Espace atelier                                          | **OK**  | `pages/binder/`                                              | idem                                                         |
| Espace client (« Mes livres »)                          | **OK**  | `pages/customer/`                                            | idem                                                         |
| Offre gérée (accepte / refuse)                          | **OK**  | `quotes/rules.ts` (lecture historique), fonctions Postgres   | `managedMarketplaceContract.test.ts`                         |
| Pricing Ma Reliure (`customer_price` / `binder_payout`) | **OK**  | `src/marketplace/pricing/`                                   | `pricing.test.ts`, `managedPricingMigrationContract.test.ts` |
| Stripe Connect / paiements                              | **NON** | —                                                            | —                                                            |
| Expédition, inspection, avenants, avis                  | **NON** | —                                                            | —                                                            |
| Fiche atelier alimentée par la base                     | **NON** | vitrine en dur dans `pages/landing/content.ts`               | —                                                            |

### Le parcours vérifié au navigateur

Boucle complète exercée le 8 septembre 2026 sur la base de développement, avec
trois comptes réels :

1. **admin** — ouverture de RL-007, lecture du Brief projeté (état, matière,
   valeur déclarée, réserves du Vérificateur avec leur provenance), levée de la
   revue manuelle (`clearCaseManualReview`), sélection de trois relieurs parmi
   cinq classés, envoi (`sendCaseToBinders`). Le plafond de trois se referme :
   « 0 invitation(s) restante(s) », les invités passent en « Déjà invité », et
   leur score baisse parce que leur charge en cours a augmenté ;
2. **atelier** — le relieur invité voit exactement le dossier sur lequel il a
   été invité, et rien d'autre. Les coordonnées du client lui sont refusées
   (« vous seront transmises s'il retient votre proposition »). Proposition
   soumise (`submitBinderQuote`), affichée avec la réserve d'inspection ;
3. **cliente** — connexion, revendication automatique par e-mail vérifié de son
   propre dossier, lecture du détail.

Aucune requête en échec sur ces parcours.

Ce qui manque encore : après connexion, un relieur et un client atterrissent
sur le portail client Métré, pas sur `/atelier` ni `/mes-livres`. Il faut y
naviguer à la main. C'est une redirection à écrire, pas une panne.

---

## E. Modèle commercial

### Décision actuelle (cible)

Ma Reliure fixe **`customer_price`** et propose au relieur **`binder_payout`**.

```
customer_price = 490 €
binder_payout  = 400 €
gross_margin   =  90 €
```

Le relieur **ACCEPTE** ou **REFUSE**. Il ne rédige pas un devis concurrent. Le
client ne compare pas plusieurs prix.

Au MVP, le pricing reste **suggestion automatique → validation humaine par un
admin**. Aucune décision de prix entièrement automatique.

### Ce que le code fait aujourd'hui

Exactement cela, depuis `52d0861`.

`src/marketplace/pricing/` calcule une suggestion déterministe à partir des
réponses structurées du Dossier — `pricing.rules.ts` porte la grille,
`pricing.engine.ts` l'applique, `pricing.types.ts` déclare des codes de raison
stables séparés de leurs libellés français. La marge minimale est vérifiée en
base, pas seulement dans le code.

`marketplace_quotes` ne stocke plus un devis mais l'offre gérée présentée à un
atelier : `customer_price_cents`, `binder_payout_cents`, `accepted_at`,
`declined_at` et un motif de refus parmi une liste fermée. Trois fonctions
Postgres rendent atomiques la validation du prix, la réponse de l'atelier et la
sélection ; `marketplace_events` journalise le tout derrière une RLS deny-all.

> **La grille tarifaire est un point de départ, pas un tarif.** Les montants de
> `PAYOUT_RULES` — 140 € de base en réparation, 180 € de supplément plein cuir,
> etc. — ont été posés pour que le moteur produise quelque chose, pas parce
> qu'ils sont justes. Ils doivent être calibrés avec un relieur réel avant
> qu'un prix atteigne un client. La validation humaine exigée par ce chapitre
> est ce qui rend cet état acceptable en attendant.

`quotes/rules.ts` subsiste pour lire les dossiers antérieurs. Aucune server
function active n'y crée plus de prix d'atelier.

### Règle non négociable

**Ne jamais analyser le texte du Project Brief pour prendre une décision
machine.** Le Brief est de la prose destinée à un humain ; un changement de
libellé français ne doit jamais modifier un triage, un score ou un prix. Toute
décision lit `build_runtime_sessions.answers` — des valeurs d'option stables,
déclarées dans `caseProfile.ts`. `triageContract.test.ts` verrouille cette
règle.

---

## F. Workflow cible et état

| Étape                  | État                                     |
| ---------------------- | ---------------------------------------- |
| Visitor → Métré Intake | **OK**                                   |
| Project Brief          | **OK**                                   |
| Marketplace Case       | **OK** (trigger d'ingestion)             |
| Pricing                | **OK** (suggestion + validation humaine) |
| Validation admin       | **OK**                                   |
| Matching               | **OK**                                   |
| Binder Offer           | **OK**                                   |
| Binder accepts         | **OK**                                   |
| Customer price         | **OK**                                   |
| Payment                | **NON**                                  |
| Shipment               | **NON**                                  |
| Inspection             | **NON**                                  |
| Work                   | **NON**                                  |
| Amendment              | **NON**                                  |
| Return                 | **NON**                                  |
| Review                 | **NON**                                  |

---

## G. Base de données

Migration marketplace : `supabase/migrations/20260908120000_marketplace_reliure.sql`
(57 migrations au total dans le dossier, dont 56 héritées de Métré Build).

| Table                          | Rôle                                                 | Relations                                               |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------- |
| `marketplace_intake_missions`  | déclare qu'une Mission Métré alimente la marketplace | → `build_missions`                                      |
| `marketplace_binders`          | les ateliers référencés                              | → `auth.users`                                          |
| `marketplace_binder_skills`    | savoir-faire d'un atelier (matching)                 | → `marketplace_binders`                                 |
| `marketplace_binder_portfolio` | pièces d'un atelier                                  | → `marketplace_binders`                                 |
| `marketplace_cases`            | un livre confié = un dossier marketplace             | → `build_dossiers`, → `auth.users` (`customer_user_id`) |
| `marketplace_case_matches`     | un atelier sollicité sur un dossier (≤ 3)            | → `marketplace_cases`, → `marketplace_binders`          |
| `marketplace_quotes`           | une proposition de prix                              | → `marketplace_case_matches`                            |

Fonctions et déclencheurs :

- `marketplace_ingest_dossier()` + trigger `build_dossiers_marketplace_ingest`
  (AFTER INSERT sur `build_dossiers`) : crée le `marketplace_case`. Conditionné
  à `marketplace_intake_missions`, avale ses erreurs, `ON CONFLICT DO NOTHING`.
  **Le moteur Métré ignore que la marketplace existe** — c'est le point de
  couture, et il est en base, pas dans le code.
- `marketplace_ingest_missing_cases()` : RPC de rattrapage idempotent.
- `marketplace_enforce_match_ceiling()` + trigger AFTER INSERT : plafond de
  3 ateliers par dossier, vérifié en base en plus du code.

### Règle de non-duplication

**Ne jamais recopier `answers`, les photos ou le Project Brief dans une table
`marketplace_*`.** Métré les possède déjà. `marketplace_cases.dossier_id`
référence le Dossier ; la marketplace le lit par projection
(`cases/dossierProjection.ts`). Dupliquer, c'est créer deux vérités qui
divergeront.

### Sécurité

`build_*` et `marketplace_*` sont en RLS **deny-all** pour `anon` et
`authenticated` (`USING (false) WITH CHECK (false)`). Tout accès passe par le
`service_role`, côté serveur uniquement. **Ne jamais modifier une politique
`build_*` pour faire fonctionner une fonctionnalité marketplace.**

---

## H. Supabase

### Trois références de projet coexistent — attention

| Ref                    | Rôle                                        | Où elle apparaît             |
| ---------------------- | ------------------------------------------- | ---------------------------- |
| `hljxohondjvrkzqicexl` | **production**, celle que sert mareliure.fr | secrets du Worker Cloudflare |
| `qwfhebtxeubfmvvdsqdt` | **développement / test**                    | `.env` local (non versionné) |
| `imivilculbdgjvmfyohz` | projet Métré Build d'origine (Lovable)      | `supabase/config.toml`       |

> **Piège.** `supabase/config.toml` porte encore `project_id = "imivilculbdgjvmfyohz"`.
> Un `npx supabase db push` sans `link` explicite viserait ce projet-là, qui
> n'est pas Ma Reliure. **Toujours faire `supabase link --project-ref <REF>`
> avant tout push**, et vérifier la cible affichée.

État constaté en production le 8 septembre 2026 :

- 57 migrations enregistrées dans `supabase_migrations.schema_migrations` ;
- 7 tables `marketplace_*` présentes ;
- 1 `marketplace_intake_missions` (la Mission Reliure) ;
- 0 `build_dossiers`, 0 `marketplace_cases`, 0 session du tunnel : l'unique
  dossier de test du lancement (RL-002, 8 septembre) a été supprimé le
  10 septembre 2026, avec sa session, sa photo dans `build-project-photos`
  et une session vide ouverte pendant le même essai ;
- 0 `marketplace_binders`.

Le jeton de gestion utilisé pour l'audit n'a **plus** accès au projet
`qwfhebtxeubfmvvdsqdt` (« account does not have the necessary privileges ») :
son état n'a pas pu être vérifié.

### Configuration d'authentification en production

| Réglage              | Valeur                 |
| -------------------- | ---------------------- |
| `site_url`           | `https://mareliure.fr` |
| `disable_signup`     | `true`                 |
| `mailer_autoconfirm` | `false`                |

> **Les inscriptions publiques sont fermées.** C'était le bon réglage le jour
> où le seul compte à créer était celui de l'administrateur, sur un site sans
> client. Ce ne l'est plus dès qu'un premier livre arrive : **une cliente qui
> reçoit son lien de suivi ne peut pas revendiquer son dossier sans se créer un
> compte**, et un relieur ne peut pas s'inscrire non plus. À rouvrir avant la
> première mise en relation réelle, via l'API de gestion ou le tableau de bord
> Supabase (`Authentication → Sign In / Providers → Allow new users to sign up`).
>
> `mailer_autoconfirm` reste à `false`, donc une inscription demandera une
> confirmation par e-mail — expédiée par l'expéditeur Supabase par défaut, dont
> la délivrabilité est faible. Ce point est à traiter en même temps que la
> réouverture, pas après.

### Commandes

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>   # obligatoire, voir le piège
npx supabase db push

npm run seed:bookbinding        # sème le Playbook Reliure + sa Mission
npm run seed:marketplace-demo   # données de démonstration marketplace
npm run seed:deck               # Playbook de démonstration Métré (Deck)
```

Les identifiants viennent de l'environnement local (`.env`) ou du CLI Supabase.
**Aucun secret ne doit être demandé, écrit ni commité.**

---

## I. Variables d'environnement

Source unique : **`.env.example`**, versionné et sans aucune valeur réelle.
Copier en `.env` (ignoré par git). Ci-dessous les **noms** uniquement.

**Public / client** — présentes dans le bundle navigateur :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_PUBLIC_BRAND` — `metre` (défaut) ou `mareliure`

**Serveur uniquement** — ne doivent jamais atteindre le navigateur :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` — contourne la RLS ; **aucune variante `VITE_`
  ne doit exister**
- `IP_HASH_SALT`

**Optionnelles** :

- `LOVABLE_API_KEY`, `LOVABLE_AI_MODEL` — moteur IA
- `STRIPE_SANDBOX_API_KEY`, `STRIPE_LIVE_API_KEY`,
  `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `PAYMENTS_LIVE_WEBHOOK_SECRET` —
  abonnements SaaS Métré, **sans rapport** avec les paiements marketplace
- `METRE_ANALYTICS_TOKEN`

**Déploiement** : les mêmes variables serveur, poussées comme _secrets_ du
Worker (`npm run secrets:mareliure`), plus `VITE_PUBLIC_BRAND=mareliure` au
moment du build.

`src/marketplace/secretsContract.test.ts` échoue si une clé secrète devient
lisible depuis le bundle client, ou si un `sb_secret_…` apparaît dans les
assets construits.

---

## J. Cloudflare

> ### ✅ Les deux migrations sont en production
>
> Appliquées le 9 septembre 2026 sur `hljxohondjvrkzqicexl` :
> `20260908210000_managed_pricing_offers` et
> `20260909120000_pricing_reference_system`. 59 migrations locales,
> 59 enregistrées en production.
>
> **Par l'API de gestion, pas par le CLI.** Le CLI ne joint la base de
> production qu'en IPv6 (`db.<ref>.supabase.co`), que ce réseau ne route pas,
> et il ne peut emprunter le pooler IPv4 sans le mot de passe Postgres — que
> `supabase link` ne demande plus. La voie qui fonctionne, avec
> `SUPABASE_ACCESS_TOKEN` (voir `.env.supabase`) :
>
> ```
> POST https://api.supabase.com/v1/projects/<ref>/database/query
> body: { "query": "<le SQL>" }
> ```
>
> Elle sert aussi à lire `supabase_migrations.schema_migrations`, ce que l'API
> REST ne permet pas — le schéma n'est pas exposé. **Toujours comparer
> l'historique réel aux fichiers locaux avant de pousser** : si la production
> annonçait 59 migrations en attente au lieu de 2, rejouer les 56 héritées de
> Métré sur une base qui tourne ne serait pas anodin.
>
> Vérifié après coup : les quatre tables répondent, `pricing_status` accepte
> `manual_review`, les 45 travaux du catalogue sont semés, les trois nouvelles
> tables sont en `USING (false) WITH CHECK (false)` — une écriture avec la clé
> publique rend 401 — et aucune donnée d'essai n'a suivi : 0 grille, 0 entrée
> de Pricebook, 0 relieur.
>
> **Déployé le 10 septembre 2026** — Worker `mareliure`, version
> `292966bd-4c92-402a-9a19-593f355b9d9a`, commit `b2ff563`. Code et base de
> production sont alignés.

|               |                                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| Hébergement   | Cloudflare Workers (offre gratuite)                                           |
| Nom du Worker | `mareliure`                                                                   |
| URL technique | <https://mareliure.aferriere.workers.dev>                                     |
| Domaine       | `mareliure.fr` (custom domain attaché au Worker)                              |
| Registrar     | OVH                                                                           |
| DNS           | Cloudflare (la zone OVH est inerte depuis le changement de NS)                |
| Preset Nitro  | `cloudflare-module` (défaut du projet, **ne pas basculer sur `node-server`**) |
| Flag requis   | `nodejs_compat` (pour `node:crypto`)                                          |
| Binding       | `ASSETS`                                                                      |

Il n'y a **pas** de `wrangler.toml` ni de `wrangler.jsonc` à la racine : Nitro
génère `.output/server/wrangler.json` et `.wrangler/deploy/config.json` au
build. C'est pour cela que le script de déploiement passe `--name mareliure`.

```bash
# construire pour Ma Reliure — lit .env.production.mareliure et vérifie l'artefact
npm run build:mareliure

# construire puis déployer
npm run deploy:mareliure

# pousser les secrets serveur
npm run secrets:mareliure         # npx wrangler secret bulk --name mareliure
```

### Ne jamais déployer un `npm run build` nu

La configuration Supabase du **navigateur** est figée dans le bundle au moment
du build. Un build lancé sans elle ne plante pas : il en prend une autre,
silencieusement.

C'est arrivé. Pendant une journée, mareliure.fr a servi un bundle qui pointait
le navigateur vers le projet Métré d'origine, pendant que le serveur parlait au
bon. Rien ne s'est vu — la landing est statique et le runtime passe par des
server functions — et ça se serait vu à la première connexion d'un client.

`scripts/buildMaReliure.mjs` referme ce trou : il lit
`.env.production.mareliure`, refuse de démarrer si la marque ou le projet
manquent, puis **relit les fichiers JavaScript produits** et échoue s'ils
référencent un autre projet que celui attendu. Une vérification sur l'artefact,
pas sur l'intention. `deploy:mareliure` passe obligatoirement par lui.

Limites de l'offre gratuite à surveiller : 100 000 requêtes/jour et **10 ms de
CPU par requête**. Le script fait environ 1,1 Mo gzip pour un plafond de 3 Mo.

### Réglages restants, à faire dans le tableau de bord Cloudflare

Le jeton OAuth de `wrangler` n'a que `zone (read)` ; ces deux réglages ne
peuvent pas être posés en ligne de commande :

1. **SSL/TLS → Edge Certificates → Always Use HTTPS** → activer
   (aujourd'hui `http://mareliure.fr` répond 200 en clair) ;
2. **Rules → Redirect Rules** : `www.mareliure.fr` → 301 vers
   `concat("https://mareliure.fr", http.request.uri.path)`
   (aujourd'hui `www` sert l'application au lieu de rediriger).

---

## K. GitHub et remotes

### Dépôt principal

**<https://github.com/antoineferriere2-star/mareliure>**

Branches sur ce dépôt (identiques au commit près) :

- `main` — état stable Ma Reliure ;
- `feat/reliure-marketplace-mvp` — **la branche de travail actuelle**.

### État réel des remotes dans le clone de référence

Le clone utilisé jusqu'ici est un clone du dépôt Métré auquel un remote
`mareliure` a été ajouté. **Les noms sont donc inversés par rapport à la
convention** :

```
origin      https://github.com/Antoineoppe/m-tr-build-ai.git      (moteur Métré)
mareliure   https://github.com/antoineferriere2-star/mareliure.git (Ma Reliure)
metreoppe   https://github.com/Antoineoppe/metreoppe.git           (autre dépôt Métré)
```

Ces remotes n'ont **pas** été renommés pour faire joli : ils sont décrits tels
qu'ils sont.

**Un clone neuf depuis le dépôt principal donne la configuration attendue**, et
c'est celle à privilégier :

```bash
git clone https://github.com/antoineferriere2-star/mareliure.git
cd mareliure
git remote add upstream https://github.com/Antoineoppe/m-tr-build-ai.git
```

→ `origin` = Ma Reliure, `upstream` = moteur Métré.

### Récupérer les évolutions du moteur Métré

```bash
git fetch upstream
git log --oneline HEAD..upstream/main -- src/build/    # ce qui a bougé côté moteur
git merge upstream/main                                # ou cherry-pick ciblé
```

Attention : `upstream/main` contient aussi le site marketing Métré. Préférer un
`cherry-pick` ciblé sur `src/build/` à une fusion large.

---

## L. Alternance Claude Code ↔ Codex

**Un seul agent travaille à la fois. Jamais deux agents sur la même branche en
même temps.**

Avant de quitter une session, l'agent actif doit :

1. lancer les tests pertinents (`npm test`) ;
2. `npm run typecheck` ;
3. vérifier `git status` — le working tree doit être propre ou son état
   expliqué ;
4. committer ses modifications ;
5. pousser si les permissions le permettent ;
6. mettre à jour ce document si l'architecture ou l'état fonctionnel a changé ;
7. **ajouter un nouveau bloc `## Latest handoff` en fin de document**, en
   remplaçant le précédent.

L'agent suivant **commence par lire ce bloc**, puis `git fetch --all --prune`,
`git status`, `git log -5 --oneline`.

Ne jamais commencer à coder sur un working tree sale sans avoir compris
pourquoi il l'est.

Format du bloc :

```markdown
### (exemple) Latest handoff

Agent:
Date:
Branch:
Commit:
Completed:
In progress:
Next recommended task:
Known issues:
Do not touch:
```

---

## M. Convention de branches

```
main                  état stable Ma Reliure
feat/<feature>        nouvelle fonctionnalité
fix/<bug>             correction
chore/<task>          outillage, dépendances, documentation
```

Pas de GitFlow, pas de branche `develop`.

Le travail en cours est sur **`feat/reliure-marketplace-mvp`**, et `main`
pointe aujourd'hui sur le même commit. Continuer sur cette branche tant que le
P0 marketplace n'est pas clos ; ouvrir une `feat/*` dédiée pour le passage au
modèle prix fixe (§E), qui est un chantier distinct.

---

## N. Commandes

```bash
npm run dev                 # serveur de développement, port 8080
npm run build               # build de production (Nitro cloudflare-module)
npm run build:dev           # build en mode development
npm run preview             # prévisualisation du build

npm test                    # vitest run
npm run typecheck           # tsc --noEmit
npm run lint                # eslint .
npm run format              # prettier --write .
npm run test:e2e            # playwright test
npm run test:e2e:ui         # playwright --ui

npm run seed:bookbinding    # Playbook Reliure + Mission
npm run seed:marketplace-demo
npm run seed:deck

npm run build:mareliure     # build de production + vérification du bundle
npm run deploy:mareliure    # build:mareliure puis wrangler deploy
npm run secrets:mareliure   # wrangler secret bulk --name mareliure
```

---

## O. Tests

| Commande                  | Dernier résultat connu (8 septembre 2026)                  |
| ------------------------- | ---------------------------------------------------------- |
| `npm test`                | **1349 tests, 105 fichiers, tous verts**                   |
| `npm run typecheck`       | **propre**                                                 |
| `npm run lint`            | **échoue sur une copie de travail CRLF — voir ci-dessous** |
| `npm run build:mareliure` | **OK**, bundle vérifié                                     |
| `npm run test:e2e`        | **non exécuté récemment** — 3 specs sous `e2e/`            |

### Le lint et les fins de ligne

Le dépôt est stocké en LF et Prettier l'exige. Sur Windows, Git for Windows
sort les fichiers en CRLF par défaut (`core.autocrlf=true`) : ESLint signale
alors `Delete ␍` sur chaque ligne de chaque fichier — plus de 40 000 erreurs
qui ne disent rien du code.

Le piège est qu'un lint restreint aux fichiers qu'on vient de formater passe :
Prettier les a réécrits en LF. Seul `npm run lint` sur tout le dépôt révèle le
problème, et il ressemble alors à une catastrophe alors qu'il n'y a rien à
corriger dans le code.

`.gitattributes` impose désormais `eol=lf`. Sur un clone déjà en CRLF,
appliquer une fois :

```bash
git add --renormalize .
```

Ne **jamais** lancer `eslint . --fix` pour faire taire ces erreurs : cela
réécrirait tous les fichiers du dépôt.

Tests structurants à ne pas affaiblir :

- `src/marketplace/migrationContract.test.ts` — clés étrangères, `ON DELETE`,
  contraintes, RLS, absence de fuite de données personnelles ;
- `src/marketplace/secretsContract.test.ts` — la clé de service ne quitte pas
  le serveur ;
- `src/marketplace/cases/triageContract.test.ts` — un changement de libellé
  français ne modifie aucun triage ;
- `src/build/i18n/runtimeChrome.test.ts` — couverture FR/EN/ES et interdiction
  des comparaisons de locale en dur dans le runtime ;
- `src/marketplace/pages/landing/landingHonesty.test.ts` — la landing n'invente
  rien, et chaque photographie déclarée existe sur le disque.

## P. À ne pas casser

- la démo Deck Métré existante ;
- `MissionRuntime` et le runtime public `/m/:publicToken` ;
- le moteur de Playbook (`src/build/engine/`) ;
- l'upload et le rendu des photos ;
- le Project Canvas ;
- le Project Brief ;
- le Visitor Summary ;
- le billing SaaS Métré (`src/lib/stripe.server.ts`) ;
- l'authentification ;
- les politiques RLS ;
- la séparation `src/build` / `src/marketplace`.

Aucun changement Reliure ne doit introduire un `if (bookbinding)` dans le
moteur générique si le besoin peut s'exprimer dans un Playbook ou sous
`src/marketplace/`.

---

## Q. À ne pas construire sans validation explicite

Ces chantiers ne doivent pas être commencés sans un ordre explicite :

- Stripe Connect, wallet, séquestre (escrow) ;
- API de transport / logistique complexe ;
- assurance ;
- pricing entièrement automatique (le MVP reste : suggestion → validation
  humaine) ;
- matching par IA ;
- internationalisation au-delà de `fr-FR` / `en-US` / `es-US`.

Rappel de principe : **l'IA propose, elle ne décide jamais seule.**

---

## Latest handoff

**Agent :** Claude Code (Sonnet 5)

**Date :** 13 septembre 2026

**Branch :** `fix/mareliure-customer-access`.

**Commit :** voir `git log -1` — Phase C en un commit, sur Phase B (`88b3d591`).

**Production :** le code de cette session **n'est pas déployé**, comme les
phases précédentes. La migration **est appliquée** sur `hljxohondjvrkzqicexl`
(même méthode — l'API de gestion, le CLI ne joint toujours pas la base).

---

### Chantier de cette session — Phase C : pricing à trois modes

Suite de `docs/transactional-platform-audit.md` (Phase C). Le point le plus
important : **la majeure partie de ce qu'exigeait ce chantier existait déjà**
avant d'y toucher — `pricing_low_estimate_cents`/`pricing_high_estimate_cents`
et la confiance (`confidence.ts`) étaient en production depuis le 9 septembre.
Phase C **formalise** ce que le moteur savait déjà, elle n'invente pas de
nouveau seuil.

**Modes commerciaux (§23-§28)**

- `marketplace_cases.pricing_mode` (`FIXED_PRICE` | `ESTIMATE_THEN_CONFIRM` |
  `MANUAL_STUDY`), dérivé sans nouvelle heuristique
  (`pricing/pricingMode.ts#pricingModeFor`) :
  - `status: "manual_review"` (déjà le refus de chiffrer du moteur) →
    `MANUAL_STUDY` ;
  - confiance `"high"` (plusieurs ateliers d'accord, récents, sur le travail
    exact) → `FIXED_PRICE` ;
  - confiance `"medium"`/`"low"` → `ESTIMATE_THEN_CONFIRM`.
- `deposit_cents` : max(20 % du bas de fourchette, 50 €) — même formule que
  la marge plancher (`max(pourcentage, plancher absolu)`), configurable dans
  `PRICING_POLICY` (`depositPercentageBps`, `depositMinimumCents`), jamais un
  montant fixe codé en dur. Version de la politique passée à
  `bookbinding-2026-09-13-v3`.
- Calculé et posé une seule fois, dans `generateMarketplacePricing` (déjà
  existant, étendu plutôt que dupliqué).
- **Non construit, annoncé** : l'écran client de confirmation du prix
  définitif après examen physique (§26) et le paiement de l'acompte/solde.
  Les deux dépendent de Stripe Connect (Phase D, toujours bloquée faute
  d'identifiants) — construire l'écran sans le paiement réel aurait affiché
  une promesse que le produit ne tient pas encore.

**Rémunération différenciée par atelier (§31)**

- `marketplace_binder_commercial_terms` (binder_id, family_key,
  payout_multiplier_bps, manual_payout_required, effective_from/to). Une
  ligne par atelier et par famille de métier (`WORK_FAMILIES`, catalog.ts —
  8 familles déjà existantes), jamais une grille complète : exactement
  l'exemple du cahier des charges (toile 1,00 / cuir 1,05 / dorure 1,10 /
  restauration manuel).
- `resolvePayout` (`pricing/commercialTerms.ts`, pur, testé) : le
  multiplicateur s'applique à la **famille structure** du projet
  (`structuralFamily` — un projet a au plus un travail structure, catalog.ts
  le garantissait déjà). Sans condition configurée → montant de référence
  inchangé. `manualPayoutRequired` gagne toujours et ne calcule jamais un
  montant automatique.
- **Branché au seul point qui compte** : `sendCaseToBinders` calcule
  désormais un montant par atelier sollicité (`resolvePerBinderPayouts`),
  plus un montant unique pour les trois. Un atelier en « manuel » pour la
  famille du projet **bloque l'envoi** vers lui spécifiquement — refus
  explicite plutôt qu'un montant inventé.
- Une seule condition **active** par atelier et par famille
  (`effective_to IS NULL`) : en poser une nouvelle ferme l'ancienne au lieu
  de l'écraser — l'historique tarifaire reste lisible.
- Écran admin minimal sur `/marketplace/binders` (`BinderListPage.tsx`,
  section repliée « Conditions commerciales ») : lister et ajouter une
  condition. Pas d'historique visible dans l'UI (la donnée existe,
  interrogeable directement).

**Matching (§33) — vérifié, pas corrigé**

- `matching/score.ts` a été relu contre l'ordre du §33. Conclusion : **aucune
  correction nécessaire**. Le poids "payout" (15/100, derrière compétences à
  40/100) ne compare jamais les ateliers entre eux sur le prix — il vérifie
  seulement que le montant de référence, uniforme pour tous les candidats au
  moment du classement, tombe dans la fourchette que chaque atelier a
  déclarée. Les montants différenciés par commercial terms n'entrent en jeu
  qu'*après* le classement, quand l'admin a déjà choisi à qui envoyer — le
  score ne devient donc jamais un « qui coûte le moins cher gagne ».
  Documenté ici plutôt que de changer un code qui n'avait pas le défaut
  supposé.

---

### Completed (Phase C)

- 1 migration (`20260913090000_marketplace_pricing_modes.sql`), additive,
  rejouable, rollback documenté. **Appliquée sur `hljxohondjvrkzqicexl`**
  (production) via l'API de gestion. Vérifié après coup : les deux colonnes
  existent sur `marketplace_cases`, la table `marketplace_binder_commercial_terms`
  existe (0 ligne, attendu — aucune condition n'a encore été posée).
- Un bug de typecheck pré-existant (Phase B) trouvé et corrigé au passage :
  `answerCaseDecision` écrivait `Record<string, unknown>` là où Supabase
  attend `Json` — passait la compilation par accident jusqu'à ce que `tsc`
  le relève cette session. Cast explicite ajouté, même patron que
  `pricing_components` ailleurs dans le fichier.
- `tsc --noEmit` : propre. `eslint` sur tous les fichiers touchés : propre,
  0 warning nouveau.
- `npx vitest run` : **1589 tests verts, 127 fichiers**, dont 25 nouveaux
  (mode de pricing, conditions commerciales, contrat de la migration).
- `npm run build` : vert. Aucune nouvelle route.

---

### In progress

Rien. Working tree propre après le commit de cette session.

---

### Next recommended task

1. **Déployer Phases A, B et C ensemble** (`npm run deploy:mareliure`) —
   aucune n'est en production. Le premier test réel (compte relieur,
   message, décision, condition commerciale) reste à faire.
2. **Remplir le référentiel tarifaire** — toujours vide en production,
   inchangé depuis le 10 septembre. Sans lui, `pricing_mode` ne sortira
   jamais que `MANUAL_STUDY` en pratique : aucun agrégat n'existe pour
   produire `FIXED_PRICE` ou `ESTIMATE_THEN_CONFIRM`.
3. **Spike Stripe Connect** (Phase D) — toujours bloqué, mêmes identifiants
   absents. C'est ce spike qui débloque à la fois le paiement et l'écran de
   confirmation du prix définitif (§26) laissé de côté cette session.
4. **Logistique par niveau de risque** (Phase E) — colonnes seules, pas le
   fournisseur de transport (`docs/shipping-pickup-point-spec.md`).

---

### Known issues

Tout ce qui était listé à la fin de Phase B reste vrai, sans changement,
sauf :

- Nouveau : **`pricing_mode` ne peut sortir que `MANUAL_STUDY` en
  production** tant que le référentiel tarifaire reste vide (voir Next
  recommended task, point 2) — la logique est prête, les données de terrain
  manquent pour l'exercer.
- Nouveau : **pas d'écran client pour le prix définitif après examen
  physique (§26)** ni pour payer un acompte — dépend du spike Stripe.

---

### Do not touch

Tout ce qui était listé à la fin de Phase B reste vrai. S'y ajoute :

- **`pricingModeFor`** : dérive le mode de `status`/`confidence`, jamais
  d'un nouveau seuil. Si un mode semble mal choisi, la correction se fait
  dans `confidence.ts` (ce qui fonde la confiance), pas en ajoutant un
  paramètre à `pricingModeFor`.
- **`depositCentsFor`** : max(pourcentage, plancher), jamais un montant
  fixe. Un acompte à 100 € codé en dur serait exactement la régression que
  `noFabricatedPrices.test.ts` existe pour empêcher — `depositPercentageBps`/
  `depositMinimumCents` ont été ajoutés à la liste des noms exclus de ce
  garde-fou ; tout nouveau paramètre de politique doit y être ajouté de la
  même façon, jamais en écrivant le montant en clair ailleurs.
- **`marketplace_binder_commercial_terms` reste un multiplicateur par
  famille, jamais un tarif par travail.** Le §31 est explicite : pas de
  retour à 45 tarifs par atelier.
- **`resolvePayout`/`manualPayoutRequired`** : ne jamais faire calculer un
  montant automatique quand `manualPayoutRequired` est vrai, même « pour
  dépanner ». `sendCaseToBinders` doit continuer à refuser l'envoi plutôt
  que d'inventer un chiffre.
