# Reproductions indépendantes — 19 octobre 2026

Ces fichiers sont des caractérisations réservées à l'audit. Certaines assertions attendent un résultat dangereux pour le rendre observable. Un test vert ne signifie donc pas « faille corrigée ». Les simulations ne doivent jamais appeler une production ou un fournisseur réel.

Dans un checkout isolé du commit étudié, installer les dépendances verrouillées avec Node 24, copier ce dossier sous `docs/pr-review-20261019`, puis copier `vitest.audit-replay.template.ts` **à la racine** sous `vitest.audit-replay.local.ts`. Ne pas remplacer la configuration du dépôt ni les fichiers produit.

```powershell
# PR135 : ef0f074505b2f2a945e7540ebb756a5fd702bb14
npm test -- --config vitest.audit-replay.local.ts docs/pr-review-20261019/pr135.repro.test.ts

# PR136 : a1a75d593234a69dbd489ab22ce85708d146c4d2
npm test -- --config vitest.audit-replay.local.ts docs/pr-review-20261019/pr136.repro.test.ts src/marketplace/shipping/labelOrchestrator.test.ts src/marketplace/shipping/sendcloudProvider.server.test.ts
```

La sonde photo originale provient du commit `d5536dd81f3cd4293929f8f493ce61d0c0bdb4e4` de #132. Le rejeu P1 original provient de `084ba649833ee016084319b978aa1882fd05a211` de #133, fichier `scripts/audits/sendcloudP1Review.test.ts`. Le rapport explique leurs attentes devenues obsolètes. PGlite assure les contraintes et transitions SQL ; les lectures fournisseur et octets PDF sont synthétiques. Il ne représente pas deux connexions PostgreSQL concurrentes : les barrières ordonnent les intercalages applicatifs de manière déterministe.

Pour #137 (`118da664ec309dbd0f5af8537bb5c489b1c3030d`), reprendre `e2e/customer` et `playwright.customer.config.ts` de #134, commit `45c30736be688a80e2066892799827daf6284429`. Dans la copie de `journey.spec.ts`, remplacer uniquement les attentes du compteur `scenario.phoneRefusals` de 1 puis 2 par 0 puis 0. Le message local empêche maintenant l'appel serveur. Conserver toutes les autres assertions et exécuter les deux projets (bureau, iframe de 375 px) en FR et EN avec le serveur local simulé. Fournir `E2E_CHROMIUM_EXECUTABLE_PATH` si le navigateur Playwright n'est pas à son emplacement standard. Ne pas sélectionner les autres suites E2E du dépôt.

Résultats obtenus : #135, 2 reproductions adaptées et 50 tests existants ; #136, 5 nouvelles reproductions plus 66 tests existants, soit 71 ; #137, 4 parcours. Les logs complets et captures restent privés dans `D:/CodexProjects/outputs/mareliure-brief3-20261019` et les dossiers `test-results` des checkouts isolés.

## Contre-vérification de #141

Dans le checkout isolé **`7582d72a88e0c671813e4e03632bbf540460c596`**, copier les deux fichiers `pr141.*.test.ts` et la même configuration à la racine, puis :

```powershell
npm test -- --config vitest.audit-replay.local.ts docs/pr-review-20261019/pr141.photo.repro.test.ts docs/pr-review-20261019/pr141.transport.repro.test.ts
```

Résultat : **14/14**. Les tests de photos, reprise annulée, contradiction explicite et ancienne course webhook attendent désormais le comportement corrigé. Les caractérisations supplémentaires attendent encore le POST d'annulation sans identité complète / avec colis additionnel, ou l'erreur de course après la lecture d'état : elles documentent des réserves, pas des corrections. Voir `docs/REVIEW_141_20261019.md`. Sur ce SHA, les quatre échecs de l'ancienne sonde inchangée décrivent des attentes dangereuses devenues obsolètes ; ne pas mélanger ces deux séries de résultats.
