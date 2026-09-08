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

> **Écart connu entre ce positionnement et le code actuel.** Le P0 livré
> implémente encore un modèle de _devis_ : le relieur saisit son prix
> (`submitBinderQuote`), le client choisit parmi les propositions
> (`selectQuote`). Le passage au modèle « prix fixé par Ma Reliure, l'atelier
> accepte ou refuse » n'est **pas fait**. Voir §E et §D.

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

| Fonction                                                | État        | Chemin principal                                             | Tests                                                     |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Landing Ma Reliure                                      | **OK**      | `src/marketplace/pages/ReliureLanding.tsx`, `pages/landing/` | `landingHonesty.test.ts`                                  |
| Marque `/` par environnement                            | **OK**      | `src/brand.ts`, `src/routes/index.tsx`                       | —                                                         |
| Playbook Reliure                                        | **OK**      | `src/build/playbooks/bookbindingPlaybookSchema.ts`           | `playbookIntegrity.test.ts`                               |
| Runtime Mission                                         | **OK**      | `src/build/pages/public/MissionRuntime.tsx`                  | plusieurs                                                 |
| Localisation `fr-FR`                                    | **OK**      | `src/build/i18n/runtimeChrome.ts`                            | `runtimeChrome.test.ts`                                   |
| Upload de photos                                        | **OK**      | `src/build/engine/fields/`, Supabase Storage                 | —                                                         |
| Project Canvas                                          | **OK**      | `src/build/pages/public/ProjectCanvas.tsx`                   | `ProjectCanvas.test.ts`                                   |
| Project Brief                                           | **OK**      | `src/build/engine/brief.ts`                                  | `brief.test.ts`                                           |
| Ingestion `marketplace_cases`                           | **OK**      | trigger `build_dossiers_marketplace_ingest`                  | `migrationContract.test.ts`                               |
| Lecture du Dossier par la marketplace                   | **OK**      | `cases/caseProfile.ts`, `cases/dossierProjection.ts`         | `caseProfile.test.ts`, `dossierProjection.test.ts`        |
| Triage (drapeaux)                                       | **OK**      | `cases/triage.ts`                                            | `triage.test.ts`, `triageContract.test.ts`                |
| Machine à états du dossier                              | **OK**      | `cases/state.ts`                                             | `state.test.ts`                                           |
| Propriété client (claim par jeton)                      | **OK**      | `cases/ownership.ts`, `permissions.ts`                       | `ownership.test.ts`, `permissions.test.ts`                |
| Matching (score + sélection ≤ 3)                        | **OK**      | `matching/score.ts`, `matching/selection.ts`                 | `matching.test.ts`                                        |
| Commission (bps, centiemes entiers)                     | **OK**      | `orders/commission.ts`                                       | `commission.test.ts`                                      |
| Garde-fou secrets                                       | **OK**      | `secretsContract.test.ts`                                    | lui-même                                                  |
| Écran admin (dossiers, relieurs, matching)              | **OK**      | `pages/admin/`                                               | logique testée + parcours complet vérifié au navigateur   |
| Espace atelier                                          | **OK**      | `pages/binder/`                                              | idem                                                      |
| Espace client (« Mes livres »)                          | **OK**      | `pages/customer/`                                            | idem                                                      |
| Devis relieur                                           | **PARTIEL** | `quotes/rules.ts`, `submitBinderQuote`                       | `rules.test.ts` — **modèle commercial obsolète, voir §E** |
| Pricing Ma Reliure (`customer_price` / `binder_payout`) | **NON**     | —                                                            | —                                                         |
| Stripe Connect / paiements                              | **NON**     | —                                                            | —                                                         |
| Expédition, inspection, avenants, avis                  | **NON**     | —                                                            | —                                                         |
| Fiche atelier alimentée par la base                     | **NON**     | vitrine en dur dans `pages/landing/content.ts`               | —                                                         |

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

Le modèle inverse. `marketplace_quotes` stocke un montant saisi par le relieur ;
`submitBinderQuote` l'enregistre ; `selectQuote` laisse le client en choisir un.
`quotes/rules.ts` valide un devis et ordonne les propositions « pour
comparaison ».

**Le passage au modèle cible est une refonte à part entière**, pas un
renommage : il touche le schéma (`marketplace_quotes` → une offre par
appariement, avec `customer_price`, `binder_payout`, `accepted_at` /
`declined_at`), la machine à états, les server functions et les trois écrans.
Ne pas le commencer sans l'avoir découpé.

### Règle non négociable

**Ne jamais analyser le texte du Project Brief pour prendre une décision
machine.** Le Brief est de la prose destinée à un humain ; un changement de
libellé français ne doit jamais modifier un triage, un score ou un prix. Toute
décision lit `build_runtime_sessions.answers` — des valeurs d'option stables,
déclarées dans `caseProfile.ts`. `triageContract.test.ts` verrouille cette
règle.

---

## F. Workflow cible et état

