# Ma Reliure — déploiement sur Cloudflare Workers

> Remplace l'ancien document OVH : l'hébergement OVH est abandonné. Le domaine
> `mareliure.fr` reste enregistré chez OVH ; l'application tourne sur Cloudflare
> Workers.
>
> **État au 8 septembre 2026 : déployé et testé.**
>
> URL publique : **https://mareliure.fr**
> URL technique : https://mareliure.aferriere.workers.dev
> Version : `b78dc1d7-8c8b-4295-8ff2-cf9f6b13f570`
> Supabase : **projet de production `hljxohondjvrkzqicexl`**, sans donnée de
> démonstration.
>
> Domaine branché le 8 septembre 2026 : serveurs de noms chez Cloudflare
> (`finley` / `ingrid.ns.cloudflare.com`), zone active, certificat Google Trust
> Services valide jusqu'au 7 décembre 2026. La messagerie OVH est intacte.
>
> **Deux réglages restent à faire dans le tableau de bord** (§8) : forcer HTTPS,
> et la redirection `www` vers l'apex.

---

## 1. Pourquoi Cloudflare, et ce que cela ne change pas

Le dépôt était **déjà** configuré pour Cloudflare : Nitro utilise le preset
`cloudflare-module` par défaut et génère une configuration `wrangler`. Déployer
là ne demande donc aucune modification d'architecture — c'est la cible native du
projet, pas une adaptation.

TanStack Start, le moteur Métré, les server functions, Supabase : rien n'est
touché.

---

## 2. Ce que produit le build

```bash
npm ci
npm run build          # preset cloudflare-module par défaut
```

Sortie :

| Chemin | Contenu |
| --- | --- |
| `.output/server/index.mjs` | le Worker (entrée `main`) |
| `.output/server/wrangler.json` | configuration générée **à chaque build** |
| `.output/public/` | assets statiques, servis par le binding `ASSETS` |
| `.wrangler/deploy/config.json` | pointeur que `wrangler` lit depuis la racine |

Configuration générée :

```json
{
  "compatibility_date": "2026-09-08",
  "compatibility_flags": ["nodejs_compat"],
  "main": "index.mjs",
  "assets": { "binding": "ASSETS", "directory": "../public" },
  "no_bundle": true
}
```

`nodejs_compat` est **indispensable** : le runtime public utilise `node:crypto`
(`randomBytes`, `createHash`, `timingSafeEqual`) pour les secrets de session et
le hachage d'IP. Le flag est posé automatiquement par le preset.

### Le nom du Worker

Le preset le déduit du dépôt d'origine et produit `antoineoppe-m-tr-build-ai`.
La surface de configuration exposée par `@lovable.dev/vite-tanstack-config` ne
permet pas de le fixer, et le fichier généré est réécrit à chaque build : le nom
est donc passé au déploiement.

```bash
npm run deploy:mareliure     # wrangler deploy --name mareliure
```

---

## 3. Vérifié en local sur le runtime Cloudflare

`wrangler dev` exécute **workerd**, le même moteur qu'en production. Résultats
du 8 septembre 2026 :

| Test | Résultat |
| --- | --- |
| `GET /` | 200 — `<title>Ma Reliure — Reliure et restauration de livres</title>`, canonical `https://mareliure.fr/` |
| `GET /reliure` | 200 |
| `GET /m/reliure-marketplace-token-000001` | 200 |
| `GET /mes-livres`, `/marketplace/cases`, `/project-summary/abc` | 200 — **routes profondes servies directement** |
| `POST /api/public/build-runtime` `get_mission` | Mission servie, Playbook 12 étapes, `defaultLocale: fr-FR` |
| `POST /api/public/build-runtime` `start_session` | session créée, secret de 64 caractères hex |

Le dernier test est le plus significatif : il exerce `randomBytes(32)`,
`createHash`, et une écriture Supabase en service-role **depuis le Worker**.
`nodejs_compat` fonctionne.

Reproduire :

```bash
npm run build
npx wrangler dev --name mareliure --port 8788 --local
```

`wrangler dev` lit les secrets depuis `.dev.vars` (ignoré par git).

