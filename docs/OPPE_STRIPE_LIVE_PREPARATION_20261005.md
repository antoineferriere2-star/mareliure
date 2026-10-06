# Préparation Stripe live — 5 octobre 2026

Compte connecté vérifié : `acct_1UGI34K0Q47WbZPf`, Ma Reliure/Fine Bindery, **live**. Il correspond à la garde du serveur. Aucun client, abonnement, compte atelier, paiement ou remboursement réel créé par cette préparation. Les services B/C restent fermés.

## Objets créés et relus

| Objet | Identifiant et configuration |
| --- | --- |
| Produit B | `oppe_workshop_subscription_v1` — Oppe, abonnement atelier ; outils devis, factures et vitrine professionnelle |
| Prix B | `price_1UNGCtK0Q47WbZPfij57EdX6` — 1 500 centimes EUR, mensuel, quantité unitaire, `tax_behavior=exclusive` |
| Lookup | `oppe_workshop_monthly_15_eur_v1` ; un seul prix retourné |
| Portail B | `bpc_1UNGGgK0Q47WbZPfn3zFcKbl`, actif et par défaut ; factures, coordonnées fiscales et moyen de paiement ; résiliation à échéance sans prorata ; modification du prix/quantité désactivée |
| Webhook A/B | `we_1UGPd7K0Q47WbZPfCZDzfi6p`, URL et secret existants conservés ; ajout de `customer.subscription.created/updated/deleted` et `charge.dispute.updated/closed`, événements précédents conservés |
| Webhook C | `we_1UNGGpK0Q47WbZPfXojtokfy` — `https://mareliure.fr/api/marketplace/connect-webhook`, événements des comptes connectés, API `2026-06-24.dahlia` correspondant au serveur publié |

Le webhook C reçoit `account.updated`, `checkout.session.completed/async_payment_succeeded/async_payment_failed/expired`, `payment_intent.succeeded/payment_failed/processing/canceled`, `charge.refunded` et `charge.dispute.created/updated/closed`.

Le secret C est conservé dans un fichier opérationnel à accès restreint, puis installé sous `STRIPE_CONNECT_WEBHOOK_SECRET`. Aucune valeur secrète dans Git ou dans ce document. Le produit n’a pas de catégorie fiscale explicite ; le catalogue seul n’autorise aucune vente.

## Publication et preuves

Worker actif : **`8f9d80ce-82a3-4848-8e9a-0bc1edc383ae`**, 100 %, le **5 octobre 2026 à 18:10:10 UTC**. Déploiement `5ce45f56-bea8-43d2-a39b-c770bb8c6408`.

Comparaison Cloudflare avant bascule : ETag du code strictement identique au Worker du lot 6 (`cbd5667f-3585-495a-addd-895842adf7c7`), quinze liaisons conservées, seul secret Connect ajouté. Compatibilité `2026-09-25`, `nodejs_compat`, CPU 1 000 ms et réglages d’assets conservés. Le code applicatif reste `13f18d6`.

Douze contrôles HTTP réussis sur `mareliure.fr` et `finebindery.com` : les trois webhooks refusent une absence de signature ; Connect refuse une signature erronée et accepte la signature valide jusqu’au contrôle obligatoire du compte connecté ; HTTP redirige vers HTTPS en 301. La sonde signée ne contient aucun compte connecté et s’arrête avant toute lecture/écriture en base. Elle n’atteste pas un traitement métier de paiement.

Contrôle distant en lecture seule : 107 migrations, quatre ateliers gratuits, `subscription_open=false`, `online_payment_open=false`. Aucune migration nouvelle. Preuves privées : `D:/CodexProjects/oppe-model-operation/stripe-live-preparation-20261005.json`, `stripe-live-worker-smoke.json`, `stripe-live-flags.json` et reçus Worker.

Vérification locale de la passation : TypeScript sans erreur. La suite de 3 498 tests obtient 3 493 réussites et cinq dépassements du délai de lecture des fichiers/bundles ; les trois fichiers concernés sont repris avec un seul worker, 18 tests réussis, y compris les cinq contrôles concernés, sans modification du code ni des assertions. Les deux résultats sont conservés.

Retour arrière de cette seule configuration : Worker `cbd5667f-3585-495a-addd-895842adf7c7`, même code, sans le secret C. Ne pas retirer le secret après ouverture de C sans maintenir le traitement et la reprise des événements.

Dernière vérification locale après correction de l’identité : **277 fichiers, 3 498 tests réussis**, avec deux workers et délai de 60 secondes ; TypeScript sans erreur. Aucun code applicatif modifié.

## Identité publique corrigée et relue

