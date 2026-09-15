# Modèle commercial, pricing et facturation — Ma Reliure / Fine Bindery

> Document de référence pour le chantier ouvert le 15 septembre 2026 (audit
> puis Phase 1). Décrit l'état réel du code, pas une cible aspirationnelle —
> ce qui n'existe pas encore est marqué explicitement `NON CONSTRUIT`.

## 1. Modèle commercial et juridique

Une seule société exploite deux marques commerciales, sur un seul backend :

```
CLIENT
  │  achète une prestation de reliure/restauration
  ▼
MA RELIURE / FINE BINDERY   (une seule société)
  │  achète séparément une prestation artisanale
  ▼
ATELIER PARTENAIRE
```

Le client ne contracte jamais avec l'atelier. Ma Reliure/Fine Bindery fixe
le prix client, encaisse (à terme, voir §9), reste responsable de la
relation commerciale, et rémunère l'atelier séparément. **Ce n'est pas une
commission sur une vente entre client et atelier** — le mot ne doit plus
désigner le revenu de la plateforme dans le code, les commentaires ou les
commits. Le vocabulaire imposé : prix client (`customer_service_price`),
coût/rémunération atelier (`binder_payout`), marge brute (`gross_margin`),
contribution (`contribution`).

`brand` (`MA_RELIURE` | `FINE_BINDERY`) est fixé une seule fois à la
création d'un dossier (`marketplace_cases.brand`, trigger d'immuabilité,
migration `20260916090000`) et ne change jamais ensuite.

## 2. Deux lignes, deux responsabilités

- **`marketplace_cases`** — la projection courante d'un dossier : où il en
  est, la dernière suggestion ou le dernier prix enregistré. Mutable tant
  que rien n'est figé.
- **`marketplace_commercial_proposals`** (nouvelle, migration
  `20260916100000`) — l'engagement commercial. Chaque ligne est UNE version
  figée d'une proposition pour un dossier. Avant acceptation, une nouvelle
  version peut en remplacer une autre (`status: superseded`). Une fois
  `accepted_at` posé, la ligne devient immuable — un trigger Postgres
  (`marketplace_commercial_proposals_immutable_after_acceptance`) refuse
  tout `UPDATE` ultérieur, pas seulement une convention côté serveur. Un
  changement nécessaire après acceptation crée une nouvelle version
  (amendment), jamais une écriture sur la ligne acceptée.

**Ne jamais lire `marketplace_cases` comme source contractuelle une fois
qu'une proposition est acceptée.** La source contractuelle devient alors
`marketplace_commercial_proposals` (la ligne dont `accepted_at IS NOT
NULL`, garanti unique par dossier par un index partiel).

## 3. Pricing — le calcul du prix client

Le moteur (`src/marketplace/pricing/pricing.engine.ts`) additionne les
rémunérations de référence par travail (`rateCard.ts`, grilles réellement
saisies par des ateliers — jamais un montant inventé, voir
`noFabricatedPrices.test.ts`), puis calcule le prix client via
`resolveServicePriceFloors` (`pricebook.ts`) :

```
customer_service_price_ht =
  MAX(
    pricebook_reference_ht,     -- NON CONSTRUIT : voir §3.1
    minimum_price_by_margin,    -- binder_payout_ht / (1 - target_margin_rate)
    minimum_price_by_contribution  -- binder_payout_ht + minimum_contribution_ht
  )
```

`targetMarginBps` et `minimumContributionCents` sont deux garde-fous
distincts, jamais confondus (`PricingPolicy`, `pricing.types.ts`) : le
premier borne une part du prix, le second un montant absolu. Avant le 15
septembre 2026, seul le premier existait dans le calcul — un petit projet
pouvait rendre moins que ce que l'activité doit toucher en valeur absolue.

### 3.1 Pricebook — statut réel

`marketplace_pricebook` existe et sert la détection de dérive
(`detectDrift`, écran admin) : elle compare une référence publiée par
travail à la médiane terrain constatée. **Elle n'est pas encore relue par
dossier** au moment du chiffrage — `pricebookReferenceCents` vaut toujours
`null` dans `PricingSuggestion` et dans les propositions commerciales
créées aujourd'hui. Câbler cette lecture (sommer les entrées Pricebook
correspondant aux travaux d'un dossier, comme `lookupAggregate` le fait déjà
pour les rémunérations) est un chantier distinct, volontairement hors de
cette phase — le MAX est prêt à recevoir ce troisième candidat sans nouveau
changement de forme le jour où c'est fait.

### 3.2 Fine Bindery — le multiplicateur de marque

`applyBrandServicePricing` (`brandPricing.ts`, **inchangé** dans cette
phase) multiplie le prix Ma Reliure déjà plafonné par
`serviceMultiplierBps` (10 000 = ×1,00 pour Ma Reliure, 13 000 = ×1,30 pour
Fine Bindery, `brandConfig.ts`). Ce multiplicateur :

- ne s'applique **jamais** à `binder_payout_cents` — l'atelier est payé
  pareil, quelle que soit la marque qui a vendu le projet ;
