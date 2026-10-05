# Ouverture progressive des activités Oppe

> Mise à jour du 5 octobre 2026. Le modèle A déployé remplace les anciennes orientations de commission réseau et de conciergerie. Les textes antérieurs sont consultables dans l'historique Git, notamment au commit 77af584. Les contrats et documents émis restent figés.

## Autorisation du chantier

Le propriétaire a demandé le 5 octobre 2026 de poursuivre tous les chantiers à la suite de la passation. Cette autorisation de travail ne vaut ni validation par un expert-comptable, ni avis juridique, ni accord de transition d'un atelier gratuit.

## A — déjà ouvert

Vendeur OPPE SAS, accord atelier, marge cible 25 % du prix de vente HT, devis accepté exclusivement par le client, facture Oppe, facture fournisseur atelier et virement rapproché à 30 jours. TVA décidée par ligne. PR #78 à #85 fusionnées ; Worker de référence b812e4cc, 102 migrations.

## B — ouverture payante fermée

Le catalogue doit être créé sur le compte Stripe live dédié ; le prix doit être exactement 15 € HT, EUR, mensuel, hors taxes. Configurer Stripe Tax et le portail de facturation ; faire valider la fiscalité du service et poser WORKSHOP_SUBSCRIPTION_TAX_APPROVED=true seulement après cette validation.

Faire relire les [conditions ateliers](../src/routes/conditions-ateliers.tsx), puis éprouver Checkout, renouvellement, refus, impayé, résiliation fin de période, événements doublés/hors ordre, gratuité des anciens ateliers et téléchargement historique. Ouvrir ensuite l'indicateur serveur marketplace_workshop_offer_settings.subscription_open et l'annonce WORKSHOP_OFFER.subscriptionOpen. Aucun ancien atelier n'est prélevé sans accord explicite du propriétaire.

## C — ouverture en ligne fermée

Activer Connect sur le compte live dédié. Utiliser un compte connecté dont le Dashboard est complet, les frais Stripe sont payés par l'atelier et les pertes sont gérées par Stripe. Le compte Express ancien supporté par Oppe est incompatible avec cette configuration.

Configurer le webhook Connect dédié et STRIPE_CONNECT_WEBHOOK_SECRET. Abonner aux événements checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded et charge.dispute.*. Vérifier les événements du bon compte connecté, les frais réels, les reçus et les notifications Stripe.

Recette avant ouverture : facture atelier de client propre, lien client, succès/refus/asynchrone, retour navigateur sans preuve de paiement, mauvais montant/devise/session/compte, doublons, reprise après panne, remboursements partiel/total avec avoirs, litige et absence de mélange avec les règlements déclarés. La première version est limitée aux factures sans acompte ; les reprises après un Checkout complété refusé restent une tâche d'exploitation.

Puis ouvrir marketplace_workshop_offer_settings.online_payment_open et WORKSHOP_OFFER.onlinePaymentOpen. Les 3 % portent sur le TTC réellement encaissé ; les frais Stripe sont distincts et à la charge de l'atelier.

## Transport et contrôles externes

Le forfait A à 15 € TTC conserve son périmètre français admissible et ses limites de couverture. Les transports des clients propres sont déclarés avec facture de commande, payeur, coût et référence de couverture. Aucune extension automatique à C ou à l'international. Une offre internationale se chiffre avant achat ; les secrets et un aller-retour Sendcloud réel restent à fournir/éprouver.

Identité publique Stripe live, validation de la matrice TVA A, revue juridique des clauses signalées et premier paiement réel de faible montant suivi d'un remboursement restent nécessaires. Les tests techniques ne les certifient pas.

[Procédure de sauvegarde, répétition et publication](OPPE_BC_COMPLETION.md).
