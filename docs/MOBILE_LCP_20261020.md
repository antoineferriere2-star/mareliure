# Décision — brief n° 9, 21 octobre 2026

**Recommandation : ne pas fusionner #159 en l'état.** Le premier affichage progresse sur les cinq pages, mais le LCP ne progresse pas de façon homogène et aucun LCP médian n'atteint 2,5 s. Le TBT augmente sur les cinq pages, de 5,5 à 228,5 ms sur partenaires. Le head personnalisé et l'abaissement de priorité des modules ne justifient pas leur généralisation sur ces seuls résultats. Je ne recommande pas non plus une sélection de commits comme gain prouvé : aucun essai isolé ne permet d'attribuer l'amélioration à un sous-ensemble précis.

Les choix ci-dessous portent sur **la version c5ba309 mesurée**, pas sur la production ni sur les ajouts postérieurs de main (#161). Aucun nouveau changement de code de performance n'est effectué avec cette décision ; la PR reste ouverte pour revue, sans fusion ni fermeture exécutée ici.

| Page | FCP avant → après, médiane | LCP avant → après, médiane | TBT avant → après, médiane | Décision pour les changements de #159 |
| --- | --- | --- | --- | --- |
| Ma Reliure / | 3,14 → 1,35 s | 3,66 → 3,73 s | 10 → 69 ms | Ne pas fusionner |
| /tarifs | 3,05 → 0,96 s | 3,58 → 3,41 s | 4 → 51 ms | Ne pas fusionner |
| /reparation-de-livres | 2,84 → 0,95 s | 3,43 → 3,13 s | 8 → 19 ms | Ne pas fusionner |
| /partenaires-relieurs | 3,14 → 0,94 s | 3,59 → 3,57 s | 6 → 229 ms | Ne pas fusionner |
| Fine Bindery /en | 3,19 → 1,71 s | 4,21 → 4,27 s | 13 → 95 ms | Ne pas fusionner |

## Levier suivant et gain attendu

Les chiffres suivants sont **les estimations Lighthouse des trois passages déjà archivés**, pas des gains obtenus. Ils sont non additionnables : CSS, JavaScript, police et image se recouvrent dans le chemin critique. Un zéro signifie qu'aucun gain LCP n'est estimé par cet audit, pas qu'une ressource est inutile. Les détails et les quinze extractions figurent dans [decision-estimates.json](mobile-lcp-20261020/decision-estimates.json). Aucun nouveau passage ni résultat inventé.

| Page | JS inutilisé : potentiel et estimation LCP médiane | CSS bloquante : estimation médiane | Image responsive : potentiel et estimation LCP |
| --- | --- | --- | --- |
| Ma Reliure / | 34 884 octets ; **200 ms LCP** (0–350) | **300 ms FCP / 0 ms LCP** | 15 712 octets ; **0 ms LCP** médian (0–150) |
| /tarifs | 34 881 octets ; **300 ms LCP** (300–450) | **300 ms FCP / 300 ms LCP** | 0 octets ; **0 ms LCP** médian (0–0) |
| /reparation-de-livres | 34 758 octets ; **300 ms LCP** (150–300) | **300 ms FCP / 300 ms LCP** | 0 octets ; **0 ms LCP** médian (0–0) |
| /partenaires-relieurs | 34 503 octets ; **300 ms LCP** (300–350) | **300 ms FCP / 300 ms LCP** | 15 509 octets ; **0 ms LCP** médian (0–150) |
| Fine Bindery /en | 35 779 octets ; **450 ms LCP** (400–500) | **300 ms FCP / 0 ms LCP** | 15 712 octets ; **0 ms LCP** médian (0–0) |

- **Accueil Ma Reliure :** LCP mesuré = H1 dans un passage, planche Ferrière dans deux ; image de 27 962 octets, déjà préchargée High dans la branche. La CSS de 27 ko transférés et Fraunces de 67 304 octets retardent le rendu, puis le JavaScript et l'affichage de l'image deviennent les leviers restants. Priorité : réduire les quelque 35 ko de JS inutilisé de l'index sur cette page ; corriger sizes/source de l'image seulement après vérification visuelle de netteté. Le preload/priorité est déjà reconnu : **0 ms supplémentaire estimé** pour le répéter. La réduction de CSS annonce surtout un gain FCP, sans gain LCP médian sur ce cas.
- **/tarifs :** LCP = paragraphe d'introduction, jamais une image dans ces trois passages. Priorité : alléger le JS initial et le CSS critique ; estimations ci-dessus, à valider séparément. Une meilleure image hors LCP n'annonce ici **aucun gain LCP**. La police gouverne aussi le rendu du texte, mais aucun sous-ensemble de police conservant le rendu n'a montré de gain isolé : **gain de cette piste non chiffré et non promis**.
- **/reparation-de-livres :** LCP = paragraphe d'introduction ; même dépendance CSS/police puis travail de rendu/JS. Priorité au JS inutilisé et à une CSS critique réduite, sans différer l'interactivité. Les économies calculées ne suffisent pas à affirmer le franchissement des 2,5 s, même si elles sont du même ordre que les 630 ms manquantes ; elles ne se cumulent pas simplement.
- **/partenaires-relieurs :** LCP = H1 dans les six passages avant/après, pas la capture de l'outil. Priorité à l'évaluation/hydratation du JavaScript et à la CSS ; l'image optimisable de 15,5 ko est hors LCP et n'apporte **aucun gain LCP estimé**. Le TBT justifie une trace CPU et une expérience de découpage des dépendances publiques avant de garder des modulepreload Low.
- **Fine Bindery /en :** LCP = planche Ferrière dans les trois passages de branche, 27 962 octets et priorité High ; le titre était aussi candidat avant. Priorité au JS inutilisé (environ 35,8 ko) et au coût de rendu après chargement, puis à un sizes plus précis si la netteté le permet. La même image économisable de 15,7 ko n'a **aucun gain LCP médian estimé**. CSS/police jouent sur le premier affichage ; le gain de police à rendu identique reste non démontré.

**Police et cache, sur les cinq pages :** font-display est déjà swap et font-display-insight ne propose aucun gain de ce réglage. La police est déjà preload High dans la branche ; répéter ce réglage n'est pas un nouveau levier. Le cache peut aider une visite chaude, mais le protocole à profil neuf n'en bénéficie pas : **0 ms attendu au premier accès froid** du seul changement de cache. Une réduction réelle des octets de police nécessite une expérience isolée, avec contrôle de caractères, contours et retours à la ligne ; aucun gain en millisecondes n'est validé aujourd'hui.

La piste de travail suivante recommandée est donc **un découpage mesuré du JS chargé par les pages publiques**, sur une branche distincte avec interactions précoces couvertes, plutôt qu'un nouveau report général de React. Les estimations LCP du JS restent de quelques centaines de millisecondes ; elles n'autorisent pas à promettre seules les 0,63 à 1,78 s manquantes.

---

# Performance mobile — mesures terminées le 21 octobre 2026

**Objectif LCP < 2,5 s non atteint sur les cinq pages.** Le premier affichage arrive plus tôt, mais le LCP reste entre 3,13 et 4,27 s et le temps de blocage augmente notamment sur la page partenaires. Cette PR ne résout pas l'objectif annoncé ; les changements et leurs limites sont soumis à revue, sans fusion ni déploiement.

## Protocole et sources

Lighthouse **13.5.0**, Chrome **151.0.7922.34**, Puppeteer **25.15.0**, Wrangler **4.151.3**. Build réel `node scripts/buildMaReliure.mjs`, servi localement, aucun serveur Vite pendant les mesures. Mobile 412 × 823, DPR 1,75, simulation mobile Lighthouse par défaut (CPU ×4, RTT 150 ms), profil Chrome neuf et cache froid à chaque passage. Même script, options, navigateur et méthode pour les deux sources : **trois passages par page, médiane, 30 mesures retenues**. Aucune sélection du meilleur passage.

Référence publique `abfe72b` ; branche mesurée `c5ba309e7a534b486f9873557a50f56badc09b4b`, actualisée sur `main 11d292f`, avec #156 et #160. Les évolutions externes de main postérieures à cette source ne sont pas assimilées à une mesure de cette version. La comparaison visuelle confirme les contenus FR/EN des cinq pages identiques entre les deux sources.

Mesures de branche : **21/10 12:20–12:27 UTC** ; référence remesurée **12:31–12:36 UTC** dans la même séance. « Avant/après » désigne les versions, pas leur ordre temporel. L'ancienne référence du 20/10 est écartée : son benchmark CPU médian était très différent. Ici les médianes de calibrage vont de 1 808,5 à 1 948 ; détails par passage dans [results.json](mobile-lcp-20261020/results.json). Aucun autre build, suite de tests ou navigateur de recette en parallèle des mesures retenues. Les réglages complets, ressources, nœuds LCP, empreintes des rapports bruts et script exécuté y sont conservés.

Toutes les requêtes externes, track-view et méthodes autres que GET/HEAD/OPTIONS sont interceptées avant envoi. Worker local sans clé service, URL serveur Supabase locale injoignable ; aucune liaison distante. Fine Bindery a d'abord subi un verrou SQLite local et un refus de connexion : **aucune métrique de cette erreur retenue**. Son lot complet de trois passages a été rejoué avec un stockage SQLite distinct, après vérification HTTP 200. Les quatre autres pages gardent leurs trois passages valides.

## Résultats

| Page | LCP référence | LCP branche | Dépassement de 2 500 ms | Score performance |
| --- | --- | --- | --- | --- |
| Ma Reliure / | 3,66 s | 3,73 s | +1233 ms | 84 → 85 |
| /tarifs | 3,58 s | 3,41 s | +915 ms | 84 → 92 |
| /reparation-de-livres | 3,43 s | 3,13 s | +630 ms | 87 → 94 |
| /partenaires-relieurs | 3,59 s | 3,57 s | +1069 ms | 84 → 86 |
| Fine Bindery /en | 4,21 s | 4,27 s | +1775 ms | 80 → 84 |

| Page | Premier affichage (FCP) référence → branche | Blocage (TBT) référence → branche |
| --- | --- | --- |
| Ma Reliure / | 3,14 → 1,35 s | 10 → 69 ms |
| /tarifs | 3,05 → 0,96 s | 4 → 51 ms |
| /reparation-de-livres | 2,84 → 0,95 s | 8 → 19 ms |
| /partenaires-relieurs | 3,14 → 0,94 s | 6 → 229 ms |
| Fine Bindery /en | 3,19 → 1,71 s | 13 → 95 ms |

CLS médian 0 et accessibilité Lighthouse 100 pour les dix couples page/version. Trois passages restent un petit échantillon ; ils ne démontrent pas une significativité statistique ni des Core Web Vitals terrain. L'amélioration du FCP ne doit pas masquer le LCP encore trop élevé et la hausse du TBT.

## Ressource LCP et retard observé

- **Accueil Ma Reliure :** le titre peut être le LCP ; deux passages de branche retiennent la planche Ferrière, `ferriere-baudelaire-800.webp`, 27 962 octets. L'image passe effectivement de Low à High et est découverte comme preload. Le texte reste dépendant de la police et du rendu ; le dernier candidat LCP arrive encore tard.
- **/tarifs et /reparation-de-livres :** le paragraphe d'introduction est le LCP, pas une image. Sa police et le rendu initial comptent davantage qu'un nouvel encodage d'image. La CSS est VeryHigh, la police High ; relever la priorité des images ne suffit donc pas.
- **/partenaires-relieurs :** le H1 est le LCP dans les six passages. Les captures de l'outil ne sont pas le LCP retenu. Le TBT médian passe de 5,5 à 228,5 ms : piste de réactivité à examiner avant une généralisation de la priorité basse des modules.
- **Fine Bindery /en :** le titre et la même planche sont candidats ; les trois passages de branche retiennent la planche. Le preload responsive reprend exactement le srcset/sizes existant. La ressource devient High et préchargée, mais son affichage reste tardif.

Les tableaux de décomposition fournis par Lighthouse sont des observations de trace ; leurs durées ne sont pas additionnées au LCP simulé comme s'il s'agissait de la même horloge. Aucun chiffre de laboratoire n'est présenté comme une mesure de production.

## Changement conservé et pistes écartées

`PerformanceHead` place CSS, police et images critiques avant les modulepreload, avec priorité basse pour ces derniers, uniquement sur les cinq chemins. L'API React `precedence` empêche le hoisting des modules de repasser devant la CSS ; nonce, métadonnées et JSON-LD sont conservés. Ajout du preload responsive commun aux deux accueils, priorité explicite de la police, cache police d'un jour avec stale-while-revalidate d'une semaine. Le cache immuable des assets à nom haché existait déjà ; le cache HTML n'est pas modifié.

La police originale Fraunces **67 304 octets**, ses contours, le CSS, les images et leurs tailles restent identiques. `font-display: swap` et le srcset existaient déjà. L'essai AVIF q80 produisait 41 474 octets contre 27 962 en WebP ; il n'est pas retenu, sans prétendre qu'aucun autre encodage ne puisse faire mieux. Les essais de police dérivée et de CSS en ligne sont également retirés.

Le report du chargement de React après le premier affichage a été **retiré** : un test réel avec téléchargement du runtime retenu reproduisait la perte d'un clic précoce sur le choix de savoir-faire. Aucun mécanisme de capture/rejeu ni adaptation de champs n'est livré. `src/client.ts` personnalisé supprimé, entrée native TanStack restaurée, `lib/hydration.ts` et PartnersLanding identiques à main. Aucune métrique issue de cet essai n'entre dans les tableaux ci-dessus.

Le découpage réel du JavaScript reste à traiter. Le chunk index reste de l'ordre de **96 ko gzip** (324 096 octets bruts dans le build mesuré), sans réduction revendiquée du volume initial. Transferts réseau JS observés, distincts d'une mesure statique gzip :

| Page | Total JS transféré référence → branche |
| --- | --- |
| Ma Reliure / | 191 → 193 ko |
| /tarifs | 188 → 189 ko |
| /reparation-de-livres | 188 → 190 ko |
| /partenaires-relieurs | 191 → 192 ko |
| Fine Bindery /en | 193 → 194 ko |

La prochaine amélioration substantielle nécessite de réduire le travail/les dépendances du premier chargement, avec une recette des interactions précoces ; les seuls hints réseau ne suffisent pas. Les fichiers réservés Fine Bindery/i18n/routes localisées ne sont pas modifiés par cette PR.

## Compatibilité #156, rendu et vérifications

Les routes `/m/:publicToken` et `/:locale/project` ne font pas partie de la liste optimisée : elles gardent HeadContent natif. Leurs pendingComponent et MissionRuntimePending restent présents ; l'entrée client, `markHydrated`, la navigation avant hydratation et la configuration Vite sont byte pour byte identiques à main 11d292f. **Sept tests ciblés réussis**, dont ces deux routes. Il s'agit d'une vérification de code et de rendu du head, pas d'un appel de runtime de production.

Dix comparaisons navigateur (cinq pages × mobile/bureau) : **0 changement de texte, retours à la ligne ou géométrie**, mêmes titres/langues/métadonnées/JSON-LD, aucune image cassée. Accueils mobiles inspectés visuellement : [Ma Reliure avant](mobile-lcp-20261020/before-home-mobile.png)/[après](mobile-lcp-20261020/after-home-mobile.png), [Fine Bindery avant](mobile-lcp-20261020/before-finebindery-mobile.png)/[après](mobile-lcp-20261020/after-finebindery-mobile.png). Les images PNG complètes Fine Bindery mobile ont des métadonnées brutes différentes ; le comparateur n'a pas calculé leur différence pixel et ce cas est explicitement null dans le JSON. Aucune identité pixel complète n'est revendiquée pour ce cas.

**Suite complète en CI : 315 fichiers / 3 853 tests**, typecheck réussi, lint sans erreur et 19 avertissements existants, build Vite réussi ([quality](https://github.com/antoineferriere2-star/mareliure/actions/runs/39598808666)). Build Ma Reliure local réussi avec contrôle des bundles client/serveur. `npm run test:e2e:customer` local final : **4/4 en 3,9 minutes**, FR/EN bureau et iframe 375 px réels, server functions simulées ; [CI client](https://github.com/antoineferriere2-star/mareliure/actions/runs/39598808750) également verte. Pas de nouvelle vérification axe-core indépendante dans ce chantier.

Incident local antérieur, déjà signalé au propriétaire : pendant les essais du brief 7, l'emploi d'un PID périmé a arrêté par erreur un processus de contenu Firefox. Une interruption d'onglet est possible ; aucun état de cet onglet n'a été certifié ensuite. Cet incident précède les mesures retenues. Les arrêts suivants utilisent identité fraîche, date de création et handle détenu du seul processus de recette.

Aucune écriture de production, migration, achat, paiement, compte, e-mail, fusion de PR ni déploiement effectué par ce chantier. **Mesures et recette terminées ; objectif LCP explicitement non atteint.**

Actualisation finale de la branche sur **main 38ebd31**, après les mesures. #161 a ajouté le guide photo des pages par besoin ; cette évolution externe est intégrée pour éviter une branche obsolète, mais ne fait pas partie de la source c5ba309 mesurée. Les contrôles CI de la tête finale restent distincts des trente mesures de cette source.
