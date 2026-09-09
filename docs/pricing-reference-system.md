# Le référentiel tarifaire de Ma Reliure

> État au 9 septembre 2026. Le référentiel est **vide** : aucun tarif n'a
> encore été relevé auprès d'un relieur réel. Le moteur refuse donc de chiffrer
> et chaque projet part en revue manuelle. C'est le comportement voulu.

---

## 1. Le problème que ce système résout

Le premier moteur tarifaire portait une quinzaine de montants codés en dur :
140 € pour une réparation, 200 € pour une belle reliure, 80 € pour un
demi-cuir. Ils avaient été posés pour que le calcul produise quelque chose.
Aucun relieur ne les avait jamais vus.

Rien dans le code ne les distinguait d'un tarif relevé sur le terrain : même
type, même colonne, même affichage, même confiance « haute ». Le seul rempart
était qu'un administrateur devait valider avant qu'un client voie le prix — et
un chiffre bien présenté, avec sa marge et sa décomposition, se valide.

Le système décrit ici sépare trois choses qui étaient confondues.

| Objet                 | Nature                                          | Table                      |
| --------------------- | ----------------------------------------------- | -------------------------- |
| Catalogue des travaux | Ce que le métier sait faire                     | `marketplace_work_items`   |
| Grilles des relieurs  | Ce que chaque atelier demande — **observation** | `marketplace_binder_rates` |
| Pricebook Ma Reliure  | Ce que nous payons et vendons — **décision**    | `marketplace_pricebook`    |

---

## 2. La règle centrale

**Le moteur ne contient aucun montant.**

C'est vérifié par un test qui lit le texte des fichiers
(`noFabricatedPrices.test.ts`), parce que la faute d'origine était facile à
commettre et invisible à la relecture.

Les montants n'ont qu'une origine : les grilles des artisans. Quand elles ne
couvrent pas un projet, le moteur ne dégrade pas sa réponse — il rend
`manual_review` et ne produit aucun chiffre.

> Un prix absent se rattrape par un coup de téléphone. Un prix faux se
> rattrape beaucoup plus mal.

Ce que Ma Reliure décide lui appartient et reste dans `PRICING_POLICY` : marge
cible (18 %), marge plancher (15 %), arrondi (10 €). **Décider sa marge n'est
pas inventer un tarif.**

---

## 3. Provenance

Chaque montant porte sa provenance. Deux questions indépendantes s'y jouent, et
les confondre serait une erreur.

| Provenance        | Vendable au client | Compte comme référence de marché |
| ----------------- | ------------------ | -------------------------------- |
| `REAL_VERIFIED`   | oui                | **oui**                          |
| `ADMIN_VALIDATED` | oui                | non                              |
| `DEMO`            | non                | non                              |
| `PLACEHOLDER`     | non                | non                              |
| `TEST_ONLY`       | non                | non (sauf opt-in explicite)      |

`ADMIN_VALIDATED` peut être vendu mais ne compte pas dans une médiane : un prix
décidé par Ma Reliure est une décision, pas une observation. L'inclure
reviendrait à se citer soi-même comme source et à confirmer ses propres
hypothèses.

`TEST_ONLY` relève d'une autre question — environnement, pas épistémologie. Le
jeu d'essai n'agrège que si `MARKETPLACE_ALLOW_TEST_RATES=true` **et** que
l'environnement n'est pas marqué production. Deux verrous, parce qu'un `.env`
copié d'un environnement à l'autre est l'accident le plus banal du métier.

---

## 4. Le pipeline

```
réponses structurées Métré
  → travaux identifiés          workResolver.ts
  → tarifs de référence         rateCard.ts (agrégation)
  → rémunération suggérée       somme des médianes
  → prix client suggéré         marge cible + arrondi
  → fourchette                  somme des min / somme des max déclarés
  → confiance                   confidence.ts
  → validation humaine          l'administration, jamais le moteur
```

Le moteur ne lit **jamais** une phrase du Project Brief. Le Brief est écrit
pour une personne ; le reformuler casserait silencieusement le chiffrage. Seules
les réponses structurées comptent, via `CASE_ANSWER_VALUES`, dont un test de
contrat vérifie qu'elles existent encore dans le Playbook.

### La fourchette

Elle vient du minimum et du maximum réellement déclarés par les ateliers,
jamais d'un pourcentage appliqué autour de la médiane.

### L'approximation, jamais le coefficient

Exiger la correspondance exacte (travail × format × complexité) rendrait le
système inutilisable : personne ne remplit 500 lignes en vingt minutes. Le
moteur se rabat donc sur la classe courante — **sans appliquer le moindre
coefficient**. Majorer de 10 % pour un grand format serait exactement le geste
qu'on vient de bannir. L'approximation est déclarée (`approximated: true`),
elle coûte des points de confiance, elle n'est pas compensée.

---

## 5. La confiance

Elle se calculait sur le nombre de réponses du visiteur. « Haute » voulait donc
dire « le parcours est bien rempli », pas « nous savons ce que ce travail
coûte » — et c'est précisément là qu'un prix inventé devient dangereux.

Elle porte maintenant sur ce qui la fonde :

| Note            | Condition                                          |
| --------------- | -------------------------------------------------- |
| `high`          | 6 ateliers ou plus sur le travail le moins couvert |
| `medium`        | 3 à 5 ateliers                                     |
| `low`           | 1 ou 2 ateliers — validation artisan recommandée   |
| `manual_review` | refus de chiffrer                                  |