---

## 4. Le risque à surveiller : le plafond CPU du plan Free

| Plan | Requêtes | CPU par requête |
| --- | --- | --- |
| Workers **Free** | 100 000 / jour | **10 ms** |
| Workers Paid ($5/mois) | 10 M inclus | 30 s |

Mesures locales sur `/` à chaud : **5 à 10 ms de temps mural**. Ce n'est pas du
temps CPU — l'attente réseau (Supabase) n'est pas comptée par Cloudflare — mais
c'est assez proche du plafond pour qu'on ne puisse pas affirmer que le plan Free
suffira. Le rendu serveur de la landing et l'initialisation d'un bundle de
5,1 Mo consomment du CPU réel, surtout au premier appel d'un isolate.

Ce qui joue en notre faveur : `/m/$publicToken` et `/_authenticated/*` sont en
`ssr: false`, donc le serveur y fait très peu de travail, et les routes API sont
dominées par l'attente de Supabase.

**Conduite à tenir** : déployer sur Free, puis surveiller les erreurs
« Worker exceeded CPU time limit » (code 1102) dans les logs. Si elles
apparaissent sur `/`, passer au plan Paid à 5 $/mois. Ne pas réécrire
l'application pour économiser des millisecondes avant d'avoir constaté le
problème.

---

## 5. Variables d'environnement — deux natures à ne pas confondre

C'est l'erreur la plus facile à commettre ici.

### Variables de BUILD (`VITE_*`)

Elles sont **figées dans le JavaScript** au moment du `npm run build`. Les
définir sur Cloudflare après coup ne change rien : le bundle est déjà écrit.
Elles doivent être présentes **là où le build s'exécute** (poste local, ou
Workers Builds — §9).

| Variable | Rôle |
| --- | --- |
| `VITE_PUBLIC_BRAND` | `mareliure` — fait servir la homepage Ma Reliure à `/` (§6) |
| `VITE_SUPABASE_URL` | projet Supabase lu par le navigateur |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publiable (publique par conception) |
| `VITE_SUPABASE_PROJECT_ID` | idem |

### Secrets d'EXÉCUTION (Worker)

Chiffrés par Cloudflare, jamais dans `wrangler.json`, jamais dans le dépôt.

| Secret | Rôle |
| --- | --- |
| `SUPABASE_URL` | lu côté serveur |
| `SUPABASE_PUBLISHABLE_KEY` | vérification des JWT (`requireSupabaseAuth`) |
| `SUPABASE_PROJECT_ID` | — |
| `SUPABASE_SERVICE_ROLE_KEY` | **contourne la RLS** — jamais côté client |
| `IP_HASH_SALT` | sel du hachage d'IP du rate limiting |

Les poser :

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name mareliure
wrangler secret put SUPABASE_URL --name mareliure
wrangler secret put SUPABASE_PUBLISHABLE_KEY --name mareliure
wrangler secret put SUPABASE_PROJECT_ID --name mareliure
wrangler secret put IP_HASH_SALT --name mareliure
```

Chaque commande demande la valeur en interactif : elle ne passe ni par un
fichier, ni par l'historique du shell.

**Garde-fou automatique** : `src/marketplace/secretsContract.test.ts` échoue si
la clé service-role devient lisible depuis le bundle client. À lancer après
chaque build :

```bash
npm run build && npx vitest run src/marketplace/secretsContract.test.ts
```

---

## 6. `/` sert la homepage Ma Reliure

Pas de redirection `/ → /reliure` : elle ferait du canonical un chemin, et
coûterait un aller-retour sur la page qui doit charger le plus vite.

`src/brand.ts` lit `VITE_PUBLIC_BRAND` **au build**. `metre` par défaut, donc
tout déploiement Métré Build existant est inchangé. Sur `mareliure` :

- `/` rend `ReliureLanding` ;
- le canonical et `og:url` valent `https://mareliure.fr/` ;
- `/reliure` rend la même page et pointe son canonical vers `/`, pour ne pas
  scinder l'autorité du domaine entre deux URL.

