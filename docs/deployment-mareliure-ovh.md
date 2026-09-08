# Ma Reliure — déploiement sur mareliure.fr (OVH)

> **État au 8 septembre 2026 : rien n'est déployé.** L'offre OVH actuellement
> souscrite pour `mareliure.fr` est un hébergement web mutualisé, incompatible
> avec cette application. Ce document contient l'audit qui l'établit, l'offre
> minimale qui convient, et la procédure complète — prête à exécuter dès que
> l'hébergement est en place.

---

## 1. Architecture réelle de l'application

Audit du dépôt, pas des intentions.

| Point | Constat |
| --- | --- |
| Framework | TanStack Start (Router + server functions), React 19, Vite 8 |
| Bundler serveur | **Nitro 3** (via `@lovable.dev/vite-tanstack-config`) |
| Cible de build par défaut | **`cloudflare-module`** — produit un Worker Cloudflare, pas un serveur Node |
| Cible retenue pour OVH | **`node-server`** — `NITRO_PRESET=node-server`, produit `.output/server/index.mjs` |
| Node requis | ≥ 20 ; testé sur **24.14.0**. Aucun `engines` ni `.nvmrc` dans le dépôt |
| Commande de build | `npm ci && NITRO_PRESET=node-server npm run build` |
| Commande de production | `node .output/server/index.mjs` |
| Processus serveur | **Oui, persistant.** Écoute `HOST`/`PORT`, sert le SSR et les routes API |
| Server functions | TanStack `createServerFn`, résolues par un handler serveur (`__tanstack-start-server-fn-resolver`). **Elles n'existent pas sans processus Node.** |
| Rendu | SSR sur les routes marketing ; `ssr: false` sur `/m/$publicToken`, `/_authenticated/*` — mais le **serveur reste requis** pour servir ces routes et leurs server functions |
| Supabase | Deux clients : navigateur (clé publiable) et serveur (clé **service-role**, `client.server.ts`). Les tables `build_*` et `marketplace_*` sont `service_role` only, RLS deny-all — **tout passe par le serveur** |
| Uploads | Supabase Storage, buckets privés. Le fichier transite **par le serveur** (`upload_project_photo`, base64 → `POST /api/public/build-runtime`, corps jusqu'à 12 Mo) |
| Lecture des photos | URL signées générées côté serveur (TTL 1 h) |
| Authentification | Supabase Auth ; JWT vérifié côté serveur (`requireSupabaseAuth`) |
| Endpoints runtime | `POST /api/public/build-runtime` (7 actions), `/api/public/project-summary`, `/api/public/analyze-site`, `/api/public/contact`, `/api/public/faq-ask`, `/api/public/track-view`, webhooks paiements |
| Routes dynamiques | `/m/$publicToken`, `/project-summary/$accessToken`, `/marketplace/cases/$caseId`, `/atelier/cases/$caseId`, `/mes-livres/$caseId` — **un rafraîchissement direct doit être servi par l'application**, pas par un 404 de l'hébergeur |
| WebSockets | Aucun |
| Tâches planifiées | Aucune |

### Ce que cela impose à l'hébergement

1. Exécuter un **processus Node persistant** et le relancer s'il meurt.
2. Router **toutes** les URL vers ce processus (pas de résolution de fichiers).
3. Fournir des **variables d'environnement serveur** invisibles du navigateur.
4. Accepter des corps de requête d'au moins **12 Mo** (photos).

---

## 2. Compatibilité OVH

### L'offre actuelle ne convient pas

`mareliure.fr` est rattaché à un hébergement mutualisé
(`marelio.cluster121.hosting.ovh.net`). Toute la gamme visible dans le manager —
**Perso, Startup, Pro, Performance, Agency** — est de l'hébergement web
mutualisé : elle exécute **PHP**, pas Node.js, et n'autorise pas de processus
persistant. L'accès SSH n'apparaît qu'à partir du Pro, et il ne change rien : il
n'y a pas d'`init` pour maintenir un service en vie.

Les « 1 vCore / 1 Go de RAM » affichés sur **Startup** décrivent la part de
ressources allouée à l'exécution **PHP**, pas une machine où lancer ce que l'on
veut. Monter de Startup à Agency Plus n'y change rien : c'est la même nature
d'hébergement, en plus grand.

**Conséquence : aucune des six offres de cette page ne fait tourner Ma Reliure.**

Y forcer l'application signifierait la réduire à un site statique, ce qui
supprimerait les server functions, l'authentification, le runtime Métré, les
uploads, la génération du Project Brief et tout l'accès Supabase côté serveur.
C'est-à-dire tout le produit.

### Ce qui conviendrait chez OVH

| Offre | Node.js | Processus persistant | Verdict |
| --- | --- | --- | --- |
| Hébergement web (Perso → Agency Plus) | non | non | **incompatible** |
| **Cloud Web** | oui (runtime PHP/Node.js, variables d'environnement) | à vérifier | **à confirmer avant achat** — la documentation ne précise pas si l'on peut définir une commande de démarrage arbitraire (`node .output/server/index.mjs`) |
| **VPS** | oui | oui | **compatible, recommandé** |
| Public Cloud | oui | oui | compatible, mais plus d'administration pour ce MVP |

**Recommandation : un VPS.** C'est la seule option dont on peut garantir
aujourd'hui qu'elle exécute l'application **sans la modifier**, et c'est celle
vers laquelle la page « hébergement Node.js » d'OVH oriente elle-même. Un
**VPS-1** (2 vCores, 4 Go de RAM, 40 Go SSD) suffit largement : le MVP sert
quelques visiteurs, et le build peut se faire ailleurs.

Ne pas surdimensionner : ni Public Cloud, ni load balancer, ni Kubernetes pour
ce volume.

> **Cloud Web** mériterait un appel à OVH avant de trancher : si elle accepte une
> commande de démarrage personnalisée, elle serait plus simple à administrer
> qu'un VPS. Tant que ce n'est pas confirmé, le VPS reste le choix sûr.

---

## 3. Prérequis

- Un VPS OVH avec Debian 12 ou Ubuntu 24.04, et son **IPv4**.
- Un accès SSH (clé publique de préférence).
- Le domaine `mareliure.fr` dans le manager OVH (déjà le cas).
- Un projet Supabase dédié (voir §6).

---

## 4. Préparation du serveur

Toutes les commandes sont à exécuter sur le VPS, en root ou via `sudo`.

```bash
apt update && apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
adduser --system --group --home /srv/mareliure mareliure
```

Le service tourne sous un utilisateur dédié sans shell : une faille applicative
ne donne pas la machine.

---

## 5. Variables d'environnement

Voir `.env.example` pour la liste complète et son classement
PUBLIC / SERVER ONLY / OPTIONNELLES.

Sur le serveur, elles vivent dans un fichier lu par systemd, **jamais** dans le
dépôt :

```bash
install -o mareliure -g mareliure -m 600 /dev/null /etc/mareliure.env
```

Contenu (à remplir avec les valeurs du projet Supabase de production) :

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_PROJECT_ID=
SUPABASE_SERVICE_ROLE_KEY=
IP_HASH_SALT=
```

`chmod 600` et propriétaire `mareliure` : la clé service-role contourne la RLS,
elle ne doit être lisible par personne d'autre.

Les valeurs `VITE_*` ne servent **qu'au build** — elles sont figées dans le
JavaScript client à ce moment-là. Elles doivent donc être présentes **là où le
build est fait**, pas sur le serveur de production.

---

## 6. Supabase

### Environnements

| Environnement | Projet | Statut |
| --- | --- | --- |
| Local | `qwfhebtxeubfmvvdsqdt` | **provisoire** — sert aujourd'hui de bac à sable ET de cible de test. Contient des données de démonstration (6 relieurs `is_demo`, 8 projets `@example.com`) |
| Production | à créer | Aucun projet de production n'existe encore |

> Ce point est important et ne doit pas être maquillé : **il n'y a pas
> aujourd'hui d'environnement de production isolé.** Le projet
> `qwfhebtxeubfmvvdsqdt` est un projet de test. Avant toute mise en ligne
> publique, créer un second projet Supabase, y rejouer les migrations, y publier
> le Playbook, et **ne pas y seeder les données de démonstration**.

### Configuration Authentication à faire dans le tableau de bord Supabase

`Authentication → URL Configuration` :

| Champ | Valeur |
| --- | --- |
| Site URL | `https://mareliure.fr` |
| Redirect URLs | `https://mareliure.fr/**` |
| Redirect URLs | `http://localhost:8080/**` |

Le port local est **8080** (`.claude/launch.json`, et la configuration Vite du
dépôt). Pas de wildcard plus large que le domaine lui-même : pas de `https://*`.

`Authentication → Providers → Email` : garder **la confirmation d'e-mail
activée**. Le rattachement d'un dossier à un compte par adresse vérifiée
(`verifiedEmailFromClaims`) ne se déclenche que si le fournisseur d'identité
déclare l'adresse vérifiée ; désactiver la confirmation désactive silencieusement
ce chemin.

---

## 7. Build

Le build peut se faire sur le VPS (4 Go de RAM suffisent) ou sur un poste puis
être transféré. Sur le VPS :

```bash
sudo -u mareliure git clone https://github.com/antoineferriere2-star/mareliure.git /srv/mareliure/app
cd /srv/mareliure/app
sudo -u mareliure npm ci
sudo -u mareliure VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... VITE_SUPABASE_PROJECT_ID=... NITRO_PRESET=node-server npm run build
```

`NITRO_PRESET=node-server` est **indispensable** : sans lui, Nitro construit un
Worker Cloudflare qui ne démarre pas sous Node.

Vérification de sécurité, juste après le build :

```bash
npx vitest run src/marketplace/secretsContract.test.ts
```

Ce test échoue si une clé secrète s'est retrouvée dans le bundle client.

---

## 8. Service systemd

`/etc/systemd/system/mareliure.service` :

```ini
[Unit]
Description=Ma Reliure
After=network.target

[Service]
Type=simple
User=mareliure
WorkingDirectory=/srv/mareliure/app
EnvironmentFile=/etc/mareliure.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/mareliure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now mareliure
systemctl status mareliure
```

---

## 9. nginx et routes profondes

`/etc/nginx/sites-available/mareliure` :

```nginx
server {
  listen 80;
  server_name mareliure.fr www.mareliure.fr;
  location / { proxy_pass http://127.0.0.1:3000; }
}
```

Après obtention du certificat (§10), certbot réécrit ce fichier en HTTPS. La
configuration finale doit contenir :

```nginx
# www -> apex, permanent, et jamais l'inverse
server {
  listen 443 ssl;
  server_name www.mareliure.fr;
  return 301 https://mareliure.fr$request_uri;
}

server {
  listen 443 ssl;
  server_name mareliure.fr;

  # 12 Mo : le runtime accepte une photo encodée en base64 jusqu'à cette taille.
  client_max_body_size 16m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

**`location /` sans `try_files` est ce qui règle les routes profondes** : chaque
URL, y compris `/mes-livres/<uuid>` rafraîchie directement, part vers Node, qui
sait la rendre. C'est précisément ce qu'un hébergement mutualisé ne peut pas
faire.

`X-Forwarded-For` est nécessaire : le rate limiting du runtime hache l'IP du
visiteur et lirait sinon `127.0.0.1` pour tout le monde.

---

## 10. SSL

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d mareliure.fr -d www.mareliure.fr --redirect
```

`--redirect` installe la redirection HTTP → HTTPS. Le renouvellement est
automatique (timer systemd de certbot) ; le vérifier avec
`certbot renew --dry-run`.

---

## 11. DNS

À saisir dans **OVH Manager → Noms de domaine → mareliure.fr → Zone DNS**.

> `<IPV4_DU_VPS>` est à remplacer par l'IP réelle du VPS une fois commandé.
> Aucune valeur n'est inventée ici : tant que le VPS n'existe pas, cette adresse
> n'existe pas non plus.

| Type | Sous-domaine | Valeur | TTL | Rôle |
| --- | --- | --- | --- | --- |
| A | `@` | `<IPV4_DU_VPS>` | 3600 | Fait pointer `mareliure.fr` sur l'application |
| A | `www` | `<IPV4_DU_VPS>` | 3600 | Laisse nginx répondre puis rediriger vers l'apex |
| AAAA | `@` | `<IPV6_DU_VPS>` | 3600 | Optionnel — seulement si le VPS a une IPv6 |
| AAAA | `www` | `<IPV6_DU_VPS>` | 3600 | Optionnel, idem |

Un `CNAME www → mareliure.fr.` fonctionnerait aussi, mais un `A` évite un aller
supplémentaire et permet à certbot de valider les deux noms de la même façon.

### Entrées à NE PAS supprimer

La zone contient déjà des entrées créées avec l'hébergement mutualisé. Avant de
supprimer quoi que ce soit, vérifier son rôle :

| Entrée | Ne pas toucher si… |
| --- | --- |
| `MX` | vous comptez recevoir du courrier sur `@mareliure.fr` |
| `TXT` avec `v=spf1` | SPF — sa suppression fait classer vos e-mails en spam |
| `TXT` sur `_dmarc` | DMARC |
| `TXT` sur un sélecteur (`...._domainkey`) | DKIM |
| `CNAME` `autodiscover`, `autoconfig` | configuration automatique des clients mail OVH |

Seules les entrées `A`/`AAAA` de `@` et `www` qui pointent vers le cluster
mutualisé doivent être **modifiées** (pas supprimées) pour viser le VPS.

---

## 12. Route racine — décision en attente

Aujourd'hui, `/` sert la page marketing de **Métré Build** et `/reliure` la
landing **Ma Reliure**. Sur `mareliure.fr`, la racine doit être Ma Reliure.

Trois options, par ordre de préférence :

1. **Une variable d'environnement de marque** (`PUBLIC_BRAND=mareliure`) qui fait
   rendre la landing Ma Reliure à la racine sur ce déploiement. Petit, réversible,
   sans duplication de code. **Recommandé.**
2. Une redirection `/` → `/reliure` côté nginx. Simple, mais le canonique
   deviendrait `https://mareliure.fr/reliure`, ce qui contredit l'objectif.
3. Déployer deux applications distinctes. Coûteux et prématuré.

Cette décision n'a pas été prise : elle change ce que voit un visiteur et
n'appartient pas à l'implémentation.

---

## 13. Mise à jour

```bash
cd /srv/mareliure/app
sudo -u mareliure git fetch origin && sudo -u mareliure git checkout <SHA>
sudo -u mareliure npm ci
sudo -u mareliure NITRO_PRESET=node-server npm run build
systemctl restart mareliure
```

Une nouvelle migration Supabase se joue **avant** le redémarrage :

```bash
npx supabase db push --db-url "<chaîne Session pooler>"
```

## 14. Rollback

Le déploiement est un dossier git et un service. Revenir en arrière :

```bash
cd /srv/mareliure/app
sudo -u mareliure git checkout <SHA_précédent>
sudo -u mareliure npm ci && sudo -u mareliure NITRO_PRESET=node-server npm run build
systemctl restart mareliure
```

**Une migration de base ne se rollback pas ainsi.** La migration marketplace
contient sa propre recette de retour arrière, en commentaire à la fin de
`supabase/migrations/20260908120000_marketplace_reliure.sql`.

## 15. Logs et debug

```bash
journalctl -u mareliure -f          # logs applicatifs
systemctl status mareliure          # état du service
tail -f /var/log/nginx/error.log    # erreurs de proxy
curl -I https://mareliure.fr        # en-têtes et code de statut
```

Symptômes fréquents :

| Symptôme | Cause probable |
| --- | --- |
| 502 Bad Gateway | le service Node est arrêté — `journalctl -u mareliure -n 50` |
| « Missing Supabase environment variable » | `/etc/mareliure.env` incomplet ou non lu |
| 413 sur un upload photo | `client_max_body_size` trop bas dans nginx |
| Toutes les IP identiques dans le rate limiting | `X-Forwarded-For` absent de la configuration nginx |
| Le site démarre puis meurt | build fait sans `NITRO_PRESET=node-server` |

---

## 16. CI/CD

**Pas maintenant.** Le premier déploiement doit être manuel et compris de bout
en bout. Une fois qu'il tourne, l'étape suivante la plus simple est un script
`deploy.sh` sur le serveur, appelé en SSH. GitHub Actions ne se justifie que si
plusieurs personnes déploient — ce qui n'est pas le cas aujourd'hui.

---

## 17. Ce qui reste à faire avant la mise en ligne

1. Prendre un VPS OVH (ou confirmer que Cloud Web accepte une commande de
   démarrage personnalisée).
2. Créer un projet Supabase **de production**, distinct du projet de test.
3. Trancher la question de la route racine (§12).
4. Exécuter §4 à §11.
5. Dérouler les tests de production : landing, redirection `www`, runtime
   `/m/reliure-marketplace-token-000001`, tunnel complet avec photos, création du
   `marketplace_case`, matching, devis, comparaison, rafraîchissement direct sur
   les routes profondes, et rendu à 375 px, 390 px et desktop.
