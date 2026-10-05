# Modèle commercial et facturation — Oppe, Ma Reliure et Fine Bindery

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

## Sources et publication

- [Passation du modèle A](CODEX_HANDOFF_OPPE_MODEL.md).
- [Suite B/C et limites de recette](OPPE_BC_COMPLETION.md).
- [Matrice TVA à valider](oppe-tva-matrice-expert-comptable.md).
- [Prérequis d'ouverture](payment-activation-contracts.md).

Le produit et le prix B ont été créés en Stripe test uniquement. Les accès live, la revue juridique, l'expert-comptable et Sendcloud restent à traiter. Le journal D:/CodexProjects/oppe-model-operation/PUBLICATION.md atteste les déploiements réellement effectués ; la présence d'une branche ou d'un fichier ne prouve pas leur mise en production.