Une valeur inconnue retombe sur `metre` sans lever d'erreur : une faute de
frappe dans une variable de déploiement doit servir la page par défaut, pas
provoquer une panne.

---

## 7. Compte Cloudflare

```bash
npx wrangler login          # OAuth, ouvre le navigateur
```

ou un jeton d'API (*Edit Cloudflare Workers*) exposé en `CLOUDFLARE_API_TOKEN`.

### Le sous-domaine workers.dev

Un compte neuf n'en a pas, et `wrangler deploy` échoue avec
« You need to register a workers.dev subdomain ». Il est **à l'échelle du
compte**, pas du Worker, et se fixe une fois :

```bash
# via l'API, avec le jeton OAuth de wrangler
PUT /client/v4/accounts/<account_id>/workers/subdomain  {"subdomain": "..."}
```

Ouvrir la page *Workers & Pages* du tableau de bord en crée un automatiquement,
mais le nom est alors subi. Celui de ce compte est **`aferriere`**, d'où l'URL
`https://mareliure.aferriere.workers.dev`.

Le plan Free suffit pour commencer (§4).

---

## 8. DNS — le point qui demande une décision

### Ce qui existe aujourd'hui

| Type | Valeur actuelle |
| --- | --- |
| NS | `dns200.anycast.me`, `ns200.anycast.me` (OVH) |
| A `@` | `188.165.53.185` (cluster mutualisé OVH) |
| MX | `mx1.mail.ovh.net` (1), `mx2` (5), `mx3` (100) |
| TXT | `v=spf1 include:mx.ovh.com -all` |
| TXT | `1|www.mareliure.fr` (marqueur de redirection OVH) |

### Ce que Cloudflare exige

Pour attacher un domaine personnalisé à un Worker, **la zone doit être active
chez Cloudflare** : les serveurs de noms doivent pointer vers Cloudflare. On ne
peut pas garder le DNS chez OVH et se contenter d'un enregistrement `A` — un
Worker n'a pas d'adresse IP fixe à cibler.

Il faut donc, dans **OVH Manager → Noms de domaine → mareliure.fr → Serveurs
DNS** : remplacer les serveurs OVH par les deux serveurs que Cloudflare
attribuera lors de l'ajout du site (`Add a site` dans le tableau de bord
Cloudflare). Cloudflare les donne à ce moment-là ; ils sont propres à chaque
compte et **ne peuvent pas être devinés à l'avance**.

### ⚠️ L'e-mail casse si on oublie ceci

`mareliure.fr` a une messagerie OVH active. Basculer les serveurs de noms rend
la zone OVH inopérante : **les MX et le SPF doivent être recréés à l'identique
dans Cloudflare**, sinon plus aucun e-mail n'arrive.

À recréer dans la zone Cloudflare, avec le **proxy désactivé** (nuage gris) pour
tout ce qui concerne le courrier :

| Type | Nom | Valeur | Priorité | Proxy |
| --- | --- | --- | --- | --- |
| MX | `@` | `mx1.mail.ovh.net` | 1 | — |
| MX | `@` | `mx2.mail.ovh.net` | 5 | — |
| MX | `@` | `mx3.mail.ovh.net` | 100 | — |
| TXT | `@` | `v=spf1 include:mx.ovh.com -all` | — | — |

Vérifier aussi, avant de basculer, la présence d'un DKIM
(`<sélecteur>._domainkey`) et d'un DMARC (`_dmarc`) dans la zone OVH : s'ils
existent, les recopier également.

Cloudflare importe généralement la zone existante automatiquement lors de
l'ajout du site — **il faut malgré tout vérifier ligne à ligne** avant de
changer les NS chez OVH.

### Ce qui a réellement été fait le 8 septembre 2026

Les serveurs de noms ont été basculés sur Cloudflare et la zone importée.
Vérifié auprès des serveurs autoritaires après la bascule : **les 3 MX, le SPF
et les 3 SRV mail sont intacts**, tous en `DNS only`. Cloudflare avait repris
davantage que la liste minimale ci-dessus — les SRV `_autodiscover`, `_imaps` et
`_submission` inclus.

Deux pièges rencontrés, à connaître pour la prochaine fois :