Identité publique corrigée dans le Dashboard et relue par l’API : nom Ma Reliure / Fine Bindery, descripteur `OPPE RELIURE`, préfixe `OPPE`, support `contact@oppe.fr`, site et URL de support `https://mareliure.fr`, description reliure/restauration et outil atelier. Le MCC `5734` reste inchangé et à qualifier auprès de Stripe.

Description enregistrée : « OPPE SAS vend des prestations de reliure et de restauration de livres sous les marques Ma Reliure et Fine Bindery, réalisées par des ateliers partenaires ; le client est débité lors du paiement du devis accepté. OPPE propose aussi aux ateliers un outil de devis, facturation et vitrine professionnelle par abonnement mensuel. »

Aucune identité légale, pièce personnelle ni coordonnée bancaire modifiée. Reçu privé `stripe-live-identity-corrected-20261005.json`, capture `stripe-public-identity-corrected.jpg`.

L’ancien logo WooPayments, constaté dans l’aperçu Checkout, a également été retiré des surfaces hébergées. La relecture API confirme `logo=null`, `icon=null`, `use_logo_instead_of_icon=false` : le nom commercial corrigé Ma Reliure / Fine Bindery est conservé, sans inventer de nouveau visuel. Couleurs principales existantes conservées ; contraste recalculé selon la contrainte Stripe ; couleurs de marque activées pour Checkout, paramètres de couleurs spécifiques conservés. Reçu privé `stripe-live-brand-corrected-20261005.json`, capture `stripe-brand-corrected.jpg`.

## Connect : configuration test vérifiée, vérification live requise

Connect test préparé sur `acct_1UGISJKB3EBc6Slh` : compte fictif français `acct_1UNGxgKB3EtvZpEO` généré par Stripe, objet Accounts v2, Dashboard `full`, responsabilités frais/pertes/exigences collectées par Stripe relues par l’API. Démonstration automatique de paiement direct réussie : `pi_3UNH3cKB3EtvZpEO1rml1DuM`, 100 € fictifs, 3 € de frais plateforme, 3,40 € de frais Stripe, 93,60 € nets. Les capacités restent restreintes ; cette démonstration ne constitue pas une recette de l’application. Au retour live, la confirmation d’intégration est bloquée sur une vérification personnelle Stripe Identity : pièce d’identité avec photo et selfie du titulaire, traitement biométrique. L’écran est prêt ; aucun consentement ni image personnelle transmis par l’agent. Activation Connect live non attestée, aucun compte atelier live créé. Adapter le socle applicatif Accounts v1 à v2 et effectuer la recette complète avant ouverture.

Les trois étapes test du guide Stripe sont terminées. L’atelier test conserve les exigences non satisfaites ; ne pas inventer son KYC. Les frais Stripe de 3,20 € affichés avant création étaient illustratifs : le reçu réel retourne 3,40 €. Ne pas créer de fausse facture ou de faux client live pour cocher le guide. Reçu privé `stripe-connect-test-fixture-20261005.json`, captures `stripe-connect-test-payment.jpg` et `stripe-connect-live-identity-required.jpg`. Reprendre dans le [Dashboard Connect live](https://dashboard.stripe.com/acct_1UGI34K0Q47WbZPf/connect/onboarding).

## Conditions restantes

- Stripe Tax : `status=active`, siège français existant et catégorie par défaut `txcd_10202000`, mais **zéro immatriculation fiscale enregistrée**. Aucun réglage fiscal modifié. L’expert-comptable doit décider des obligations, catégories et immatriculations applicables ; ne pas confondre statut actif avec collecte effective. `WORKSHOP_SUBSCRIPTION_TAX_APPROVED` reste absent. [Documentation officielle](https://docs.stripe.com/billing/taxes/collect-taxes).
- Juridique : validation des conditions, médiation et autres clauses toujours non obtenue ; liens juridiques du portail à poser après validation. Le portail est configuré, son parcours hébergé n’est pas encore éprouvé.
- Connect : vérification personnelle du titulaire requise avant confirmation live ; webhook et démonstration test ne prouvent pas l’activation live. Le socle publié utilise Accounts v1 alors que le compte généré par Stripe est Accounts v2. Adapter création, onboarding, capacités et événements, puis recette applicative complète avant ouverture. [Guide officiel SaaS](https://docs.stripe.com/connect/saas).
- C : reprise d’un Checkout complété en échec, succès/refus/asynchrone, avoirs/remboursements, litiges, reçus, e-mails et frais réels à éprouver. Aucun atelier réel ni données KYC inventés.
- Sendcloud : secrets et test physique réel toujours manquants. Premier paiement réel puis remboursement non effectués. Offre internationale toujours à définir avec des tarifs réels.
