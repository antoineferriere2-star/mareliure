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

**Agent :** Codex (GPT-6)
**Date :** 21 septembre 2026 — PR A1 tarif de base Ma Reliure, prête à relire sur `feat/mareliure-base-prices-a1`.

- Ajoute la migration `20260921110000_marketplace_base_prices.sql` : tables distinctes `marketplace_reference_default_prices` et `marketplace_reference_price_operation_links`, RLS deny-all, versions de ligne et contraintes `fixed` / `unit` / `starting_from` / `manual_review`. Zéro est autorisé comme prix explicite ; `manual_review` impose `NULL`.
- Ajoute le mapping intégral des 45 prestations commerciales vers `reliure-fr-v1`, avec les correspondances exactes, composites et les repères explicitement non équivalents.
- Ajoute l’onglet admin « Tarifs de base Ma Reliure » : édition en ligne, versionnement, signaux internes, recherche et filtres. L’onglet « Observations ateliers » conserve l’écran et les tables existants sans modification.
- **Aucune valeur de la grille 45/45 n’est injectée.** PR A2 chargera les 41 montants et les 4 états `manual_review` validés. Le catalogue atelier et les devis ne lisent pas ces nouvelles tables dans A1.
- Tests ciblés : 12 tests verts (mapping, modes, zéro/null, migration, permissions, versionnement). Les dépendances du worktree sont liées au checkout de référence pour les contrôles locaux ; le dossier `node_modules-incomplete` non suivi provient d’une tentative d’installation interrompue et ne doit pas être commité.

---

**Agent :** Claude Code (Sonnet 5)

**Date :** 20 septembre 2026 — dernier chantier : **Phase 0 (audit du 19 septembre, 8 P1)**, PR #5 fusionnée dans `main` (`158df5eb`), **5 migrations appliquées en production et Worker déployé** — voir « Phase 0 — publication » en fin de document ; avant : outil devis → facture du relieur (suite 11, PR #3, fusionnée, migration appliquée et déployé le 19/09) ; avant : UX des espaces clients (suite 10, fusionnée, PR #2). Le bloc de commits ci-dessous décrit la branche `fix/mareliure-customer-access`, fusionnée dans `main` (PR #1) : corrections P0 GTM de l'audit en navigation réelle — brand-aware email, locale serveur autoritaire, champ Country publié en production, CGV publiées, smoke test mobile — voir suite 9.

**Branch :** `main` (Phase 0 fusionnée ; branche `fix/audit-phase0-integrity-security` conservée) ; `feat/binder-quotes` (suite 11, fusionnée) ; `ux/customer-portals` (suite 10, fusionnée) ; `fix/mareliure-customer-access` (suite 9, fusionnée).

**Commit :** `361e7915` (correctif : fuite "Métré" dans le vocabulaire
d'intake partagé, trouvée en smoke test mobile demandé par l'utilisateur —
voir suite 9), sur `37269690` (publication en production de la version 3
du Playbook Reliure, champ Country — voir suite 9), sur `03d16cbd`
(documentation), sur `05bb278d` (correctif : traduction des `briefLabel` Fine
Bindery manquants, trou de couverture i18n trouvé en smoke test navigateur
après le premier déploiement de cette session — voir suite 9), sur
`6d4031be` (corrections P0 GTM : e-mail brand-aware Ma Reliure/Fine Bindery,
locale serveur autoritaire, champ Country, CGV publiées — voir suite 9), sur
`9b5af075` (correctif : `validateMarketplacePricing` renseigne
désormais `service_price_cents`/`pricing_mode`/`brand_multiplier_bps`,
bug bloquant découvert en déroulant le parcours réel — voir suite 8), sur
`93252a26` (TVA France 20 % automatique pour tout dossier
`billing_country = FR`, particulier ou professionnel — migration
`20260918090000`, **appliquée en production**, voir suite 7), sur
`ee4b20b8` (correction d'un constat erroné sur les capacités
d'écriture Stripe), sur `a049ad01`, sur `49df2dee` (modèle fiscal prêt
pour du B2B : `customer_type`, `business_name`/`business_vat_number`/
`billing_country` — migration `20260917100000`, **appliquée en production
le 17 septembre au soir**, voir suite 6), sur
`7bc0f2e2` (politique fiscale à cinq catégories, validation
admin tracée, `checkoutEligibility` exige une fiscalité validée, préflight
admin, bouton Payer client — migration `20260917090000` **appliquée en
production le 17 septembre au soir**, voir suite 6), sur `a37f6246` (client Stripe marketplace passe par le transport
`fetch`, indispensable en Cloudflare Workers), `2afd2dea` (endpoint de
santé du garde-fou compte Stripe), sur `e0cf1719` (descripteur de relevé
par marque via `statement_descriptor_suffix`), sur `2d358ba6`, `94897323`, `7b2aaed0`
(Connect sans paramètre `type` legacy, script setup réutilisable
multi-comptes), `4540b136` (garde fail-closed compte Stripe attendu), sur
`408ee54c` (intégration Stripe live — Checkout/webhook/Connect,
préparés, aucun vrai paiement), sur `dacce714`, sur `5ea6b210` (contribution
minimale 80 € + pricebookReferenceCents câblé), sur `bdb4ddce` (correctif
inscription atelier / mot de passe client), sur `2c1af9ae`, `af3aa753`
(garde d'effet `/auth`), sur `e3c92bf6` (modèle commercial Phase 1), sur
`2161b556` (traduction du Brief dans l'espace client), sur `09626619`,
`64446601` (SEO/GEO), `a2682b0d` (hook e-mail Supabase), `c6c4282d`,
`b924c9ef` (pages légales Fine Bindery), `611a2e53` → `02186112` (Phases B
à F Fine Bindery).

**Production : déployée le 18 septembre 2026, Worker `mareliure` version
`7b906286-9ca6-4efe-b90a-cf23151c8469`** (suite 9 — corrige aussi le bug
`briefLabel` puis la fuite "Métré" du vocabulaire d'intake partagé, tous
deux trouvés en smoke test post-déploiement ; versions intermédiaires
`dffb8f9f-8e75-4413-98c4-ca40da0476e9` et
`6ee82d8b-cae0-48ba-9601-725ea3ad802a` supplantées). Trois migrations fiscales
(`20260917090000`, `20260917100000`, `20260918090000`) appliquées à la
production (`hljxohondjvrkzqicexl`) via l'API de gestion Supabase — voir
suite 6 et suite 7. Suite 9 a aussi publié, sur demande explicite de
l'utilisateur, la **version 3** du Playbook Reliure (`build_playbook_versions`,
id `220eb9f2-d43a-4be2-860c-7047e7f501b8`) — ajoute le champ Country,
repointe les deux Missions (Ma Reliure et Fine Bindery). Code et base de
production sont alignés.

---

### Chantier de cette session (suite 8) — parcours commercial complet vérifié de bout en bout, un vrai bug bloquant trouvé et corrigé

Suite à "vas-y, connecte-toi en admin et déroule le parcours" : je n'ai pas
de mot de passe admin (et ne dois jamais en manipuler), donc pas de
connexion navigateur littérale. À la place, avec l'accord explicite de
l'utilisateur, j'ai obtenu `SUPABASE_SERVICE_ROLE_KEY` (production, dans un
fichier local `.env.production-admin-script.txt`, jamais vu par moi ni
commité — `.env.*` est gitignoré) pour exécuter le **vrai code**
(`loadCaseContext`, `buildCommercialProposalSnapshot`,
`insertCommercialProposal`, `resolveAutomaticTaxPolicy`,
`recomputeProposalTax`, `updateProposalTaxValidation`,
`acceptCommercialProposal`, `checkoutEligibility`, `getPaymentPreflight` —
jamais une réimplémentation) via des scripts `tsx` ponctuels (non commités,
supprimés après usage).

**Dossiers existants audités (lecture seule) avant toute écriture** : 2 cas
réels en production, tous deux sur le compte de l'utilisateur
(`<personal-test-email>`) — RL-003 (Ma Reliure, `validated`, 500 €/
375 €) et RL-004 (Fine Bindery, `pending`). **RL-003 n'a pas été touché**
(conservé intact, comme demandé) : relancer le moteur de pricing actuel
dessus produit `manual_review` (aucune couverture Pricebook pour ses
travaux sous les règles `bookbinding-2026-09-16-v5`) — la tentative s'est
arrêtée sans écrire.

**Nouveau dossier de test créé via le vrai parcours public** ("Présenter
mon livre", `/m/reliure-marketplace-token-000001`), pas par insertion SQL :
un livre courant, reliure toile, style classique, valeur "Décoration",
75001 Paris, `<personal-test-email>`. Deux tentatives : la première
(**RL-005**) a été laissée incomplète (l'admin ne pouvait pas connaître le
style/matière depuis un intake où je ne les avais pas remplis, moteur
abstient avec `work_item_keys: []`) — la seconde, **RL-006**, complète, a
servi la suite. Upload photo réalisé par script (JS `DataTransfer`
constructant un `File` factice, l'input `<input type=file>` du formulaire
ne pouvant pas être piloté par les outils navigateur habituels — jamais
utilisé pour autre chose qu'un placeholder de photo, jamais pour contourner
une validation métier).

**Découverte critique** : même avec un dossier neuf et complet, le moteur
automatique (`suggestManagedPrice`) s'abstient **systématiquement**
aujourd'hui — `marketplace_binder_rates` est **vide** (0 relieur onboardé,
confirmé). C'est structurel, pas un bug : "sans référentiel, il n'invente
rien" (commentaire déjà présent dans le code). RL-003 lui-même n'avait
donc jamais été tarifé par le moteur — toujours à la main.

**Le vrai bug** : le chemin de tarification manuelle
(`saveMarketplacePricing` + RPC `marketplace_validate_pricing`) — **le seul
chemin possible aujourd'hui, pour tous les dossiers** — ne renseigne jamais
`service_price_cents`/`pricing_mode`/`brand_multiplier_bps`. Seul
`generateMarketplacePricing` (qui s'abstient toujours) les renseigne.
Conséquence : **tout dossier tarifé à la main restait bloqué devant
`createCommercialProposal`** ("pas de prix client calculé"), même après
validation admin en bonne et due forme. C'est pour cette raison précise que
RL-003 a d'abord semblé "cassé" — ce n'était pas RL-003, c'était ce chemin.

**Corrigé** (commit `9b5af075`) : `validateMarketplacePricing` complète
désormais ces trois colonnes quand elles restent `NULL` après la RPC, avec
le multiplicateur réel de la marque du dossier (`marketplaceBrandConfig`)
— jamais un écrasement si le moteur les avait déjà renseignées. Testé
(148 fichiers, 1981 tests verts — un flake isolé sur
`secretsContract.test.ts` non reproductible, reconfirmé par un second run
complet), typecheck propre, build vert, **déployé** (Worker `mareliure`
version `19dcfd30-1215-4376-b33e-65724dba58d6`).

**Résultat du parcours complet sur RL-006** (Ma Reliure, France, 500 € HT) :

| Étape | Résultat |
| --- | --- |
| Intake public réel | Dossier créé, `manual_review_required: false` |
| Pricing manuel (500 €/375 €, marge 25 %) | `pricing_status: validated`, `service_price_cents: 50000` (après correctif) |
| Proposition commerciale | v1 créée, `customerServicePriceCents: 50000`, `binderPayoutCents: 37500` |
| TVA France automatique | `tax_policy: FR_B2C`, `tax_validation_source: FR_STANDARD_VAT_20`, `customer_vat_rate_bps: 2000`, `customer_vat_amount_cents: 10000`, `customer_total_ttc_cents: 60000` |
| Acceptation | `status: accepted` |
| **`checkoutEligibility`** | **`{ eligible: true }`** |
| Preflight (côté DB/fiscal) | Tous les champs commerciaux/fiscaux corrects ; seuls `stripe_account_mismatch_or_unreachable`/`stripe_webhook_not_configured` apparaissent — uniquement parce que ce script local n'a pas `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (déjà vérifiés séparément configurés en production via le connecteur Stripe MCP et `wrangler secret list`, suite 5) |

**Conclusion : le parcours métier atteint bien `READY FOR PAYMENT` au sens
commercial/fiscal**, exactement les chiffres du brief (500 € → 100 € TVA →
600 € TTC). Le préflight réel dans l'admin (avec les vrais secrets Stripe
du Worker) le confirmerait intégralement — non revérifié dans l'admin lui-même
(pas d'identifiants), mais chaque brique a été exécutée avec le vrai code,
pas une simulation.

**Nettoyage** : tous les scripts ponctuels supprimés après usage
(`scripts/_walkthroughStep*.ts`, jamais commités). `.env.production-admin-script.txt`
reste en local (gitignoré) — à l'utilisateur de le supprimer s'il le
souhaite, je ne l'ai pas fait moi-même.

**Toujours bloquant avant le premier vrai paiement** :
1. Un taux de TVA validé par un expert-comptable pour la règle française
   elle-même (décision opérationnelle temporaire de l'utilisateur, pas une
   validation professionnelle) et pour tout cas international.
2. Correction manuelle de l'identité publique Stripe (toujours impossible
   à écrire via le connecteur).
3. Rotation de `STRIPE_SECRET_KEY` — différée par décision explicite.
4. Un vrai dossier client (RL-006 est un test interne, comme RL-003) : le
   premier Checkout payé doit correspondre à une vraie commande, jamais à
   ce dossier de test.

---

### Chantier de cette session (suite 11) — outil devis → facture du relieur (branche `feat/binder-quotes`)

**Statut mis à jour le 20/09/2026 : fusionné (PR #3, types PR #4), migration `20260919090000` appliquée en production
le 19/09, Worker déployé.** La recette réelle avec deux comptes atelier (points 6 à 15) n'a **pas** été faite : elle attend
deux utilisateurs Supabase créés par l'utilisateur (les règles interdisent de les créer). Note d'origine : la migration
crée des tables en production. Périmètre : un module très simple pour qu'un relieur chiffre
un ouvrage pour SES clients, marketplace ou non — *ouvrage → dimensions → prestations →
calcul → devis → facture*. Ce n'est ni une comptabilité, ni un ERP, ni un CRM. **Pas touchés :**
Stripe, abonnement / limitation de devis (l'outil est gratuit), encaissement, e-invoicing,
Factur-X, connexion à une Plateforme Agréée, pricing marketplace, dossiers clients de la
marketplace.

**Migration** `20260919090000_marketplace_binder_quotes.sql` — additive, rejouable (vérifiée deux
fois de suite sur un vrai Postgres), rollback en pied de fichier (à ne PAS exécuter dès qu'une
facture existe). Aucune table existante n'est modifiée.
- Tables : `marketplace_binder_billing_profiles` (1 par atelier : identité, SIRET, TVA, régime,
  mention, préfixes, validité, conditions), `marketplace_binder_service_categories`,
  `marketplace_binder_services` (catalogue de l'atelier : prix HT en centimes, TVA optionnelle,
  actif, archivé), `marketplace_binder_clients` (les clients DE l'atelier — pas des comptes Ma
  Reliure), `marketplace_binder_document_counters`, `marketplace_binder_quotes` +
  `_quote_items`, `marketplace_binder_invoices` + `_invoice_items`.
- Fonctions SQL (service_role seulement) : `marketplace_binder_next_document_number` (compteur
  atomique par atelier, type et année), `marketplace_binder_create_quote`,
  `marketplace_binder_update_quote` (brouillon seulement), `marketplace_binder_convert_quote_to_invoice`
  (devis `accepted` seulement, verrou `FOR UPDATE`, numéro + facture + lignes dans UNE transaction :
  pas de trou dans la séquence des factures).
- Isolation : même patron que tout `marketplace_*` — RLS activée, **deny-all pour anon et
  authenticated**, `GRANT` à service_role seulement, fonctions révoquées pour PUBLIC/anon/
  authenticated. Le serveur résout l'atelier de la session (`findActiveBinderMembership` : tout
  membre ACTIF, pas seulement le propriétaire) et filtre CHAQUE requête par `binder_id` ; un
  identifiant d'un autre atelier est « introuvable », comme un identifiant inexistant.
- Snapshots : un devis/une facture porte le client, l'ouvrage, l'identité de l'émetteur, le régime
  de TVA, les mentions et chaque ligne (libellé, prix, TVA, prix catalogue d'origine). Changer le
  catalogue ou le profil ne change JAMAIS un document existant. Une **facture est immuable**
  (trigger : seuls le suivi de paiement et les emplacements externes restent modifiables ; lignes
  ni modifiables ni supprimables). Un atelier ne peut pas être supprimé sous ses devis/factures
  (`ON DELETE RESTRICT`) — pièces à conserver.
- Facture : acompte demandé / payé, `amount_paid_cents`, `payment_status` (`unpaid`, `deposit_paid`,
  `paid`) — le **modèle** est prêt, aucun paiement n'est encaissé ni aucune action « marquer payée »
  n'existe. Emplacements NULLABLES, fournisseur non figé et aucune valeur interprétée :
  `external_provider`, `external_invoice_id`, `external_status`, `electronic_invoice_status`,
  `electronic_invoice_sent_at`, `external_metadata`. La logique métier ne dépend d'aucun fournisseur.

**Calcul** (`src/marketplace/quotes/quoteCalc.ts`, pur, centimes entiers, aucun flottant sur un
montant) : quantité (2 décimales) × prix, arrondi au plus proche ; TVA **par taux** (jamais ligne
par ligne), arrondie une fois par taux ; remise en % ou en € (plafonnée : jamais négatif),
répartie sur les taux au prorata avec somme exacte ; acompte sur le TTC. Le navigateur affiche ce
calcul en direct, mais le serveur ne reçoit AUCUN total (schémas `.strict()`) et recalcule tout.

**TVA** : aucun régime n'est présumé — `vat_regime` est `NULL` tant que l'atelier n'a pas choisi
(`FRANCHISE` ou `VAT_LIABLE`). Un devis exige seulement un nom d'atelier et ce régime (deux champs,
saisis dans le constructeur) ; une **facture** exige l'identité complète (adresse, SIRET, n° de TVA
ou mention de franchise). En franchise, les taux enregistrés sont 0. La mention de franchise
« TVA non applicable, art. 293 B du CGI » n'est qu'une **suggestion modifiable** : à faire valider
(**LEGAL REVIEW REQUIRED**) — comme les mentions obligatoires d'une facture (pénalités, indemnité de
recouvrement, forme juridique, capital…), configurables par l'atelier, jamais interprétées.

**PDF** (`documentPdf.ts`, `pdf-lib` — JavaScript pur, sans DOM, compatible Workers, nouvelle
dépendance) : une mise en page pour devis et facture, pagination, pied de page, bloc « bon pour
accord » sur un devis. Texte assaini pour l'encodage WinAnsi (espaces insécables, emoji → « ? »,
jamais d'échec). **Ce n'est PAS une facture électronique réglementaire** (ni Factur-X, ni
plateforme agréée) : un document imprimable.

**Routes** (`/atelier`, authentifiées) : `/atelier/devis` (liste devis / factures),
`/atelier/devis/nouveau` (constructeur), `/atelier/devis/$quoteId` (détail, statuts, PDF,
« Convertir en facture »), `/atelier/devis/$quoteId/modifier` (brouillon), `/atelier/factures/$invoiceId`,
`/atelier/tarifs` (« Devis et tarifs » : catalogue, TVA, identité). Server functions :
`services/binderQuotes.data.functions.ts` (logique dans `binderQuotes.server.ts`).

**QA** : les vraies routes parcourues dans un navigateur avec une session simulée et un faux
backend au niveau `fetch` bâti sur le VRAI code de calcul, de construction et de PDF (pas de
Supabase réel, pas de session réelle) — scénario du brief (220 × 145 × 32 mm, plein cuir + nerfs +
dorure titre + étui = 430 € HT, prix ajusté à 340 € sans toucher le catalogue, devis, accepté,
facture, PDF), largeurs 1280 / 820 / 390. La migration a été exécutée sur un vrai Postgres (pglite,
hors dépôt) : 40 vérifications SQL (numérotation par atelier/année, atomicité, conversion,
immuabilité, contraintes, isolation par rôle) + les charges utiles produites par le TypeScript.

