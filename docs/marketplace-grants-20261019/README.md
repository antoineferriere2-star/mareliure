# Rejouer les contrôles des droits sur une copie

Ne jamais utiliser une production. La migration est une proposition, son application distante n'est pas autorisée par cette PR. Préparer une copie PostgreSQL native sauvegardée/restaurée et vérifiée, avec les rôles et les données nécessaires, puis répéter le SQL dans cette seule copie. Les reçus joints décrivent l'exécution locale du 19 octobre, pas une application de production.

Les scripts d'inventaire s'exécutent depuis la racine du dépôt avec Node 24. `marketplaceGrantUsage.mjs` reçoit un catalogue privé contenant les tables/propriétaires/droits et les définitions des fonctions SQL, puis un chemin JSON de sortie. Ne jamais versionner le catalogue brut ni le dump. `buildGrantProposal.mjs` reçoit ce JSON d'usage et le chemin de sortie SQL ; il ne se connecte à aucune base.

```powershell
node scripts/audits/marketplaceGrantUsage.mjs CHEMIN_CATALOGUE_PRIVE docs/marketplace-grants-20261019/usage.json
node scripts/audits/buildGrantProposal.mjs docs/marketplace-grants-20261019/usage.json CHEMIN_SQL_A_COMPARER
```

`nativeLabelResolutionChecks.sql` est un rejeu transactionnel des neuf assertions de résolution, sous `service_role`, terminé par ROLLBACK. Il refuse une base dont le nom ne correspond pas à `acl_rehearsal_YYYYMMDD` et une connexion hors `127.0.0.1`. Il exige des références de proposition/atelier présentes dans la copie. Lancer `psql -X -w -v ON_ERROR_STOP=1 -f scripts/audits/nativeLabelResolutionChecks.sql` avec **PGHOST=127.0.0.1**, les port/utilisateur/base de cette copie. Aucun fournisseur externe appelé.

## Recette navigateur

Installer les dépendances verrouillées avec Node 24 et un Chromium Playwright. La configuration utilise un serveur local dédié, les données Auth/RPC de #134 et les assertions téléphone adaptées à #137. Le pont natif exige un nom `acl_rehearsal_YYYYMMDD`, un hôte loopback et un psql local ; il force la connexion au rôle local `postgres`, puis les opérations du plan sous `SET LOCAL ROLE service_role`. Ne pas transmettre de clé Supabase de production.

```powershell
$env:E2E_NATIVE_COPY_DATABASE='acl_rehearsal_20261019'
$env:E2E_NATIVE_COPY_HOST='127.0.0.1'
$env:E2E_NATIVE_COPY_PORT='55432'
$env:E2E_NATIVE_PSQL='CHEMIN_LOCAL/psql.exe'
# Facultatif si Chromium n'est pas à l'emplacement Playwright standard :
$env:E2E_CHROMIUM_EXECUTABLE_PATH='CHEMIN_LOCAL/chrome.exe'
npm run test:e2e:grants-copy
```

Les quatre tests créent des dossiers synthétiques `QA-COPY-<uuid>` dans la copie, en référençant un acteur déjà copié. Sauvegarde/relecture du plan : vraies opérations SQL natives ; autres fonctions, connexion, proposition, paiement et fournisseur : simulations. Aucun compte créé, aucune action Stripe/Sendcloud. Une exécution sans `E2E_NATIVE_COPY_DATABASE` conserve seulement la simulation et **ne peut pas être annoncée comme recette de la copie**.

Les captures sont attachées au rapport Playwright local (`playwright-report/grants-copy`) ; elles ne contiennent que les fixtures synthétiques. Les triggers protègent l'historique des plans contre une suppression ordinaire : préférer restaurer une nouvelle copie après inspection. Le nettoyage exceptionnel réalisé le 19 octobre est décrit dans le rapport et son reçu, avec recontrôle des 98 empreintes. Ne jamais généraliser ce nettoyage à des références existantes ou à une production.

Le contrôle PGlite `src/marketplace/security/marketplaceGrantsHardening.test.ts` appartient à la suite normale. La recette native exige une copie privée et n'est pas lancée automatiquement dans la CI publique.
