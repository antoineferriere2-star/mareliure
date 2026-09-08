# Métré Build AI — Admin module

Ce dossier concentre le module **Métré Build AI**, distinct du reste de
l'app (site public, marketing) et sécurisé sous `/build/*`.

## Sécurité & architecture

- L'espace admin `/build/*` est protégé par le layout
  `src/routes/_authenticated/build/route.tsx` (`beforeLoad` +
  `requireBuildAdmin`).
- Le contrôle admin s'appuie sur `public.user_roles` + `public.has_role`
  côté DB, jamais sur le client.
- Les tables `build_*` (missions, dossiers, playbooks, knowledge_notes,
  runtime sessions/rate) sont **service_role only** : aucun rôle
  `anon`/`authenticated` n'y a d'accès direct via l'API Data.
- Toutes les opérations admin passent par des **server functions
  TanStack** (`createServerFn` + `requireSupabaseAuth`) qui :
  1. vérifient d'abord le rôle admin via le client RLS de l'appelant
     (`user_roles`), puis
  2. utilisent le client service-role (`supabaseAdmin`) uniquement une
     fois l'admin confirmé.

> Note : la spec Codex mentionnait une edge function
> `supabase/functions/build-admin/index.ts`. Sur cette stack TanStack
> Start, la règle plateforme interdit d'ajouter de nouvelles edge
> functions. L'équivalent fonctionnel (même isolation service-role, même
> gating admin) est implémenté dans
> `src/build/services/admin.data.functions.ts`.

## Moteur de Playbook générique

Le vrai Playbook (schéma versionné : sections/étapes/champs typés, options,
logique conditionnelle, règles de cohérence, mapping vers le Dossier
Commercial) vit dans `src/build/schema/playbook.ts` (Zod). Il est interprété
par des modules purs dans `src/build/engine/` (`conditions.ts`,
`validation.ts`, `brief.ts`) et rendu par un composant générique par type de
champ dans `src/build/engine/fields/*` — **aucun de ces composants ne connaît
de règle métier** ; tout vient de la donnée Playbook, jamais du code.

Une Mission pointe vers une **version publiée immuable** d'un Playbook
(`build_playbook_versions`) : éditer le brouillon d'un Playbook n'affecte
jamais une Mission déjà active.

Le Playbook Deck (`src/build/playbooks/deckPlaybookSchema.ts`) est un exemple
complet de Playbook exprimé en donnée — il remplace l'ancien
`deckProjectBrief.ts` codé en dur. Il est publié via
`scripts/seedDeckPlaybook.ts` (idempotent, à exécuter après migration DB) qui
crée la Mission Deck toujours publique (`/demo/deck-project`, token fixe
`DECK_DEMO_PUBLIC_TOKEN` dans `src/build/constants.ts`).

Le Playbook Bookbinding (`src/build/playbooks/bookbindingPlaybookSchema.ts`,
publié par `scripts/seedBookbindingPlaybook.ts`) est la seconde verticale
curatée. Il est la preuve que le moteur ne connaît aucun métier : un domaine
entièrement différent, en français, avec ses propres branches et ses propres
pièges, sans une ligne de code ajoutée dans `engine/`. Il alimente la
marketplace Reliure — voir `docs/reliure-marketplace-architecture.md` et
`src/marketplace/`, qui consomme le Dossier produit ici et n'entre jamais dans
le moteur.

## Runtime public

- La seule surface publique est `/m/:publicToken` (voir
  `src/build/pages/public/MissionRuntime.tsx`, servie par la route API
  publique `src/routes/api/public/build-runtime.ts`) — `/demo/deck-project`
  est une Mission ordinaire rendue par ce même composant, pas une route
  parallèle.
- Aucune route `/build/run/:id` n'existe et ne doit être ré-introduite.

## Client admin (remote-first, fallback local)

`src/build/services/buildAdminClient.ts` expose `callWithFallback` + un
fallback localStorage, utilisé uniquement pour **Knowledge notes**. Les
Playbooks (schéma riche, versionné) ne passent plus par ce mécanisme — ils
exigent Supabase, comme Missions et Dossiers.

## Structure

```
src/build/
├── schema/               # Zod : PlaybookSchema, Answers, ProjectBrief
├── engine/                # conditions/validation/brief (purs) + fields/*
├── playbooks/             # Playbooks exprimés en donnée (ex. Deck)
├── pages/                 # Composants publics (marketing, MissionRuntime)
├── services/
│   ├── admin.functions.ts        # requireBuildAdmin (gate)
│   ├── admin.data.functions.ts   # server fns admin (missions, dossiers,
│   │                             #                   playbooks, knowledge)
│   ├── buildAdminClient.ts       # facade + fallback localStorage (knowledge)
│   └── buildPublicForms.ts       # audit / private beta (public)
└── types/index.ts                # types partagés Build AI
```