1. **La zone OVH devient inerte** dès la bascule, et OVH l'affiche en bandeau :
   « Cette zone DNS n'est pas autoritaire pour votre nom de domaine ». Supprimer
   des enregistrements chez OVH après la bascule ne fait rien. Tout se passe
   désormais chez Cloudflare.
2. **Les A/AAAA importés pointaient encore sur l'hébergement OVH** et servaient
   sa page « Site en construction » à travers le proxy Cloudflare. Ils doivent
   être supprimés avant d'attacher le Worker : sinon l'API répond
   `100117 — Hostname already has externally managed DNS records`.

Une fois les quatre enregistrements retirés, les deux domaines ont été attachés
par l'API Workers :

```
PUT /accounts/<account_id>/workers/domains
{ "environment": "production", "hostname": "mareliure.fr",
  "service": "mareliure", "zone_id": "<zone_id>" }
```

Cloudflare crée alors ses propres enregistrements et provisionne le certificat.

### Une fois la zone active chez Cloudflare

`Workers & Pages → mareliure → Settings → Domains & Routes → Add custom domain` :

| Domaine | Rôle |
| --- | --- |
| `mareliure.fr` | l'application |
| `www.mareliure.fr` | redirigé (voir ci-dessous) |

Cloudflare crée lui-même les enregistrements nécessaires (`AAAA`/`CNAME`
proxifiés vers le Worker) et provisionne le certificat TLS. HTTPS et la
redirection HTTP → HTTPS sont automatiques.

### Les deux réglages qui restent

Ils demandent un droit d'écriture sur la zone que le jeton OAuth de `wrangler`
n'a pas (`zone (read)` seulement) — donc à faire dans le tableau de bord.

**1. Forcer HTTPS.** Constaté après la mise en ligne : `http://mareliure.fr`
répond 200 en clair au lieu de rediriger.

`SSL/TLS → Edge Certificates → Always Use HTTPS` → **On**

**2. `www` → apex.** Constaté : `www.mareliure.fr` sert l'application au lieu de
rediriger. Les deux noms sont attachés au Worker, il faut donc une règle.

`Rules → Redirect Rules → Create rule`

- Si : `Hostname` **equals** `www.mareliure.fr`
- Alors : redirection **Dynamic**,
  `concat("https://mareliure.fr", http.request.uri.path)`
- Statut **301**, *Preserve query string* activé

Jamais l'inverse : l'apex est la forme canonique, c'est lui que porte le
`<link rel="canonical">` de chaque page.

---

## 9. Déploiement depuis GitHub

Le dépôt est `antoineferriere2-star/mareliure` (branche `main`). Le dépôt Métré
d'origine reste l'`origin` local, comme upstream.

**Workers Builds** (`Workers & Pages → mareliure → Settings → Build`) permet un
déploiement sur `git push` :

| Champ | Valeur |
| --- | --- |
| Repository | `antoineferriere2-star/mareliure` |
| Branch | `main` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy --name mareliure` |
| Build variables | `VITE_PUBLIC_BRAND`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |

Les `VITE_*` doivent être des **variables de build**, pas des secrets de Worker :
elles sont consommées pendant `npm run build`, pas à l'exécution.

Pas de GitHub Actions : Workers Builds couvre le besoin, et une seconde chaîne
de déploiement ne se justifie pas pour un dépôt à un seul contributeur.

---

## 10. Supabase

### Environnements

| Environnement | Projet | Région | Statut |
| --- | --- | --- | --- |
| Test / bac à sable | `qwfhebtxeubfmvvdsqdt` | eu-west-2 | 6 relieurs `is_demo`, 8 projets `@example.com`. Sert aux essais, jamais au public. |
| **Production** | **`hljxohondjvrkzqicexl`** | eu-west-1 | **En service.** Schéma complet, Playbook publié, **aucune donnée de démonstration**. |

La production a été vérifiée vide après le test de mise en service : 0 dossier,
0 session, 0 cas, 0 relieur. Seuls la Mission et la version publiée du Playbook
y figurent.

> Le plan Free met un projet en pause après une semaine sans activité. Sans
> trafic, le site répondra par une erreur au réveil. À surveiller le jour où
> `mareliure.fr` est public.

### Créer le projet de production

```bash
# 1. Rejouer le schéma (57 migrations + marketplace)
npx supabase link --project-ref <REF_PROD>
npx supabase db push

