# Audit des circuits — état réconcilié le 5 octobre 2026

> Mise à jour du 5 octobre 2026. Le modèle A déployé remplace les anciennes orientations de commission réseau et de conciergerie. Les textes antérieurs sont consultables dans l'historique Git, notamment au commit 77af584. Les contrats et documents émis restent figés.

## Modèle applicable

| Activité                         | Vendeur et facture                                                            | Prix et rémunération                                                                                                  | État                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A : projet vendu par Oppe        | OPPE SAS vend et facture le client, par marque MR/FB. L'atelier facture Oppe. | Marge cible 25 % du prix de vente HT : 150 € atelier → 200 € vente. Dérogation motivée. Règlement atelier à 30 jours. | En production, Worker b812e4cc, 102 migrations au terme du lot 5.                     |
| B : outil atelier                | Oppe fournit le logiciel ; l'atelier facture ses clients propres.             | Abonnement 15 € HT/mois. Ateliers existants gratuits jusqu'à accord exprès de transition.                             | Code et migrations préparés dans la suite B/C ; ouverture payante fermée.             |
| C : services aux clients propres | L'atelier reste vendeur et facture son client.                                | Règlement direct gratuit ; paiement en ligne : 3 % du TTC encaissé, frais Stripe distincts à la charge de l'atelier.  | Règlement déclaré déjà disponible ; socle Connect préparé, ouverture en ligne fermée. |

La marque ne détermine pas l'origine commerciale. Les projets Oppe et les clients propres sont séparés en base et côté serveur. Aucun devis/facture atelier au client d'une commande Oppe ; aucun Checkout Oppe sur client propre. L'atelier ne reçoit ni prix client ni marge A.

## Documents et fiscalité

L'atelier accepte sa prestation, sa rémunération et son délai. Seul le client accepte le devis Oppe, avec preuve. La TVA de vente A se qualifie par ligne avec décision motivée de l'administration ; la TVA d'achat atelier est distincte. Aucun taux n'est présumé. Les factures, avoirs, accords et paiements fournisseurs émis sont immuables.

La suite B/C ajoute des avoirs partiels par prestation et taux, avec plafonds cumulatifs et TVA d'origine après remise. Un avoir intégral suivant un avoir partiel porte sur le reliquat. Les remboursements Stripe C passent par un avoir rapproché ; un remboursement extérieur non rapproché est signalé.

## Réconciliation de l'audit du 28 septembre

La commission d'apport de 25 % et le circuit network_sale ont été retirés par les PR #78/#79. La conciergerie ne constitue plus un circuit financier distinct. La seule règle de 25 % applicable aux nouvelles ventes Oppe est une marge du prix de vente HT. Aucun contrat historique n'est requalifié.

Les ateliers facturent Oppe pour A et leurs clients pour B/C. Connect C utilise des paiements directs sur le compte connecté de l'atelier ; il ne répartit pas les paiements A. Le journal déclaratif existant ne vaut jamais preuve d'un encaissement Stripe.

## Preuves et limites

Le circuit A a une recette complète Ma Reliure/Fine Bindery en Stripe test et un smoke production consigné dans la passation. La suite B/C dispose de tests PostgreSQL et de tests serveur ; sa recette hébergée et live reste décrite explicitement dans [OPPE_BC_COMPLETION.md](OPPE_BC_COMPLETION.md). Les accès et réglages externes ne sont pas déduits du dépôt.