- ne s'applique **jamais** au shipping ;
- s'applique uniquement au prix service, dans `applyBrandServicePricing`.

## 4. Shipping

Colonnes ajoutées sur `marketplace_commercial_proposals` :
`shipping_outbound_cents`, `shipping_return_cents`, `shipping_other_cents`,
`shipping_total_cents`, `shipping_margin_cents`, `shipping_handling_fee_cents`.

**P0 : `shipping_margin_cents` et `shipping_handling_fee_cents` valent
toujours 0.** Rien ne les calcule encore — les colonnes existent pour ne
pas redemander une migration le jour où une décision commerciale leur
donne une valeur. `buildCommercialProposalSnapshot` garantit que le
multiplicateur de marque ne touche jamais un montant de shipping : le
shipping est saisi et stocké indépendamment du calcul du prix service.

**NON CONSTRUIT** : intégration transporteur, tarification automatique du
transport.

## 5. Fiscalité

`tax_policy` vaut toujours `TAX_REVIEW_REQUIRED` (`brandPricing.ts`,
inchangé). Aucun moteur fiscal n'existe pour aucune des deux marques. Le
snapshot conserve `customer_vat_rate_bps`/`customer_vat_amount_cents`/
`customer_total_ttc_cents`, tous `null` tant que la politique reste en
revue — jamais un TTC calculé sur un taux non validé. Le système reste
HT-first : `customer_total_ht_cents` est toujours connu, `_ttc_cents` ne
l'est que si un taux a été validé.

**NON CONSTRUIT** : `FR_STANDARD`, `EU_CONSUMER`, `NON_EU_REVIEW`,
`EXEMPT_CONFIRMED` — le type `CommercialTaxPolicy` reste ouvert pour ces
valeurs futures, aucune n'est implémentée. Corollaire : rien dans ce
chantier ne bloque un Checkout sur `MANUAL_TAX_REVIEW`, puisque le Checkout
lui-même n'existe pas encore (§9).

## 6. Modes de pricing

`FIXED_PRICE` / `ESTIMATE_THEN_CONFIRM` / `MANUAL_STUDY`
(`pricingMode.ts`, inchangé) — dérivés de la confiance du chiffrage, jamais
un nouveau seuil. Une proposition ESTIMATE_THEN_CONFIRM conserve
`estimate_min_cents`/`estimate_max_cents` ; un prix définitif confirmé
après examen physique devient sa propre version, jamais une réécriture de
l'estimation.

## 7. Acompte

`depositCentsFor` (`pricingMode.ts`, inchangé) calcule le montant. Le
snapshot conserve la politique **réellement appliquée** au moment de
l'offre (`deposit_type`, `deposit_value_bps`, `deposit_amount_cents`) —
une évolution future de la règle d'acompte ne doit jamais changer une
proposition déjà figée.

## 8. Admin

`CaseMatchingPage.tsx` affiche désormais (panneau « Économie ») : marque,
multiplicateur, prix Ma Reliure avant marque, rémunération atelier, marge
cible, contribution minimale, prix client service, marge brute (montant et
taux), statut fiscal. Un panneau « Proposition commerciale » liste les
versions figées d'un dossier et permet de créer une nouvelle version ou
d'accepter la dernière proposée — réservé à l'administration dans cette
phase (§9).

## 9. Stripe — état réel, rien construit dans cette phase

**Aucune intégration Stripe n'existe pour Ma Reliure/Fine Bindery.** Le
seul client Stripe du dépôt (`src/lib/stripe.server.ts`) passe par la
gateway Lovable et est scopé au projet Supabase de Métré Build — le Worker
`mareliure` n'a aucun secret Stripe configuré. Il n'y a ni Checkout, ni
Stripe Connect, ni webhook, ni transfert atelier pour la marketplace.
« Accepter » une proposition commerciale, dans cette phase, est une action
admin (équivalent de `marketplace_validate_pricing` pour la nouvelle
couche) — aucun parcours client ne déclenche encore une acceptation ni un
paiement lui-même.

Le connecteur MCP Stripe a été relié à ce compte le 15 septembre 2026
(accès de préparation) mais aucune capacité d'écriture n'a été utilisée :
aucun Product, Checkout, compte Connect ou transfert n'a été créé. La
Phase Stripe (Products permanents, Separate Charges and Transfers, 80/20,
webhooks) reste à auditer et cadrer séparément, en particulier la question
laissée ouverte : garder le client `stripe.server.ts`/gateway Lovable
existant, ou en établir un propre à la marketplace — décision à prendre au
début de cette phase, pas avant.

## 10. Ce qui n'a pas changé, volontairement

- Le catalogue de travaux, les grilles ateliers (`rateCard.ts`), le
  résolveur de travail (`workResolver.ts`) — inchangés.
- `brandPricing.ts` — le mécanisme de multiplicateur reste exactement celui
  qui existait, appliqué désormais à un prix Ma Reliure mieux plafonné.
- Le 80/20 atelier reste une politique documentée, non implémentée (aucun
  Stripe Connect).