# 2. Publier le Playbook et la Mission — SANS les données de démonstration
npm run seed:bookbinding
```

**Ne pas lancer `seed:marketplace-demo` en production.**

### Authentication

`Authentication → URL Configuration` :

| Champ | Valeur |
| --- | --- |
| Site URL | `https://mareliure.fr` |
| Redirect URLs | `https://mareliure.fr/**` |
| Redirect URLs | `http://localhost:8080/**` |

Le port local est **8080**. Pas de wildcard plus large que le domaine.

`Authentication → Providers → Email` : garder la **confirmation d'e-mail
activée**. Le rattachement d'un dossier par adresse vérifiée ne se déclenche que
si le fournisseur d'identité déclare l'adresse vérifiée ; la désactiver coupe ce
chemin silencieusement.

---

## 11. Mise à jour, rollback, logs

```bash
# Mise à jour
git push mareliure main          # si Workers Builds est branché
# ou, manuellement :
npm ci && npm run build && npm run deploy:mareliure

# Rollback — Cloudflare conserve les versions
wrangler deployments list --name mareliure
wrangler rollback --name mareliure

# Logs en direct
wrangler tail --name mareliure
```

Une migration Supabase se joue **avant** le déploiement qui en dépend. Elle ne
se rollback pas avec le Worker : la migration marketplace porte sa propre
recette de retour arrière, en commentaire à la fin de
`supabase/migrations/20260908120000_marketplace_reliure.sql`.

### Symptômes fréquents

| Symptôme | Cause probable |
| --- | --- |
| Erreur 1102 « exceeded CPU time » | plafond du plan Free (§4) — passer au plan Paid |
| « Missing Supabase environment variable » | un secret de Worker n'a pas été posé (§5) |
| La homepage affiche Métré Build | `VITE_PUBLIC_BRAND` absent **au moment du build** |
| `node:crypto` introuvable | `nodejs_compat` absent de `compatibility_flags` |
| E-mails qui n'arrivent plus | MX/SPF non recréés dans Cloudflare (§8) |

---

## 12ter. Sur le domaine public (8 septembre 2026)

`https://mareliure.fr` :

| Test | Résultat |
| --- | --- |
| Certificat | Google Trust Services, `CN=mareliure.fr`, valide jusqu'au 7 décembre 2026 |
| `/` | 200 · `Ma Reliure — Reliure et restauration de livres` · canonical `https://mareliure.fr/` |
| `/reliure`, `/mes-livres`, `/atelier`, `/marketplace/cases`, `/project-summary/…`, `/auth` | 200 — routes profondes servies directement, 0,15 à 0,56 s |
| `/m/reliure-marketplace-token-000001` | en-tête « Ma Reliure » · `lang="fr-FR"` · sélecteur masqué · « Étape 1 sur 8 · 13 % terminé » |
| `get_mission` | Mission servie depuis la production, Playbook 12 étapes |
| Mobile 375 px | aucun débordement horizontal |
| Console | aucune erreur |
| Messagerie | 3 MX résolus après la bascule |
| `http://mareliure.fr` | **200 en clair — à corriger** (§8) |
| `https://www.mareliure.fr` | **200, sert l'app au lieu de rediriger — à corriger** (§8) |

## 12bis. Résultats du premier déploiement (8 septembre 2026)

Sur `https://mareliure.aferriere.workers.dev` :

