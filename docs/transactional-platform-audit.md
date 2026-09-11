# Plateforme transactionnelle Ma Reliure — audit avant chantier

> Écrit en réponse au cahier des charges du 11 septembre 2026 (compte
> client/relieur, messagerie, décisions, pricing à trois modes, Stripe Connect
> 80/20, logistique par niveau de risque, vitrine atelier). Complète, ne
> remplace pas, [reliure-marketplace-architecture.md](reliure-marketplace-architecture.md)
> (audit du 8 septembre) et [shipping-pickup-point-spec.md](shipping-pickup-point-spec.md)
> (spécifié, non commencé) — les deux restent la référence sur ce qu'ils
> couvrent déjà.
>
> Règle de lecture : le code est la source de vérité. Ce document constate,
> il n'invente pas.

---

## A. Architecture actuelle — ce que le code fait réellement

### A.1 Beaucoup plus est déjà construit que le cahier des charges ne le suppose

Le point le plus important de cet audit : **le modèle de pricing géré, la
marge plancher, le journal d'événements et le claim sécurisé du §4 sont déjà
en production**, pas à créer. Le chantier restant est plus petit que 90
sections ne le laissent penser.

### A.2 Auth (`AUTH`)

- **Primitive unique** : `requireSupabaseAuth` (middleware TanStack,
  [auth-middleware.ts](../src/integrations/supabase/auth-middleware.ts)) vérifie
  un bearer JWT via `supabase.auth.getClaims()`, expose `{ supabase (client
  RLS de l'appelant), userId, claims }`. Aucune autre voie d'authentification
  serveur.
- **Rôles** : `public.user_roles` (`user_id`, `role` : enum `admin | user`),
  `has_role()`. **Deux rôles seulement.** Client et relieur ne sont **pas**
  des rôles — ce sont des relations : un compte est « client » parce
  qu'une ligne `marketplace_cases.customer_user_id` pointe vers lui, « relieur »
  parce qu'une ligne `marketplace_binders.user_id` pointe vers lui. C'est
  cohérent avec §9/§72 du cahier des charges (accès par relation, pas par
  déclaration) — **à conserver, pas à remplacer par un système de rôles**.
