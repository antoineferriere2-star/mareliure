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

`marketplace_cases.tax_status` (aperçu de prix, avant toute proposition)
vaut toujours `TAX_REVIEW_REQUIRED` (`brandPricing.ts`, inchangé — un
vocabulaire distinct de celui du snapshot commercial, volontairement non
harmonisé pour ne pas toucher à un champ hors du périmètre de ce
chantier). Le snapshot d'une proposition, lui, a une vraie architecture
fiscale depuis le 17 septembre 2026 — voir §9bis pour le détail complet
(les cinq catégories, le mécanisme de validation admin, le snapshot fiscal
figé). Le système reste HT-first : `customer_total_ht_cents` est toujours
connu, `_ttc_cents` ne l'est que si un taux a été validé.

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

**Construit et vérifié en conditions réelles (17 septembre 2026)** :
- Trois Products permanents sur `LIVE_ACCOUNT_ID`
  (`prod_VGu3dUcm5c03W3` Ma Reliure, `prod_VGu332vGMShtpJ` Fine Bindery,
  `prod_VGu3DtQmcdtp2Z` Transport), posés comme secrets du Worker
  Cloudflare — jamais de Price Stripe fixe, le montant reste toujours
  `price_data` dynamique depuis le snapshot commercial. Les mêmes trois
  existent aussi sur `TEST_ACCOUNT_ID` pour le développement local
  (`scripts/setupStripeProducts.ts`, idempotent, réutilisable sur
  n'importe quel compte via `STRIPE_EXPECTED_ACCOUNT_ID`). Trois anciens
  IDs sur `LEGACY_ACCOUNT_ID` ne sont plus référencés nulle part en
  production ; ni supprimés ni archivés sur ce compte (jamais demandé).
- `createCommercialCheckoutSession` (`checkoutSession.server.ts`) :
  recharge la proposition **acceptée**, seule source du montant — jamais
  une valeur du navigateur. `checkoutPlan.ts` (pur, testé) bloque tant
  qu'une proposition n'a pas une fiscalité **validée** (`tax_policy`
  différent de `MANUAL_TAX_REVIEW` ET `tax_validated_at` renseigné — voir
  §9bis) : **le premier vrai paiement ne peut donc avoir lieu que pour un
  dossier dont un admin a explicitement validé la fiscalité**, jamais par
  une règle automatique. Descripteur de relevé bancaire par marque via
  `payment_intent_data.statement_descriptor_suffix`
  (`"MARELIURE"`/`"FINEBINDERY"`, dérivé du `brand` de la proposition,
  jamais du navigateur) — combiné par Stripe au préfixe raccourci du
  compte (`"OPPE"` proposé, pas encore posé côté Dashboard, voir
  `CODEX_HANDOFF.md`).
- Bouton client « Payer »/« Pay securely » (`CustomerCasePage.tsx`) :
  n'apparaît que si le serveur (`getMyCustomerCase`) recalcule
  `checkoutEligibility` à `true` pour la proposition acceptée du dossier —
  jamais un flag optimiste côté client. Le bouton n'appelle que
  `createCommercialCheckoutSession`, qui refait le même calcul
  server-side avant de créer quoi que ce soit chez Stripe.
- Préflight admin (`getPaymentPreflight`, `PreflightPanel` dans
  `CaseMatchingPage.tsx`) : relit en direct marque, dossier, client,
  service/transport HT, fiscalité, TVA, TTC, joignabilité réelle du compte
  Stripe (`assertExpectedStripeAccount`), Products configurés, suffixe de
  relevé, webhook configuré, déjà-payé — puis rend `READY FOR PAYMENT` ou
  `BLOCKED — <raisons>`. Rien n'y est recalculé côté navigateur.
- Webhook live **enregistré et vérifié** sur `LIVE_ACCOUNT_ID`
  (`we_1UGPd7K0Q47WbZPfCZDzfi6p`,
  `https://mareliure.fr/api/marketplace/stripe-webhook`) : signature
  vérifiée avant toute lecture (confirmé : signature manquante/invalide
  → 400), idempotent par `event.id` (`marketplace_stripe_webhook_events`),
  ignore tout paiement sans notre metadata (les cinq autres activités sur
  le compte historique, sans rapport avec ce compte dédié).
- État de paiement dans `marketplace_commercial_proposal_payments`, une
  table séparée plutôt que des colonnes sur `marketplace_commercial_proposals`
  : cette dernière reste rigoureusement immuable après acceptation (Phase
  1), payer n'est pas un terme commercial.
- Connect Express préparé (`binderConnect.server.ts`, réutilise
  `marketplace_binders.stripe_account_id`, `controller` explicite plutôt
  que le paramètre `type` legacy) — jamais appelé, aucun Connected
  Account créé. Aucun Connected Account n'existait déjà sur
  `LIVE_ACCOUNT_ID` (`GetAccounts` → liste vide).
- **Reconfirmé en direct le 17 septembre 2026 (chantier suivant)** via le
  connecteur MCP Stripe (réautorisé pendant la session) : les 3 Products
  existent avec les mêmes IDs et sans `default_price`, le webhook répond
  avec les mêmes 7 événements et `status: "enabled"`, et le compte reste
  propre — `GetCustomers`/`GetAccounts` (connectés) renvoient toujours des
  listes vides. Aucune régression entre les deux audits.
- `assertExpectedStripeAccount` **vérifié fonctionnel de bout en bout** en
  production (`GET /api/marketplace/stripe-health`, protégé par jeton
  porteur) : `{"ok":true,"expectedAccountId":"acct_1UGI34K0Q47WbZPf"}`.
  Le client Stripe marketplace utilise un `httpClient` `fetch` explicite
  (`Stripe.createFetchHttpClient()`) — indispensable en Cloudflare
  Workers, qui n'a pas les modules Node `http`/`https` dont le SDK se
  sert par défaut.

### 9bis. Politique fiscale — architecture (17 septembre 2026)

Décidée par l'application, jamais par Stripe : Stripe Tax reste `active`
sur le compte mais n'influence aucune décision — voir `CODEX_HANDOFF.md`
§ "Stripe Tax reste sans effet sur notre politique métier". Aucune règle
d'exonération n'est codée à partir d'une interprétation maison ; la seule
chose codée en dur est une liste d'États membres UE (un fait géographique,
pas une règle fiscale) dans `src/marketplace/commercial/taxPolicy.ts`.

