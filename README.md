# Ma Reliure · Métré Build

Un dépôt, deux marques publiques servies depuis la même base de code.

**Métré Build** est le moteur générique : il transforme des visiteurs de site
web en Dossiers Commerciaux exploitables, via des Missions (parcours guidés)
alimentées par des Playbooks (l'expertise métier) et des agents IA.

**Ma Reliure** — <https://mareliure.fr> — est une marketplace gérée de reliure
et de restauration de livres, construite **sur** ce moteur. Elle en est une
consommatrice, pas une copie : le visiteur présente son livre, répond au
Project Intake Métré, obtient un Project Brief, et Ma Reliure lui sélectionne
un atelier.

La marque servie à la racine du domaine dépend de la constante de build
`VITE_PUBLIC_BRAND` (`metre` par défaut, `mareliure` pour le déploiement
Ma Reliure). Voir `src/brand.ts`.

## Où est quoi

```
src/build/        moteur générique Métré — ne connaît aucun métier
src/marketplace/  logique Ma Reliure
src/routes/       routes TanStack Start
supabase/         migrations Postgres
docs/             documentation de projet
```

**Règle absolue :** aucune règle commerciale Ma Reliure ne doit entrer dans
`src/build/`. Elle appartient au Playbook (qui est de la donnée) ou à
`src/marketplace/`.

## Démarrer

```sh
npm install
cp .env.example .env     # puis remplir — aucune valeur réelle n'est versionnée
npm run dev              # http://localhost:8080
```

```sh
npm test                 # vitest
npm run typecheck        # tsc --noEmit
npm run lint
npm run build
```

## À lire avant de contribuer

| Document                                   | Contenu                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`docs/CODEX_HANDOFF.md`**                | **état réel du projet, architecture, base de données, déploiement, prochaine tâche.** Point d'entrée de tout agent ou nouveau contributeur. |
| `AGENTS.md`                                | consignes courtes pour les agents automatisés                                                                                               |
| `CLAUDE.md`                                | vocabulaire produit imposé et anti-patterns refusés                                                                                         |
| `docs/reliure-marketplace-architecture.md` | décisions d'architecture de la marketplace                                                                                                  |
| `docs/pricing-reference-system.md`         | comment un prix se construit, et pourquoi le moteur préfère s'abstenir                                                                      |
| `docs/content-assets.md`                   | provenance et autorisation de chaque image publiée                                                                                          |
| `docs/shipping-pickup-point-spec.md`       | expédition en point relais — spécifié, non commencé                                                                                         |
| `docs/deployment-mareliure-cloudflare.md`  | déploiement Cloudflare Workers, DNS, secrets                                                                                                |

## Construit avec

TanStack Start · React 19 · TypeScript · Vite 8 · Nitro 3 · Tailwind 4 ·
Supabase · Cloudflare Workers · Vitest · Playwright