- **Admin** : `assertAdmin` (client service-role, lit `user_roles` puis bascule
  sur `admin()`) et `requireBuildAdmin` (server function, même lecture côté
  client RLS de l'appelant, pour le gating front). Modèle homogène avec le
  reste du moteur Métré (`docs/reliure-marketplace-architecture.md` §A.7).
- **Connexion client** : magic link Supabase (`src/marketplace/auth/accessLink.ts`,
  livré le 11 septembre) — `signInWithOtp({ shouldCreateUser: true })`, aucun
  mot de passe. Modèles d'e-mail français dans `supabase/templates/mareliure/`,
  posés par `scripts/configureMareliureAuth.ts`. **C'est exactement le §3 du
  cahier des charges, déjà en production.**
- **Connexion relieur / équipe** : mot de passe classique
  (`supabase.auth.signInWithPassword`), en retrait sur `/auth`
  ([MaReliureAuthPage.tsx](../src/marketplace/pages/auth/MaReliureAuthPage.tsx)).
  Il n'existe **aucun flux d'invitation relieur** : un compte relieur se crée
  aujourd'hui par mot de passe, sans lien avec l'approbation admin d'un
  atelier — c'est le vrai trou du §7.

### A.3 Claim d'un dossier existant (`AUTH` × `MARKETPLACE`)

Déjà livré et testé, deux preuves de possession :

1. **Lien d'accès** (`claimMarketplaceCase`, POST) — colle le lien de suivi
   Métré (`build_dossier_access_tokens`, 256 bits, haché, expirable) dans
   `/mes-livres`. Idempotent, jamais de transfert entre comptes, écriture
   conditionnée par `is("customer_user_id", null)` pour trancher une course.
2. **E-mail vérifié** (`attachVerifiedEmailCases`, appelée à chaque
   `listMyCustomerCases`) — rapproche un dossier **non réclamé** dont
   l'adresse du fournisseur d'identité est déclarée vérifiée. Ne fait jamais
   de comparaison de chaînes sur `visitor_email` en dehors de ce chemin.

**Exactement ce que demande le §4** (« pas d'attachement par égalité de
chaînes, preuve de possession requise »). Rien à construire ici.

### A.4 Client (`CLIENT`)

| Existant | Ce qu'il fait |
| --- | --- |
| `/mes-livres` → `CustomerCaseListPage.tsx` | `listMyCustomerCases` : mes cas, prix si validé, référence, statut |
| `/mes-livres/:caseId` → `CustomerCasePage.tsx` | `getMyCustomerCase` : vue filtrée (`caseDisclosure` = `full` pour un client), atelier sélectionné une fois connu |
| Après soumission | `CustomerSpaceOffer.tsx` (11 septembre) : lien de connexion direct depuis le récapitulatif |

Pas de messagerie, pas de décisions structurées, pas de timeline dynamique,
pas d'indicateur « message non lu » : ces briques n'existent nulle part dans
le produit, marketplace ou Métré. **À construire intégralement (§10-§21).**

### A.5 Relieur (`RELIEUR`)

| Existant | Ce qu'il fait |
| --- | --- |
| `/atelier` → `BinderDashboardPage.tsx` | `listMyBinderCases` : mes dossiers, statut, rémunération offerte |
| `/atelier/cases/:caseId` → `BinderCasePage.tsx` | `getBinderCase` : vue `assigned` ou `project_only` selon sélection, offre, `canRespond` |
| Réponse à une offre | `respondToBinderOffer` → RPC `marketplace_respond_to_offer` (accepter/refuser + motif structuré, révèle `minimum_required_payout_cents` en cas de refus pour rémunération — **exactement le signal de prix du §31 déjà collecté**) |

**Relation utilisateur ↔ atelier : `marketplace_binders.user_id UUID UNIQUE`.**
Un compte, un atelier, pour toujours. C'est le point que le §8 demande
explicitement de corriger — confirmé comme vrai trou, pas une supposition.

Pas d'invitation client par l'atelier, pas de lien personnel, pas de
provenance `BINDER_REFERRED` : rien de tout ça n'existe (§52-§61 à construire).

### A.6 Marketplace — cases, offres, matching

Le modèle **« marketplace gérée »** (offre à prix fixé par Ma Reliure, jamais
de mise en concurrence de prix) est en production depuis le 8 septembre :

- `marketplace_cases` : statuts de transaction (`under_review` →
  … → `completed`/`cancelled`), `pricing_status`
  (`pending|suggested|validated|manual_review`), `customer_price_cents` /
  `binder_payout_cents` une fois validés.
- `marketplace_case_matches` : au plus **3 relieurs par cas**, garanti par un
  trigger `AFTER INSERT` (un `BEFORE` ne verrait pas les lignes du même
  `INSERT` — bug réel trouvé et corrigé le 8 septembre) et un index unique
  partiel sur `state = 'selected'`.
- `marketplace_quotes` : l'offre gérée par cas/atelier — `offered → accepted
  | declined → selected`, refus motivé par un code stable
  (`payout_insufficient`, `deadline_impossible`, `outside_specialty`,
  `no_capacity`, `other`).
- `marketplace_events` : **journal d'événements append-only déjà en
  production** (`pricing_generated`, `pricing_validated`, `offer_sent`,
  `offer_accepted`, `offer_declined`, `binder_selected`, `case_completed`…).
  C'est le §69 du cahier des charges, déjà construit — à étendre avec les
  nouveaux types d'événements (messagerie, décisions, paiement), pas à créer.
- Fonctions SQL `SECURITY DEFINER` réservées à `service_role` pour toute
  opération qui tranche un état concurrent (`marketplace_validate_pricing`,
  `marketplace_respond_to_offer`, `marketplace_select_binder_offer`) — le
  modèle d'idempotence demandé au §70 est déjà le patron suivi.

### A.7 Pricing

- **Un seul Pricebook client** (`marketplace_pricebook`, `work_item_key` ×
  `size_class` × `complexity_class`, `status: draft|published|retired`, une
  seule ligne publiée à la fois). **§30 déjà acquis.**
- **Grilles relieur séparées** (`marketplace_binder_rates`) : ce que chaque
  atelier dit demander, avec provenance tracée
  (`REAL_VERIFIED|ADMIN_VALIDATED|DEMO|PLACEHOLDER|TEST_ONLY`) — jamais
  confondu avec le prix client. C'est l'« ancien Binder Rate Card » que
  l'audit devait chercher : **il n'a pas été remplacé, il a été redéfini
  comme la couche d'observation**, distincte de la décision (Pricebook). Rien
  à supprimer.
- **Marge plancher = max(% cible, montant absolu) : déjà implémentée deux
  fois** — dans le moteur pur (`pricing.engine.ts`,
  `Math.max(minimumMarginCents, ceil(customerPrice * minimumMarginBps / 10000))`)
  et dans la fonction SQL `marketplace_validate_pricing` (même formule,
  `greatest(...)`), qui refuse d'écrire un prix qui ne la respecte pas. La
  politique (`PRICING_POLICY` dans `pricing.rules.ts` : `targetMarginBps:
1800`, `minimumMarginBps: 1500`, `minimumMarginCents: 2000`) est centralisée
  dans un seul fichier, comme demandé. **§34 acquis** ; reste seulement à la
  rendre éditable depuis l'admin plutôt que par déploiement de code, si
  souhaité — amélioration, pas un manque bloquant.
- **Aucune fabrication de prix** : `noFabricatedPrices.test.ts` interdit les
  nombres magiques hors de `PRICING_POLICY`/`pricing.rules.ts`.
- **`pricing_status` a déjà un niveau `manual_review`** — le triage §29
  (`AUTO`/`FAST_REVIEW`/`EXPERT_REVIEW`) n'existe pas nommément, mais la
  distinction binaire auto/revue est déjà là ; il manque l'échelon
  intermédiaire et les critères de bascule mesurés.
- **Ce qui n'existe pas** : les trois modes commerciaux `FIXED_PRICE` /
  `ESTIMATE_THEN_CONFIRM` / `MANUAL_STUDY` (§23-§28), l'acompte configurable,
  la confirmation de prix définitif après réception. Le modèle actuel ne
  connaît qu'un prix unique validé une fois — pas de fourchette payée par le
  client, pas de solde. **Écart réel, à construire.**
- **Conditions de rémunération par atelier par famille de métier** (§31) :
  n'existe pas. `marketplace_work_items.family` existe déjà (`repair, cloth,
  leather, gilding, finishing, protection, restoration, creation`) — la clé
  d'appariement que le §31 demande est déjà la bonne, il manque la table de
  multiplicateur.

### A.8 Paiement (`PAYMENT`)

- `src/lib/stripe.server.ts` : client Stripe **proxié via la passerelle
  connecteur Lovable** (`https://connector-gateway.lovable.dev/stripe`), avec
  des identifiants de connexion opaques (`STRIPE_SANDBOX_API_KEY` /
  `STRIPE_LIVE_API_KEY`), jamais une clé secrète Stripe directe. Toute requête
  Stripe (SDK `stripe` npm normal) part vers `api.stripe.com` puis est
  réécrite vers la passerelle, avec deux en-têtes ajoutés
  (`X-Connection-Api-Key`, `Lovable-API-Key`).
- **Utilisé uniquement par `src/build/billing/*`** (abonnement SaaS Métré :
  plans, quotas, entitlements) — zéro ligne marketplace ne l'importe
  aujourd'hui. La séparation `src/marketplace/payments/` que demande le §36
  est donc gratuite : il n'y a rien à démêler, juste à ne jamais réutiliser ce
  module tel quel.
- **Stripe Connect n'est démontré nulle part dans ce dépôt.** Aucun appel
  `stripe.accounts.*`, `stripe.accountLinks.*`, `transfer_data`,
  `application_fee_amount` n'existe dans le code.
- **Blocage réel pour ce spike** : cet environnement local n'a **aucune**
  valeur pour `STRIPE_SANDBOX_API_KEY` ni `LOVABLE_API_KEY` (`.env` ne les
  définit pas ; seul `.env.example` les documente, en commentaire). Le spike
  du §37/§76 ne peut donc pas être exécuté depuis cette session — voir G.

### A.9 Storage

Trois buckets privés, tous `public: false`, lecture uniquement par URL
signée, RLS deny-all sur `storage.objects` :

| Bucket | Contenu | Limites |
| --- | --- | --- |
| `build-project-photos` | photos du projet (Playbook) | 8 Mo, jpeg/png/webp/heic/heif |
| `build-inspiration-photos` | photos d'inspiration | 8 Mo, jpeg/png/webp |
| `marketplace-binder-photos` | avatar + portfolio atelier | 8 Mo, jpeg/png/webp |

Aucun bucket pour les pièces jointes de messagerie (§16 : JPEG/PNG/WEBP + PDF
éventuel) — à créer, sur le même patron exactement.

### A.10 Shipping

**Rien n'est construit.** `docs/shipping-pickup-point-spec.md` est un cahier
des charges complet et déjà écrit (parcours, modèle `marketplace_shipments`,
interface `ShippingProvider`, constats d'état en 3 temps, critère de sortie).
Il precède ce chantier dans l'ordre déjà arrêté (« après le référentiel
tarifaire et le cadrage Stripe Connect ») — **le §47-§51 de la nouvelle
demande (niveaux de risque) s'ajoute à ce document plutôt que de le
dupliquer** : `declared_value_band` existe déjà sur `marketplace_cases` et
alimentera `shipping_risk_level`.

---

## B. Ce que ce chantier réutilise tel quel

Rien de ce qui suit n'est modifié :

- Auth : `requireSupabaseAuth`, `user_roles`, `assertAdmin`/`admin()`, le
  magic link `accessLink.ts`.
- Claim de dossier : lien d'accès + e-mail vérifié, entièrement.
- `permissions.ts` (`Viewer`, `canViewCase`, `caseDisclosure`) — le modèle à
  trois niveaux de divulgation (`full`/`assigned`/`project_only`/`none`) est
  précisément le modèle que le §9/§62/§72 demandent ; il s'étend, il ne se
  remplace pas.
- Le moteur de pricing géré (suggestion, marge plancher, Pricebook unique,
  grilles relieur séparées).
- Le journal `marketplace_events` et le patron des fonctions SQL
  `SECURITY DEFINER` idempotentes.
- Les 3 buckets Storage et leur politique.
- Les portails `/mes-livres` et `/atelier` comme routes définitives — aucune
  nouvelle route parallèle.

---

## C. Tables à ajouter ou modifier

### C.1 Nouvelles tables

```
marketplace_binder_members     binder_id, user_id, role(OWNER|MEMBER),
                                status(active|removed), created_at
                                UNIQUE(binder_id, user_id)
                                -- §8 : découple "1 atelier" de "1 compte pour
                                -- toujours", sans casser marketplace_binders.

marketplace_binder_invitations token_hash, binder_id (nullable — peut précéder
                                la création de l'atelier), email, invited_by,
                                status(pending|accepted|expired|revoked),
                                expires_at, accepted_at
                                -- §7 : le flux ADMIN crée/approuve → invite →
                                -- relieur active, séparé du login.

marketplace_messages           id, case_id, sender_user_id, sender_role
                                (customer|binder|admin), body, attachment_paths[],
                                created_at, edited_at, deleted_at
                                -- §14-§15 : une conversation par cas.

marketplace_conversation_reads case_id, user_id, last_read_at
                                UNIQUE(case_id, user_id)
                                -- §17.

marketplace_decisions          id, case_id, kind(COLOR|MATERIAL|PAPER|
                                GILDING_TEXT|GILDING_STYLE|DECOR|
                                TECHNICAL_CHOICE|OTHER), question, options JSONB,
                                status(open|answered|cancelled), requested_by,
                                answered_by, answer JSONB, answered_at,
                                superseded_by UUID REFERENCES self, created_at
                                -- §20 : réponse horodatée et immuable ; une
                                -- modification crée une nouvelle ligne
                                -- (superseded_by), jamais un UPDATE de la
                                -- réponse.

marketplace_binder_commercial_terms
                                binder_id, family_key (references
                                marketplace_work_items.family — la colonne
                                existe déjà), payout_multiplier_bps,
                                manual_payout_required, effective_from,
                                effective_to, created_by
                                -- §31.

marketplace_amendments         id, case_id, reported_by(binder_id),
                                reason, description, photo_paths[],
                                new_customer_price_cents, new_binder_payout_cents,
                                binder_accepted_at, customer_accepted_at,
                                customer_paid_at, state(reported|priced|
                                binder_accepted|customer_notified|
                                customer_accepted|customer_declined|
                                binder_declined|resolved), created_at
                                -- §44-§46. Ordre imposé par le cahier des
                                -- charges : atelier accepte AVANT que le
                                -- client voie l'avenant.

marketplace_payouts            case_id, binder_id, total_cents,
                                initial_transfer_cents, final_transfer_cents,
                                initial_transferred_at, final_transferred_at,
                                final_payout_status(scheduled|review|paid|
                                cancelled), stripe_transfer_id_initial,
                                stripe_transfer_id_final, idempotency_key_initial,
                                idempotency_key_final, created_at
                                -- §39-§42. Table séparée de marketplace_cases :
                                -- un paiement a son propre cycle de vie et ses
                                -- propres idempotency keys, distinctes du prix.
```

### C.2 Colonnes à ajouter sur des tables existantes

```
marketplace_cases
  + acquisition_origin TEXT NOT NULL DEFAULT 'MA_RELIURE_ACQUIRED'
      CHECK (IN ('MA_RELIURE_ACQUIRED', 'BINDER_REFERRED'))          -- §53
  + referred_binder_id UUID REFERENCES marketplace_binders(id)       -- §53
  + pricing_mode TEXT CHECK (IN ('FIXED_PRICE','ESTIMATE_THEN_CONFIRM',
      'MANUAL_STUDY'))                                               -- §23
  + estimate_low_cents INTEGER, estimate_high_cents INTEGER          -- §25
  + deposit_cents INTEGER, deposit_percentage INTEGER,
    deposit_minimum_cents INTEGER                                    -- §25
  + shipping_risk_level TEXT DEFAULT 'STANDARD'
      CHECK (IN ('STANDARD','SECURE','PATRIMONIAL'))                 -- §47
  + declared_market_value_cents INTEGER,
    sentimental_value_flag BOOLEAN DEFAULT false,
    historical_or_patrimonial_flag BOOLEAN DEFAULT false             -- §51
  + payment_state TEXT, work_state TEXT, customer_action_required TEXT
                                                                      -- §67, sous-états
                                                                      -- séparés plutôt qu'un
                                                                      -- statut global explosé

marketplace_binders
  + account_status TEXT NOT NULL DEFAULT 'draft'
      CHECK (IN ('invited','onboarding','active','suspended','inactive'))
      -- §7, DISTINCT du `status` d'approbation existant
      -- (draft|pending_review|approved|rejected|suspended), qui reste
      -- « cet atelier est-il autorisé à travailler ? ». Le nouveau
      -- account_status répond à « ce compte a-t-il activé son accès ? ».
      -- Les deux se recoupent mais ne sont pas synonymes : un atelier
      -- approved peut avoir un compte encore onboarding.
  + personal_referral_slug TEXT UNIQUE                                -- §52 : /a/:slug
  + stripe_connect_status TEXT                                        -- §63

marketplace_case_matches / marketplace_quotes
  (déjà tous les champs nécessaires — aucun changement)
```

### C.3 Ce qui n'est délibérément PAS ajouté maintenant

- Aucune colonne wallet/solde artisan (§38 : interdit explicitement).
- Aucun champ d'assurance inventé (§51/§9 du doc shipping).
- Pas de deuxième grille tarifaire par atelier (§30/§31 : un multiplicateur
  par famille, pas 45 tarifs).

---

## D. Migrations — plan d'écriture

Une migration par sous-domaine, additive, rejouable (`DROP CONSTRAINT IF
EXISTS` avant `ADD`, comme le patron déjà suivi dans
`20260908210000_managed_pricing_offers.sql`), avec rollback commenté en pied
de fichier — **le patron exact que ce dépôt suit déjà**, à ne pas réinventer.

1. `marketplace_binder_membership.sql` — `marketplace_binder_members`,
   `marketplace_binder_invitations`, `marketplace_binders.account_status`,
   `personal_referral_slug`.
2. `marketplace_acquisition_origin.sql` — `acquisition_origin`,
   `referred_binder_id` sur `marketplace_cases` (+ backfill
   `MA_RELIURE_ACQUIRED` pour les lignes existantes, qui est déjà la valeur
   par défaut donc gratuit).
3. `marketplace_messaging.sql` — `marketplace_messages`,
   `marketplace_conversation_reads`, bucket `marketplace-message-attachments`.
4. `marketplace_decisions.sql` — `marketplace_decisions`.
5. `marketplace_commercial_terms.sql` — `marketplace_binder_commercial_terms`.
6. `marketplace_pricing_modes.sql` — `pricing_mode`, `estimate_low_cents`,
   `estimate_high_cents`, `deposit_*` sur `marketplace_cases`.
7. `marketplace_amendments.sql` — `marketplace_amendments`.
8. `marketplace_payouts.sql` — `marketplace_payouts` (créée en avance de
   phase D pour que le modèle de données existe avant le code Stripe, mais
   sans aucune écriture avant que le spike G soit tranché).
9. `marketplace_shipping_risk.sql` — `shipping_risk_level`,
   `declared_market_value_cents`, `sentimental_value_flag`,
   `historical_or_patrimonial_flag` (les colonnes seules ; les tables de
   `docs/shipping-pickup-point-spec.md` restent P1, non commencées).

Chaque migration suit `migrationContract.test.ts` (déjà existant, vérifie
mécaniquement le patron GRANT/RLS/rollback) — **à étendre pour couvrir les
nouvelles tables**, pas à dupliquer.

**Compatibilité (§84)** : chaque nouvelle colonne a un défaut ou est nullable ;
`acquisition_origin` a un défaut qui rend les 100+ dossiers déjà en
production `MA_RELIURE_ACQUIRED` sans backfill à écrire.

---

## E. Modèle de permissions

Étend `permissions.ts`, ne le remplace pas.

| Acteur | Cases | Messages | Décisions | Rémunération |
| --- | --- | --- | --- | --- |
| Admin | tout | tout | tout | tout, y compris marge |
| Client | ses cases (`customer_user_id`) | conversation de ses cases | ses décisions à répondre | jamais le payout atelier |
| Relieur (OWNER/MEMBER via `marketplace_binder_members`) | cases où son `binder_id` a une ligne `matches`/`quotes` (`canViewCase` inchangé — le membership résout **quel `binder_id`**, pas l'accès au cas) | conversation des cases qui lui sont confiées | décisions qu'il a demandées | sa seule rémunération, jamais la marge |
| Relieur non retenu | `project_only` (déjà le cas) | **aucun accès** à la conversation dès qu'un autre atelier est sélectionné | aucun | aucun |

Point d'attention nouveau : **résoudre `binder_id` depuis `user_id` devient
une jointure par `marketplace_binder_members` au lieu d'un
`marketplace_binders.user_id` direct.** `findBinderForUser` (utilisé par 4
server functions existantes) est le seul point à changer — bien identifié,
petite surface.

**`BINDER_REFERRED` (§54, §61)** : le case est affecté directement au
`referred_binder_id`, ne passe jamais par `marketplace_case_matches`
générique. `canViewCase` doit reconnaître ce chemin : un relieur voit un cas
qui lui a été référé même sans ligne `matches`, mais **aucun autre atelier**
ne doit jamais recevoir d'invitation dessus — nouvelle règle explicite à
ajouter dans `matching/selection.ts`, testée symétriquement (l'atelier
référent le voit, tout autre atelier ne le voit pas).

---

## F. Risques de régression

1. **`findBinderForUser` est appelé par `getMyBinderProfile`,
   `listMyBinderCases`, `getBinderCase`, `respondToBinderOffer`.** Le faire
   passer par `marketplace_binder_members` sans casser ces quatre points
   demande un test de non-régression avant toute réécriture — un atelier à un
   seul membre (100 % du parc actuel) doit se comporter identiquement.
2. **`marketplace_cases_status_check`** porte déjà deux générations de
   valeurs en compatibilité (`sent_to_binders`, `quotes_received` conservés
   « en lecture seule »). Ajouter les sous-états `payment_state`/`work_state`
   (§67) sans y ajouter *aussi* de nouvelles valeurs à `status` — sinon la
   même explosion combinatoire que le cahier des charges demande d'éviter.
3. **Historique des paiements et migration de `pricing_status`** : les cas
   déjà `validated` avant ce chantier n'ont pas de `pricing_mode`. Un
   `pricing_mode IS NULL` doit s'afficher comme `FIXED_PRICE` par défaut côté
   UI (le seul mode qui existait), jamais comme une erreur (§84).
4. **`marketplace-binder-photos` et les deux buckets Métré sont à 8 Mo /
   jpeg-png-webp** ; le nouveau bucket messagerie doit décider séparément
   s'il accepte le PDF (§16) — feature légèrement différente, pas un copier-
   coller aveugle du patron bucket.
5. **`.output/public`** (test `secretsContract.test.ts`, « does not appear in
   built client assets ») dépend d'un build frais — déjà connu comme lent
   (>5s, timeout par défaut), sans lien avec ce chantier mais à ne pas
   confondre avec une régression introduite ici.
6. **Aucune table `build_*` n'est touchée** par aucune migration listée en D —
   vérifié, patron respecté (F.4 de l'audit du 8 septembre).

---

## G. Architecture Stripe — proposition, sous réserve du spike

### Constat

Le spike exigé par le §37/§76 **ne peut pas être exécuté depuis cet
environnement** : ni `STRIPE_SANDBOX_API_KEY` ni `LOVABLE_API_KEY` n'existent
dans `.env` local. La passerelle Lovable réécrit uniquement l'hôte HTTP
(`api.stripe.com` → `connector-gateway.lovable.dev/stripe`) et ajoute deux
en-têtes ; **rien dans le code ne dit si Connect est autorisé côté Lovable**
pour cette connexion — cela dépend du produit Lovable, pas du code de ce
dépôt.

### Ce qu'il faut pour lever le blocage

1. Une clé `STRIPE_SANDBOX_API_KEY` de test posée par le tableau de bord
   Lovable (comme `LOVABLE_API_KEY` l'est déjà pour le billing SaaS), **ou**
   confirmation que la connexion actuelle autorise déjà `/v1/accounts`.
2. Un appel de test, en sandbox uniquement :
   `stripe.accounts.create({ type: 'express', country: 'FR', ... })` via
   `createStripeClient('sandbox')`. S'il réussit, `accountLinks.create` pour
   l'onboarding hébergé, puis un `PaymentIntent` avec
   `transfer_data.destination` pour vérifier que « separate charges and
   transfers » passe par la passerelle sans erreur 4xx spécifique à Connect.
3. Si la passerelle refuse (le scénario le plus probable — la plupart des
   passerelles connecteur ne proxient qu'un sous-ensemble d'endpoints), la
   voie de repli documentée au F.3 de l'audit du 8 septembre s'applique : une
   clé Stripe restreinte dédiée à la marketplace, dans
   `src/marketplace/payments/`, avec son propre client — **jamais** celui du
   billing SaaS.

### Architecture recommandée, dans les deux cas

**Separate charges and transfers**, comme le cahier des charges le préfère
(§37) :

- Le client paie Ma Reliure (le `PaymentIntent` est au nom de la plateforme,
  jamais du compte connecté) — cohérent avec « le client achète à Ma Reliure »
  (principe 0).
- `transfer_data` n'est **pas** utilisé sur le `PaymentIntent` initial :
  les transferts 80/20 sont deux `Transfer` distincts, créés après coup,
  vers le compte connecté du relieur — c'est ce qui permet de découpler le
  paiement client de l'échéancier de rémunération (§40-§42), impossible avec
  `transfer_data` qui transfère au moment du charge.
- Comptes connectés : **Express**, pas Custom — Ma Reliure ne veut pas
  collecter elle-même les informations KYC (§63, interdit explicitement) ;
  Standard est écarté parce qu'il donne au relieur un accès direct au
  dashboard Stripe et à ses propres remboursements, ce qui casse le contrôle
  centralisé que le principe 0 exige.
- SCA (§27) : pas d'autorisation carte bloquée sur la fourchette haute. Le
  dépôt est un `PaymentIntent` capturé immédiatement ; le solde après examen
  physique est un **second** `PaymentIntent`, avec `off_session: false` —
  le client est présent (notification + clic « Confirmer et lancer les
  travaux »), donc l'authentification 3DS peut se faire à ce moment-là plutôt
  que de supposer un débit hors session qui échouerait silencieusement.
- Idempotency keys Stripe (le paramètre natif du SDK, pas une réinvention) :
  une par intention de transfert (`initial_transfer:{case_id}`,
  `final_transfer:{case_id}`), stockées dans `marketplace_payouts` (C.1) pour
  qu'un retry de webhook ne rejoue jamais un transfert déjà envoyé.
- Webhooks Connect ont leur **propre secret de signature**, distinct du
  webhook plateforme (`PAYMENTS_SANDBOX_WEBHOOK_SECRET` existant est celui du
  billing SaaS — un nouveau `MARKETPLACE_PAYMENTS_WEBHOOK_SECRET` est
  nécessaire, jamais partagé).

### Ce que je ne recommande pas

Un wallet interne ou un calcul de solde recalculé côté application entre les
deux transferts (§38) : chaque `Transfer` Stripe est la seule source de
vérité de ce qui a été réellement envoyé, `marketplace_payouts` n'en garde
qu'une projection pour l'UI et l'idempotence.

---

## H. Plan de réalisation par phases

Reprend l'ordre du §86 du cahier des charges, ajusté à ce que l'audit a
trouvé déjà construit.

### Phase A — Fondations (aucun blocage, prêt à démarrer)

- Migrations C.1/C.2 §1-2 : `marketplace_binder_members`,
  `marketplace_binder_invitations`, `account_status`,
  `personal_referral_slug`, `acquisition_origin`, `referred_binder_id`.
- `findBinderForUser` → résolution par membership (F.1), avec test de
  non-régression sur le parc actuel (atelier à un seul membre).
- Flux d'invitation relieur (§7) : e-mail transactionnel (patron
  `send-email.ts`/`resend.ts` déjà en place, réutilisé tel quel), page
  d'activation, acceptation des conditions.
- `BINDER_REFERRED` : résolution serveur d'un slug (§55 : jamais un
  `?binder=id` qui suffit à lui seul), persistée à la création du cas.
- Le claim client existe déjà (A.3) — rien à faire ici.

### Phase B — Portails, messagerie, décisions

- Migrations D.1 §3-4.
- Bucket `marketplace-message-attachments`, validation MIME/poids/permissions
  (patron des buckets existants).
- Une conversation par cas (§14), lecture temps réel via React Query
  (invalidation + polling raisonnable — Realtime seulement si le budget de
  sécurité/complexité le justifie, cf. §18).
- Décisions structurées (§20-§21), y compris le cas titrage/dorure avec
  confirmation horodatée immuable.
- `/mes-livres` et `/atelier` deviennent de vrais dashboards (§10, §12) —
  UI uniquement, aucune nouvelle route.
- Notifications e-mail (§19) sur les événements déjà loggués dans
  `marketplace_events`, plus les nouveaux types (message important, décision
  demandée).

### Phase C — Pricing à trois modes, matching, rémunération atelier

- Migrations D.1 §5-6.
- `FIXED_PRICE` / `ESTIMATE_THEN_CONFIRM` / `MANUAL_STUDY` dans le moteur pur
  (`pricing.engine.ts`), la validation reste dans
  `marketplace_validate_pricing` — étendue, pas remplacée.
- Acompte configurable (`deposit_percentage`/`deposit_minimum_cents`, jamais
  une constante).
- `marketplace_binder_commercial_terms` + résolution du multiplicateur par
  `family_key` dans le calcul de rémunération.
- Correction du matching (§33) : l'ordre de critères existe partiellement
  dans `matching/score.ts` — vérifier que le prix n'est un tie-breaker que
  s'il l'est déjà, sinon corriger l'ordre.

### Phase D — Stripe (bloquée sur le spike de G)

- Spike G, avec le go/no-go documenté avant toute ligne de code de paiement
  (§76 : « NE FAIS PAS semblant »).
- Selon l'issue : paiement `FIXED_PRICE`, acompte + solde
  `ESTIMATE_THEN_CONFIRM`, Connect onboarding, transferts 80/20,
  remboursements de base, sous feature flag pour garder `main` déployable
  (§85).

### Phase E — Logistique par niveau de risque

- Colonnes C.2 §9 seules dans cette phase (`shipping_risk_level`,
  `declared_market_value_cents`, drapeaux).
- Le reste (`marketplace_shipments`, fournisseur, points relais) reste régi
  par `docs/shipping-pickup-point-spec.md`, dans son ordre déjà arrêté.

### Phase F — Vitrine publique atelier

- `/ateliers/:slug`, contenu réel uniquement (§57-§60), tunnel Guided Project
  Intake existant avec `BINDER_REFERRED` porté par la session.

**À chaque phase** : tests + `tsc --noEmit` + `npm run build` (avec
`build:mareliure` pour tout ce qui touche au bundle client, jamais `npm run
build` seul — voir l'incident du 11 septembre évité de justesse), commit
cohérent, `main`/la branche de travail reste déployable.

---

## Ce que je recommande de trancher avant Phase A

1. **Le spike Stripe (G)** ne peut être lancé que depuis le tableau de bord
   Lovable ou avec des identifiants sandbox que je n'ai pas — à fournir
   quand la Phase D approche, pas maintenant.
2. **Realtime vs. polling (§18)** : aucun signal dans le code existant
   n'indique que Supabase Realtime est déjà activé sur ce projet. Sauf
   contre-indication, Phase B part sur React Query (invalidation + polling),
   plus simple à sécuriser avec le modèle RLS deny-all déjà en place.
3. **`account_status` vs `status` sur `marketplace_binders`** (E.2) : deux
   colonnes qui se recoupent sans être synonymes. Je propose de les garder
   séparées (approbation métier vs activation de compte) plutôt que de
   fusionner les deux state machines — à confirmer, c'est une décision
   produit autant que technique.
