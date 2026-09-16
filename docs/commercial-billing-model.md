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

## 9. Stripe — live, Phase 1 (Products, Checkout, webhook, Connect préparés)

**Trois comptes Stripe distincts — ne jamais les confondre :**

```
LEGACY_ACCOUNT_ID = acct_1S530YKEMCwyPCrw   # "Oppe" — Métré/AccessBot/BatiScores/MuWo/Securicom
                                              # INTERDIT pour Ma Reliure/Fine Bindery, en toute circonstance
LIVE_ACCOUNT_ID   = acct_1UGI34K0Q47WbZPf   # compte live DÉDIÉ Ma Reliure/Fine Bindery — seule cible de production
TEST_ACCOUNT_ID   = acct_1UGISJKB3EBc6Slh   # "environnement de test Mareliure/finebindery" — développement local UNIQUEMENT
```

**Décision explicite de l'utilisateur, NO SANDBOX pour la production** :
tout Checkout/Invoice/Refund/Connect/Transfer réel doit passer par
`LIVE_ACCOUNT_ID`, jamais `LEGACY_ACCOUNT_ID` ni `TEST_ACCOUNT_ID`. Le
Worker Cloudflare de production porte `STRIPE_EXPECTED_ACCOUNT_ID=
acct_1UGI34K0Q47WbZPf` ; `assertExpectedStripeAccount`
(`stripeClient.server.ts`) refuse (fail closed) toute écriture si la clé
posée répond pour un autre compte — vérifié en conditions réelles (mismatch
délibéré → refus), voir `CODEX_HANDOFF.md`.

**Client Stripe dédié** : `src/marketplace/stripe/stripeClient.server.ts`,
séparé de `src/lib/stripe.server.ts` (gateway Lovable, abonnements SaaS
Métré — aucune capacité Connect, aucun rapport avec la marketplace). Une
vraie clé secrète (`STRIPE_SECRET_KEY`), jamais la passerelle Lovable.

**Construit** :
- Trois Products permanents (idempotents par metadata,
  `scripts/setupStripeProducts.ts`) — jamais de Price Stripe fixe, le
  montant reste toujours `price_data` dynamique depuis le snapshot
  commercial. Créés sur `TEST_ACCOUNT_ID` pour le développement local
  (`prod_VGqVa0gxBdKMFv`/`prod_VGqV9v0VrlqutW`/`prod_VGqVuC29bc1dgv`) ;
  **à recréer séparément sur `LIVE_ACCOUNT_ID`** avant tout premier
  paiement réel — voir `CODEX_HANDOFF.md` pour l'état exact de cette
  étape. Trois autres Product IDs existent sur `LEGACY_ACCOUNT_ID`
  (`prod_VGowujXB5VAtLN`/`prod_VGoxLIJgDWDx7c`/`prod_VGoxkLqYmwcFm6`,
  créés avant la décision de dédier un compte séparé) — **toujours
  présents dans les secrets du Worker de production au moment d'écrire
  ceci**, à remplacer par les IDs `LIVE_ACCOUNT_ID` dès que le connecteur
  MCP est reconnecté dessus (voir `CODEX_HANDOFF.md`, bloquant), puis à
  archiver sur `LEGACY_ACCOUNT_ID` sur confirmation explicite (jamais
  avant).
- `createCommercialCheckoutSession` (`checkoutSession.server.ts`) :
  recharge la proposition **acceptée**, seule source du montant — jamais
  une valeur du navigateur. `checkoutPlan.ts` (pur, testé) bloque tant que
  `tax_policy` vaut `TAX_REVIEW_REQUIRED` (toujours vrai aujourd'hui,
  aucun moteur fiscal construit) : **le premier vrai paiement ne peut donc
  pas encore avoir lieu**, par construction, pas par bug.
- Webhook `POST /api/marketplace/stripe-webhook` : signature vérifiée
  avant toute lecture, idempotent par `event.id`
  (`marketplace_stripe_webhook_events`), ignore tout paiement sans notre
  metadata (les cinq autres activités sur ce même compte). **Pas encore
  enregistré côté Stripe** (`STRIPE_SECRET_KEY` absent, voir
  `CODEX_HANDOFF.md`, chantier Stripe, point 6).
- État de paiement dans `marketplace_commercial_proposal_payments`, une
  table séparée plutôt que des colonnes sur `marketplace_commercial_proposals`
  : cette dernière reste rigoureusement immuable après acceptation (Phase
  1), payer n'est pas un terme commercial.
- Connect Express préparé (`binderConnect.server.ts`, réutilise
  `marketplace_binders.stripe_account_id`) — jamais appelé, aucun
  Connected Account créé. Aucun Connected Account n'existait déjà sur ce
  compte (`GetAccounts` → liste vide).

**Non construit / décisions ouvertes** :
- Politique fiscale concrète (`FR_STANDARD`…) — bloque le premier
  paiement tant qu'elle n'existe pas.
- Descripteur de relevé bancaire : ce compte partagé affiche "SECURICOM"
  par défaut pour un Checkout ponctuel (le `statement_descriptor` d'un
  Product ne s'applique qu'aux abonnements) — décision à prendre.
- Invoicing Stripe (numérotation déjà partagée avec d'autres activités,
  non touchée sans validation), UI cliente "Payer" (aucun bouton ne
  déclenche encore `createCommercialCheckoutSession`).

## 10. Ce qui n'a pas changé, volontairement

- Le catalogue de travaux, les grilles ateliers (`rateCard.ts`), le
  résolveur de travail (`workResolver.ts`) — inchangés.
- `brandPricing.ts` — le mécanisme de multiplicateur reste exactement celui
  qui existait, appliqué désormais à un prix Ma Reliure mieux plafonné.
- Le 80/20 atelier reste une politique documentée, non implémentée (aucun
  Stripe Connect).