**Dettes et points à traiter** (non corrigés ici) :
- Le **logo** de l'atelier n'est pas géré (le nom sert d'en-tête) : il demande un bucket privé et
  un téléversement.
- `integrations/supabase/types.ts` (généré) ne connaît pas les nouvelles tables : le serveur utilise un
  client typé large. À régénérer après application de la migration.
- Aucun paiement encaissé, aucune action « marquer payée » : le suivi de paiement est un modèle.
- Pas de suppression de devis (un devis refusé/expiré reste) ; pas de duplication de devis.
- Numérotation `PRÉFIXE-AAAA-NNNN`, une séquence par atelier, type et année (repart à 1 chaque année).
- Un atelier avec factures ne peut pas être supprimé (RESTRICT) : un flux de suppression de compte /
  RGPD devra les anonymiser ou les archiver, jamais les supprimer.
- La facturation électronique (réforme française, plateformes agréées) reste entièrement à faire ;
  vérifier les échéances qui s'appliquent aux ateliers avant toute mise en production réelle.
- Les tests de service utilisent un faux client Supabase (les filtres d'atelier sont vérifiés par
  ces tests ET par une lecture du code) ; l'isolation réelle sur Supabase avec deux comptes n'a pas
  été rejouée (pas de clé service-role locale).

---

### Chantier de cette session (suite 10) — UX des espaces clients (branche `ux/customer-portals`)

Périmètre : navigation, lisibilité, usage de `/mes-livres` sur les deux
marques. **Non touchés** : modèle commercial, pricing, fiscalité, Stripe,
règles d'éligibilité au paiement, permissions, modèle atelier, migrations
(aucune). Non déployé : la branche attend une revue.

Ce qui a changé :
- **Un seul vocabulaire client**, `src/marketplace/customer/customerPresentation.ts`
  (logique pure, testée) : statut lisible (14 états, FR/EN), « Prochaine
  étape » avec au plus un bouton principal, mode de prix en mots, historique
  bâti sur des dates que le client peut connaître (jamais `marketplace_events`),
  nettoyage des valeurs du Brief (`null`/`-`/`N/A`, `true`/`false`, identifiants
  machine masqués ; « à préciser » devient « ce que nous devons encore
  confirmer »), textes FR/EN de tout l'espace client.
- **Liste** : vrai titre du livre (la liste affichait `content.missionName`,
  identique pour tous les projets d'un client), type, date, statut, montant
  TTC, prochaine étape, miniature, projets qui attendent le client en premier,
  état vide, rattachement d'un projet replié.
- **Détail** : bouton « ← Mes livres » déterministe (`Link to="/mes-livres"`,
  jamais `history.back`), en-tête + statut, « Prochaine étape » (le bouton
  Payer y est, plus enfoui sous le Brief), carte « Votre proposition »
  (Service / Transport / HT / TVA / TTC / mode de prix), résumé, photos
  (ratio fixe, agrandissement accessible, repli si l'URL signée a expiré),
  atelier, messages, historique, « Voir tous les détails ».
- **Serveur, lecture seule** : `getMyCustomerCase` renvoie une vue de
  proposition en **liste blanche** (`customerProposalView.ts` — jamais
  rémunération d'atelier, marge, contribution, règles) ; `listMyCustomerCases`
  applique la même règle « prix validé seulement » que le détail. Les deux
  passent par `customerCommerce.server.ts`, qui appelle `checkoutEligibility`
  avec les mêmes entrées que le Checkout.
- **Messagerie / décisions (rôle client uniquement, l'atelier est inchangé)** :
  une réponse de décision s'affichait en JSON brut (`{"choice":"…"}`) ; erreurs
  claires avec « Réessayer » ; un envoi raté conserve le brouillon ; un
  rechargement raté n'efface plus le fil déjà affiché ; défilement dans le fil
  au lieu d'un saut de page ; champs nommés pour les lecteurs d'écran.
- Zones tactiles ≥ 44 px, lien d'évitement, régions de navigation nommées.

QA : rendu réel des vrais composants avec des données de test synthétiques
(scénarios A à H, deux marques), en navigateur à 375 / 390 / 430 px : aucun
défilement horizontal, aucune zone tactile < 43 px. **Limites** : aucune session
cliente réelle n'a été utilisée (l'espace client exige une connexion et je n'en
ai pas fabriqué) ni l'application déployée ; les server functions ne sont
testées que par lecture de code et tests de contrat. Chrome headless impose une
fenêtre d'environ 500 px de large : des captures « 375 px » prises ainsi sont
mises en page à 500 px puis rognées — pour un vrai rendu mobile, utiliser un
iframe de la largeur voulue.

**Mise à jour de la PR #2 — acceptation client et canal Concierge** (après revue
du premier rendu ; toujours ni pricing, ni fiscalité, ni Stripe, ni shipping,
ni espace atelier, ni migration) :

1. *Acceptation client de la proposition.* Le parcours cible est : proposition
   présentée → le client consulte → **il accepte** → le paiement devient
   possible → il paie. Avant, seule l'administration pouvait accepter
   (`acceptCommercialProposal`, inchangée). Ajout de `acceptMyProposal`
   (`customerProposalAcceptance.data.functions.ts`) qui délègue à la MÊME écriture
   (`accepted_at` posé, ligne immuable par trigger) après avoir vérifié côté
   serveur, dans cet ordre : le dossier, son propriétaire (`canViewCase`, rôle
   client — ni atelier ni admin par ce chemin), la proposition déjà acceptée
   (idempotent), la proposition demandée (elle doit appartenir au dossier), qu'elle
   est toujours la dernière version, puis la règle `customerAcceptance`
   (proposition `proposed`, prix du dossier validé par un humain, projet non clos,
   et **fiscalité/identité professionnelle jugées par `checkoutEligibility`** —
   un client ne peut donc jamais accepter vers un « Payer » qui échouerait).
   Le navigateur n'envoie que `{ caseId, proposalId }` (schéma `.strict()`) :
   jamais un montant, une taxe ou un statut. Après succès, la possibilité de
   payer est recalculée (`loadCustomerCommerce` → `checkoutEligibility`).
   Une proposition révisée pendant la lecture est refusée (le client relit la
   nouvelle version : il n'accepte jamais un prix qu'il n'a pas vu). Une seconde
   acceptation de la même proposition (double clic, deux onglets) réussit sans
   rien réécrire ni second événement. Événement `commercial_proposal_accepted`
   avec `accepted_by: "customer"`.
   Visibilité : avant acceptation, le client ne voit la proposition que si elle est
   acceptable ; une proposition en préparation (fiscalité non validée, prix non
   validé) n'existe pas encore pour lui. Une proposition déjà acceptée n'est
   jamais remplacée par une version plus récente. UX : « Accepter la proposition »
   / « Accept proposal » est l'action principale de « Prochaine étape », avec le
   total confirmé en toutes lettres ; une fois acceptée, « Payer » / « Pay securely »
   la remplace. Si une confirmation est aussi demandée, elle garde la première
   place et le bouton d'acceptation reste accessible dans la carte proposition.
   Hors périmètre volontaire : aucune case « J'accepte les CGV » n'a été ajoutée
   (les CGV ne sont pas touchées) — à décider avec le juridique.
2. *Fine Bindery — modèle concierge.* Constat : il n'existe **qu'un seul fil par
   dossier** (`marketplace_messages`, sans colonne de canal) partagé client /
   atelier / admin, et `customerWorkshopDirectMessaging` n'était lu nulle part.
   Le drapeau est maintenant lu, et un client Fine Bindery : (a) ne reçoit plus
   aucun message d'atelier (`listCaseMessages` filtre côté serveur avant l'envoi,
   pour le rôle client seulement — `customerVisibleSenderRoles`) ; (b) ne les voit
   pas dans ses non-lus (`unreadCountsByCase`) ; (c) n'est plus notifié par e-mail
   d'un message d'atelier qu'il ne peut pas lire, et le message du concierge le
   nomme (« Your Fine Bindery concierge… ») ; (d) voit un canal « Your Fine Bindery
   concierge » (titre, texte, champ, raccourci « Message your concierge », auteur
   « Fine Bindery concierge »), sans libellé « Your workshop » dans la messagerie ;
   (e) même si un message d'atelier atteignait le navigateur, l'interface ne le
   rend pas. Ma Reliure est inchangée (fil partagé). `canAccessConversation`,
   les permissions et la base ne sont pas modifiés.

   > **Mise à jour Phase 0 (P1-6)** : le manque serveur ci-dessous est traité — audiences de messages persistées,
   > lecture atelier limitée à son canal, accès réservé à l'atelier retenu, vue admin des deux canaux ajoutée. Voir « Phase 0 » en fin de document.

   **Manque serveur à traiter dans une PR séparée** (ne pas le faire ici : il
   touche le modèle de messagerie, les permissions, la base et l'espace atelier) :
   - le fil reste unique : sur un dossier Fine Bindery, **un message que le
     client écrit est encore lisible par l'atelier** (`listCaseMessages`, rôle
     atelier, non filtré) — le client n'écrit pas « à l'atelier » dans
     l'interface, mais la donnée lui reste visible ;
   - un message d'atelier n'est plus lisible par le client mais **personne ne le
     relaie** : il n'existe pas de vue concierge qui distingue « à relayer au
     client » ; l'atelier croit parler au client et le concierge doit le relire dans
     le fil admin ;
   - une vraie séparation exige deux canaux (colonne `channel` ou table dédiée),
     une politique d'accès par canal dans `conversation.ts`, la lecture atelier
     limitée au canal atelier, et une UI de relais côté admin ;
   - l'e-mail « nouveau message » à l'atelier n'existe pas (voir
     `notifyCustomerOfNewMessage`) : hors sujet ici, à traiter avec le point ci-dessus.
   La décision `marketplace_decisions` (réponse client à une question de
   l'atelier) n'a pas de canal de messagerie : elle n'est pas concernée.

QA de cette mise à jour : les vrais composants dans un navigateur, contre un faux
backend installé au niveau de `fetch` (le client réel : bouton, mutation,
relecture, focus) — parcours Ma Reliure et Fine Bindery « proposition disponible →
acceptation → paiement », chemin d'erreur (message générique, jamais le texte du
serveur), largeurs 375 / 390. **Toujours pas de session cliente réelle ni de
déploiement** : les server functions sont testées avec un dépôt de propositions en
mémoire et le vrai `checkoutEligibility`, pas contre Supabase.

Constats hors périmètre, **non corrigés** :
- `cases/journey.ts` n'est plus utilisé que par son test (le parcours est
  remplacé par le statut + l'historique) : à supprimer ou à réutiliser.
- `listMyCustomerCases` fait plusieurs lectures par projet (contexte, commerce,
  signature d'une photo) : acceptable pour quelques livres, à regrouper au-delà.
- `components/ui/dialog.tsx` a un bouton de fermeture « Close » en anglais (le
  lecteur photo l'évite en utilisant Radix directement).
- Le format des dimensions dans les lignes du Brief Fine Bindery (virgule
  décimale) n'a pas pu être vérifié sur une donnée réelle.

---

### Chantier de cette session (suite 9) — corrections P0 GTM (audit en navigation réelle du 18 septembre 2026)

Suite à l'audit GTM en navigation réelle du 18 septembre 2026 (Ma Reliure et
Fine Bindery), correctif ciblé des problèmes visibles côté client — **aucun
chantier produit nouveau, architecture inchangée, pricing engine non touché,
Stripe Connect non touché, aucune transaction créée, aucun paiement
effectué, aucun Connected Account créé**, comme demandé explicitement.

**A. Fichiers modifiés**

- [`src/routes/api/public/build-runtime.ts`](../src/routes/api/public/build-runtime.ts) — `handleSubmitSession` résout
  désormais la marque marketplace (Ma Reliure / Fine Bindery) depuis le Host
  de la requête réelle (`resolveMarketplaceBrandForHostname`, jamais un champ
  client), et la locale figée de la Mission (`proposal.defaultLocale`)
  l'emporte sur `body.locale` envoyé par le navigateur — corrige à la racine
  le récapitulatif et l'e-mail en français pour un client Fine Bindery.
- [`src/build/services/visitorSummaryEmail.server.ts`](../src/build/services/visitorSummaryEmail.server.ts) — `brandEmailData`
  distingue enfin Ma Reliure de Fine Bindery (avant : uniquement
  Métré Build vs "isMaReliure", qui vaut vrai pour les deux marques
  marketplace) ; l'e-mail "Your project summary from Fine Bindery" est
  désormais signé Fine Bindery, pointe vers finebindery.com, et passe la
  marque à `sendTemplateEmail` pour l'expéditeur.
- [`src/lib/email-templates/send-email.ts`](../src/lib/email-templates/send-email.ts) — expéditeur résolu par marque
  (`resolveMarketplaceSender`) via `contactIdentity` (déjà présent dans
  `brandConfig.ts`, jamais lu jusqu'ici) plutôt qu'une seule constante Ma
  Reliure pour tout envoi marketplace.
- [`src/marketplace/auth/authEmailHook.server.ts`](../src/marketplace/auth/authEmailHook.server.ts) — passe la marque résolue
  du lien magique à `sendTemplateEmail`.
- [`src/lib/email-templates/case-activity.tsx`](../src/lib/email-templates/case-activity.tsx) — gabarit rendu brand/locale-aware
  (avant : toujours Ma Reliure, toujours en français).
- [`src/marketplace/services/messaging.data.functions.ts`](../src/marketplace/services/messaging.data.functions.ts), [`decisions.data.functions.ts`](../src/marketplace/services/decisions.data.functions.ts) —
  `loadCaseBrand` résout la marque du dossier pour ces notifications.
- [`src/build/engine/brief.ts`](../src/build/engine/brief.ts) — `formatValue` affiche "Yes"/"No" pour une
  réponse booléenne (consentement) au lieu du littéral JS `"true"`.
- [`src/build/pages/public/frPublicCopy.ts`](../src/build/pages/public/frPublicCopy.ts) — traduction française de "Yes"/"No".
- [`src/build/playbooks/bookbindingPlaybookSchema.ts`](../src/build/playbooks/bookbindingPlaybookSchema.ts) — le champ
  `localisation` gagne un composant `country` distinct (jamais fondu dans le
  code postal) et un pattern de code postal assoupli (le Playbook sert aussi
  Fine Bindery, "Worldwide service").
- [`src/build/pages/public/enBookbindingCopy.ts`](../src/build/pages/public/enBookbindingCopy.ts) — traductions anglaises des
  nouveaux libellés ("Pays" → "Country", etc.).
- [`src/marketplace/pages/legal/LegalPages.tsx`](../src/marketplace/pages/legal/LegalPages.tsx), [`legalEntity.ts`](../src/marketplace/legal/legalEntity.ts) — conditions
  générales de vente publiées (FR + EN), remplaçant l'annonce "seront
  publiées avant l'ouverture du paiement" ; clauses juridiques substantielles
  (rétractation, garanties, responsabilité) explicitement marquées
  **LEGAL REVIEW REQUIRED** plutôt qu'inventées ; section médiation marquée
  **BLOCKED — MEDIATOR DETAILS REQUIRED** (aucun médiateur réel connu).
- [`src/routes/conditions-generales-de-vente.tsx`](../src/routes/conditions-generales-de-vente.tsx), [`terms-of-sale.tsx`](../src/routes/terms-of-sale.tsx) — nouvelles
  routes.
- [`src/marketplace/pages/landing/LandingChrome.tsx`](../src/marketplace/pages/landing/LandingChrome.tsx), [`fineBindery/FineBinderyChrome.tsx`](../src/marketplace/pages/fineBindery/FineBinderyChrome.tsx) —
  lien CGV ajouté au pied de page des deux marques.
- Tests ajoutés/étendus : [`visitorSummaryEmail.server.test.ts`](../src/build/services/visitorSummaryEmail.server.test.ts) (Fine Bindery —
  expéditeur, contenu, absence de fuite "Ma Reliure"), [`bookbindingPlaybook.test.ts`](../src/build/playbooks/bookbindingPlaybook.test.ts)
  (composant `country`), [`legal.test.ts`](../src/marketplace/legal/legal.test.ts) (CGV publiées, médiateur non inventé),
  [`enBookbindingCopy.test.ts`](../src/build/pages/public/enBookbindingCopy.test.ts) (couvre désormais `option.briefLabel`, pas
  seulement `option.label` — voir le bug Canvas trouvé en smoke test, plus
  bas dans cette même suite).
- Deux bugs de typage préexistants corrigés au passage dans
  `messaging.data.functions.ts`/`decisions.data.functions.ts` (`loadCaseBrand`
  ne compilait pas — narrowing TypeScript sur la mauvaise expression).

**B. Routage e-mail multi-brand, état final**

`sendTemplateEmail(template, to, { brand, ... })` — `brand` optionnel,
ignoré hors marketplace. `resolveMarketplaceSender(brand)` : Ma Reliure ou
`brand` absent → `Ma Reliure <noreply@mareliure.fr>` ; Fine Bindery → nom
affiché "Fine Bindery", **adresse technique toujours `noreply@mareliure.fr`**
tant que `finebindery.com` n'a pas de DKIM vérifié chez Resend (voir C/D/F ci-
dessous — c'est un choix fail-closed délibéré, pas un oubli). Un client Fine
Bindery voit donc "Fine Bindery <noreply@mareliure.fr>", jamais "Ma Reliure"
en clair nulle part (objet, en-tête, corps, CTA, pied de page).

**C. Domaine expéditeur Ma Reliure** : `mareliure.fr`, vérifié chez Resend
(DKIM présent), envoi via `send.mareliure.fr` (Return-Path Resend/SES,
SPF correct).

**D. Domaine expéditeur Fine Bindery** : reste `mareliure.fr` (voir B) —
`finebindery.com` n'est **pas encore vérifié** chez Resend, action requise
avant de pouvoir l'utiliser (voir E-G).

**E/F/G. Audit de délivrabilité (§8) — DNS interrogé directement, sans
identifiants, le 18 septembre 2026**

| Domaine | SPF racine | DKIM Resend (`resend._domainkey`) | DMARC (`_dmarc`) | Sous-domaine Return-Path Resend |
| --- | --- | --- | --- | --- |
| `mareliure.fr` | `v=spf1 include:mx.ovh.com -all` (boîte OVH, sans rapport avec Resend) | **PRÉSENT** — domaine vérifié | **MANQUANT** | `send.mareliure.fr` : `v=spf1 include:amazonses.com ~all` — CORRECT |
| `finebindery.com` | même SPF OVH, sans rapport | **MANQUANT (NXDOMAIN)** — domaine jamais vérifié dans Resend | **MANQUANT** | — |

CURRENT : Ma Reliure envoie authentifié (SPF+DKIM alignés via le sous-domaine
Resend) mais sans DMARC. Fine Bindery n'a aucune authentification Resend —
c'est la cause structurelle de "e-mails en spam" pour les deux marques, en
plus du hook d'authentification jamais activé (voir Next recommended task).

EXPECTED : DKIM Resend vérifié sur `finebindery.com` (ou usage exclusif de
`mareliure.fr` comme aujourd'hui, en acceptant "Fine Bindery" seulement comme
nom affiché) ; un enregistrement DMARC (`p=quarantine` a minima) sur les deux
domaines, aligné avec le SPF/DKIM du sous-domaine Resend.

MISSING : DMARC sur `mareliure.fr` et `finebindery.com` ; vérification
Resend + DKIM pour `finebindery.com` si ce domaine doit un jour émettre
directement.

ACTION REQUIRED (hors du périmètre de ce chantier — nécessite un accès DNS
que je n'ai pas, et une décision produit sur si Fine Bindery doit un jour
avoir son propre domaine d'envoi) :
1. Ajouter un enregistrement DMARC sur `mareliure.fr` (ex. `_dmarc.mareliure.fr TXT "v=DMARC1; p=quarantine; rua=mailto:<adresse à définir>"`).
2. Idem sur `finebindery.com` dès que ce domaine sert à autre chose que le
   nom affiché.
3. Si Fine Bindery doit un jour envoyer depuis `@finebindery.com` : vérifier
   le domaine dans le dashboard Resend, attendre la propagation DKIM,
   confirmer par requête DNS directe (jamais supposer), puis seulement
   retirer `finebindery.com` absent de `VERIFIED_SENDING_DOMAINS`
   (`send-email.ts`).
4. Réputation/contenu : non auditable sans accès au dashboard Resend
   (taux de plainte, warm-up du domaine) — à vérifier là-bas.

**H. Fuites françaises Fine Bindery corrigées** : locale serveur autoritaire
(`proposal.defaultLocale`, jamais `body.locale` client) ; "true"/"false" →
"Yes"/"No" ; traductions EN déjà complètes dans `enBookbindingCopy.ts`
(le bug n'était pas un dictionnaire manquant, mais une locale mal résolue en
amont).

**I. Project Summary Fine Bindery** : corrigé par le même fix de locale — le
générateur (`buildVisitorProjectSummary`) traduisait déjà correctement une
fois `options.locale` fiable.

**J. Champ Country** : ajouté au champ `localisation` du Playbook Reliure
(composant `country`, distinct du code postal), exploitable tel quel par la
fiscalité/logistique/admin. **Pas encore un blocage strict à la soumission** :
le moteur de validation générique ne sait imposer qu'"au moins un composant
d'adresse rempli", pas "ce composant précis" — en faire un vrai blocage
demande une évolution du moteur de validation, explicitement hors périmètre
("ne pas refondre l'architecture"). Persisté comme le reste de `answers`
(JSON), donc déjà exploitable en l'état pour tout dossier qui le renseigne.

**Publication en base — résolu.** `bookbindingPlaybookSchema.ts` n'est que le
code source : un Playbook publié (`build_playbooks.published_version_id` →
`build_playbook_versions.schema`, un instantané figé) est une chose
distincte, et les deux Missions de production (`BOOKBINDING_MISSION_ID` /
`FINE_BINDERY_MISSION_ID`, `src/build/constants.ts`) pointaient encore vers la
**version 2**, publiée avant ce composant `country` — trouvé en smoke test
navigateur, le champ n'apparaissait pas sur l'étape de contact. Diff
préalable entre le schéma calculé localement et la version 2 en production
(lecture seule, API de gestion Supabase) : **exactement** les deux
changements attendus (composant `country` ajouté, pattern du code postal
assoupli), rien d'inattendu.

Sur demande explicite de l'utilisateur ("Publie la version 3 du Playbook
maintenant"), publié le 18 septembre 2026 via une écriture SQL ciblée
(`POST /v1/projects/hljxohondjvrkzqicexl/database/query`, jeton
`SUPABASE_ACCESS_TOKEN` de `.env.supabase`) plutôt que les scripts
`seed:bookbinding`/`seed:fine-bindery` (qui auraient aussi réécrit les autres
champs de Mission avec leurs valeurs codées en dur) : une seule transaction
SQL insère `build_playbook_versions` version 3 (id
`220eb9f2-d43a-4be2-860c-7047e7f501b8`), met à jour
`build_playbooks.published_version_id`, et repointe `playbook_version_id`
sur les deux Missions — rien d'autre touché. Vérifié en lecture après
écriture (les trois lignes pointent bien vers la version 3) **et** en
navigation réelle sur `finebindery.com` : le champ Country apparaît
désormais sur l'étape de contact ("ZIP / postal code", "City", "Country").
Ma Reliure re-testé après coup, toujours intégralement en français, aucune
régression.

**K. CGV** : publiées aux adresses `/conditions-generales-de-vente` (Ma
Reliure, FR) et `/terms-of-sale` (Fine Bindery, EN), liées depuis le pied de
page des deux marques et depuis "Conditions d'utilisation"/"Terms of Use".
Sections factuelles (parties au contrat, prix, commande) rédigées à partir du
modèle réel du produit. Sections de position juridique (rétractation,
garanties, responsabilité) marquées **LEGAL REVIEW REQUIRED** — formulation
usuelle du secteur, pas encore validée par un juriste pour OPPE SAS.

**L. Médiateur** : **BLOCKED — MEDIATOR DETAILS REQUIRED.** Aucun médiateur
de la consommation réel n'a été trouvé dans le dépôt ni fourni par
l'utilisateur ; la mention est obligatoire (Code de la consommation,
art. L616-1) avant toute vente réelle à un consommateur français. La section
existe dans les CGV et dit explicitement qu'elle est en attente — jamais un
médiateur inventé.

**M/N/O/P. Tests, typecheck, lint, build** : voir "Commandes exécutées"
ci-dessous — tout au vert.

**Smoke test mobile (375×812, les deux marques)** — fait sur demande
explicite de l'utilisateur après la publication de la version 3.
Homepage, tunnel d'intake complet (sélection, saisie de texte, étapes
obligatoires, bannières de validation), pages CGV et `/auth` : tout lisible,
tap targets corrects, aucune erreur console. La feuille mobile "Votre
projet"/"Your project" (`ProjectCanvasMobileSheet`, remplace la colonne
latérale sous le point de rupture `lg`) s'ouvre et se ferme correctement des
deux côtés.

**Bug trouvé pendant ce smoke test mobile, corrigé et déployé** : la
description de cette feuille mobile affichait littéralement **"The project
details Métré has captured so far."** sur `finebindery.com` — le mot
"Métré" (nom interne du produit) fuitait dans l'interface Fine Bindery.
Cause : `RUNTIME_CHROME_STRINGS` (`runtimeChrome.ts`) est un vocabulaire
partagé par toutes les Missions (Métré Build, Ma Reliure, Fine Bindery), et
deux de ses chaînes anglaises de base avaient "Métré" codé en dur au lieu
d'un texte neutre — les traductions françaises existaient déjà sans ce mot
("Ce qui a été retenu de votre projet jusqu'ici."), seule la version
anglaise (qui sert de source ET de sortie quand la locale est `en-US`,
celle de Fine Bindery) le portait encore. Deuxième chaîne du même genre
trouvée par relecture complète du fichier : "Métré will suggest what it
notices..." (étape photo d'inspiration). Les deux chaînes de base rendues
neutres ("The project details captured so far.", "We'll suggest what we
notice..."), traductions FR/ES mises à jour en conséquence (l'espagnol
portait aussi "Métré" en dur, jamais utilisé par aucune marque de ce
chantier mais corrigé par cohérence). Vérifié en navigation réelle mobile
sur les deux marques après déploiement (Worker `mareliure`, version
`7b906286-9ca6-4efe-b90a-cf23151c8469`) : Fine Bindery affiche désormais
"The project details captured so far.", Ma Reliure reste inchangé en
français.

- Activer le hook d'authentification Supabase (`scripts/configureMareliureAuth.ts`,
  déjà écrit, jamais exécuté) pour que le lien magique passe enfin par le
  gabarit brand-aware plutôt que par le modèle unique du projet Supabase.
- DMARC + vérification Resend de `finebindery.com` (voir E-G).
- Revue juridique des CGV, désignation d'un médiateur réel (voir K/L).

**Bug trouvé et corrigé pendant le smoke test navigateur de cette session,
absent de l'audit initial** : la barre latérale "Live Project Canvas"
affichait "Réparation" (français) sur `finebindery.com` alors que la question
elle-même s'affichait déjà en anglais ("Repair it"). Cause : `optionLabel()`
(`engine/brief.ts`) préfère `option.briefLabel` à `option.label` pour le
Canvas et le récapitulatif — un texte volontairement distinct pour le Brief
remis au relieur — mais le test de couverture i18n (`enBookbindingCopy.test.ts`)
ne parcourait jamais `briefLabel`, seulement `label`/`reassurance`/etc. Sept
chaînes concernées (`Réparation`, `Restauration`, `Reliure`,
`Personnalisation`, `Transformation`, `Protection sur mesure`, `Projet à
préciser`), toutes traduites ; le test de couverture corrigé pour ne plus
laisser passer ce genre de trou. Vérifié en navigation réelle après
redéploiement : corrigé.

---

### Chantier de cette session (suite 7) — TVA France 20 % automatique (décision opérationnelle temporaire)

Décision de l'utilisateur (18 septembre 2026, "Décision fiscale temporaire
validée") pour débloquer les ventes françaises Ma Reliure sans attendre
une politique fiscale internationale.

**Règle** : tout dossier avec `billing_country = FR` (particulier OU
professionnel) reçoit automatiquement `tax_policy = FR_B2C`,
`customer_vat_rate_bps = 2000` (20 %), `tax_validation_source =
FR_STANDARD_VAT_20`. Tout le reste — Fine Bindery, UE hors France, hors
UE — reste `MANUAL_TAX_REVIEW`, sans changement : `resolveAutomaticTaxPolicy`
(`taxPolicy.ts`) ne renvoie rien pour eux, jamais une extrapolation
("si la France, pourquoi pas l'Allemagne" — non, tant que ce n'est pas
une décision explicite équivalente).

**`tax_validated_by` reste `NULL` pour cette source** — pas un admin qui
valide, et surtout pas un UUID inventé (`SYSTEM_POLICY` en texte n'aurait
pas pu satisfaire la contrainte de clé étrangère vers `auth.users`).
`tax_validation_source = 'FR_STANDARD_VAT_20'` porte seule cette
information, sans ambiguïté avec une validation humaine
(`'manual_admin_review'`, qui exige toujours `tax_validated_by`).
Garanti par une contrainte CHECK dédiée (migration `20260918090000`,
appliquée et vérifiée en production — `pg_get_constraintdef` relu après
coup).

**Nouvelles server functions** (`commercialProposal.data.functions.ts`) :
- `applyAutomaticFranceTaxPolicy` — fail closed sur tout pays différent
  de `FR` (§7 du brief : ce n'est pas `validateCommercialProposalTax`
  avec une valeur pré-remplie, c'est une porte séparée qui ne peut
  matériellement pas s'appliquer à un dossier international).
- `resetProposalTaxToManualReview` — la porte de sortie que l'admin garde
  toujours (§2, §8) pour un cas particulier détecté avant acceptation.

**UI admin** (`CaseMatchingPage.tsx`) : un bandeau vert "France détectée"
avec un bouton d'application en un clic dès que le pays de facturation
saisi vaut `FR` ; le formulaire manuel (les quatre autres catégories, ou
un forçage) reste disponible, replié dans un `<details>`. Le
`PreflightPanel` affiche désormais la source de validation, avec la
mention "Auto-validée par la politique système" pour `FR_STANDARD_VAT_20`.

**Tests** (§9 du brief, cas exacts) : `taxPolicy.test.ts` — FR B2C et
FR B2B, service HT 500 € → TVA 100 € → TTC 600 € ; Fine Bindery UAE, USA,
et UE hors France (DE, IT) restent `MANUAL_TAX_REVIEW`.
`npx vitest run` → 148 fichiers, 1981 tests verts (7 nouveaux).
`npx tsc --noEmit` propre, `npm run lint` 0 erreur, `npm run
build:mareliure` vert.

**Déployé** : migration `20260918090000` appliquée et vérifiée
(`pg_get_constraintdef` relu directement), `npm run deploy:mareliure` →
Worker `mareliure` version `08911db0-f9be-4368-b565-da9b8828950f`. Smoke
test `https://mareliure.fr/` : 0 erreur console.

**Non fait, nécessite un admin réel** : dérouler le parcours §34 du
brief du 17 septembre (Project Brief → pricing → proposition → **appliquer
la TVA France automatique** → accepter → preflight) jusqu'à `READY FOR
PAYMENT` sur un dossier français réel/interne. Toujours pas d'identifiants
admin disponibles ici.

---

### Chantier de cette session (suite 6) — migrations fiscales appliquées, déploiement en production

Suite directe de la suite 5 : le blocage `SUPABASE_ACCESS_TOKEN` a été
levé par l'utilisateur au cours de cette même session.

**Deux échecs avant le bon jeton — documentés pour qu'un futur agent ne
perde pas de temps sur la même confusion** :
1. Premier remplacement : toujours `Unauthorized`, format vérifié correct
   (`sbp_`, 44 caractères) — jeton effectivement expiré/révoqué.
2. Second remplacement : erreur différente (`"JWT could not be decoded"`).
   Diagnostic (préfixe uniquement, jamais la valeur) : `sb_sec…`, 41
   caractères — **une clé API de *projet*** (`sb_secret_...`, l'équivalent
   moderne d'une clé de service), pas un **jeton d'accès personnel**. Les
   deux sont des credentials Supabase distincts, faciles à confondre : la
   clé de projet vient de *Project Settings → API*, le jeton de gestion
   vient de *Account Settings → Access Tokens* et commence par `sbp_`.
3. Troisième remplacement : `sbp_`, 44 caractères — **valide**.

**Vérifications avant toute écriture (§6-7 du brief)** :
- `GET /v1/organizations` → `200`, liste vide (le compte n'a pas
  d'organisation nommée visible par ce jeton — sans conséquence, la suite
  a confirmé l'accès au bon projet directement).
- `GET /v1/projects` → un seul projet, `hljxohondjvrkzqicexl`, `"Ma
  Reliure - production"`, `status: "ACTIVE_HEALTHY"` — la cible attendue,
  confirmée par le jeton lui-même plutôt que supposée depuis la doc.
- `supabase_migrations.schema_migrations` : 70 lignes, la plus récente
  `20260916120000` — exactement ce qui était documenté, aucune migration
  concurrente ajoutée par ailleurs. 72 fichiers locaux − 70 appliquées = 2
  en attente (`20260917090000`, `20260917100000`), comme prévu.

**Application** (`POST /v1/projects/hljxohondjvrkzqicexl/database/query`,
jamais `supabase db push` — toujours injoignable en IPv6 depuis cet
environnement) :
- `20260917090000` appliquée, puis vérifiée par lecture directe
  d'`information_schema.columns` : les 6 colonnes fiscales existent avec
  les bons types et le bon défaut (`tax_policy` → `MANUAL_TAX_REVIEW`).
  Enregistrée dans `supabase_migrations.schema_migrations` pour que
  `supabase migration list`/`db push --dry-run` la reconnaisse.
- `20260917100000` : la première tentative a été **refusée par le
  classificateur de permissions de Claude Code** ("Modify Shared
  Resources") — même catégorie de refus déjà rencontrée le 16 septembre
  pour `stripe_implementation_planner`. Aucun contournement tenté ; le
  blocage et la commande exacte ont été communiqués à l'utilisateur, qui
  a explicitement autorisé la poursuite ("fais toi même"). Réappliquée
  avec succès, vérifiée de la même façon (les 5 colonnes B2B existent),
  puis enregistrée dans `schema_migrations`.
- Compte final : `supabase_migrations.schema_migrations` liste bien
  `20260917100000`, `20260917090000`, `20260916120000` en tête — les deux
  nouvelles sont les plus récentes.

**Redéploiement** (§32) : `npx tsc --noEmit` propre, `npx vitest run` → 148
fichiers/1974 tests verts, `npm run build:mareliure` vert (bundle vérifié
`hljxohondjvrkzqicexl` uniquement), puis `npm run deploy:mareliure` —
Worker `mareliure` version `1338a6ff-9f2b-48a7-9933-16d61e769514`,
92 fichiers uploadés, aucune erreur.

**Smoke tests (§33) — partiels, ce qui est accessible sans identifiants
admin** :
- `https://mareliure.fr/` : charge, 0 erreur console, contenu correct.
- `https://mareliure.fr/auth` : charge (`"Retrouver mes livres — Ma
  Reliure"`), 0 erreur console.
- `https://mareliure.fr/partenaires-relieurs` : charge, 0 erreur console.
- `https://finebindery.com/` : charge (`"Fine Bindery — Exceptional
  French Bookbinding"`), vérifié dans un onglet neuf pour écarter un faux
  positif — 0 erreur console, tous les réseaux en 200/304.
- `https://mareliure.fr/api/marketplace/stripe-health` sans jeton porteur
  → `401` (comportement attendu, confirme que la route est bien déployée
  et protégée — pas de vérification du contenu réel, qui exige le jeton
  `STRIPE_HEALTHCHECK_TOKEN`, un secret que je n'ai pas et ne dois pas
  avoir).
- **Non fait, nécessite une session admin réelle** : portail client,
  espace atelier, admin marketplace, ouverture d'un dossier existant,
  proposition commerciale, validation tax admin, préflight paiement — je
  n'ai pas d'identifiants et ne dois pas en demander. **À faire par
  l'utilisateur** avant de considérer le parcours métier (§34) validé.

**Toujours bloquant avant le premier vrai paiement** (inchangé, aucun de
ces points n'était du ressort de ce chantier) :
1. Un taux de TVA validé par un expert-comptable pour au moins un cas réel.
2. Correction manuelle de l'identité publique Stripe (statement
   descriptor, support_email/url, product_description) — toujours
   impossible à écrire via le connecteur MCP, confirmé cette session ;
   votre accord de principe est noté, l'exécution reste à faire par vous
   dans le Dashboard.
3. Rotation de `STRIPE_SECRET_KEY` — différée par décision explicite.
4. Le parcours métier complet (§34) jusqu'à `READY FOR PAYMENT`, à
   dérouler par un admin réel.

---

### Chantier de cette session (suite 5) — customer_type B2B, vérification Git/Supabase/Stripe réels

Brief du 17 septembre 2026 : reprise depuis l'état réel du dépôt, pas
depuis une supposition. Toujours aucun paiement/customer/invoice/refund/
Connected Account/transfer fictif créé.

**0. État Git vérifié** : `git fetch --all --prune` propre, branche locale
`fix/mareliure-customer-access` à jour avec les commits `7bc0f2e2`/
`1f45d40a` de la session précédente (confirmés déjà commités, comme
attendu), 24 commits en avance sur `mareliure/main` (jamais poussés vers
GitHub — le déploiement production passe par `wrangler`/Cloudflare, pas
par ce remote). Rien d'inattendu.

**6-7. Supabase — toujours bloqué, revérifié avant toute tentative.**
`SUPABASE_ACCESS_TOKEN` (`.env.supabase`) retesté par deux appels distincts
de l'API de gestion (`GET /v1/organizations`, une requête SQL sur
`supabase_migrations.schema_migrations`) : **`401 Unauthorized`** sur les
deux, y compris la lecture la plus triviale possible — confirme un jeton
expiré/révoqué, pas un problème de portée ni de format (longueur 44,
préfixe `sbp_`, aucun caractère de contrôle parasite — vérifié). Aucun
contournement tenté (pas de `supabase login` interactif, pas de recherche
de identifiants ailleurs), conformément à l'instruction explicite de
l'utilisateur. **STOP maintenu sur toute migration/déploiement** tant
qu'un nouveau jeton n'est pas fourni dans `.env.supabase`.

**1-4. Stripe — connecteur MCP réautorisé pendant cette session**, ce qui
n'était pas le cas la fois précédente. Audit live complet, lecture seule :
- `list_available_accounts_or_orgs` confirme les deux comptes visibles,
  dont `acct_1UGI34K0Q47WbZPf` (`"Mareliure/finebindery"`, `livemode:
  true`) — exactement la cible attendue.
- **3 Products inchangés**, mêmes IDs, aucun `default_price` (montants
  toujours dynamiques) : `prod_VGu3DtQmcdtp2Z` (Transport),
  `prod_VGu332vGMShtpJ` (Fine Bindery), `prod_VGu3dUcm5c03W3` (Ma Reliure).
- **Webhook inchangé** (`we_1UGPd7K0Q47WbZPfCZDzfi6p`) : mêmes 7
  événements, `status: "enabled"`, URL correcte.
- **Compte toujours propre** : `GetCustomers` → liste vide,
  `GetAccounts` (connectés) → liste vide. Aucun Customer, aucun Connected
  Account, comme au dernier audit.
- **Identité publique — SECURICOM confirmé toujours présent**, avec un
  niveau de détail que l'accès restreint de la session précédente ne
  permettait pas (`GetAccountsAccount` complet, pas seulement
  `retrieveCurrent`) :
  - `business_profile.support_email`: `"contact@securicom.shop"`
  - `business_profile.support_url`: `null`
  - `business_profile.url`: `"https://www.oppe.fr"`
  - `settings.card_payments.statement_descriptor_prefix`: `"SECURICOM"`
  - `settings.payments.statement_descriptor`: `"SECURICOM"`
  - **Nouveau constat, hors de la liste du brief** :
    `business_profile.product_description`:
    `"Plateforme de mise en relation entre professionnels du btp"` —
    résidu du même compte cloné, décrit une activité BTP, pas de la
    reliure. `business_profile.mcc`: `"5734"` ("Computer Software
    Stores") — catégorie marchande probablement héritée aussi, jamais
    choisie pour Ma Reliure/Fine Bindery.
  - Le reste est correct : `company.name: "Oppe"`, adresse, SIREN/TVA
    correspondent à `MARELIURE_PUBLISHER` ; `charges_enabled`/
    `payouts_enabled: true` ; compte bancaire QONTO (FR, EUR) déjà relié.
  - **Correction apportée à ce constat après vérification plus poussée** :
    une capacité d'écriture (`UpdateBrandSettings`) est bien apparue dans
    la recherche d'opérations Stripe, mais elle ne couvre que le logo et
    les couleurs (`/v1/_unstable/settings/brand`) — **pas**
    `business_profile`, `settings.card_payments`,
    `settings.payments` ni `product_description`. Recherche explicite
    d'une opération d'écriture pour ces champs (`stripe_api_search` sur
    "update account business profile", "update connected account",
    "update statement descriptor payments settings") : aucun résultat.
    Tentative directe de `PostAccountsAccount` : refusée, opération non
    disponible. **La conclusion du 16 septembre reste donc exacte** :
    aucune écriture n'est possible sur ces champs via ce connecteur, quel
    que soit le niveau de lecture désormais accordé. L'utilisateur a
    explicitement approuvé la correction (statement descriptor "OPPE",
    `support_email: contact@oppe.fr` confirmée surveillée,
    `support_url`/`business_profile.url: https://mareliure.fr`,
    `product_description` corrigée) — **reste à appliquer par lui-même
    dans le Dashboard Stripe** (Paramètres → Informations publiques de
    l'entreprise / Marque), le connecteur ne pouvant pas l'exécuter à sa
    place.

**10-12. `customer_type` — le modèle n'est plus structurellement
B2C-only.** Détail complet dans `docs/commercial-billing-model.md` §9ter.
Résumé : `CommercialTaxPolicy` reste inchangé, un nouveau
`CustomerType` (`"CUSTOMER"` par défaut, `"BUSINESS"`) rejoint le snapshot,
avec `business_name` (requis en base si `BUSINESS`, contrainte CHECK),
`business_vat_number`, `business_vat_validation_status`
(`"NOT_CHECKED"` par défaut, rien ne l'automatise), `billing_country`.
Se finalise avec la fiscalité, avant acceptation, dans le même geste
(`validateCommercialProposalTax`/`TaxValidationForm`). `checkoutEligibility`
bloque désormais aussi (`reason: "business_identity_incomplete"`) un
client `BUSINESS` sans raison sociale.

**13, 16. Préflight admin mis à jour** : affiche désormais le type de
client (particulier/professionnel, raison sociale) et le pays de
facturation.

**24-25. Facturation / numérotation — rien à auditer pour l'instant.**
Zéro Invoice existe sur le compte (zéro Customer, cohérent) : il n'y a pas
de séquence de numérotation à observer avant la première facture réelle.
Rien construit ni modifié sur ce point ce chantier.

**J-L. Tests, typecheck, lint, build.** `npx vitest run` : 148 fichiers,
1974 tests verts (4 nouveaux). `npx tsc --noEmit` : propre (types Supabase
mis à jour à la main pour les 5 nouvelles colonnes, même geste que la
suite 4). `npm run lint` : 0 erreur, 13 avertissements préexistants sans
rapport. `npm run build:mareliure` : vert, bundle vérifié
(`hljxohondjvrkzqicexl` uniquement).

**M-N. Déploiement — toujours BLOQUÉ.** Comme en suite 4 : déployer sans
les deux migrations casserait `getMyCustomerCase` (colonnes lues qui
n'existeraient pas encore côté base). **Rien déployé.**

**À faire par l'utilisateur avant de reprendre ce chantier** (inchangé
depuis la suite 4) :
1. Générer un nouveau jeton — Dashboard Supabase → compte → Access Tokens
   → New token — et remplacer la valeur de `SUPABASE_ACCESS_TOKEN` dans
   `.env.supabase`.
2. Appliquer LES DEUX migrations (`20260917090000` puis `20260917100000`,
   dans cet ordre) via l'API de gestion — jamais `supabase db push` en
   direct, IPv6 non routable depuis cet environnement.
3. Alors seulement : `npm run deploy:mareliure`, puis les smoke tests
   (§33 du brief) et le parcours métier sans paiement (§34) jusqu'à
   `READY FOR PAYMENT`.
4. **Appliquer manuellement dans le Dashboard Stripe** (le connecteur ne
   peut pas écrire ces champs) : statement descriptor raccourci et de
   repli → `OPPE` ; `support_email` → `contact@oppe.fr` (confirmée
   surveillée par l'utilisateur le 17 septembre) ; `support_url` et
   `business_profile.url` → `https://mareliure.fr` ; `product_description`
   → une description réelle de l'activité (reliure/restauration), pas le
   texte BTP hérité.

**Toujours bloquant avant le premier vrai paiement** :
1. Un taux de TVA validé par un expert-comptable pour au moins un cas réel
   — le mécanisme existe, aucune valeur n'est validée.
2. Correction manuelle de l'identité publique du compte (statement
   descriptor, support_email/url, product_description/mcc).
3. Rotation de `STRIPE_SECRET_KEY` — différée par décision explicite de
   l'utilisateur.
4. Les migrations `20260917090000`/`20260917100000` et le déploiement.

---

### Chantier de cette session (suite 4) — politique fiscale, éligibilité Checkout, préflight, bouton Payer

Brief du 17 septembre 2026 : dernier chantier avant le premier vrai
paiement. Connect/payout atelier explicitement non touché.

**1. Identité publique Stripe — pas re-vérifiée en direct.** Le connecteur
MCP Stripe (`stripe`) exige une autorisation OAuth que cette session, non
interactive, ne peut pas faire aboutir : `list_available_accounts_or_orgs`
et tout autre appel Stripe ont été refusés faute d'autorisation. L'audit
réutilisé ici est donc celui déjà consigné le 16 septembre 2026 (suite 2,
plus haut) : le compte `acct_1UGI34K0Q47WbZPf` porte toujours l'héritage
"SECURICOM" (`statement_descriptor_prefix`, `payments.statement_descriptor`,
`support_email: contact@securicom.shop`, `support_url: www.oppe.fr`). La
proposition de correction n'a pas changé : préfixe `OPPE`, `support_email:
contact@oppe.fr`, `support_url: https://mareliure.fr` — toujours à
appliquer par l'utilisateur lui-même dans le Dashboard (le jeton MCP,
quand il redevient accessible, reste de toute façon en lecture seule sur
ces paramètres, `limited_account_retrieve`).

**2-6. Politique fiscale — architecture construite, aucun taux inventé.**
Détail complet dans `docs/commercial-billing-model.md` §9bis. Résumé :
- Cinq catégories nommées (`MANUAL_TAX_REVIEW`, `FR_B2C`, `EU_B2C`,
  `NON_EU_B2C`, `NON_EU_TEMPORARY_IMPORT_REEXPORT`) —
  `src/marketplace/commercial/commercialProposal.ts`.
- `src/marketplace/commercial/taxPolicy.ts` (pur, testé,
  `taxPolicy.test.ts`) : liste des États membres UE (un fait géographique,
  codé en dur — la seule chose qui l'est), `suggestTaxPolicyForCountry`
  (suggestion de pré-remplissage, jamais lue par l'éligibilité Checkout),
  `validateTaxPolicySelection` (garde structurelle), `recomputeProposalTax`
  (arithmétique HT→TTC pure).
- Migration `20260917090000_marketplace_commercial_proposal_tax.sql` :
  renomme `TAX_REVIEW_REQUIRED` → `MANUAL_TAX_REVIEW` sur
  `marketplace_commercial_proposals.tax_policy` (aucune ligne réelle
  affectée — aucune proposition acceptée n'existe encore), ajoute
  `tax_country`/`tax_basis`/`tax_validation_source`/`tax_validated_at`/
  `tax_validated_by`, et une contrainte CHECK qui rend
  **structurellement impossible** qu'une catégorie autre que
  `MANUAL_TAX_REVIEW` existe sans validation tracée. Le trigger
  d'acceptation refuse désormais aussi d'accepter une proposition dont la
  fiscalité n'a pas été validée.
- `validateCommercialProposalTax` (server function, admin) : la seule
  écriture qui valide une fiscalité — un admin choisit pays/catégorie/taux,
  jamais une règle automatique. `TaxValidationForm` dans
  `CaseMatchingPage.tsx` (admin) l'expose.
- `checkoutEligibility` (`checkoutPlan.ts`) exige désormais
  `tax_validated_at` en plus de `tax_policy` — testé (`checkoutPlan.test.ts`).

**7-8. HT-first, transport.** Inchangés — déjà conformes (§7 du brief),
voir `commercial-billing-model.md` §4-5.

**10-11. Éligibilité Checkout finale et bouton Payer.** `getMyCustomerCase`
recalcule `checkoutEligibility` côté serveur et expose
`case.paymentEligible` ; `CustomerCasePage.tsx` n'affiche le bouton
(« Payer » / « Pay securely », `PayButton`) que si ce flag est vrai. Le
bouton n'appelle que `createCommercialCheckoutSession`, qui refait le même
calcul avant de parler à Stripe — aucun montant, aucune éligibilité
calculée côté navigateur.

**13. Préflight admin.** `getPaymentPreflight`
(`src/marketplace/stripe/paymentPreflight.server.ts`) + `PreflightPanel`
(`CaseMatchingPage.tsx`) : marque, dossier, client, service/transport HT,
fiscalité, TVA, TTC, `assertExpectedStripeAccount` appelé pour de vrai,
Products configurés, suffixe de relevé, webhook configuré, déjà-payé →
`READY FOR PAYMENT` ou `BLOCKED — <raisons>`.

**J-L. Tests, typecheck, build.** `npx vitest run` : 148 fichiers, 1970
tests verts (16 nouveaux : `taxPolicy.test.ts` + mises à jour de
`checkoutPlan.test.ts`/`commercialProposal.test.ts`). `npx tsc --noEmit` :
propre (après mise à jour manuelle de `src/integrations/supabase/types.ts`
pour les cinq nouvelles colonnes — même geste que les fois précédentes).
`npm run build:mareliure` : vert, bundle vérifié
(`hljxohondjvrkzqicexl` uniquement).

**M-N. Déploiement — BLOQUÉ, pas fait.** `SUPABASE_ACCESS_TOKEN`
(`.env.supabase`) répond `Unauthorized` sur l'API de gestion Supabase,
même sur un appel de lecture trivial (`GET /v1/organizations`) — le jeton
est expiré ou révoqué, pas un problème de portée. Conséquence directe :
**la migration `20260917090000` n'a pas pu être appliquée en production**,
et déployer le code sans elle casserait `getMyCustomerCase` (appelé par
toute cliente qui ouvre son dossier : `loadAcceptedCommercialProposal`
sélectionne désormais des colonnes qui n'existeraient pas encore côté
base) — une régression bien plus grave que le blocage qu'on cherche à
lever. **Le code n'a donc pas été déployé**, par choix, pas par oubli.

**À faire par l'utilisateur avant de reprendre ce chantier** :
1. Générer un nouveau jeton — Dashboard Supabase → compte → Access Tokens
   → New token — et remplacer la valeur de `SUPABASE_ACCESS_TOKEN` dans
   `.env.supabase`.
2. Appliquer la migration via l'API de gestion (voir §H plus haut pour la
   commande exacte — jamais `supabase db push` en direct, IPv6 non
   routable depuis cet environnement).
3. Alors seulement : `npm run deploy:mareliure`.

**Toujours bloquant avant le premier vrai paiement** :
1. Un taux de TVA validé par un expert-comptable pour au moins un cas réel
   — le mécanisme existe, aucune valeur n'est validée.
2. Correction manuelle de l'identité publique du compte (voir point 1).
3. Rotation de `STRIPE_SECRET_KEY` — différée par décision explicite de
   l'utilisateur.
4. La migration `20260917090000` et le déploiement — voir ci-dessus.

---

### Chantier de cette session (suite 3) — clé live posée, webhook enregistré

**`STRIPE_SECRET_KEY` posée avec succès, health check vert :**

```json
{"ok":true,"expectedAccountId":"acct_1UGI34K0Q47WbZPf"}
```

Deux bugs réels trouvés et corrigés en chemin, pas juste "ça a fini par
marcher" :

1. **Le prompt masqué de `wrangler secret put` (`Enter a secret value:
   ... *`) n'a capturé qu'un seul caractère de contrôle** au lieu de la clé
   collée, dans ce terminal PowerShell — un bug d'environnement, pas un
   mismatch de compte. Diagnostiqué via un endpoint temporaire
   (`?raw=1` sur `/api/marketplace/stripe-health`, retiré depuis) qui
   comparait la longueur/le préfixe de la clé lue par le Worker à ce
   qu'elle devait être. Résolu en repassant par redirection de fichier
   (`Get-Content | wrangler secret put`) plutôt que le prompt interactif.
2. **Le client Stripe de la marketplace n'avait pas de `httpClient` fetch**
   — indispensable en Cloudflare Workers (pas de module Node `http`/
   `https`). Sans ça, `assertExpectedStripeAccount` échouait toujours,
   quelle que soit la clé, avec `StripeAPIError: Invalid JSON received
   from the Stripe API`. Corrigé en ajoutant `httpClient:
   Stripe.createFetchHttpClient()`, comme le fait déjà
   `src/lib/stripe.server.ts` pour l'autre intégration.

**Incident de sécurité en chemin, documenté pour mémoire** : une tentative
manuelle de réenregistrer la clé a collé sa valeur directement sur la
ligne de commande (après `--name mareliure`, sans espace) plutôt qu'au
prompt — la commande a échoué (nom de Worker invalide), mais la clé a
transité en clair par l'historique du terminal et cette conversation.
Rotation signalée comme nécessaire ; **l'utilisateur a choisi explicitement
de continuer avec cette clé et de la faire tourner plus tard** — décision
qui lui appartient, actée ici pour qu'un futur agent ne la re-signale pas
comme un fait nouveau sans savoir qu'elle a déjà été tranchée.

**Endpoint de santé permanent** : `GET /api/marketplace/stripe-health`
(`src/routes/api/marketplace/stripe-health.ts`), protégé par jeton porteur
(`STRIPE_HEALTHCHECK_TOKEN`, secret Cloudflare). Déclenche
`assertExpectedStripeAccount` à la demande — à réutiliser après toute
future pose ou rotation de `STRIPE_SECRET_KEY`, pas seulement cette
fois-ci.

**Webhook live enregistré** :

| | |
| --- | --- |
| Endpoint ID | `we_1UGPd7K0Q47WbZPfCZDzfi6p` |
| URL | `https://mareliure.fr/api/marketplace/stripe-webhook` |
| Événements | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `invoice.paid`, `invoice.payment_failed` |
| Statut | `enabled` |

`STRIPE_WEBHOOK_SECRET` posé en secret Cloudflare uniquement (jamais vu
ailleurs). Vérifié en conditions réelles, sans aucun faux événement
financier :
- `POST` sans en-tête `stripe-signature` → 400 `Missing stripe-signature header`.
- `POST` avec une signature invalide → 400 `Invalid signature` (confirme
  que le secret réel est bien utilisé pour vérifier, pas juste que le
  endpoint répond).
- Idempotence (`marketplace_stripe_webhook_events`, dédoublonnage par
  `event.id`) : couverte par les tests unitaires existants
  (`webhookEvents.test.ts`, `stripeWebhookLog.server.ts`), pas rejouée en
  live — aucun événement financier réel n'existe encore pour la tester de
  bout en bout, et en fabriquer un serait exactement ce qui est interdit.

**Toujours bloquant avant le premier vrai paiement** :
1. Politique fiscale concrète (`tax_policy` reste `TAX_REVIEW_REQUIRED`,
   `checkoutEligibility` bloque tout Checkout tant que ça n'a pas changé).
2. Correction manuelle de l'identité publique du compte côté Dashboard
   (statement descriptor "SECURICOM" hérité, support_email/url — voir le
   chantier précédent pour les valeurs proposées) — pas encore faite par
   l'utilisateur au moment d'écrire ceci.
3. Rotation de `STRIPE_SECRET_KEY` — différée par décision explicite de
   l'utilisateur, pas oubliée.
4. Bouton « Payer » côté client — toujours non branché sur
   `createCommercialCheckoutSession`.

---

### Chantier de cette session (suite 2) — bascule effective sur le compte live dédié

Le connecteur MCP Stripe a été reconnecté par l'utilisateur sur
`acct_1UGI34K0Q47WbZPf` (confirmé : `list_available_accounts_or_orgs`
renvoie désormais les deux comptes, `livemode: true` sur le nouveau).

**Fait :**

1. **Audit live read-only** de `acct_1UGI34K0Q47WbZPf` : `charges_enabled`/
   `payouts_enabled: true`, `transfers: active`, zéro Connected Account,
   zéro Product, zéro webhook, zéro customer/invoice — compte propre.
   **Mais hérité de "SECURICOM"** (comme l'ancien compte partagé) sur
   `card_payments.statement_descriptor_prefix`,
   `payments.statement_descriptor`, `business_profile.support_email`
   (`contact@securicom.shop`) et `support_url` (`www.oppe.fr`) — visiblement
   un profil cloné à la création plutôt que rempli pour Ma Reliure/Fine
   Bindery.
2. **Trois Products créés sur `acct_1UGI34K0Q47WbZPf`** (aucun n'existait) :
   `prod_VGu3dUcm5c03W3` (Ma Reliure), `prod_VGu332vGMShtpJ` (Fine
   Bindery), `prod_VGu3DtQmcdtp2Z` (Transport).
3. **Secrets du Worker `mareliure` remplacés** : `STRIPE_PRODUCT_MA_RELIURE_SERVICE`/
   `_FINE_BINDERY_SERVICE`/`_SHIPPING` pointent désormais vers ces trois IDs
   — les anciens (créés sur `acct_1S530YKEMCwyPCrw`, jamais utilisés
   réellement) ne sont plus référencés nulle part en production.
4. **Correction technique demandée par l'utilisateur** : `PaymentIntent.
   statement_descriptor` ne s'applique pas aux paiements carte — Stripe
   combine `statement_descriptor_suffix` avec le préfixe raccourci du
   compte. `statementDescriptorSuffixForBrand` (`checkoutPlan.ts`, pur,
   testé) dérive `"MARELIURE"`/`"FINEBINDERY"` du `brand` de la proposition
   acceptée — jamais du navigateur — câblé dans
   `payment_intent_data.statement_descriptor_suffix` de
   `createCommercialCheckoutSession`. Avec un préfixe cible `"OPPE"` côté
   compte, le combiné (`OPPE*MARELIURE` = 14 car., `OPPE*FINEBINDERY` = 16
   car.) reste sous la limite Stripe de 22 caractères.
5. **Impossible de corriger l'identité publique du compte moi-même** : la
   clé/session connectée via MCP pour `acct_1UGI34K0Q47WbZPf` est scopée
   `required_permissions: ["limited_account_retrieve"]` — lecture seule sur
   les paramètres de compte (`business_profile`, `settings`,
   `statement_descriptor`…). Aucune opération d'écriture correspondante
   n'apparaît même dans `stripe_api_search`. **À faire par l'utilisateur
   lui-même, via le Dashboard Stripe (Paramètres → Informations publiques
   de l'entreprise / Marque)** :
   - Descripteur raccourci (préfixe) : `OPPE`
   - Descripteur de repli (`payments.statement_descriptor`) : proposer
     `OPPE` également (cohérent, même entité, jamais "SECURICOM")
   - `support_email` : `contact@oppe.fr` (déjà l'adresse officielle
     publiée dans les pages légales des deux marques,
     `src/marketplace/legal/legalEntity.ts` — jamais une adresse inventée)
   - `support_url`/`business_profile.url` : `https://mareliure.fr`
     (le site produit réellement exploité ; `www.oppe.fr` n'est pas une
     vitrine client)
   - Ne pas toucher l'identité juridique (`company.name: "Oppe"`,
     adresse, SIREN/SIRET/TVA) — déjà correcte et correspond à
     `MARELIURE_PUBLISHER` dans le code.
6. **Stripe Tax reste sans effet sur notre politique métier** :
   `tax.settings.status: "active"` sur ce compte aussi, mais
   `checkoutEligibility` (`checkoutPlan.ts`) continue de bloquer tout
   Checkout tant que `tax_policy` vaut `TAX_REVIEW_REQUIRED` — aucune
   politique concrète (France B2C, UE B2C, hors UE, biens envoyés puis
   réexportés) n'a été décidée ni construite. Volontairement inchangé.

**Toujours bloquant** : `STRIPE_SECRET_KEY` du compte
`acct_1UGI34K0Q47WbZPf` jamais posée (l'utilisateur doit le faire
lui-même) — sans elle, ni le health check applicatif, ni le webhook live
ne peuvent avancer.

npx vitest run : 147 fichiers, 1954 tests verts (2 nouveaux). npx tsc
--noEmit : propre. npm run lint : propre. npm run build : vert. Déployé.

---

### Chantier de cette session (suite) — compte de test dédié, Connect modernisé

**Trois comptes Stripe distincts coexistent désormais — à ne jamais confondre :**

| Compte | Rôle | Mode |
| --- | --- | --- |
| `acct_1S530YKEMCwyPCrw` | Ancien compte partagé (Métré/AccessBot/BatiScores/MuWo/Securicom) | live — **ne plus jamais y écrire d'objet marketplace** |
| `acct_1UGI34K0Q47WbZPf` | Compte live **dédié** Ma Reliure/Fine Bindery | live — cible de production, `STRIPE_EXPECTED_ACCOUNT_ID` du Worker |
| `acct_1UGISJKB3EBc6Slh` | « environnement de test Mareliure/finebindery » — test dédié, découvert cette session via une clé `sk_test_...` fournie par l'utilisateur | test — pour le développement local uniquement |

**Nouveau, cette session :**

1. **`ensureBinderStripeAccount` ne passe plus par `type: "express"`** (paramètre legacy) mais par `controller` explicite
   (`fees.payer`/`losses.payments: "application"`, `stripe_dashboard.type: "express"`,
   `requirement_collection: "stripe"`) — recommandation directe de
   `stripe_implementation_planner` (arbre de décision Connect #5 : "Do NOT
   configure connected accounts using the legacy type parameter").
2. **`scripts/setupStripeProducts.ts` n'est plus câblé sur un seul compte en
   dur** : il lit `STRIPE_EXPECTED_ACCOUNT_ID` de l'environnement et refuse
   (fail closed) si la clé posée répond pour un autre compte — même garde
   que `assertExpectedStripeAccount`. Exécuté avec succès contre le compte
   de test (`acct_1UGISJKB3EBc6Slh`) : trois Products créés
   (`prod_VGqVa0gxBdKMFv`, `prod_VGqV9v0VrlqutW`, `prod_VGqVuC29bc1dgv`),
   ré-exécution confirmée idempotente.
3. **`.env` local de l'utilisateur** porte désormais `STRIPE_SECRET_KEY`
   (clé test), `STRIPE_EXPECTED_ACCOUNT_ID=acct_1UGISJKB3EBc6Slh` et les
   trois `STRIPE_PRODUCT_*` du compte de test — jamais lu ni affiché par
   l'agent, seule sa présence a été vérifiée (`grep -c`).
4. **Le connecteur MCP Stripe de cette session reste scopé sur l'ancien
   compte partagé** (`acct_1S530YKEMCwyPCrw`) — toujours pas reconnecté sur
   `acct_1UGI34K0Q47WbZPf`. Un audit read-only via `stripe_implementation_planner`
   a néanmoins été obtenu (le tool n'exige pas d'accès au compte cible pour
   produire un plan générique) : voir l'arbre de décision complet dans la
   conversation pour le détail (Connect Separate Charges and Transfers,
   fee collection par `transferring less`, Invoicing déclenché par
   événement métier).

**`stripe_implementation_planner` est soumis à l'approbation de l'auto-mode
classifier** (catégorie « Modify Shared Resources » — le tool crée
apparemment un guide persistant côté Stripe) : le premier appel a été
refusé, le second (après que l'utilisateur a ajusté ses permissions) est
passé.

npx vitest run : 147 fichiers, 1952 tests verts. npx tsc --noEmit : propre.
npm run lint : propre. npm run build : vert. Déployé.

---

### Chantier de cette session — Stripe live, Phase 1 (audit, Products, Checkout/webhook/Connect préparés)

Décision explicite de l'utilisateur, après le constat de la session
précédente (connecteur MCP Stripe = compte live, pas de sandbox) :
**« NO SANDBOX. Nous travaillons directement sur le compte Stripe LIVE
actuellement connecté : `acct_1S530YKEMCwyPCrw`. »** Avec garde-fous stricts :
aucun faux paiement, aucune fausse facture, aucun transfert de test, aucun
client fictif — le premier vrai paiement devra correspondre à une vraie
commande.

**1. Audit live read-only, complet (rien modifié pendant l'audit).**
`acct_1S530YKEMCwyPCrw` :

- **Identité réelle : « Oppe », private_corporation, France** (705 route
  du Montclair, 24160 Clermont d'Excideuil), TVA/SIRET fournis, compte
  `standard` (`controller.type: account`), `charges_enabled`/
  `payouts_enabled: true`, capacités carte/Klarna/Bancontact/etc. actives,
  `transfers: active` (Connect utilisable). Devise par défaut `eur`, pays
  `FR`. Compte bancaire externe QONTO (FR) rattaché.
- **Ce compte sert déjà, réellement et en direct, au moins cinq autres
  activités** : Métré Build (abonnements SaaS — les Products "Métré
  Business/Launch/Growth/Pro", webhooks "Created by Lovable" pointant vers
  `lovable.app`/`lovable.dev` et un *quatrième* projet Supabase,
  `lmzyhtpqzdkefgshnbqm`), AccessBot Pro / Audit One Shot (audit RGAA),
  BatiScores Premium (avec son propre webhook Supabase
  `zmhlwuwpnoawtnryqvdc`), MuWo (annonces de mission BTP — abonnements
  Starter/Pro/Business, un vrai client `contact@muwo.fr`), Securicom (BTP
  — `business_profile.name: "Oppe"`, `support_email:
  contact@securicom.shop`, **`statement_descriptor_prefix: "SECURICOM"`**),
  Axelo (`axelo.nanocorp.app`). Des factures réelles existent et ont été
  payées (ex. 120 € TTC, `in_1SBJVGKEMCwyPCrwPCac6BD7`). Numérotation de
  facture **partagée** entre toutes ces activités (préfixe `W2WNQYLL-000X`
  constaté sur deux factures de produits différents) — **non touchée**,
  conformément à l'instruction explicite.
- **`GetAccounts` (Connected Accounts) : liste vide.** Aucun Connect
  Standard/Express/Custom n'existe encore sur ce compte — table rase pour
  Ma Reliure/Fine Bindery, aucun conflit possible.
- **`tax.settings` : Stripe Tax actif** (`status: active`,
  `tax_behavior: inferred_by_currency`), déjà utilisé par les autres
  produits. Rien activé pour la marketplace dans ce chantier — `tax_policy`
  reste `TAX_REVIEW_REQUIRED` côté application, voir point 5.
- **Balance** : 0 € disponible, 0 € en attente (paiements quotidiens,
  délai 3 jours) — rien d'anormal.
- **Conclusion de l'audit, explicitement acceptée par l'utilisateur** :
  aucune anomalie bloquante. « Oppe » est déjà l'entité qui facture
  plusieurs marques distinctes (Métré, Securicom, MuWo, BatiScores,
  AccessBot) sous ce même compte Stripe — Ma Reliure/Fine Bindery s'y
  ajoutent comme une marque de plus, pas un cas nouveau. **Point ouvert,
  non résolu par ce chantier** : le descripteur de relevé bancaire par
  défaut du compte est "SECURICOM" ; un Product a un `statement_descriptor`
  propre mais **ce champ ne s'applique qu'aux paiements par abonnement**
  (confirmé via `stripe_api_details`), pas à un Checkout `mode: payment`
  ponctuel comme le nôtre — un client Ma Reliure/Fine Bindery verrait donc
  aujourd'hui "SECURICOM" sur son relevé bancaire, sauf action
  complémentaire (`payment_intent_data.statement_descriptor_suffix` sur le
  Checkout, à décider avec l'utilisateur — pas fait, pas anodin).

**2. Trois Products live créés, idempotents.** Recherchés d'abord par
metadata (`GetProducts`, aucun `brand=MA_RELIURE`/`FINE_BINDERY` ni
`product_role=SHIPPING` existant) puis créés :

| Rôle | Product ID | Metadata |
| --- | --- | --- |
| Ma Reliure Service | `prod_VGowujXB5VAtLN` | `product_role=CUSTOMER_SERVICE`, `brand=MA_RELIURE` |
| Fine Bindery Service | `prod_VGoxLIJgDWDx7c` | `product_role=CUSTOMER_SERVICE`, `brand=FINE_BINDERY` |
| Transport / Shipping | `prod_VGoxkLqYmwcFm6` | `product_role=SHIPPING` |

Aucun Price fixe créé — le montant reste toujours `price_data` dynamique,
jamais un tarif Stripe (§6 du brief). `scripts/setupStripeProducts.ts`
(nouveau) referait exactement cette recherche-puis-création s'il fallait le
rejouer — **non exécuté par ce script lui-même** (il a besoin de
`STRIPE_SECRET_KEY`, que je n'ai pas et ne dois pas demander en clair —
voir point 6) ; les trois Products ont été créés directement via le
connecteur MCP, en lecture-avant-écriture (`GetProducts` avant chaque
création). Les trois IDs sont posés comme secrets du Worker Cloudflare
(`STRIPE_PRODUCT_MA_RELIURE_SERVICE`/`_FINE_BINDERY_SERVICE`/`_SHIPPING`) —
jamais en dur dans un composant React.

**3. Checkout — code prêt, jamais déclenché.**
`src/marketplace/stripe/checkoutSession.server.ts`
(`createCommercialCheckoutSession`) recharge le dossier → sa proposition
commerciale **acceptée** → l'état de paiement, vérifie l'autorisation
(`canViewCase`, client propriétaire ou admin), puis construit les lignes
Stripe à partir de ce snapshot immuable — jamais un montant venu du
navigateur (§10). `checkoutPlan.ts` (pur, testé,
`checkoutPlan.test.ts`) porte le fail-closed : **bloque tant que
`tax_policy` vaut `TAX_REVIEW_REQUIRED`** — c'est-à-dire toujours
aujourd'hui, puisqu'aucun moteur fiscal n'a jamais été construit. C'est
voulu (§12, « mieux vaut bloquer un Checkout que facturer avec une
mauvaise TVA ») mais ça veut dire concrètement : **le premier vrai paiement
ne peut pas encore avoir lieu tant qu'une politique fiscale concrète
n'existe pas** — voir Next recommended task. Idempotent (une session déjà
créée pour une proposition est réutilisée, `idempotencyKey` par
proposition) ; aucune UI cliente ne l'appelle encore (pas de bouton
« payer »).

**4. Webhook — route déployée, endpoint live PAS ENCORE créé côté
Stripe.** `POST /api/marketplace/stripe-webhook`
(`webhookHandler.server.ts`) vérifie la signature avant de rien lire,
journalise chaque `event.id` une seule fois
(`marketplace_stripe_webhook_events`, migration `20260916120000`) puis
délègue à `decideWebhookAction` (pur, testé, `webhookEvents.test.ts`) :
`checkout.session.completed`/`payment_intent.succeeded` avec **notre**
metadata marquent la proposition payée
(`marketplace_commercial_proposal_payments`, table séparée exprès — voir
point 7) ; les autres événements du périmètre (`payment_intent.
payment_failed`, `charge.refunded`, `charge.dispute.created`,
`invoice.paid`, `invoice.payment_failed`) sont journalisés dans
`marketplace_events` ; tout paiement sans notre metadata (Métré/BatiScores/
MuWo/Securicom/Axelo, sur ce même compte) est explicitement ignoré. Vérifié
en production : `POST` sans signature → 400 propre, pas de crash. **Pas
encore enregistré côté Stripe** (`PostWebhookEndpoints` jamais appelé) :
l'endpoint échouerait à chaque appel réel tant que `STRIPE_SECRET_KEY`
n'est pas posé (voir point 6) — inutile de le créer avant, ça ne ferait que
générer des échecs de livraison. À faire dès que ce secret existe.

**5. Fiscalité — non traitée, bloque le premier paiement par construction.**
Voir point 3 : `tax_policy` reste `TAX_REVIEW_REQUIRED` pour toute
proposition existante, et `checkoutEligibility` refuse tout Checkout tant
que c'est le cas. Aucune politique fiscale concrète (`FR_STANDARD`,
`EU_CONSUMER`…) n'a été construite dans ce chantier — c'était hors périmètre
du brief Stripe, mais c'est désormais le blocage réel avant tout premier
paiement.

**6. Ce que je n'ai pas pu faire — clé secrète et webhook signing secret.**
`STRIPE_SECRET_KEY` (une vraie clé secrète Stripe) n'existe nulle part
dans mes accès : le connecteur MCP fonctionne par OAuth, pas par clé API
exposée, et je ne dois ni demander à l'utilisateur de la coller dans le
chat, ni la saisir moi-même nulle part (identifiants financiers). **Sans
elle, aucun code Stripe de ce chantier ne peut réellement s'exécuter en
production** — `getMarketplaceStripeClient()` refuse de démarrer. Deux
commandes à lancer par l'utilisateur lui-même, dans son propre terminal
(je ne verrai jamais la valeur) :

```bash
npx wrangler secret put STRIPE_SECRET_KEY --name mareliure
```

Une fois ce secret posé, je peux (sur autorisation déjà donnée par ce
brief) créer le webhook live via le connecteur MCP et poser
`STRIPE_WEBHOOK_SECRET` directement en secret Cloudflare — je ne l'aurai
vu qu'une fois, jamais stocké ailleurs (§16).

**7. Décision d'architecture prise, à documenter clairement** : l'état de
paiement (session Checkout, PaymentIntent, facture, `paid_at`) vit dans
une **nouvelle table séparée**, `marketplace_commercial_proposal_payments`
— pas comme colonnes sur `marketplace_commercial_proposals`. Raison :
cette dernière reste rigoureusement immuable après acceptation (trigger de
la Phase 1, « Do not touch »), et payer n'est pas un terme commercial,
c'est ce qui arrive ensuite à un terme commercial déjà figé. Percer une
exception dans le trigger existant aurait été plus risqué qu'ajouter une
table.

**8. Connect — code préparé, aucun Connected Account créé.**
`binderConnect.server.ts` (compte Express, lien d'onboarding, relecture des
capacités) réutilise `marketplace_binders.stripe_account_id`, déjà présent
depuis la toute première migration marketplace (`20260908120000` —
personne ne l'avait jamais utilisé). Aucune route ni bouton admin ne
l'appelle encore.

**Tests, build, déploiement** : `npx vitest run` → 146 fichiers, 1948 tests
verts (13 nouveaux : `checkoutPlan.test.ts`, `webhookEvents.test.ts`).
`npx tsc --noEmit` → propre. `npm run lint` → propre (mêmes 13
avertissements préexistants). `npm run build` → vert. Déployé
(`npm run deploy:mareliure`, version `edc5d2de-7c3c-469a-aa00-52aafc975b4a`).
Vérifié en production, sans appel financier : `/` sans erreur console,
`POST /api/marketplace/stripe-webhook` sans signature → 400 propre.

---

### Next recommended task (chantier Stripe)

1. **L'utilisateur pose `STRIPE_SECRET_KEY`** (`npx wrangler secret put
   STRIPE_SECRET_KEY --name mareliure`, sa vraie clé secrète live) — rien
   de ce chantier ne peut s'exécuter avant.
2. Une fois ce secret posé : créer le webhook live via le connecteur MCP
   (`PostWebhookEndpoints`, URL `https://mareliure.fr/api/marketplace/
   stripe-webhook`, les 7 événements listés au point 4), poser
   `STRIPE_WEBHOOK_SECRET` en secret Cloudflare dans la foulée.
3. **Décider une politique fiscale concrète** (même minimale, ex.
   `FR_STANDARD` pour un client français) — sans ça, `checkoutEligibility`
   bloque tout Checkout indéfiniment, par construction.
4. **Décider le sort du statement descriptor** ("SECURICOM" par défaut sur
   ce compte partagé) — via `payment_intent_data.statement_descriptor_suffix`
   sur le Checkout, ou accepté tel quel.
5. Brancher un bouton « Payer » côté client (`/mes-livres/:caseId`) sur
   `createCommercialCheckoutSession` — aucune UI ne l'appelle encore.
6. Premier Connected Account réel dès qu'un atelier réel est prêt
   (`binderConnect.server.ts`, jamais appelé à ce jour).

### Known issues (chantier Stripe)

- Nouveau : aucun premier paiement réel n'est possible tant que 1) et 3)
  ci-dessus ne sont pas faits — c'est un blocage attendu (fail closed),
  pas un bug.
- Nouveau : le descripteur de relevé bancaire par défaut de ce compte
  partagé est "SECURICOM" — un client Ma Reliure/Fine Bindery le verrait
  sur son relevé tant que le point 4 ci-dessus n'est pas tranché.
- Nouveau : la numérotation de facture Stripe est partagée avec au moins
  cinq autres activités sur ce compte — pas un problème en soi, mais à
  garder en tête si l'Invoicing Stripe est un jour branché pour la
  marketplace (§13-14 du brief, non traité dans ce chantier).

### Do not touch (chantier Stripe)

- **Ne pas modifier `settings.branding`/`business_profile`/le descripteur
  de relevé au niveau du compte** — ce compte sert déjà cinq autres
  activités réelles ; toute décision de branding pour Ma Reliure/Fine
  Bindery doit rester au niveau Product/Checkout, jamais au niveau compte,
  sans validation explicite.
- **Ne pas toucher la numérotation de facture Stripe** sans validation
  explicite (§14 du brief) — partagée avec d'autres activités réelles.
- **Ne jamais écrire `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` ailleurs
  qu'en secret du Worker Cloudflare** — jamais dans `.env` versionné,
  jamais dans ce document, jamais dans une réponse de chat.
- **Ne pas créer le webhook live avant que `STRIPE_SECRET_KEY` existe** —
  chaque tentative de livraison échouerait et userait la santé de
  l'endpoint pour rien.

---

### Chantier de cette session — corrections post-Phase 1 (compte client, contribution 80 €, Pricebook câblé, audit Stripe)

Suite directe de la Phase 1 (voir le chantier ci-dessous), sur une demande
en quatre volets : sécuriser le compte client, fixer une contribution
minimale réelle, câbler le Pricebook par dossier, puis auditer Stripe en
lecture seule.

**1. Mot de passe attaché par erreur à un compte client réel — corrigé au
niveau du code, pas seulement documenté.** Root cause identifiée avec
certitude en lisant le code (pas de nouvelle hypothèse) : deux formulaires
appelaient `supabase.auth.signUp({ email, password })` sur un e-mail saisi
librement, **avant** toute vérification — `MaReliureAuthPage.tsx`
(« Vous préférez un mot de passe ? » côté client) et
`invitation-atelier.$token.tsx` (l'invitation atelier ne vérifiait l'e-mail
qu'*après* la création du compte, dans `acceptBinderInvitation`). Un test
de l'inscription atelier avec l'adresse d'une cliente déjà connue (lien
magique) a ainsi attaché un mot de passe à son compte réel plutôt que de
créer/rejeter le compte visé par l'invitation. Corrigé (commit
`bdb4ddce`) :
- `MaReliureAuthPage.tsx` : la création de mot de passe client n'existe
  plus comme formulaire public — elle est proposée juste après qu'un code
  de connexion a été vérifié (`CodeSignIn` → `SetPasswordAfterVerification`),
  via `supabase.auth.updateUser({ password })` sur la session que ce code
  vient d'ouvrir. `updateUser` ne prend aucun e-mail en entrée : cibler un
  autre compte est structurellement impossible, pas seulement empêché par
  une validation.
- `invitation-atelier.$token.tsx` : le champ e-mail est verrouillé
  (lecture seule) sur l'adresse réelle de l'invitation, résolue par une
  nouvelle lecture publique `getBinderInvitationEmail` /
  `resolvePendingInvitationEmail` — plus aucun e-mail arbitraire ne peut
  être tapé avant que l'invitation soit vérifiée. Un garde
  `canSubmitInvitationSignup` reste une seconde ligne de défense côté
  client.
- Tests de non-régression : `authPasswordSignupContract.test.ts`
  verrouille qu'aucun `signUp` ne subsiste dans `MaReliureAuthPage.tsx` ;
  `membership.test.ts` couvre `canSubmitInvitationSignup`.
- **L'état réel du compte affecté (`<personal-test-email>` — le
  compte du testeur lui-même, pas un tiers) n'a PAS pu être vérifié ni
  corrigé en base cette session** : le lire précisément (mot de passe
  présent ou non) ou le corriger exige la clé `service_role` de
  production, que le classificateur de sécurité de Claude Code a refusé de
  laisser matérialiser dans cette session (« Credential Materialization »)
  — un choix de sécurité délibéré, pas une limite technique contournable.
  Deux issues, aucune tentée sans validation : (a) l'utilisateur vérifie/
  corrige lui-même via le tableau de bord Supabase (Authentication → Users
  → cette adresse), ce qui est de toute façon la voie la plus sûre pour un
  compte réel ; (b) l'utilisateur autorise explicitement, dans une session
  future, l'usage de la clé `service_role` de production pour ce diagnostic
  précis. Comme le compte concerné est celui du testeur, le risque
  immédiat est faible — mais la vulnérabilité de code, elle, était réelle
  et touchait n'importe quel e-mail client, pas seulement celui-ci.

**2. `minimumContributionCents` : 20 € → 80 € HT, configurable.** Décision
commerciale de l'utilisateur. `PRICING_POLICY.minimumContributionCents`
(`pricing.rules.ts`) passe de `2_000` à `8_000`, version de politique
`bookbinding-2026-09-16-v5`. Même plancher absolu pour les deux marques —
Fine Bindery multiplie *au-dessus* de ce plancher, ne le remplace jamais
(architecture inchangée, voir « Do not touch »). Le snapshot d'une
proposition commerciale conservait déjà la valeur réellement appliquée
(`minimum_contribution_cents`, colonne de la Phase 1) : une commande
acceptée avant ce changement ne bouge pas rétroactivement — vérifié par
`economicTraceability.test.ts`.

**3. `pricebookReferenceCents` câblé dossier par dossier.**
`lookupPricebookReference` (`pricing/pricebook.ts`, nouveau) applique aux
entrées Pricebook **publiées** la même cascade de repli que
`lookupAggregate` sur les grilles atelier (exact → format standard →
complexité standard → générique, jamais un coefficient) et somme leur
`customer_price_cents` pour les travaux du dossier — `null`, jamais une
somme partielle, si un seul travail n'a aucune entrée publiée. Branché
dans `suggestManagedPrice` (`pricing.engine.ts`, via
`generateMarketplacePricing` qui charge maintenant `loadPricebook(sb)` en
plus des grilles) et recalculé à l'identique dans `createCommercialProposal`
(`resolveWork` sur le profil du dossier — la même fonction que le moteur,
jamais une seconde source de vérité). Migration `20260916110000` (appliquée
en production) : `marketplace_cases` gagne
`pricing_pricebook_reference_cents`/`pricing_price_bound_by` (pour l'admin,
avant toute proposition figée) ; `marketplace_commercial_proposals` gagne
`pricebook_provenance` (JSONB — quelles entrées, quelle version, quel prix
publié ont produit la référence, gelé avec la proposition).

**4. Écran admin « Économie » réorganisé.** Six blocs, dans l'ordre où le
prix se construit (§5 de la demande) : Pricebook, Marque, Atelier,
Garde-fous, Client, Économie. Le +30 % Fine Bindery est explicitement
annoté comme une *Brand Pricing Policy* plutôt qu'une simple ligne de
chiffre. Toujours interne/admin uniquement — **jamais exercé en
conditions réelles** (aucun dossier avec `pricing_status: validated` et
une correspondance Pricebook complète n'était disponible pour un
screenshot en conditions réelles cette session non plus).

**5. Audit Stripe MCP en lecture seule — arrêté avant de lire quoi que ce
soit.** `list_available_accounts_or_orgs` ne renvoie qu'un seul compte :
`acct_1S530YKEMCwyPCrw` (« oppe.fr »), **`livemode: true`**. Deux
problèmes distincts, ni l'un ni l'autre résolu sans l'utilisateur : (a) la
demande portait explicitement sur Sandbox/Test, jamais sur du live — ce
connecteur n'expose aucun mode test ; (b) rien ne confirme que ce compte
Stripe est celui de Ma Reliure/Fine Bindery plutôt qu'un compte personnel
ou d'un autre projet de l'organisation GitHub `Antoineoppe` (voir §K —
plusieurs dépôts/organisations coexistent déjà pour des raisons
similaires). Lire ses Products/Checkout/Connect en aurait été une
hypothèse non vérifiée sur un compte peut-être hors sujet, en mode live de
surcroît. **Aucun appel `stripe_api_read` n'a été fait.** Voir
`docs/commercial-billing-model.md` §9 pour le même constat, détaillé.

**Tests, build :** `npx vitest run` → 144 fichiers, 1935 tests verts.
`npx tsc --noEmit` → propre. `npm run lint` → propre (mêmes 13
avertissements préexistants, aucun nouveau). `npm run build` → vert.
Vérifié au navigateur en production après déploiement (`/`, `/auth` avec
le nouveau flux mot de passe, `/partenaires-relieurs`) : aucune erreur
console.

---

### Next recommended task (chantier de cette session)

1. **Confirmer quel compte/mode Stripe le connecteur MCP doit exposer**
   avant tout audit — c'est le blocage réel de la Phase Stripe, pas une
   question d'architecture. Une fois confirmé (idéalement un compte
   Sandbox/Test dédié à Ma Reliure/Fine Bindery), reprendre l'audit
   read-only (Products, Checkout, Invoicing, Connect, Separate Charges and
   Transfers, capacités des Connected Accounts) avant toute décision
   d'architecture Phase 2.
2. **Décider du sort du compte client réel** (`<personal-test-email>`)
   — voir point 1 ci-dessus. Aucune action prise cette session ; la
   vulnérabilité de code, elle, est corrigée et ne peut plus reproduire ce
   problème sur un compte tiers.
3. Exercer l'écran « Économie »/« Proposition commerciale » sur un dossier
   réel dès qu'un Pricebook complet existe pour ses travaux — jamais fait
   en conditions réelles à ce jour.

### Known issues (chantier de cette session)

Tout ce qui précède reste vrai, sauf :

- Résolu : le mot de passe pouvait être attaché à l'e-mail de n'importe
  quel client via l'inscription atelier ou la page `/auth` publique —
  corrigé au niveau du code (voir point 1 ci-dessus). L'état du compte
  déjà affecté reste à vérifier/corriger côté Supabase, séparément.
- Résolu : `pricebookReferenceCents` valait toujours `null` — câblé (voir
  point 3 ci-dessus). Reste `null` tant qu'un Pricebook publié ne couvre
  pas *tous* les travaux d'un dossier, par construction.
- Nouveau : le connecteur MCP Stripe de cette session n'expose qu'un
  compte live (`acct_1S530YKEMCwyPCrw`, « oppe.fr ») dont l'appartenance à
  Ma Reliure/Fine Bindery n'est pas confirmée — aucun audit Stripe n'a pu
  être fait.

### Do not touch (chantier de cette session)

Tout ce qui précède reste vrai. S'y ajoute :

- **Ne plus jamais appeler `supabase.auth.signUp` pour « ajouter un mot de
  passe » à un compte client** — seul `supabase.auth.updateUser` sur une
  session déjà authentifiée peut le faire (voir
  `authPasswordSignupContract.test.ts`, qui fait échouer la suite si
  `signUp` réapparaît dans `MaReliureAuthPage.tsx`).
- **Ne pas appeler `stripe_api_read`/`stripe_api_write` avec le compte
  actuellement connecté** (`acct_1S530YKEMCwyPCrw`) sans confirmation
  explicite de l'utilisateur sur son identité et son mode — voir point 5
  ci-dessus.

---

### Chantier antérieur — modèle commercial Phase 1 (audit + pricing MAX + snapshot immuable)

Demande explicite de l'utilisateur : abandonner tout raisonnement
« commission marketplace » au profit d'un modèle achat/revente (client
achète à Ma Reliure/Fine Bindery, qui achète ensuite la prestation à
l'atelier). Audit d'abord, puis Phase 1 seulement — **aucun changement
Stripe live**, sur instruction explicite répétée plusieurs fois.

**Audit (résumé — voir la conversation pour le détail complet donné à
l'utilisateur) :** le pricing existant (`pricing.engine.ts`, `pricebook.ts`,
`brandPricing.ts`, `pricingMode.ts`) était déjà un modèle acheteur/revendeur
correct, jamais une commission — rien à défaire. Le vrai vide était Stripe :
**aucune intégration n'existe** pour la marketplace (le seul client Stripe
du dépôt est scopé au projet Métré Build via la gateway Lovable). Un écart
concret trouvé côté pricing : le plancher de marge n'était pas combiné par
MAX avec un plancher de contribution absolue — seule la marge cible
s'appliquait.

**Phase 1 — livré :**

1. **`resolveServicePriceFloors`** (`pricing/pricebook.ts`, nouveau) :
   `customer_service_price_ht = MAX(référence Pricebook si connue, plancher
   de marge, plancher de contribution)`. Branché dans `pricing.engine.ts` à
   la place du calcul par marge seule. `PricingPolicy.minimumContributionCents`
   ajouté (`pricing.types.ts`, `pricing.rules.ts`), distinct de
   `minimumMarginCents` (validation a posteriori, inchangé) — les deux
   garde-fous ne sont jamais confondus. `applyBrandServicePricing`
   (`brandPricing.ts`) **inchangé**, sur instruction explicite : il continue
   de multiplier le prix Ma Reliure déjà plafonné, jamais le payout atelier
   ni le shipping.
2. **`marketplace_commercial_proposals`** (migration `20260916100000`,
   **appliquée en production**) : la couche snapshot immuable, séparée de
   la ligne mutable `marketplace_cases`. Chaque ligne est une version figée
   d'une proposition pour un dossier ; un trigger Postgres refuse tout
   `UPDATE` une fois `accepted_at` posé (même mécanisme que
   `marketplace_cases_forbid_brand_change`, déjà en production). Un index
   partiel garantit au plus une ligne acceptée par dossier.
3. **`src/marketplace/commercial/commercialProposal.ts`** (pur) :
   `buildCommercialProposalSnapshot` assemble un snapshot complet (HT-first,
   shipping séparé toujours à marge nulle en P0, acompte figé, TTC client
   `null` tant que `tax_policy` reste `TAX_REVIEW_REQUIRED`).
   `commercialProposalRepository.server.ts` (insert/accept/list, aucun
   UPDATE hors acceptation) et `commercialProposal.data.functions.ts`
   (server functions admin-only : `createCommercialProposal`,
   `acceptCommercialProposal`, `listCaseCommercialProposals`,
   `getAcceptedCommercialProposal`).
4. **Admin minimal** (`CaseMatchingPage.tsx`) : panneau « Économie »
   (marque, multiplicateur, rémunération atelier, marge cible, contribution
   minimale, prix service, marge brute, statut fiscal) et panneau
   « Proposition commerciale » (créer une version, l'accepter). Réservé à
   l'admin — aucun parcours client n'accepte encore une proposition
   lui-même.
5. **`CaseRow`** (`caseRepository.server.ts`) étendu : `pricing_mode`,
   `deposit_cents`, `base_service_price_cents`, `brand_multiplier_bps`,
   `service_price_cents`, `tax_status` manquaient à la sélection depuis
   leurs migrations respectives (20260913090000, 20260916090000) — jamais
   lus par `loadCaseContext` jusqu'ici, nécessaires à la construction du
   snapshot.
6. **`docs/commercial-billing-model.md`** créé — état réel du modèle,
   ce qui est construit contre ce qui ne l'est pas (Pricebook par dossier,
   shipping, tax, Stripe entier).
7. **Connecteur MCP Stripe relié** (accès de préparation, demandé par
   l'utilisateur en cours de session) — **aucune capacité d'écriture
   utilisée**. Sert pour la future Phase Stripe (lister l'existant avant
   d'en créer, §48 du brief commercial) — ne pas présumer qu'un Product,
   Checkout ou compte Connect existe déjà pour la marketplace : aucun n'a
   été créé.

**Régénération collatérale :** `src/integrations/supabase/types.ts`
régénéré (`supabase gen types`, le token `SUPABASE_ACCESS_TOKEN` de
`.env.supabase` était expiré — la session CLI `supabase` elle-même restait
authentifiée et a servi à la fois pour `db push` et `gen types`). Un type
généré plus strict a exposé un mismatch pré-existant sans rapport
(`marketplace_respond_to_offer`, arguments RPC nullable déclarés
non-nullables par cette version du générateur) — corrigé par un cast local,
pas une réécriture de la fonction Postgres.

---

### Completed (cette session)

- Migration `20260916100000_marketplace_commercial_proposals.sql` :
  **appliquée et vérifiée en production** (`supabase db push
  --project-ref hljxohondjvrkzqicexl`).
- `npx tsc --noEmit` : propre.
- `npm run lint` : propre (mêmes 13 avertissements pré-existants, aucun
  nouveau).
- `npx vitest run` : **142 fichiers, tous verts** (dont les nouveaux
  `pricebook.test.ts`, `commercialProposal.test.ts`, et les cas ajoutés à
  `brandPricing.test.ts`/`noFabricatedPrices.test.ts`) — couvre les six cas
  demandés par l'utilisateur (Ma Reliure normal, plancher de contribution,
  Fine Bindery bout en bout, shipping non multiplié, indépendance d'un
  snapshot déjà construit vis-à-vis d'un recalcul ultérieur).
- `npm run build` : vert.
- **Déployé le 16 septembre 2026** (`npm run deploy:mareliure`, Worker
  `mareliure` version `c40a39c6-dfd3-4254-aff2-cbabfaf1f4fb`) et vérifié :
  `mareliure.fr` accessible, aucune erreur console sur la page d'accueil,
  migration confirmée à jour en production (`supabase db push --dry-run` →
  `upToDate: true`).
- **Toujours pas vérifié au navigateur en conditions réelles** : le panneau
  admin « Proposition commerciale » n'a pas été cliqué (aucun dossier de
  test avec un prix validé n'était disponible pendant la session, et
  l'accès admin n'était pas disponible depuis l'agent) — à faire au premier
  dossier réel qui atteint `pricing_status: validated`.
- **Travail autonome du 16 septembre 2026 (session suivante, même
  utilisateur absent la matinée)** : en vérifiant le déploiement ci-dessus,
  un bug d'hydratation React a été trouvé sur `/auth` (et toute redirection
  vers cette route) — `Minified React error #418` en production, et en
  reproduction locale non minifiée (build `npm run build:dev` servi par
  `wrangler dev`), l'avertissement explicite "Can't perform a React state
  update on a component that hasn't mounted yet". **Confirmé préexistant**
  par comparaison directe : même erreur reproduite sur le commit `a2682b0d`
  (avant tout le travail SEO/pricing de cette longue session), via une
  copie de travail Git isolée (`git worktree`). Un garde `cancelled` a été
  ajouté à l'effet `supabase.auth.getSession().then(...)` de
  `routes/auth.tsx` (commit `af3aa753`, déployé) — sûr et correct dans
  l'absolu, mais **la reproduction s'est révélée intermittente** (l'erreur
  n'apparaît pas à chaque rechargement, avant comme après ce changement) :
  impossible d'affirmer avec certitude que la cause exacte de l'erreur #418
  est éliminée. La page reste fonctionnelle dans tous les cas observés. Une
  investigation plus poussée demanderait des source maps de production et
  une instrumentation React DevTools — pas tentée, jugée disproportionnée
  pour un avertissement non bloquant sur une session sans supervision en
  direct.

---

### In progress

Rien côté code. `git status` propre après le dernier commit de ce chantier.

---

### Next recommended task

1. **Phase Stripe**, sur validation explicite de l'utilisateur uniquement —
   commencer par confirmer les capacités réelles du connecteur MCP
   maintenant relié (`stripe_api_read`/`stripe_api_write`) avant toute
   hypothèse d'architecture : Connect disponible ou non, Separate Charges
   and Transfers possible, webhooks, Invoicing. Ne pas décider entre
   « garder `stripe.server.ts`/gateway Lovable » et « client Stripe propre à
   la marketplace » avant cette vérification (question explicitement laissée
   ouverte, voir `docs/commercial-billing-model.md` §9).
2. **Câbler `pricebookReferenceCents`** dossier par dossier
   (`marketplace_pricebook` existe, sert seulement la détection de dérive
   aujourd'hui) — troisième candidat du MAX, prêt côté types/fonction pure,
   jamais branché à la lecture live.
3. **Décider une vraie valeur pour `minimumContributionCents`** — posé à
   2 000 (20 €) par défaut, aligné sur `minimumMarginCents` faute de mieux,
   jamais validé commercialement.
4. Les points 2 à 5 du bloc précédent (Stripe Connect, référentiel
   tarifaire à remplir, premier atelier réel, logistique) restent valables
   et non traités par ce chantier.

---

### Known issues

Tout ce qui précède reste vrai, sans changement, sauf :

- Nouveau : `hook_send_email_enabled` reste `false` en production (Phase F,
  auth e-mails brand-aware) — la route est déployée et vérifiable
  manuellement, jamais activée côté Supabase. Un client Fine Bindery reçoit
  toujours son lien de connexion en français tant que ce n'est pas fait.
- Nouveau : `pricebookReferenceCents` vaut toujours `null` en pratique —
  voir Next recommended task, point 2.
- Nouveau : le panneau admin « Proposition commerciale » n'a jamais été
  exercé en conditions réelles (voir Completed).
- Nouveau : `/auth` (et toute page qui y redirige) produit par
  intermittence une erreur console d'hydratation React en production
  (`#418`) — préexistante, non bloquante (la page reste utilisable), cause
  exacte non isolée malgré un correctif défensif appliqué. Voir le bloc
  « Travail autonome du 16 septembre 2026 » dans Completed.

---

### Do not touch

Tout ce qui précède reste vrai. S'y ajoute :

- **`applyBrandServicePricing` (`brandPricing.ts`) ne doit pas être
  réécrite** pour recevoir les ingrédients bruts du MAX (référence,
  payout) — décision explicite de l'utilisateur de conserver le mécanisme
  actuel (multiplier le prix Ma Reliure déjà plafonné), même si cela diverge
  en théorie d'un multiplicateur appliqué à une référence Pricebook brute
  dans un cas limite (référence publiée sous les deux planchers *et* marque
  Fine Bindery en même temps) — cas non couvert par les tests demandés,
  arbitrage assumé.
- **`marketplace_commercial_proposals` ne s'UPDATE jamais après
  `accepted_at`** — le trigger le refuse de toute façon, mais aucun code
  applicatif ne doit tenter de contourner cette garantie (par exemple via
  une fonction `SECURITY DEFINER` qui l'ignorerait). Un changement après
  acceptation crée une nouvelle version.
- **Ne pas utiliser le connecteur MCP Stripe en écriture** avant la Phase
  Stripe explicitement validée par l'utilisateur — la connexion a été faite
  pour préparer l'accès, pas pour agir.

---

### Chantier antérieur — candidature atelier structurée, mot de passe client, page de recrutement

Trois demandes distinctes, traitées dans l'ordre où elles sont arrivées :

**1. Candidature atelier structurée (remplace le `mailto:`)**

- `marketplace_binder_applications` (migration
  `20260914090000_marketplace_binder_applications.sql`) : une candidature
  publique, sans authentification, lue à la main dans l'admin
  (`/marketplace/binders`). Ne crée **jamais** de compte ni d'atelier —
  `createBinderFromApplication` (ajouté cette session, l'admin ne pouvait
  auparavant créer un atelier que par script de seed) reste un acte humain
  distinct.
- Route `/candidature-atelier` : prénom, nom, e-mail, téléphone (facultatif),
  atelier, type d'entreprise, ville (facultatif), années d'expérience
  (facultatif), CA moyen annuel (facultatif), message (facultatif).

**2. Mot de passe client (évite de ressaisir l'e-mail à chaque connexion)**

- `/auth`, onglet Client : lien discret « Vous préférez un mot de passe ? »
  sous le lien magique, ouvrant inscription ou connexion par mot de passe
  (`supabase.auth.signUp` / `signInWithPassword`). Un même compte Supabase
  Auth accepte les deux méthodes simultanément — vérifié empiriquement.
- Bug trouvé et corrigé en testant en direct : un `signUp` refusé par
  Supabase (domaine invalide) renvoie un message d'erreur qui est littéralement
  la chaîne `"{}"`. Fallback ajouté dans `PasswordSignUp` et
  `invitation-atelier.$token.tsx` : `"Vérifiez l'adresse indiquée et
  réessayez."` quand le message est vide ou vaut `"{}"`.
- **Effet de bord constaté, signalé à l'utilisateur** : tester l'inscription
  atelier avec une adresse déjà enregistrée côté client (lien magique) a
  ajouté un mot de passe à ce compte réel plutôt que de refuser
  l'inscription. Pas corrigé cette session — l'utilisateur ne s'est pas
  prononcé sur s'il faut retirer ce mot de passe.

**3. Page de recrutement `/partenaires-relieurs`**

- Distincte de `/candidature-atelier` : celle-ci est la page de vente qui
  explique le réseau (bénéfices, parcours, espace atelier, invitation de ses
  propres clients, rémunération, FAQ) et **contient son propre formulaire**,
  plus court (pas de type d'entreprise ni de CA moyen, mais site/réseau
  social et savoir-faire en plus) — les deux formulaires écrivent dans la
  même table via le même server function `submitBinderApplication`.
- `marketplace_binder_applications` étendue plutôt que dupliquée
  (`20260915090000_marketplace_binder_applications_extend.sql`) :
  `legal_entity_type` devient facultatif, `website_url` et `skills` (même
  catalogue que `BINDER_SKILLS`, slugs hors catalogue filtrés en silence)
  ajoutés.
- Honeypot anti-spam (`hpCompanyName`, champ masqué visuellement mais lu par
  un lecteur d'écran comme « à ne pas remplir ») : faux succès silencieux si
  rempli, jamais stocké. **Pas de rate-limiting côté serveur** — aucune
  infrastructure de ce type n'existe ailleurs dans le produit
  (`/candidature-atelier` ne l'a pas non plus) ; en construire une aurait été
  disproportionné pour cette page seule. À traiter le jour où le spam devient
  un problème réel, pas avant.
- Section « Répartition 80/20 » et section vitrine (`/ateliers/:slug`)
  écrites au futur, explicitement : Stripe Connect n'est pas branché (Phase D
  toujours bloquée), et aucune vitrine par atelier n'a jamais été construite.
  Aucune capture d'écran de l'espace atelier — aucun atelier réel ne s'y est
  encore connecté en production, en fabriquer une aurait été l'invention que
  le produit interdit.
- Navigation « Pour les relieurs » (entête, pied de page, teaser sur la
  landing client) repointée de l'ancre `#pour-les-relieurs` vers cette page.
  L'ancre elle-même a été retirée de `ANCHORS` (plus référencée nulle part).
- `SHELL` et `SectionHead` extraits de `ReliureLanding.tsx` vers
  `LandingChrome.tsx` (exportés) pour que la nouvelle page réutilise
  exactement le même système de mise en page plutôt que d'en refaire un
  second — vérifié par `landingHonesty.test.ts` (42/42, cette page n'est
  pas dans son périmètre de scan) et par lint.
- Analytics : `usePageViewTracking()` (déjà générique, jusque-là utilisé
  seulement côté Métré) rebranché sur cette page pour la vue de page.
  **Pas d'événements de funnel** (clic CTA, début/soumission de candidature)
  — aucune infrastructure d'événements nommés n'existe au-delà du compteur de
  vues ; en construire une aurait dépassé le périmètre d'une seule page.

---

### Completed (cette session)

- 2 migrations additives (candidature atelier + son extension), toutes deux
  **appliquées et vérifiées en production**.
- `npx tsc --noEmit` : propre. `npm run lint` : propre (mêmes 11
  avertissements pré-existants, aucun nouveau).
- `npx vitest run` : **1610 tests verts, 130 fichiers** (dont les 5 nouveaux
  du contrat de migration d'extension).
- `npm run build` : vert, route `/partenaires-relieurs` généreée dans
  `routeTree.gen.ts`.
- Vérifié au navigateur (local et production) : rendu desktop et mobile
  (375 px), formulaire testé de bout en bout (soumission réussie, ligne
  écrite puis nettoyée en production), aucune erreur console.
- `npm run deploy:mareliure` : déployé, vérifié en ligne.

---

### In progress

Rien. Working tree propre après le commit de cette session.

---

### Next recommended task

1. **Décider du sort du mot de passe ajouté par erreur** au compte client
   réel testé cette session (effet de bord du point 2 ci-dessus) — l'utilisateur
   ne s'est pas encore prononcé.
2. **Spike Stripe Connect** (Phase D) — toujours bloqué, mêmes identifiants
   absents. Débloque le paiement, l'écran de prix définitif après examen
   (§26), et lève enfin les deux sections de `/partenaires-relieurs` écrites
   au futur.
3. **Remplir le référentiel tarifaire** — toujours vide en production. Sans
   lui, `pricing_mode` ne sort jamais que `MANUAL_STUDY`.
4. **Premier atelier réel** — dès qu'une candidature (`/candidature-atelier`
   ou `/partenaires-relieurs`) est acceptée, `createBinderFromApplication`
   permet de créer l'atelier depuis l'admin. Ce sera aussi le premier test
   réel du parcours complet (invitation, espace atelier, messagerie,
   décisions, lien de parrainage personnel).
5. **Logistique par niveau de risque** (Phase E) — colonnes seules, pas le
   fournisseur de transport (`docs/shipping-pickup-point-spec.md`).

---

### Known issues

Tout ce qui était listé à la fin de Phase C reste vrai, sans changement,
sauf :

- Nouveau : un compte client réel (`<personal-test-email>`, lien
  magique) a désormais aussi un mot de passe, ajouté par un test de
  l'inscription atelier cette session — voir Next recommended task, point 1.
- Nouveau : **pas de rate-limiting sur les formulaires publics de
  candidature** (`/candidature-atelier`, `/partenaires-relieurs`) — seul un
  honeypot protège contre le spam automatisé. Le référentiel Zod valide la
  forme des données mais pas leur fréquence.

---

### Do not touch

Tout ce qui était listé à la fin de Phase C reste vrai. S'y ajoute :

- **`submitBinderApplication` reste le seul point d'écriture de
  `marketplace_binder_applications`**, partagé par `/candidature-atelier` et
  `/partenaires-relieurs`. Ne pas dupliquer ce server function pour la
  deuxième page : un champ optionnel absent doit rester optionnel, jamais
  une seconde validation divergente.
- **`ANCHORS` de `landing/content.ts` ne porte plus `binders`** — le
  supprimer était correct puisqu'il n'était plus référencé ; ne pas le
  réintroduire pour un lien qui peut pointer directement vers
  `/partenaires-relieurs`.
- **`SHELL`/`SectionHead` vivent dans `LandingChrome.tsx`, pas dans
  `ReliureLanding.tsx`.** Toute nouvelle page éditoriale Ma Reliure doit les
  importer de là, jamais en redéclarer une copie.


---

## Phase 0 — audit du 19 septembre 2026 (P1-1 … P1-8)

Branche `fix/audit-phase0-integrity-security`, PR #5 — **fusionnée le 20/09/2026 (merge commit `158df5eb`), migrations appliquées, déployée** (voir « Phase 0 — publication »).
Détail des preuves (défaut confirmé sur `main`, correction, tests) dans la description de la PR.

| P1 | Défaut | Correction |
| --- | --- | --- |
| 1 | Le Checkout facturait le HT | `stripe/amountDue.ts` : montant exigible = TTC du snapshot figé, vérifié de bout en bout ; lignes TTC dont la somme vaut exactement le TTC ; session ouverte au mauvais montant expirée, jamais réutilisée ; **acompte bloqué (fail closed)** |
| 2 | « Payé » sans vérifier | `webhookEvents.ts` + `paymentVerification.ts` : `payment_status`, montant, devise, session, dossier ; `unpaid` / `no_payment_required` ne marquent rien ; `async_payment_succeeded` géré ; un paiement enregistré n'est jamais réécrit |
| 3 | Événement en échec absorbé comme doublon | états `received/processing/processed/failed` + tentatives + dernière erreur (`marketplace_claim_webhook_event`) ; seul `processed` est absorbé ; échec ⇒ 500 (Stripe redélivre, plafonné à 8 tentatives) |
| 4 | Deux sources de prix | `commercial/authoritativePrice.ts` : seule autorité = `customer_price_cents` validé ; proposition périmée non acceptable |
| 5 | Dossier engagé qui revient au chiffrage | `cases/engagement.ts` + trigger `marketplace_cases_guard_engagement` (transactionnel) ; nouvelle version refusée après acceptation |
| 6 | Un seul fil, atelier invité admis | `messaging/audience.ts` + colonne `marketplace_messages.audience` ; seul l'atelier **retenu** et en règle entre dans une conversation |
| 7 | `ilike` sur l'e-mail (jokers `_` `%`) | `marketplace_dossier_ids_for_verified_email` : égalité exacte sur adresse normalisée |
| 8 | Mention de franchise perdue à la facture | `marketplace_binder_convert_quote_to_invoice(… p_vat_mention)` : mention effective figée, refus sinon |

### Migrations (dans cet ordre, **avant** de déployer le code)

`20260920090000_marketplace_verified_email_exact_match` · `20260920100000_marketplace_binder_invoice_vat_mention` ·
`20260920110000_marketplace_stripe_webhook_states` · `20260920120000_marketplace_case_engagement_guard` ·
`20260920130000_marketplace_message_audiences`. Toutes additives et rejouables ; `20260919090000` (déjà appliquée) n'est pas éditée.
Le code appelle les nouvelles fonctions SQL : **déployer le code avant les migrations casse** le rapprochement e-mail, la
conversion en facture, le webhook et la messagerie (échec fermé, jamais d'exposition). `types.ts` a été complété à la main
pour ces migrations : le régénérer depuis la base après application.

### Ce qui change pour l'exploitation

- **Paiement par acompte impossible** (proposition `ESTIMATE_THEN_CONFIRM` avec acompte) tant que le paiement en deux temps
  n'existe pas : ni acceptable par le client, ni payable. Aucune proposition de ce type n'existe en production (constaté le
  19/09/2026 : une seule proposition, sans acompte, 500 € HT → 600 € TTC). **Décision produit à prendre.**
- Une proposition dont le prix validé a changé n'est plus acceptable : créer une nouvelle version.
- Un atelier invité ou disponible ne voit plus la conversation avant d'être retenu ; en Fine Bindery l'atelier ne lit plus les
  échanges client ↔ concierge. Le « manque serveur » du modèle concierge (suite 10, point 2) est donc traité. Côté plateforme,
  le dossier admin (`CaseMatchingPage`) affiche maintenant les deux canaux séparés (`AdminConversations` : Client · Atelier
  retenu ; Ma Reliure : fil partagé · Atelier retenu), le concierge y lit et y répond, et la liste admin porte un compteur de
  non-lus (tous canaux). Ce n'est **pas** un deuxième système de messagerie : le `ConversationPanel` existant, fixé sur un
  canal. **Reste** : aucun e-mail « nouveau message » vers l'atelier ni vers le concierge (signal = compteurs de non-lus).
- Recette Stripe **en mode test** (compte `acct_1UGISJKB3EBc6Slh`, clé `sk_test`) le 20/09/2026 : Checkout Session réelle à
  60 000 EUR, session `unpaid` non soldée, paiements de test (`pm_card_visa`) rapprochés, mauvais montant/devise refusés,
  doublon sans effet, reprise après échec idempotente. Script rejouable hors dépôt ; aucune carte réelle, aucun live.
- Un événement Stripe en échec répond 500 (avant : 200). Les événements des autres produits du compte partagé, sans notre
  metadata, sont toujours ignorés en 200.

---

## Phase 0 — publication (20 septembre 2026)

Ordre suivi : migrations → types → tests/tsc/lint/build → merge → `main` local en fast-forward → déploiement → QA production.

- **Migrations appliquées en production** (`hljxohondjvrkzqicexl`, « Ma Reliure - production », cible vérifiée : seul projet visible, `ACTIVE_HEALTHY`),
  une requête atomique par migration puis enregistrement dans `supabase_migrations.schema_migrations` (mécanisme identique à celui des devis ;
  jamais `supabase db push`) : `20260920090000`, `…100000`, `…110000`, `…120000`, `…130000`. Empreintes sha256 figées, 74 migrations
  déjà appliquées → 79. Comptes avant/après identiques (1 proposition, 0 paiement, 0 événement webhook, 0 message, 6 dossiers) et empreinte des
  dossiers inchangée. Vérifié ensuite : droits des fonctions (`anon`/`authenticated` sans `EXECUTE`, `service_role` seul), une seule surcharge de
  la conversion (6 arguments), 2 triggers actifs, 7 colonnes, 2 CHECK, 2 index, RLS toujours active.
- **Types Supabase régénérés depuis la production** : **aucune dérive**, fichier identique octet pour octet à celui de la PR (édité à la main).
- **PR #5** fusionnée en merge commit normal (sans squash, branche conservée) ; `main` local synchronisé en fast-forward (`3e5148c0` → `158df5eb`).
- **Déploiement** : `npm run deploy:mareliure` depuis `main` `158df5eb` — Worker `mareliure`, Version ID `3de67d1d-b9f8-4d29-99a7-16b113efcee6`
  (bundle vérifié `hljxohondjvrkzqicexl` seulement). Version précédente : `4369d077-b729-4e64-87e1-6b7c9462dde2` (retour arrière possible par `wrangler rollback`).
- **Validation avant merge** : 172 fichiers / 2 511 tests verts, `tsc` 0 erreur, `eslint` 0 erreur (13 avertissements préexistants), build vert.

### QA production ciblée (sans compte de test, sans paiement)

HTTP : 6 routes répondent ; le webhook Stripe répond 400 sans signature et 400 avec une signature falsifiée (rien n'est enregistré) ; le chunk de la page
admin déployé contient les canaux « Client » / « Atelier retenu ». **Base réelle**, dans des transactions qui **s'annulent toujours** (chaque test se termine par une
exception forcée ; contrôle final : 0 message, 0 événement, 0 paiement, empreinte des dossiers inchangée) :

| P1 | Constat en production |
| --- | --- |
| 4 / 5 | Sur le dossier réel dont la proposition est acceptée : modifier le prix client, le prix de service, le statut de retour vers `pricing` / `under_review`, le `pricing_status`, ou re-valider le prix → **tous bloqués** (`case_engaged`) ; une écriture non commerciale reste permise |
| 3 | Machine d'états du webhook sur la vraie fonction : première livraison `claimed` ; concurrente `in_progress` ; redélivrance après échec `claimed`, tentative 2 ; après succès `already_processed` |
| 6 | Sur un vrai dossier Fine Bindery : message d'atelier inséré sans audience → `workshop_platform` ; client → `customer_concierge` ; admin → `customer_concierge` ; Ma Reliure reste `shared` |
| 7 | `marketplace_dossier_ids_for_verified_email` : `%` et blanc ne correspondent à rien |
| 2 | Vérification de la preuve de paiement : recette Stripe **TEST** du 20/09 (Checkout réel à 60 000 EUR, `unpaid` non soldé, paiements de test rapprochés, mauvais montant / devise refusés, doublon sans effet, reprise idempotente) |

**Non exercé** (à faire quand les conditions existent) : (a) la **page Checkout hébergée** payée avec une carte de test — abandonnée à la demande de l'utilisateur
(la session de test a été expirée) ; (b) la messagerie Fine Bindery **avec de vrais comptes** client / atelier retenu / atelier invité / concierge (aucun atelier,
aucun match, aucun message en production) ; (c) P1-1 (Checkout au TTC) et P1-8 (mention de franchise) **en production** : aucun paiement réel ni devis n'existe ;
couverts par les tests, Postgres réel (pglite) et la recette TEST. Le seul dossier payable réel (500 € HT → 600 € TTC) sera le premier Checkout réel.

### Suite

La roadmap produit / UX (phases A → E, une branche et une PR par phase, repartir de `main` contenant la phase précédente) démarre depuis `main` `158df5eb`.
Points ouverts hérités : décision produit sur l'**acompte** (propositions avec acompte bloquées) ; e-mail « nouveau message » vers l'atelier et le concierge
(le signal est un compteur de non-lus) ; recette production des devis/factures avec deux comptes atelier ; `docs` : la suite 11 garde son récit d'origine.

## Phase A — parcours particulier Ma Reliure (20 septembre 2026)

Branche `feat/ux-mareliure-customer-flow`, depuis `main` `767299f9`. **Aucune migration**, aucune écriture en base, aucune modification du Playbook publié : tout est du code (et 4 illustrations SVG dans `public/photo-guide/`), actif dès le déploiement.

**Le principe.** `MissionRuntime` reste générique : il ne sait pas ce qu'est un dos. Ce que Ma Reliure ajoute lui est donné par la route
(`src/routes/m.$publicToken.tsx`) dans une prop `guidance` (`src/build/pages/public/intakeGuidance.ts`), le même passage que `renderAfterSubmission`. Réservé à la
Mission « Présenter mon livre » (`BOOKBINDING_PUBLIC_TOKEN`) : Fine Bindery et Métré reçoivent seulement les améliorations génériques (progression, barre collante).
Le contenu — vues photo, vocabulaire, textes — vit dans `src/marketplace/pages/customer/reliureIntakeGuidance.ts` et `ReliureIntakeCopy.tsx`, relié au Playbook
par un test de contrat (`reliureIntakeGuidance.test.ts`). Le déplacer un jour dans les données du Playbook (schéma + republication) est possible et serait le bon
chemin pour Fine Bindery (phase D) ; on ne l'a pas fait ici pour ne pas exiger de réécriture du Playbook de production.

**Ce qui change pour la personne.**
- Progression honnête (`engine/progress.ts`, `pages/public/progressLabel.ts`) : « Étape 3 sur 9 · Environ 4 min restantes », « sur au moins 8 » tant qu'une étape
  peut encore apparaître selon une réponse à venir. Plus de pourcentage (il partait de 13 % avant toute réponse). Le temps est estimé d'après le *type* des questions restantes.
- Promesse avant la première question : ce qu'on obtient, environ 5 minutes, **ne pas envoyer le livre maintenant**. Rappel au dernier regard : envoyer n'engage à rien.
- Guide photo : une vignette illustrée par vue (couverture, dos, tranche ; dommage principal) avec ajout / remplacement / retrait par vue, aperçu de la vraie photo,
  refus immédiat (type, poids) avant envoi. La photo porte un champ optionnel `shot` dans la réponse (additif : `validateFieldFormat` ne lit que `mimeType` et `sizeBytes`).
  Les aperçus n'existent que pendant la session : après reprise, la photo s'affiche « enregistrée » (une URL signée par vignette serait un changement serveur).
- Vocabulaire : « Un mot vous échappe ? » sous l'étape, seulement les mots que le texte de l'étape emploie (`engine/glossary.ts`).
- Récapitulatif : nombre de questions sans réponse (jamais bloquant), photos en images libellées par vue, « Je ne sais pas » / « Oui » en français.
- Confirmation : « Et maintenant ? » en trois étapes avec l'acteur qui agit ; le délai est **sans chiffre** (« Nous revenons vers vous dans les prochains jours ouvrés »).
- Reprise de session : on revient **à l'étape atteinte** (première question obligatoire restante), pas à l'écran 1 ; message « Content de vous revoir ».
- Mobile 390 px : barre Retour / Continuer collante, cibles de 44 px, message d'erreur amené à l'écran (le bouton refusé n'a plus l'air mort), titres plus petits.
- Correctifs en chemin : erreur d'adresse restée en anglais, écran de chargement / d'échec du chargement en anglais (la langue de la Mission n'arrive qu'avec la Mission :
  la route donne `initialLocale`), double point après un libellé de consentement.

**Décision du propriétaire (20/09/2026) : aucun délai chiffré tant qu'il n'est pas validé opérationnellement.** `RELIURE_REPLY_NOTICE` (`reliureIntakeGuidance.ts`) dit
« Nous revenons vers vous dans les prochains jours ouvrés » ; un test interdit d'y remettre un chiffre (heures, jours, « sous », « garanti »). Le jour où un délai
réel est validé (SLA mesuré), c'est cette seule constante qui change — et le test avec elle.

**QA.** Banc hors dépôt (Playwright + Chrome, faux endpoint du runtime servi avec le vrai Playbook, état conservé entre rechargements) : desktop 1280, tablette 820, mobile 390 ;
reprise après vrai rechargement, ajout / remplacement / retrait de photos, échec d'envoi puis reprise, fichier refusé, chargement lent, échec de chargement, récapitulatif, soumission.
Non exercé : le runtime réel contre Supabase (pas de clé de service locale) et un vrai envoi de photo vers le stockage.

## PR 1 — Contacts + Ouvrages (21 septembre 2026)

Branche `feat/binder-contacts-works`, depuis `main` `a47b3ac3`. Première marche de « tout part d'un ouvrage » : un **contact** et un **ouvrage** vivants dans l'atelier, et le devis
qui s'y rattache. **Une migration**, appliquée en production le 20/09/2026 *avant* le déploiement du code (voir « Application de la migration »).

**Périmètre, strictement.** Contacts + Ouvrages + les relations nécessaires. Pas de devis rapide, pas de workflow d'atelier, pas de logistique, pas de Sendcloud, pas de nouvelle
facturation, pas de refonte des prestations, pas de référentiel de 195 opérations (en attente d'arbitrage).

**Modèle** (`supabase/migrations/20260921090000_marketplace_binder_contacts_works.sql`, additive, rejouable, retour arrière en pied de fichier) :
- **Contact = `marketplace_binder_clients`, étendue** (pas de second système) : `first_name`, `last_name`, `organization`, `origin` (`mon_client` | `ma_reliure`, défaut `mon_client`),
  `origin_case_id`, `archived_at`. Aucune colonne existante n'est modifiée. `name` reste le nom d'affichage, déduit côté serveur (`works/contactName.ts`).
- **Ouvrage = `marketplace_binder_works`** : contact, référence lisible `O-AAAA-NNNN` (une suite par atelier et par année, `marketplace_binder_work_counters`, séparée des
  devis/factures qui sont des pièces comptables sans trou), titre, auteur, édition, description, hauteur / largeur / épaisseur (mm), poids (g, facultatif), valeur déclarée (cts),
  état, notes internes, `status` (`active` | `archived` — cycle de vie de la *fiche*, pas l'état de travail, qui viendra avec l'intervention), `source` (`mon_client` | `ma_reliure`)
  et `case_id` (unique).
- **Photos** : `marketplace_binder_work_photos`, structure seulement (étapes `intake / before / reception / during / after`). Aucune UX, aucun bucket.
- **Lien** `marketplace_binder_quotes.work_id` (nullable, `ON DELETE SET NULL`). Les documents émis gardent leurs snapshots : le lien est une référence, jamais une source de vérité.
  La facture n'est **pas** touchée (elle se rattache à l'ouvrage par son devis) : ni sa table, ni son trigger d'immutabilité, ni la fonction de conversion de la Phase 0.
- `work_id` n'est volontairement **pas** dans `QUOTE_ROW_KEYS` : un devis sans ouvrage envoie exactement ce qu'il envoyait avant (test).

**Isolation.** RLS activée, refus total pour `anon`/`authenticated`, accès par server functions en service-role qui résolvent l'atelier depuis la session (`requireBinderId`) et
filtrent chaque requête par `binder_id` : l'objet d'un autre atelier est « introuvable ». Aucun schéma d'entrée n'accepte l'atelier, la référence, la source, l'origine ni le dossier
(`.strict()`). En plus, la **base** refuse (deux triggers) qu'un ouvrage pointe le contact d'un autre atelier, ou qu'un devis pointe l'ouvrage d'un autre atelier. Fonctions non exposées
(`REVOKE`), aucune `SECURITY DEFINER`. `marketplace_binder_create_work` impose atelier, référence, statut `active`, source `mon_client` et dossier `NULL` : un ouvrage créé depuis
l'atelier est toujours « mon client » ; un ouvrage issu d'un projet Ma Reliure passera par sa propre fonction, dans la PR qui l'introduit (D1/D5 : jamais de conversion implicite).

**Écrans.** `/atelier/contacts` (+ fiche), `/atelier/ouvrages` (+ fiche, création, modification). Nav atelier : Projets · Ouvrages · Devis et factures · Contacts · Tarifs (le bouton
« Se déconnecter » de la PR #8 est conservé). Création d'un ouvrage : trois champs suffisent (contact, titre, dimensions), le reste se replie ; le contact se crée sur place. La fiche
dit sans ambiguïté la provenance (« Mon client · Aucune commission Ma Reliure »). « Créer un devis » depuis la fiche ouvre le constructeur avec contact et livre déjà remplis
(`/atelier/devis/nouveau?workId=`, jamais une autorisation : le serveur vérifie que l'ouvrage est celui de l'atelier). Les notes internes de l'ouvrage ne passent jamais dans le devis.

**Application de la migration (faite, autorisée par le propriétaire).** Cible explicite `Ma Reliure - production` (`hljxohondjvrkzqicexl`), jamais un projet « lié » ; une requête = une
transaction, puis inscription dans `supabase_migrations.schema_migrations` (version `20260921090000`). Avant : historique (79 appliquées, exactement une en attente), objets neufs absents,
empreinte de tous les objets et données préexistants (48 tables, 250 contraintes, 141 index, 27 triggers, 47 politiques, 25 fonctions, 484 lignes). Après : **aucun objet ni ligne préexistant
modifié** ; seuls ajouts = 3 tables, 4 fonctions, 3 triggers, 7 colonnes, 3 contraintes et 3 index attendus. La production ne contenait alors ni contact, ni devis, ni facture à migrer.
Fermeture vérifiée avec la clé publique du bundle : `INSERT` refusé par la RLS, `create_work` / `next_work_reference` en « permission denied », lectures vides.
Les droits de table `anon`/`authenticated` sont les droits par défaut de Supabase : **la porte, c'est la RLS deny-all**, comme pour toutes les tables `marketplace_*`.

**Types.** `src/integrations/supabase/types.ts` est **généré depuis la production** (API Management `types/typescript`, schémas `public,graphql_public`) : `main` + 205 lignes, rien d'autre.
Une première version écrite à la main ne différait que par l'ordre d'une clé étrangère ; elle a été remplacée. Ne plus éditer ce fichier à la main : le régénérer après chaque migration.

**Vérifié.** Migration rejouée sur un vrai Postgres (pglite) : 46 contrôles (contraintes, numérotation par atelier, triggers d'isolation, refus des rôles `anon`/`authenticated`,
rejouabilité). Tests : `binderWorks.server.test.ts` (isolation entre deux ateliers, données forgées, lignes croisées, lien devis→ouvrage), `works/works.domain.test.ts`,
`works/worksSurface.test.ts`, `binderWorksMigrationContract.test.ts`. Mutations sur le serveur : 18 filtres `binder_id` retirés un par un + 4 contrôles de propriété (contact / ouvrage / lien devis), 22 mutants, tous détectés
**sur une référence verte** (le script refuse de tourner si la référence est rouge : un premier passage « tout tué » était faux, un test cassé échouait sans mutant). Ont été durcis en chemin :
l'archivage d'un ouvrage d'un autre atelier (l'erreur n'arrivait qu'après l'écriture), le nom d'un contact d'un autre atelier dans une liste corrompue, une facture d'un autre atelier rattachée par un devis. QA navigateur (faux Auth, server functions simulées, hors dépôt) : desktop 1280, tablette
820, mobile 390 — création contact → ouvrage → devis prérempli, recherche sans accents, archivage, erreur de saisie, cibles de 44 px, aucun défilement horizontal. Non exercé : le runtime réel
contre Supabase (pas de clé de service locale).

## PR 2a — Référentiel métier + catalogue de l'atelier (21 septembre 2026)

Branche `feat/reference-catalog`, depuis `main` `1859c82a` (PR #9 fusionnée et déployée). **Une migration additive, appliquée en production le 20/09/2026 AVANT le déploiement du code** (voir « Application de la migration »).
Arbitrages Q1–Q9 du propriétaire (20/09/2026) : voir le rapport de la PR et `docs/reference/reliure-fr-v1/`.

**Le principe.** Le relieur doit sentir : « tout mon métier est disponible si j'en ai besoin, mais ce sont mes prestations, mes mots et mes prix ». Un **référentiel commun en lecture seule**
(dans le code) se cherche ; un **catalogue personnel** (en base) se possède. Le lien est facultatif, informatif, jamais une contrainte.

**Ressource `reliure-fr-v1`** (`src/marketplace/reference/reliure-fr-v1/` : `manifest.json`, `operations.json`, `relations.json`) — Q1 option A : versionnée dans le code, pas de tables globales.
- Clés stables `OPR-0001…0195` (aucun slug ; un CHECK en base et un test l'interdisent). Le libellé peut changer, l'identité jamais.
- 195 entrées : 162 `operation`, 23 `package`, 1 `diagnostic` (**186 importables**) + 5 `adjustment`, 3 `material_choice`, 1 `generic_quote` (non importables). 79 `needsBinderValidation` (74 de la source + 5 ajoutées ; INTERNE : jamais affiché au relieur).
- Relations en trois familles nommées par rôle (Q2), **descriptives** : `operation_sequences` (prerequisite / dependent : « habituellement après ou avec », jamais obligatoire — 35), `operation_components`
  (composite / component : « peut inclure » — 10), `operation_alternatives` (paire non orientée a < b — 4). Un test interdit `from` / `to` / `depends_on` et tout champ « obligatoire / bloquant ».
  Aucun blocage, aucune case cochée : elles serviront à « Opérations généralement associées » (pas encore affichée).
- Natures importables (Q3, **modifié par le propriétaire**) : `operation`, `package`, `diagnostic`. **Pas `adjustment`** : une majoration ou une remise n'est pas une opération technique, elle reste un mécanisme du devis.
  Exclus aussi : `material_choice` et « Prestation sur devis » (= la ligne libre). Une entrée `active: false` n'est jamais proposée (seule OPR-0187 l'est).
- Unités (Q4) : vocabulaire contrôlé de **20** (`units.ts`) + « Autre » ; le **mode de prix** (unité / heure / forfait / sur devis → `pricingModes`) est séparé, **sans colonne en base** (le pilote dira). En base, `unit` reste du
  texte libre : le vocabulaire propose, il n'enferme pas.
- Chargement à la demande (`loadReference`, import dynamique par version) : le navigateur ne le télécharge qu'en ouvrant le catalogue. Une nouvelle version = un dossier + une ligne dans `LOADERS`.

**Normalisation (Q6).** `scripts/buildReliureReference.mjs` lit `operations-reliure.json` et `operations-relations.json` **hors du dépôt** (`RELIURE_REFERENCE_SOURCE`), n'en modifie rien, ne lit **aucun prix**
et produit ressource + **journal** (`docs/reference/reliure-fr-v1/normalization-journal.md`, détail entrée par entrée dans `journal.json`) : ancien contenu, nouveau contenu, raison, type, impact. Déterministe (rejouable).
381 corrections : A1 26 · A2 22 · A3 3 · A4 8 · A5 1 · A6 59 · A7 34 · A8 10 · A9 195 · A10 1 · A11 16 · V3 6. Décisions éditoriales à valider par un relieur : la séquence Grecquage/Couture (l'entrée disait le contraire de l'ordre d'atelier
usuel) et 9 prérequis d'entrées convertis en séquences.

**Prix publics (Q8).** Jamais lus, jamais importés, jamais exposés, jamais un prix conseillé. Contrat (`noPublicPrices.contract.test.ts`) : aucun marqueur du fichier de prix dans `src/`, liste blanche stricte des champs d'une entrée (un prix
la ferait échouer), aucun montant dans la ressource, le script ne lit que les deux fichiers d'opérations, **aucun marqueur dans le bundle construit**, le champ prix du formulaire part vide.

**Base** (`20260921100000_marketplace_binder_reference_links.sql`, additive, rejouable, retour arrière en pied de fichier) : `marketplace_binder_services` + `reference_version`, `reference_operation_key`, `is_favorite` ;
`marketplace_binder_quote_items` + `reference_version`, `reference_operation_key`. CHECK sur les deux tables : (version, clé) tous deux présents ou tous deux absents, clé `OPR-0000`, version `[a-z0-9-]`. **Pas de clé étrangère** :
une mise à jour du référentiel ne peut casser ni prestation ni devis. Aucune table, fonction, politique, droit ni trigger touché ; facture, immutabilité et conversion de la Phase 0 intactes. Vérifié sur un vrai Postgres (43 contrôles).

**Application de la migration (faite, autorisée par le propriétaire).** Cible explicite `Ma Reliure - production` ; une requête = une transaction, puis inscription (`20260921100000`). Avant : 80 migrations appliquées, exactement une en attente,
les 5 colonnes absentes, empreinte de tous les objets et données préexistants. Après : **aucun objet ni ligne préexistant modifié** (RLS, droits, 29 fonctions dont celles de la Phase 0, triggers, factures identiques) ; seuls ajouts : 5 colonnes,
2 CHECK, 2 index. Les CHECK ont été exercés en production dans une transaction qui échoue toujours (rien conservé).
**Nom de la migration** : `20260921100000` est conservé. Convention du dépôt : `AAAAMMJJHHMMSS`, croissant, un créneau par heure ; la dernière migration appliquée en production est `20260921090000` (PR #9) — une migration datée du 20/09 se
classerait *avant* elle, hors ordre. Aucune autre branche ouverte n'utilise ce créneau. **Retour arrière** : uniquement en commentaires au pied du fichier (jamais exécuté) ; les deux `DROP CONSTRAINT IF EXISTS` exécutables ne visent que les contraintes de
CETTE migration, pour qu'elle soit rejouable.
**Types** : `types.ts` régénéré depuis la production (schémas `public,graphql_public`) — **identique** à l'édition manuelle faite avant application ; `main` + 15 lignes (5 colonnes × Row/Insert/Update).

**Serveur.** `addReferenceService` (l'opération doit exister dans la version ET être importable — refuse ajustement, matériau, inconnue, inactive) et `setServiceFavorite` (`binderReferenceCatalog.server.ts`), entrées `.strict()`
(pas de prix, pas de lien libre). `saveService` gagne `isFavorite` **facultatif** (absent : le favori ne bouge pas ; enregistrer un prix ne défavorise jamais) et **ne peut pas** écrire le lien. **Provenance des lignes de devis** :
`createQuote` / `updateQuote` recopient (version, clé) depuis la prestation de l'ATELIER (jamais depuis le navigateur) ; libellé, unité, quantité et prix restent des snapshots ; sans lien, les clés envoyées sont exactement `QUOTE_ITEM_ROW_KEYS`.
**L'import massif du catalogue de départ (56 prestations à 0 €) est supprimé** (fonction, server function, données, tests).

**Écrans** (`/atelier/tarifs`, `pages/binder/quotes/catalog/`). Atelier vide : « Ajouter mes premières prestations », recherche, dix suggestions facultatives (`starterSuggestions.ts`), zéro prestation possible. Sinon : Mes favoris → Mes
prestations (par catégorie, avec unité libre, étoile, actif) → Ajouter une prestation (recherche dans le référentiel, résultat compact « Dorure & titrage › Titrage », mini-formulaire nom / unité / prix / favori — **prix vide**, jamais prérempli).
Prestation personnalisée toujours proposée. Corrigé au passage (défaut préexistant) : le champ de prix d'une ligne n'enregistrait pas en le quittant (`MoneyInput.onCommit`).

**Préparation de PR 2b** (pas commencée) : `searchServices` (cherche le nom, la description ET les synonymes de l'opération liée), `is_favorite`, la provenance sur les lignes, `getMyCatalog` renvoie déjà favori et lien. Le constructeur de devis n'a été touché
que pour retirer le bouton d'import massif (« Ajouter mes premières prestations » renvoie vers Tarifs).

**Vérifié.** Tests : `reference.test.ts` (invariants, relations, recherche — sondes nerf / coiffe / titre / cuir —, unités), `serviceForm.test.ts`, `noPublicPrices.contract.test.ts`, `binderReferenceCatalog.server.test.ts` (import, renommage, unité libre,
prix, favori, personnelle, isolation, provenance, snapshots), `binderReferenceLinksMigrationContract.test.ts`. Mutations : 38 mutants (serveur, recherche, formulaire, natures), **tous détectés sur une référence verte** ; 4 survivants initiaux
(synonyme seul, mot-clé seul, sémantique ET, priorité du nom exact) ont donné des tests. QA navigateur (faux Auth, server functions simulées, **vrai référentiel chargé**, hors dépôt) : desktop 1280, tablette 820, mobile 390 — catalogue vide, recherche, ajout,
favori, prestation personnelle, masquage, cibles 44 px, aucun défilement horizontal, aucune erreur console. Non exercé : le runtime réel contre Supabase (pas de clé de service locale).

---

## Latest handoff

**Agent :** Codex (GPT-6) — 22 septembre 2026, `feat/binder-quote-workbench`.

- Workbench Devis : création rapide client/ouvrage, palette tarif atelier prioritaire sur la base Ma Reliure A2, favoris, récentes atelier, recherche métier `reliure-fr-v1`, saisie directe et duplication des lignes, prix manuel obligatoire pour « sur étude », sauvegarde et réouverture des snapshots avec provenance OPR. Aucun changement de schéma ni migration.
- Liste : recherche, filtres, actions ouvrir/modifier/dupliquer/PDF. PDF : protection des colonnes client/ouvrage contre les longs libellés.
- Recette réelle isolée sur un atelier QA temporaire en production Supabase avec application locale : création client + ouvrage + devis (570 € HT, puis 610 € HT après ajustement), réouverture, duplication, PDF A4 lisible, création depuis ouvrage avec client prérempli et référence OPR, recherche « dorure », validation « sur étude », responsive 375/390/430/1024/1280 sans débordement. Parcours depuis ouvrage prérempli mesuré à 3,7 s, six clics et zéro champ manuel dans le navigateur automatisé local.
- Vérifications locales : `npm test` 2 867 tests verts ; tests ciblés, typecheck, lint (13 avertissements préexistants) et build verts après les derniers ajustements. Attendre la CI de PR avant tout merge/déploiement. L’atelier QA isolé, son compte, ses contacts, ouvrages et devis ont été supprimés après la recette.
- L’authentification CLI Cloudflare est expirée sur cette machine ; vérifier un autre accès autorisé au déploiement avant la publication.

## Latest handoff

**Agent :** Codex (GPT-6) — 22 septembre 2026, `feat/binder-connected-workspace`.

- Audit : `docs/binder-connected-workspace-audit.md`. Les dossiers, attributions, messages, lu/non lu, contacts, ouvrages, devis, factures et prestations existants sont consolidés ; aucun second modèle de dossier, de messagerie ou de devis.
- Atelier : navigation Aujourd'hui · Leads · Devis · Ouvrages · Messages · Contacts · Factures · Prestations ; accueil opérationnel, filtres des dossiers, conversations contextualisées et compteur lu/non lu. Un dossier Ma Reliure sélectionné crée contact + ouvrage atomiquement puis ouvre le Quote Workbench prérempli.
- Admin : `/admin` pour le pilotage, les ateliers, les dossiers et les messages Ma Reliure. La fiche atelier expose les données des projets Ma Reliure et uniquement des comptes agrégés pour les clients privés ; aucun mode support ni accès silencieux aux conversations privées n'est activé.
- Migration additive : `20260922140000_marketplace_binder_case_work.sql`, une fonction service-role seulement, idempotente sous verrou, qui vérifie marque Ma Reliure + match selected + atelier actif. RLS des tables inchangée.
- Migration appliquée sur `Ma Reliure - production` (`hljxohondjvrkzqicexl`) et enregistrée dans `supabase_migrations.schema_migrations` sous `20260922140000`. Avant/après : 8 dossiers, 0 message, 0 contact, 0 ouvrage, 0 devis et 0 facture métier ; aucune donnée existante modifiée. La fonction existe, `anon`/`authenticated` ne peuvent pas l'exécuter, `service_role` le peut. Les types Supabase ont été régénérés depuis la production ; leur seul ajout est la signature RPC attendue.
- PR #15 : https://github.com/antoineferriere2-star/mareliure/pull/15. Deux exécutions CI entièrement vertes sur `2726eb3` ; localement : typecheck, lint (13 avertissements historiques), build et 2 876 tests verts.
- E2E réel sur le bundle Cloudflare, connecté à Supabase production avec un atelier QA isolé : connexion → Aujourd'hui → recherche/filtres Leads → lecture du dossier RL-009 et de ses photos → lecture puis disparition du badge non lu → réponse → création atomique contact/ouvrage → Quote Workbench prérempli → ajout Plein cuir + Titrage → sauvegarde D-2026-0001 à 444 € TTC → retour au lead avec ouvrage/devis liés → conversation contextualisée → ouvrage et contact retrouvés. Réouverture/modification du devis verte.
- E2E admin réel : connexion → Pilotage → Ateliers → atelier QA → Leads → dossier Ma Reliure → conversation → devis lié → listes globales Leads/Messages. Confidentialité exercée avec un contact et un ouvrage personnels portant des marqueurs explicites : l'admin ne voit que `1 ouvrage` agrégé ; ni le nom du contact, ni le titre, ni la note privée n'apparaissent dans l'aperçu ou l'onglet Ouvrages.
- Responsive réel : 375 px (Aujourd'hui, Quote Workbench), 390 px (Leads), 430 px (Messages), navigation et cartes sans débordement horizontal visible. Restent : mise à jour finale de la PR/CI après ce handoff, fusion, déploiement production unique, QA production, puis suppression de toutes les données QA temporaires.

## Latest handoff

**Agent :** Codex (GPT-6) — 22 septembre 2026, `fix/binder-invitation-confirmation`.

- Signal utilisateur : après « Créer mon accès » depuis une invitation atelier, aucun e-mail de confirmation n'arrive. Audit Supabase production : tentative `user_repeated_signup` pour `contact@metre-pro.fr` le 22 septembre à 18:47 UTC ; ce compte existait déjà et était confirmé depuis le 12 septembre. Supabase masque l'existence d'un compte confirmé à `signUp`, ce qui rendait le message « confirmez votre adresse » trompeur. SMTP personnalisé actif et Site URL `https://mareliure.fr` ; aucune panne d'envoi établie.
- Correctif : l'invitation reconnaît la réponse de compte déjà existant et propose la connexion, y compris par lien e-mail sans mot de passe. Une nouvelle inscription donne à Supabase un `emailRedirectTo` sur l'invitation pour que la confirmation revienne finir l'activation. Une session ouverte avec une autre adresse montre un changement de compte explicite. `/auth` propose aussi le lien e-mail à l'atelier pour les connexions ultérieures.
- Validation locale : typecheck vert, lint ciblé vert, build Ma Reliure vert, 2 876 tests verts avec `--testTimeout 30000` (trois scans du dépôt/bundle dépassaient 5 s lors d'un premier passage en parallèle). Reste : publier la branche/PR, attendre CI, fusionner/déployer, recette production du parcours d'invitation avec un compte de test autorisé, puis mettre à jour ce bloc avec les résultats.
