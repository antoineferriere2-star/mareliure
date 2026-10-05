# Passation Codex — mise en œuvre du modèle Oppe (5 octobre 2026)

Brief d'origine : « finaliser les différentes activités A, B, C, circuits complets, tests, déploiement ».
Ce document dit **ce qui est livré et vérifié**, **ce qui reste**, et **comment travailler** sans casser
l'existant. Audit de départ : « Audit modèle Oppe » du 5 octobre 2026.

## 1. État de la production (vérifié le 5 octobre 2026, 14:47 UTC)

- `main` = `77af584` ; Worker `mareliure` = `b812e4cc-a6ea-4050-81a8-508044caed0c` (retour arrière : `f1f36d4b`,
  Worker du lot « contenus » ; voir « Retour arrière » ci-dessous).
- Base de production : **102 migrations**, dernière `20261005210000_oppe_tax_qualification`.
- Webhooks Stripe (2 routes) répondent 400 sans signature ; http → https en 301 ; smoke vert.

| Lot | PR | Migration | Worker | Contenu |
| --- | --- | --- | --- | --- |
| 1 | #78, #79 | `20261005090000` | d2c6095c | Origine commerciale (`marketplace_cases.commercial_origin`), gardes SQL/serveur entre projet Oppe et client propre, import qui conserve l'origine, prix client retiré des réponses atelier, `network_sale`/`concierge` retirés |
| 2 | #80 | `20261005120000` | ca0acaa0 | Accord atelier (prestation + rémunération + délai figés), marge cible 25 % du HT (politique `oppe-a-2026-10-05-v6`), dérogation motivée, devis Oppe lié à l'accord, **acceptation client seule** avec preuve (CGV, empreinte SHA-256, IP), commande payée, avancement, annulation motivée, réattribution avec historique |
| 3 | #81 | `20261005150000` | 294765f8 | Coordonnées de facturation à l'acceptation, **facture de vente OPPE SAS** par marque (MR-/FB-), confirmation de commande, frais Stripe réels, remboursements + avoirs, litiges |
| 4 | #82 | `20261005180000` | db6ecdbe | **Facture atelier → Oppe** (outil ou PDF), échéance 30 j, contrôle admin, règlements manuels rapprochés |
| contenus | #83 | — | f1f36d4b | Offre atelier (`src/marketplace/offer/workshopOffer.ts`), CGV, page relieurs, FAQ (FR + FAQ Fine Bindery 5 langues) |
| 5 | #84 | `20261005210000` | b812e4cc | **TVA par ligne** : qualification de la prestation, taux prestation/transport, justification ; fin du 20 % automatique sur les nouveaux devis |

Journal détaillé (sauvegardes, empreintes, recettes) : `D:\CodexProjects\oppe-model-operation\PUBLICATION.md`.

## 2. Ce qui est réellement utilisable