| Étape                  | État                                       |
| ---------------------- | ------------------------------------------ |
| Visitor → Métré Intake | **OK**                                     |
| Project Brief          | **OK**                                     |
| Marketplace Case       | **OK** (trigger d'ingestion)               |
| Pricing                | **NON**                                    |
| Validation admin       | **OK**                                     |
| Matching               | **OK**                                     |
| Binder Offer           | **OK**, mais sur le mauvais modèle (devis) |
| Binder accepts         | **NON**                                    |
| Customer price         | **NON**                                    |
| Payment                | **NON**                                    |
| Shipment               | **NON**                                    |
| Inspection             | **NON**                                    |
| Work                   | **NON**                                    |
| Amendment              | **NON**                                    |
| Return                 | **NON**                                    |
| Review                 | **NON**                                    |

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
- 1 `build_dossiers` et 1 `marketplace_cases` (`under_review`, non revendiqué,
  créé le 8 septembre à 15:08 UTC) — **très probablement le dossier de test du
  déploiement ; à confirmer et à supprimer avant l'ouverture réelle** ;
- 0 `marketplace_binders`.

Le jeton de gestion utilisé pour l'audit n'a **plus** accès au projet
`qwfhebtxeubfmvvdsqdt` (« account does not have the necessary privileges ») :
son état n'a pas pu être vérifié.

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

**Agent:** Claude Code (Opus 5)

**Date:** 8 septembre 2026

**Branch:** `feat/reliure-marketplace-mvp` (poussée sur `mareliure/main` et
`mareliure/feat/reliure-marketplace-mvp`, mêmes commits)

**Completed:**

- **Refonte éditoriale de la landing** (`77897a2`) : Fraunces auto-hébergée
  (67 Ko, subset latin), palette `mr-*` séparée du système Métré, hero 50/50,
  trois étapes au lieu de six, composition asymétrique des savoir-faire,
  section engagements, prix, CTA final. Composants sous `pages/landing/`.
- **Photographies réelles** (`1570297`) : hero, quatre savoir-faire, fin de
  page ; deux restaurations avant/après de l'atelier Reliure Dorure Ferrière,
  créditées. WebP 480/800/1200/1600, `sizes` mesurés, hero prioritaire.
- **Fiche du premier atelier référencé** (`3e95331`) : Reliure Dorure Ferrière,
  François Ferrière, Orléans, depuis 1982, cinq savoir-faire, quatre pièces.
  Plus aucun emplacement « photographie à fournir » sur la page.
- **Documentation d'alternance** (`ddcd3dd`, `ab0321e`) : ce document,
  `AGENTS.md`, `README.md`, `.gitignore`.
- **Correctif de production sur la cible Supabase du navigateur** : voir
  ci-dessous. C'est le point le plus important de cette session.
- **Parcours authentifié vérifié au navigateur** pour la première fois : admin,
  atelier et client, boucle complète. Détail en §D.
- **`fetchPriority`** : l'attribut était écrit en minuscules, React le
  refusait, la priorité de chargement du hero n'était donc jamais posée.
- **`.gitattributes`** : `eol=lf`, pour que `npm run lint` puisse passer sur une
  machine Windows.

**Le bug de production corrigé.** `vite.config.ts` figeait la configuration
Supabase du navigateur à partir de `process.env` seul. Vite ne charge jamais les
fichiers `.env` dans `process.env` : la valeur configurée était donc ignorée et
le repli codé en dur — le projet Métré d'origine — l'emportait silencieusement.
Le bundle servi sur mareliure.fr pointait le navigateur vers la mauvaise base
pendant que le serveur parlait à la bonne. Rien ne le montrait, parce que la
landing est statique et que le runtime passe par des server functions ; la
première connexion d'un client l'aurait révélé. La configuration est désormais
résolue via `loadEnv`, et `scripts/buildMaReliure.mjs` relit les fichiers
JavaScript produits pour refuser un bundle qui viserait un autre projet.

**In progress:** rien. Working tree propre hors fichiers non suivis ignorés.

**Next recommended task:**

Découper le passage du modèle « devis » au modèle décidé — Ma Reliure fixe
`customer_price` et propose `binder_payout`, l'atelier accepte ou refuse (§E).
C'est le dernier écart entre le produit décrit et le code. Il touche le schéma,
la machine à états, les server functions et les trois écrans : à faire sur une
branche dédiée, en commençant par le schéma et sa migration.

Deux tâches plus courtes si l'on préfère commencer petit :

1. confirmer puis supprimer le dossier de test resté en production ;
2. fermer les inscriptions publiques sur le projet de production et corriger
   son `site_url`, qui pointe encore sur l'URL technique workers.dev.

**Known issues:**

- le modèle commercial du code (devis) ne correspond pas au modèle décidé ;
- `supabase/config.toml` pointe sur le projet Métré d'origine : toujours
  `supabase link` avant un `db push` ;
- un `marketplace_case` de test subsiste en production (`under_review`, créé le
  8 septembre à 15:08 UTC) ;
- deux réglages Cloudflare restent à poser à la main (§J) ;
- la fiche atelier est en dur dans `pages/landing/content.ts` ; elle devra lire
  `marketplace_binders` quand un deuxième atelier arrivera ;
- le jeton de gestion Supabase n'a plus accès au projet de développement ;
- le tableau de bord admin Métré déborde horizontalement sous 900 px.

**Do not touch:**

- `src/build/engine/`, `src/build/schema/`, `src/build/pages/public/` pour un
  besoin propre à la reliure — passer par le Playbook ou `src/marketplace/` ;
- les politiques RLS `build_*` ;
- le preset Nitro (`cloudflare-module`) ;
- les valeurs d'option du Playbook Reliure : ce sont des clés machine lues par
  `caseProfile.ts`, pas des libellés ;
- le repli codé en dur de `vite.config.ts` : c'est la bonne valeur pour le
  déploiement Métré, et seulement pour lui ;
- Stripe Connect (§Q).
