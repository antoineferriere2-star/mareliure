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

## Identité publique : anomalie vérifiée, correction en attente

La relecture live confirme des résidus Securicom/BTP :

- Descripteur et préfixe : `SECURICOM`.
- E-mail de support : `contact@securicom.shop`.
- Description : « Plateforme de mise en relation entre professionnels du btp ».
- Site : `https://www.oppe.fr`, URL de support absente ; MCC `5734`.

Le dossier historique contient les valeurs convenues avec l’utilisateur : support `contact@oppe.fr`, site et URL de support `https://mareliure.fr`, identité OPPE et description reliure/restauration. Le descripteur long doit satisfaire les contraintes Stripe ; si `OPPE` seul est refusé, utiliser une formulation explicite conforme telle que `OPPE RELIURE`, avec préfixe `OPPE`. Ne pas déclarer le MCC approprié sans validation de l’activité auprès de Stripe.

Le connecteur donne accès en lecture à ces champs, mais ne propose pas leur écriture. Le [Dashboard du compte](https://dashboard.stripe.com/acct_1UGI34K0Q47WbZPf/settings/public) a été ouvert ; la session du navigateur n’est pas authentifiée. Une connexion utilisateur est demandée pour appliquer puis relire la correction. **Aucune correction d’identité publique n’est attestée.**

## Conditions restantes

- Stripe Tax : `status=active`, siège français existant et catégorie par défaut `txcd_10202000`, mais **zéro immatriculation fiscale enregistrée**. Aucun réglage fiscal modifié. L’expert-comptable doit décider des obligations, catégories et immatriculations applicables ; ne pas confondre statut actif avec collecte effective. `WORKSHOP_SUBSCRIPTION_TAX_APPROVED` reste absent. [Documentation officielle](https://docs.stripe.com/billing/taxes/collect-taxes).
- Juridique : validation des conditions, médiation et autres clauses toujours non obtenue ; liens juridiques du portail à poser après validation. Le portail est configuré, son parcours hébergé n’est pas encore éprouvé.
- Connect : aucun compte atelier live présent. La création du webhook et la capacité `transfers` de la plateforme ne prouvent pas l’achèvement de l’onboarding Connect live. L’opération `EnableConnect` du connecteur ne prend en charge que les sandboxes autonomes ; elle ne peut pas activer ce compte live. Vérifier/achever l’activation dans le [Dashboard Connect](https://dashboard.stripe.com/acct_1UGI34K0Q47WbZPf/connect). Le socle C publié utilise Accounts v1 ; les guides actuels orientent les nouvelles intégrations vers Accounts v2. Cette adaptation et la recette complète restent à achever avant ouverture. [Guide officiel SaaS](https://docs.stripe.com/connect/saas).
- C : reprise d’un Checkout complété en échec, succès/refus/asynchrone, avoirs/remboursements, litiges, reçus, e-mails et frais réels à éprouver. Aucun atelier réel ni données KYC inventés.
- Sendcloud : secrets et test physique réel toujours manquants. Premier paiement réel puis remboursement non effectués. Offre internationale toujours à définir avec des tarifs réels.