**A — projet vendu par Oppe (Ma Reliure et Fine Bindery) : complet de bout en bout**, vérifié en recette
(qwf, Stripe **test**) : prix cible 25 % → offre atelier → accord (délai obligatoire) → atelier retenu →
devis Oppe créé → **validation fiscale par ligne** → envoi → acceptation client (CGV + facturation) →
paiement → commande + facture OPPE SAS + confirmation → réalisation → facture atelier → contrôle →
virement enregistré ; remboursement partiel + avoir ; réattribution d'atelier.
Scripts de recette rejouables : `D:\CodexProjects\oppe-model-operation\recette\` (`recette-lot2.cjs` parcours A,
`recette-lot3.cjs` paiement/facture/remboursement, `recette-lot4.cjs` facture atelier/règlement).

**B — logiciel pour les ateliers** : devis, factures, avoirs intégraux, contacts, ouvrages existent et ne sont
pas modifiés. **L'abonnement de 15 € HT/mois n'est pas construit** ; la page l'annonce avec
`WORKSHOP_OFFER.subscriptionOpen = false` (« pas encore ouvert, d'ici là sans frais »).
**C — services aux clients propres** : règlement *déclaré* (circuit externe) existe ; **le paiement en ligne
Connect à 3 % n'est pas construit** (`onlinePaymentOpen = false`).

## 3. Ce qui reste à faire (dans l'ordre conseillé)

1. **Abonnement atelier 15 € HT/mois (B).** Table `marketplace_binder_subscriptions` (statut, `legacy_free`,
   `transition_accepted_at`, période, résiliation), ateliers existants insérés en `legacy_free` (gratuits tant
   qu'ils n'ont pas accepté la transition), Checkout Stripe Billing en mode abonnement, webhook idempotent,
   droits après résiliation (lecture et téléchargement des documents historiques conservés ; création de
   devis/factures et publication de la vitrine bloquées côté serveur). Basculer `subscriptionOpen` seulement
   après la configuration externe (§4). S'inspirer de `src/build/billing` (abonnements Métré) sans le mélanger.
2. **Vitrine** : aperçu puis publication explicite par l'atelier (profils FB `public_profile_status`
   `draft → published` existent, aucun publié) ; aligner l'offre sur Ma Reliure sans dupliquer les composants.
3. **Avoir partiel atelier** (activité B) : le générateur d'avoirs de l'outil atelier est intégral seulement ;
   la ventilation par ligne/taux existe déjà côté Oppe (`marketplace_issue_oppe_credit_note`), à transposer.
4. **Stripe Connect (C)** : atelier vendeur, onboarding du compte connecté (`binderConnect.server.ts` existe,
   jamais appelé), 3 % du TTC encaissé en frais d'application, frais Stripe à la charge de l'atelier, paiements
   réussis/refusés/asynchrones, webhooks vérifiés et idempotents, remboursements, litiges, facture par
   l'atelier. Choisir le type de charge Connect avec la documentation Stripe officielle (le choix détermine
   qui supporte frais, remboursements et litiges). Garder la séparation règlement déclaré / encaissement traité.
5. **Logistique** : rattacher le transport à la commande Oppe (A) — fait via la proposition — et à la commande
   atelier (C), payeur identifié ; vérifier coût et couverture du forfait 15 € TTC (couverture Mondial Relay
   25 € max sur facture, aucune assurance) ; **ne pas étendre le forfait** à d'autres colis/pays ; préparer
   une offre internationale avant de la rendre achetable.
6. **Documentation** : mettre à jour `docs/commercial-billing-model.md`, `docs/payment-circuits-audit-20260928.md`
   et `docs/payment-activation-contracts.md` (ils décrivent encore la commission de 25 % `network_sale` retirée).
7. **Conditions** : CGV client mises à jour (voir §5) ; **conditions ateliers** (abonnement, mandat de facturation
   absent, délai de règlement de 30 jours, responsabilité, litiges) à rédiger puis à faire relire.

## 4. Prérequis externes (non vérifiables depuis le dépôt)

- **Identité publique du compte Stripe live** (`acct_1UGI34K0Q47WbZPf`) : descripteur de relevé (« OPPE »), e-mail
  de support, URL, description d'activité — documentés comme hérités (SECURICOM) le 17/09 ; à contrôler et corriger
  dans le tableau de bord (le connecteur MCP Stripe demandait une nouvelle autorisation : non lu ici).
- **Produit/prix Stripe de l'abonnement** (live) : à créer (script sur le modèle de `scripts/setupStripeProducts.ts`), puis
  secret du Worker et `subscriptionOpen = true`.
- **Connect** : activation de Connect sur le compte live et choix du type de charge.
- **Validation de l'expert-comptable** : `docs/oppe-tva-matrice-expert-comptable.md` (aucun taux n'est automatique).
- **Revue juridique** : clauses marquées `LEGAL_REVIEW_NOTE_*` (rétractation sur prestation personnalisée,
  garanties, responsabilité, médiation). Ne jamais prétendre qu'elle est obtenue.
- **Sendcloud** : secrets et test réel d'un aller-retour (automatisation ouverte le 2 octobre sans test réel).
- Premier paiement réel de faible montant (A) avec reçu, facture, e-mail ; puis un remboursement.

## 5. Règles du modèle à ne pas casser

- Origine commerciale générée (`oppe` / `workshop_client`) et gardes SQL : aucune vente Oppe sur un client propre ;
  aucun devis/facture d'atelier au client final d'une commande Oppe ; provenance des fiches immuable.
- L'atelier ne voit jamais le prix client ni la marge (`BINDER_OFFER_COLUMNS`, test `binderPayloadContract.test.ts`).
- Marge A : 25 % **du prix de vente HT**, pas une majoration (150 € → 200 €) ; propositions historiques figées.
- Acceptation client seule (trigger `a_marketplace_require_customer_acceptance`) ; aucune acceptation admin.
- Documents émis immuables (factures, avoirs, accords, paiements fournisseurs) ; rien n'est rétroactif.
- Aucun taux de TVA présumé ; TVA d'achat (facture atelier) distincte de la TVA de vente.
- Vocabulaire du dépôt (CLAUDE.md) : Mission, Projet, Playbook, Dossier Commercial ; jamais Formulaire, Lead, etc.

## 6. Comment travailler (procédure éprouvée)

- Worktree propre : `D:\CodexProjects\mareliure-build-0510` (`node_modules` en jonction ; `.env`, `.env.production.mareliure` copiés).
  **Ne pas construire dans `mareliure-roundtrip`** (`.output` verrouillé : un build EBUSY a déjà redéployé un ancien bundle —
  `deploy.sh` s'arrête au premier échec).
- Outillage : `D:\CodexProjects\oppe-model-operation` — `01-backup.mjs` (sauvegarde production lecture seule), `make-apply.cjs`
  (SQL d'application : une transaction, empreintes md5 avant/après, `TimeZone=UTC`), `rehearse.sh` (restauration locale PostgreSQL 17
  port 55432 puis application), `apply-<lot>.mjs` (une seule tentative, jamais rejouée), `deploy.sh <tag> <message>`
  (build, `versions upload --keep-vars`, `versions deploy`, smoke), `typesgen.cjs` (types Supabase pour les objets listés).
- Séquence par lot : PR + CI verte → fusion → sauvegarde → précontrôle lecture seule → répétition sur la copie restaurée →
  migration en production → Worker → smoke → journal. Migrations additives, retour arrière en fin de fichier.
- Recette : base **qwf** (`scratchpad/pg/qwf.mjs ro|rw`, 103 migrations), serveurs `oppe-qwf` (8110) et `oppe-qwf-fb` (8111)
  du `.claude/launch.json` (`VITE_CACHE_DIR` séparé, secret webhook local dans `recette/.local-webhook-secret`),
  comptes fictifs `example.invalid` par lien magique. **Stripe : clé `sk_test` du `.env` uniquement** (classer par préfixe avant tout appel),
  jeton `pm_card_visa`, événements signés avec le secret local ; aucun débit réel ni étiquette payante.
- Règles de sécurité de la session : pas de création de compte, pas de saisie de mot de passe/carte, pas de secret dans le chat, les logs ou Git.

## 7. Retour arrière (dernier recours)

Les migrations 1 à 5 sont additives ; les anciens Workers ne connaissent pas les nouvelles colonnes mais restent lisibles.
Pour revenir sur le Worker : `versions deploy <id>@100% --name mareliure` depuis un dossier neutre
(`D:\CodexProjects\redesign-premium-operation`). Ne jamais supprimer de documents émis ni de lignes d'accord/paiement.
Sauvegardes : `production-before-lot1..5.dump` dans `D:\CodexProjects\oppe-model-operation`.
