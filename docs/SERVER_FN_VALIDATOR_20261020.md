# Passage à `createServerFn().validator()` — 20 octobre 2026

L'ancienne méthode émet un avertissement à la compilation. Dans les dépendances installées correspondant exactement au lockfile, **`validator` et `inputValidator` sont deux noms de la même fonction**, avec les mêmes types. Le remplacement peut donc rester mécanique.

Base : `origin/main 57499b4f9314cef39622fd72c6eb3881739ce1cc`. Versions relues : `@tanstack/react-start 1.168.32`, `@tanstack/start-client-core 1.170.14`. Ni dépendance ni lockfile modifiés.

## Preuve de sémantique dans la version installée

Sources primaires locales, sous `node_modules` :

- `@tanstack/start-client-core/src/createServerFn.ts:88–96` : `setValidator` construit les mêmes options et renseigne les deux clés avec le même validateur ; lignes 123–125, les deux méthodes sont affectées à **la même référence `setValidator`**.
- Lignes 670–673 : les deux propriétés utilisent exactement `ValidatorFn<TRegister, TMethod, TMiddlewares, TStrict>`. Les types d'entrée et d'inférence ne divergent pas ; le typecheck du dépôt passe après remplacement.
- Lignes 259–273 et 891–914 : même moteur `execValidator` pour fonction, objet `parse` et Standard Schema, avec les mêmes transformations et erreurs. Une sonde Node utilisant le module installé vérifie l'identité stricte des méthodes, trois scénarios de sortie (dont Date/undefined) et deux scénarios d'erreur : résultats identiques.
- Lignes 917 et suivantes : même construction du middleware et même chemin de transport/sérialisation à partir des options résolues. Aucun autre embranchement de sérialisation dépendant du nom de méthode n'est ajouté par le remplacement.
- `@tanstack/start-plugin-core/src/start-compiler/handleCreateServerFn.ts:244–320` : le compilateur traite les deux noms dans la même boucle et retire les validateurs du client de la même façon ; seul l'ancien nom déclenche l'avertissement de dépréciation.

Cette conclusion porte sur ces versions verrouillées, pas sur une promesse concernant toutes les versions futures de TanStack. La recette navigateur utilise des server functions simulées : elle ne constitue pas un aller-retour avec les server functions de production ni un test réseau de toutes les erreurs de validation. L'équivalence du chemin de sérialisation est établie par l'identité des options et la relecture du code installé.

## Modification

**233 remplacements du seul nom `inputValidator` par `validator`, dans 45 fichiers de `src/`.** Ils comprennent 225 appels produit et les simulations/assertions de sept fichiers de tests qui mentionnaient l'ancien nom. Les fonctions passées en argument, schémas, erreurs, handlers et ordre des middlewares sont conservés. Une comparaison de chaque fichier avec sa version HEAD confirme qu'il n'existe aucune autre différence de contenu, hors normalisation des fins de ligne pour la comparaison.

Aucun changement de code fonctionnel, migration, configuration suivie ou dépendance. Rapport et handoff daté accompagnent les remplacements.

## Vérifications locales

| Contrôle | Résultat |
| --- | --- |
| Suite complète, même sélection `src/**/*.test.ts` que la configuration générale | **311 fichiers, 3 821 tests réussis**. Un worker, délais de 30 s, résolution limitée au tsconfig de ce worktree dans une configuration locale non versionnée. |
| `npm run typecheck` | Réussi. |
| `npm run lint` | Aucune erreur, 19 avertissements existants de React Fast Refresh. |
| `node scripts/buildMaReliure.mjs` | Réussi ; bundle client vérifié sur le projet Supabase attendu, contrôle serveur tslib réussi. Aucun déploiement. |
| `npm run test:e2e:customer` | **4/4 réussis**, FR/EN bureau 1 280 px et iframe mobile de 375 px réels, un worker, services simulés. |

Les premières passes ont identifié des simulations de builder et une assertion textuelle utilisant encore l'ancien nom ; elles ont été renommées, puis la suite complète a été rejouée avec succès. Le build conserve des avertissements existants (chemins tsconfig, module Node externalisé, taille/plugins, avertissement Node du lanceur), sans avertissement `createServerFn().inputValidator()` dans le journal relu.

La première recette navigateur a donné **3/4** : pendant le parcours anglais sur bureau, Vite a optimisé de nouvelles dépendances puis rechargé la page. La trace montre le bouton d'envoi détaché et le parcours revenu à la première étape, jusqu'au délai de 240 s. Après cette optimisation, la **même commande, le même serveur, les mêmes délais et le même code** ont donné 4/4 en 1,1 minute. Le journal et la trace du premier échec sont conservés privés. Aucun assouplissement de test ni correctif de configuration inclus.

Recette : serveur local sur `127.0.0.1:8086`, faux projet `customer-journey.invalid`, clé service vide, Chromium déjà installé. Les appels externes et inattendus sont refusés par la fixture, et les tests vérifient leurs listes vides. Aucun paiement ou achat n'est exécuté : l'état payé et les étapes « en préparation » / « prête » sont simulés. Les captures synthétiques sont dans le rapport Playwright local, non versionné.

Production en lecture seule ; aucune opération Sendcloud, paiement, création de compte, e-mail, fusion ou déploiement.