| Test | Résultat |
| --- | --- |
| `/` | 200 · `<title>Ma Reliure — Reliure et restauration de livres</title>` · canonical et `og:url` = `https://mareliure.fr/` · `og:locale` = `fr_FR` |
| `/reliure`, `/mes-livres`, `/atelier`, `/marketplace/cases`, `/project-summary/…`, `/auth`, `/demo/deck-project` | 200 — **routes profondes servies directement**, 0,16 à 0,70 s |
| `/m/reliure-marketplace-token-000001` | 200 · en-tête « MA RELIURE » · `lang="fr-FR"` · sélecteur de langue masqué · « Étape 1 sur 8 · 13 % terminé » |
| `get_mission` | Mission servie, Playbook 12 étapes, `defaultLocale: fr-FR`, marque « Ma Reliure » |
| `start_session` | session créée en base (`randomBytes` + `createHash` + écriture Supabase depuis le Worker) |
| Gate d'authentification | `/marketplace/cases` redirige vers `/auth` |
| Mobile 375 px et 390 px | rendu correct, **aucun débordement horizontal** |
| Console | aucune erreur |
| Démarrage du Worker | 9 ms |

> Une erreur d'hydratation React #418 a été observée juste après le premier
> déploiement. Elle provenait du bundle client de la version précédente, encore
> servi ; elle a disparu après redéploiement du build courant, et ne se
> reproduit ni sur workerd en local, ni dans un onglet neuf. Consignée parce
> qu'elle réapparaîtrait à l'identique si un build et son SSR se désynchronisaient.

### Parcours visiteur complet, sur la production

Déroulé par l'API publique, exactement comme le fait un navigateur :

| Étape | Résultat |
| --- | --- |
| Ouverture de la Mission | marque « Ma Reliure », locale `fr-FR` |
| Envoi de 4 photos | déposées dans Supabase Storage **à travers le Worker** |
| Réponses | belle reliure, demi-cuir vert foncé, 5 nerfs, dorure, budget 250–400 € |
| Soumission | Dossier créé, nommé « Le Comte de Monte-Cristo » |
| Project Brief | Matière « Demi-cuir » · Couleur « Vert foncé » · Finitions « Nerfs, Dorure, Titre au dos, Nom de l'auteur au dos » · 5 nerfs · Format « 21.8 × 14.2 × 4.8 » · Budget « 250 – 400 € » · 4 photos · confiance **high 90** |
| Ingestion | `marketplace_case` **RL-001** créé automatiquement par le trigger, lié au Dossier, 4 photos dans le résumé visiteur |

Les lignes créées ont ensuite été **supprimées** (dossier, session, objets
Storage) : une base de production neuve ne doit pas garder les traces de sa
propre mise en service. Vérifié après nettoyage : 0 dossier, 0 session, 0 cas.

### Ce qui n'a PAS été vérifié

Le back-office admin, l'espace atelier et la comparaison client **n'ont pas été
exercés dans un navigateur**. Trois approches ont échoué pour des raisons
d'outillage, non d'application :

1. connexion par l'interface — le formulaire ne se soumet pas sous pilotage
   automatique (entrées React contrôlées) ;
2. injection d'une session dans `localStorage` — non reprise par le client ;
3. appel direct des server functions — elles attendent une sérialisation propre
   au client TanStack qu'une requête fabriquée à la main ne fournit pas.

Le RPC de réconciliation a été appelé isolément et fonctionne. La logique
sous-jacente (triage, score de matching, plafond de trois relieurs,
autorisations, règles de devis) est couverte par les tests unitaires. Mais
**l'assemblage UI ↔ server functions reste à valider à la main**, par une
personne qui se connecte et clique. C'est le premier point à faire au prochain
passage.

Restent également non vérifiés, faute de domaine branché : la redirection `www`
et le certificat sur `mareliure.fr`.

## 12. Tests à dérouler après le premier déploiement

1. `https://mareliure.fr` → 200, TLS valide, homepage Ma Reliure.
2. `https://www.mareliure.fr` → 301 vers l'apex.
3. `https://mareliure.fr/m/reliure-marketplace-token-000001` → runtime en
   français, sélecteur de langue masqué.
4. Tunnel complet : réponses, photos, branches conditionnelles, soumission,
   Project Brief.
5. `marketplace_case` créé, triage, matching, vue atelier, devis, comparaison.
6. Rafraîchissement direct sur `/mes-livres/<id>`, `/atelier/cases/<id>`,
   `/marketplace/cases/<id>`.
7. Authentification : connexion, redirections Supabase.
8. Rendu à 375 px, 390 px et desktop.