**Cinq catégories nommées** (`CommercialTaxPolicy`, `commercialProposal.ts`) :

| Catégorie | Sens | Automatisable aujourd'hui ? |
| --- | --- | --- |
| `MANUAL_TAX_REVIEW` | Aucune fiscalité validée — seule valeur possible sans validation humaine (garanti en base) | — c'est l'état par défaut |
| `FR_B2C` | Client particulier en France | Non : nécessite un taux confirmé par un expert-comptable et un pays client réellement capturé (aucun champ pays n'existe encore sur un dossier — voir plus bas) |
| `EU_B2C` | Client particulier dans un autre État membre UE | Non, même raison |
| `NON_EU_B2C` | Client particulier hors UE | Non, même raison — le traitement usuel (exonération à l'export) est plausible mais jamais affirmé ici sans validation |
| `NON_EU_TEMPORARY_IMPORT_REEXPORT` | Livre appartenant à un client hors UE, envoyé en France pour restauration puis réexporté | Jamais automatisable : un fait qu'un code pays ne peut pas révéler, toujours une lecture humaine du dossier (régime douanier d'admission temporaire, distinct d'une vente) |

**Ce qui est construit** : le mécanisme de validation, pas une règle
fiscale. `validateCommercialProposalTax` (server function, admin
uniquement) fait passer une proposition **encore modifiable** (jamais une
ligne acceptée — le trigger l'interdit désormais aussi au niveau base,
migration `20260917090000`) de `MANUAL_TAX_REVIEW` à une catégorie
choisie par l'admin, avec un pays de taxation et un taux de TVA qu'il
saisit lui-même — le code ne calcule ni ne suggère aucun taux, seulement
l'arithmétique HT→TTC qui en découle (`recomputeProposalTax`, pure,
testée). `suggestTaxPolicyForCountry` ne fait que pré-remplir le
formulaire admin à partir d'un pays saisi ; `checkoutEligibility` ne la
lit jamais, seulement `tax_validated_at`.

**Snapshot fiscal** (§9 du brief, structure équivalente à celle demandée) :
`tax_policy`, `customer_vat_rate_bps` (le taux), `customer_vat_amount_cents`
(le montant), `tax_country`, `tax_basis` (`"service_and_shipping"` — une
seule valeur aujourd'hui, le type reste ouvert si transport et service
devaient un jour suivre des régimes distincts), `tax_validation_source`
(deux sources désormais construites — voir plus bas), `tax_validated_at`,
`tax_validated_by`. Une fois une proposition acceptée, ce snapshot est
aussi immuable que le reste de la ligne : un changement de règle futur ne
modifie jamais une commande déjà honorée.

**Exception construite le 18 septembre 2026 — TVA France 20 %
automatique** (décision opérationnelle temporaire de l'utilisateur, pas
une automatisation générale) : tout dossier `billing_country = FR`
(particulier ou professionnel) reçoit `tax_policy = FR_B2C`,
`customer_vat_rate_bps = 2000`, `tax_validation_source =
FR_STANDARD_VAT_20` — sans admin, via `applyAutomaticFranceTaxPolicy`
(`commercialProposal.data.functions.ts`) et `resolveAutomaticTaxPolicy`
(`taxPolicy.ts`, pure, testée). Dans ce seul cas, `tax_validated_by` reste
`NULL` (contrainte CHECK dédiée, migration `20260918090000`) : ce n'est
délibérément pas une validation humaine. `EU_B2C`/`NON_EU_B2C`/
`NON_EU_TEMPORARY_IMPORT_REEXPORT` restent entièrement manuels — cette
fonction ne renvoie rien pour un pays autre que `FR`, jamais une
extrapolation. `resetProposalTaxToManualReview` permet à l'admin de
revenir en arrière avant acceptation si un cas particulier apparaît.

**Ce qui manque avant qu'une des trois catégories internationales
puisse être choisie en confiance** (inchangé pour elles — seule la
France a une règle) :
1. Un taux TVA confirmé par un expert-comptable pour chacun des trois cas
   internationaux — non fait, volontairement hors du périmètre de ce
   chantier.
2. Un pays client réellement connu : aucun dossier ne capture aujourd'hui
   une adresse ou un pays du client (seuls `customerEmail`/`customerName`
   existent, via `CaseContext`). L'admin saisit donc le pays à la main
   dans `PreflightPanel`/`TaxValidationForm`, à partir de ce qu'il sait du
   dossier — pas une lacune que ce chantier avait pour objet de combler.

### 9ter. Customer type — pas structurellement B2C-only (17 septembre 2026)

Le modèle ne suppose jamais qu'un client est un particulier :
`customer_type` (`"CUSTOMER"` par défaut, `"BUSINESS"` sinon) sur
`marketplace_commercial_proposals`, migration `20260917100000`. Pour
`BUSINESS` : `business_name` (requis — contrainte CHECK en base),
`business_vat_number` (facultatif), `business_vat_validation_status`
(`"NOT_CHECKED"` par défaut — aucune vérification automatique de numéro de
TVA construite), `billing_country` (facultatif, distinct de `tax_country`
qui reste le pays de taxation retenu). Se finalise au même moment que la
fiscalité (`validateCommercialProposalTax`, `TaxValidationForm`), avant
acceptation — donc figé, contractuel, une fois la proposition acceptée.
`checkoutEligibility` bloque désormais aussi un client `BUSINESS` sans
`business_name` (`reason: "business_identity_incomplete"`). Aucune UI
d'onboarding B2B complète n'existe : l'admin saisit ces champs à la main.

**Éligibilité Checkout finale** (`checkoutEligibility`, `checkoutPlan.ts`) :
proposition acceptée ET `tax_policy` ≠ `MANUAL_TAX_REVIEW` ET
`tax_validated_at` renseigné ET (`customer_type` ≠ `BUSINESS` OU
`business_name` renseigné) ET pas déjà payée. Le compte Stripe et le
mapping Products restent vérifiés séparément (`assertExpectedStripeAccount`,
`getStripeProductIds`) dans `createCommercialCheckoutSession` et dans
`getPaymentPreflight` — fail closed sur chacun, jamais un "on fait au
mieux" combiné dans la fonction pure.

**Non construit / décisions ouvertes** :
- Un taux de TVA validé par un expert-comptable, pour n'importe laquelle
  des quatre catégories concrètes — ce chantier construit le mécanisme de
  validation, jamais la validation elle-même.
- Capture d'un pays/adresse client sur un dossier — l'admin le saisit à la
  main au moment de valider la fiscalité d'une proposition donnée.
- Vérification automatique de numéro de TVA (VIES ou équivalent) —
  `business_vat_validation_status` reste `"NOT_CHECKED"`, rien ne l'appelle.
- Identité publique du compte (statement descriptor "SECURICOM" hérité,
  support_email `contact@securicom.shop`, pas de `support_url`,
  `product_description` décrivant une activité BTP) — **audit live
  reconfirmé le 17 septembre 2026** (connecteur MCP Stripe désormais
  autorisé, lecture complète du compte via `GetAccountsAccount`, plus
  seulement `limited_account_retrieve` comme le 16 septembre). Correction
  approuvée par l'utilisateur (`OPPE`, `contact@oppe.fr` confirmée
  surveillée, `https://mareliure.fr`, description réelle de l'activité)
  mais **toujours impossible à écrire via ce connecteur** : aucune
  opération d'écriture n'existe pour `business_profile`/
  `settings.card_payments`/`settings.payments` (seule
  `UpdateBrandSettings` existe, et elle ne couvre que logo/couleurs) — à
  appliquer par l'utilisateur lui-même dans le Dashboard, voir
  `CODEX_HANDOFF.md`.
- Rotation de `STRIPE_SECRET_KEY` — exposée une fois par erreur de
  frappe (collée sur la ligne de commande au lieu du prompt), rotation
  différée par décision explicite de l'utilisateur.
- Invoicing Stripe (numérotation déjà partagée avec d'autres activités,
  non touchée sans validation).

## 10. Ce qui n'a pas changé, volontairement

- Le catalogue de travaux, les grilles ateliers (`rateCard.ts`), le
  résolveur de travail (`workResolver.ts`) — inchangés.
- `brandPricing.ts` — le mécanisme de multiplicateur reste exactement celui
  qui existait, appliqué désormais à un prix Ma Reliure mieux plafonné.
- Le 80/20 atelier reste une politique documentée, non implémentée (aucun
  Stripe Connect).
