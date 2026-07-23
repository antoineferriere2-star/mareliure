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

## Runtime public

- La seule surface publique est `/m/:publicToken` (voir
  `src/routes/m.$publicToken.tsx`), servie par la route API publique
  `src/routes/api/public/build-runtime.ts`.
- Aucune route `/build/run/:id` n'existe et ne doit être ré-introduite.

## Client admin (remote-first, fallback local)

`src/build/services/buildAdminClient.ts` expose des helpers
`callWithFallback` + les fallbacks localStorage pour Knowledge et
Playbooks. Comportement :

- Si la server fn répond → `dataSource: "supabase"` (badge vert
  "Supabase Build admin").
- Si la server fn échoue (réseau, permission, backend down) → l'UI passe
  automatiquement sur `localStorage` et affiche le badge orange
  "Local dev fallback". L'admin reste fonctionnel en dev.

Les mutations (create/update/delete) suivent la même règle : elles
écrivent en DB si la source est Supabase, sinon dans le localStorage
correspondant.

## Structure

```
src/build/
├── pages/               # Composants publics (marketing, runtime, démo)
├── services/
│   ├── admin.functions.ts        # requireBuildAdmin (gate)
│   ├── admin.data.functions.ts   # server fns admin (missions, dossiers,
│   │                             #                   playbooks, knowledge)
│   ├── buildAdminClient.ts       # facade + fallback localStorage
│   ├── buildPublicForms.ts       # audit / private beta (public)
│   └── deckProjectBrief.ts       # playbook intégré (deck v1)
└── types/index.ts                # types partagés Build AI
```
