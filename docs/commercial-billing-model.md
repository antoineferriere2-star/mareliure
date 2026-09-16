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
`minimumContributionCents` vaut **80 € HT** depuis le 16 septembre 2026
(décision commerciale ; même plancher absolu pour les deux marques —
Fine Bindery multiplie au-dessus, ne le remplace pas), configurable dans
`PRICING_POLICY`, jamais en dur dans le moteur.

### 3.1 Pricebook — câblé dossier par dossier depuis le 16 septembre 2026

`marketplace_pricebook` sert toujours la détection de dérive (`detectDrift`,
écran admin) et sert désormais aussi de troisième candidat du MAX :
`lookupPricebookReference` (`pricebook.ts`) applique aux entrées **publiées**
la même cascade que `lookupAggregate` sur les grilles atelier (exact, puis
format ou complexité standard, jamais un coefficient) et somme leur
`customerPriceCents` pour les travaux du dossier. **Jamais une somme
partielle** : si un seul travail du dossier n'a aucune entrée publiée,
`pricebookReferenceCents` reste `null`, exactement comme avant ce câblage.

Branché dans `suggestManagedPrice` (`generateMarketplacePricing`, à partir
des grilles + du Pricebook chargés ensemble) et recalculé à l'identique
dans `createCommercialProposal` (`resolveWork` sur le profil du dossier,
comme le fait déjà le moteur — jamais une seconde source de vérité). La
provenance (quelles entrées, quelle version, quel prix publié) est gelée
sur la proposition (`pricebook_provenance`, migration `20260916110000`)
pour pouvoir expliquer a posteriori : Pricebook → coefficient de marque →
garde-fou marge → garde-fou contribution → prix client, sans recalculer.

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

`CaseMatchingPage.tsx` affiche (panneau « Économie », réorganisé le 16
septembre 2026 en six blocs, dans l'ordre où le prix se construit) :
Pricebook (référence HT), Marque (marque, multiplicateur, référence
Pricebook × marque — le +30 % Fine Bindery est explicitement annoté comme
une Brand Pricing Policy), Atelier (rémunération), Garde-fous (marge
cible, contribution minimale, quel candidat a gagné le MAX), Client (prix
service suggéré), Économie (marge brute € et %). Un panneau « Proposition
commerciale » liste les versions figées d'un dossier et permet de créer une
nouvelle version ou d'accepter la dernière proposée — réservé à
l'administration dans cette phase (§9).

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
aucun Product, Checkout, compte Connect ou transfert n'a été créé.

**Audit read-only du 16 septembre 2026 — arrêté avant de lire quoi que ce
soit.** `list_available_accounts_or_orgs` ne renvoie qu'un seul compte :
`acct_1S530YKEMCwyPCrw` (« oppe.fr »), **`livemode: true`** — aucun compte
sandbox/test n'est exposé par ce connecteur. Deux problèmes, pas un seul :
la demande explicite portait sur le Sandbox/Test, jamais sur du live ; et
rien ne confirme que ce compte Stripe (« oppe.fr ») soit même celui de Ma
Reliure/Fine Bindery plutôt qu'un compte personnel ou d'un autre projet
(voir §K de `CODEX_HANDOFF.md` : plusieurs organisations GitHub coexistent
déjà pour des raisons similaires). Lire ses Products/Checkout/Connect en
serait une hypothèse non vérifiée. Aucun appel `stripe_api_read` n'a donc
été fait — à reprendre uniquement après que l'utilisateur ait confirmé
quel compte/mode le connecteur doit exposer.

La Phase Stripe (Products permanents, Separate Charges and Transfers,
80/20, webhooks) reste à auditer et cadrer séparément, en particulier la
question laissée ouverte : garder le client `stripe.server.ts`/gateway
Lovable existant, ou en établir un propre à la marketplace — décision à
prendre au début de cette phase, pas avant, et seulement une fois le bon
compte/mode confirmé.

## 10. Ce qui n'a pas changé, volontairement

- Le catalogue de travaux, les grilles ateliers (`rateCard.ts`), le
  résolveur de travail (`workResolver.ts`) — inchangés.
- `brandPricing.ts` — le mécanisme de multiplicateur reste exactement celui
  qui existait, appliqué désormais à un prix Ma Reliure mieux plafonné.
- Le 80/20 atelier reste une politique documentée, non implémentée (aucun
  Stripe Connect).