Puis elle **descend** — jamais elle ne remonte — en cas de donnée de plus de
18 mois, de dispersion supérieure à 80 %, ou d'informations manquantes.

`manual_review` est déclenché sans rattrapage possible par : un travail non
tarifé, un travail sur étude (patrimonial, création), un ouvrage patrimonial,
ou aucun travail identifié.

---

## 6. Agrégation

Deux règles portent tout le sens.

**Un atelier, une voix.** Un relieur ayant saisi trois lignes pour le même
travail ne pèse pas trois fois : on retient la plus récente. Sans cela, le plus
bavard fixerait le prix du marché.

**Seul le terrain compte.** `countsAsReference` filtre sur `REAL_VERIFIED`.

Deux seuils :

- **3 ateliers** (`PUBLISHABLE_MINIMUM_REFERENCES`) avant qu'une fourchette
  puisse être présentée comme un ordre de grandeur du métier. En dessous il n'y
  a pas de milieu, et un artisan atypique déplace tout.
- **5 ateliers** (`QUARTILE_MINIMUM_REFERENCES`) avant d'afficher des
  quartiles. Un premier quartile sur trois valeurs est une précision inventée.

La médiane prime toujours sur la moyenne.

---

## 7. Le Pricebook ne se recalibre jamais seul

Qu'un relieur monte ses tarifs ne doit pas changer le prix affiché à un client.
Cela doit **alerter quelqu'un**.

`detectDrift` produit ce signal et rien d'autre : aucune écriture, aucune
nouvelle entrée. Seuils à 10 % (surveiller) et 20 % (agir). La validation reste
un geste humain, tracé par `validated_at` / `validated_by`.

Une entrée publiée est immuable : on en publie une nouvelle et l'ancienne passe
en `retired`. Même discipline que les versions de Playbook, et pour la même
raison — il faut pouvoir dire quel prix était en vigueur le jour d'une commande.

---

## 8. Le refus d'un atelier comme signal

Après un refus pour rémunération insuffisante, l'atelier peut indiquer à quel
montant il aurait accepté (`minimum_required_payout_cents`).

C'est la donnée la plus honnête du système : révélée par une décision réelle
plutôt que déclarée dans un entretien. Elle est enregistrée à côté de la
réponse, n'a **aucun effet** sur l'issue de l'offre, et ne modifie **jamais**
le Pricebook automatiquement.

---

## 9. La session tarifaire

`Admin → Tarifs → [un atelier] → sa grille`, ou depuis la liste des relieurs.

Tout l'écran est plié à une contrainte : vingt minutes, en face de quelqu'un.

- Travaux groupés par famille et repliés.
- Trois montants par ligne — min / courant / max — parce que c'est ainsi qu'un
  artisan parle. Seul le courant est requis ; les deux autres se complètent
  avec lui.
- Format et complexité s'appliquent à toute la saisie : on remplit une grille
  « format courant » d'un bout à l'autre, puis on repasse en grand format si
  l'atelier distingue les deux. Le demander ligne par ligne doublerait le temps.
- Rien n'est obligatoire. Une grille à moitié remplie est utile.

**La case « entendu »** fait passer la ligne en `REAL_VERIFIED`. C'est la seule
chose qui compte vraiment, et elle n'est jamais cochée d'avance. Une contrainte
SQL empêche `REAL_VERIFIED` sans `verified_at` et `verified_by` : sans elle,
ce serait une case à cocher et la traçabilité une intention.

Une ligne n'est jamais modifiée en place : elle passe en `superseded` et une
nouvelle est écrite. Savoir qu'un atelier a monté ses tarifs de 15 % en un an
vaut plus que connaître son tarif du jour.

---

## 10. Ce qui est visible du client

Rien de ce document.

Le client ne voit un prix qu'une fois `pricing_status = 'validated'` — le
serveur ne renvoie même pas les autres. Sinon il lit « Votre projet est en
cours d'étude », parce qu'un chiffre lu une fois devient une promesse et que
personne ne retient qu'il était provisoire.

La décomposition (rémunération atelier, marge, nombre de références) est
strictement réservée à l'administration. L'atelier, lui, voit sa rémunération
et jamais le budget annoncé par le client.

`/tarifs` n'affiche aucun montant. Elle explique ce qui fait le prix — l'état
d'abord, la matière ensuite, ce qui est contre-intuitif et vrai. Aucune donnée
structurée `Offer` n'y est déclarée : annoncer un prix à un moteur de recherche
est un engagement, pas une optimisation.

---

## 11. Prochaine étape

Le référentiel est vide. La priorité n'est pas du code, c'est une conversation :
s'asseoir avec un relieur et remplir sa grille.

Le premier atelier à interroger est **Reliure Dorure Ferrière** (Orléans), déjà
présent sur la plateforme. Trois ateliers suffisent à faire fonctionner le
moteur sur les travaux courants ; six à le rendre confiant.

Un jeu d'essai reproduit le cas de la Phase 25 — demi-cuir à 320 / 350 / 410 €,
médiane 350 € — dans `testReferences.fixture.ts` et dans le seed de
démonstration. Il est marqué `TEST_ONLY` et n'atteint jamais la production.
