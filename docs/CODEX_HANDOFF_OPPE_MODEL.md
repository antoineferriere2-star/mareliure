# Passation Codex — modèle Oppe, état courant du 7 octobre 2026

Lire d'abord [le lot 13 : recette C et publication vérifiée](OPPE_LOT13_C_RECIPE_20261007.md) et [la décision fiscale](OPPE_FISCAL_DECISION_20261007.md). **A, B et C sont ouverts en production** ; B à 18 EUR TTC/mois, C à 3 % du montant encaissé TVA comprise hors frais Stripe, quatre gratuités conservées. Chaque atelier complète son onboarding ; encaissement interdit sans capacités Stripe actives. Recette C hébergée terminée avec fixtures officielles sur un compte test supplémentaire, compte initial conservé. PR98 merge 07fbcb7c, Worker d4e58fd7 à 100 %, 118 migrations, CI PR/main verte, 26 contrôles de production. Sendcloud reste fermé faute de clés accessibles et de recette réelle ; ancien indicateur explicitement refermé sans effacer ses preuves. Aucun débit réel ni étiquette achetée. Le bloc Latest handoff est la mémoire courante. Les bilans ci-dessous décrivent exclusivement l'historique du 6 octobre et ne remplacent pas cet état vérifié.

## État historique du 6 octobre 2026

**Mise à jour administrative du 6 octobre 2026 :** lire d'abord
[l'approbation du propriétaire et les exceptions live B/C](OPPE_ADMINISTRATIVE_APPROVAL_20261006.md).
Les taux A configurés sont approuvés administrativement ; aucun avis comptable ou juridique n'est
présumé. Le compte Stripe Oppe live n'a désormais aucune exigence d'identité restante : la demande
de pièce/selfie ci-dessous est périmée. L'onboarding du compte atelier test reste incomplet.

Le [bilan final vérifié](OPPE_FINAL_PUBLICATION_20261006.md) remplace l'état de reprise du lot 6. Les journaux datés restent des preuves historiques distinctes.

## Production

PR #89 à #93 fusionnées après CI verte. Code applicatif 711b5ab92f34daa974640cc3730a63a9aefb0dfa, merge a71f83e77f4b5201abbefc0412f2bf79020d7ef2. Worker **42570020-0a67-48d0-812a-b05da1a4be70**, 100 %, publié à 17:12:47 UTC. 115 migrations, quatre ateliers historiques gratuits, B/C fermés. Dix-huit bindings/runtime conservés, aucune simulation e-mail de production.

## Parcours

A : vente/facture Oppe, accord atelier, commande, fournisseur et règlement enregistré ; nouveaux parcours complets MR/FB en Stripe test avec remboursements partiels et intégral. Confirmation Fine Bindery reprise après panne sans doublon ; livraison e-mail simulée vers Resend officiel seulement. PDFs factures/avoirs et portails mobile/bureau vérifiés. A reste ouvert avec qualification fiscale administrative ; premier test réel non effectué.

B : 15 EUR HT/mois, Checkout, factures, portail, droits, renouvellement, échec/reprise, résiliation effective et accès historique vérifiés. Notifications rendues/capturées, sans destinataire réel. Offre fermée faute de validations fiscales/juridiques ; les quatre gratuités historiques sont préservées.

C : paiements directs Accounts v2 sur le compte atelier existant, 3 % TTC et frais Stripe distincts ; onboarding/reprise, exigences et refus sans capacités éprouvés. Tests d'intégration de reprises, concurrence, remboursements, frais et litiges. Compte test existant acct_1UNTDkKB3EC6OVAY : 14 exigences et cartes/virements restricted. Titulaire nécessaire pour les identifiants et l'onboarding ; aucun KYC ni consentement inventé. Succès, remboursement et litige C hébergés non attestés avant résolution. C reste fermé.

Vitrines/clients propres : publication, modification, demande, vendeur atelier conservé, devis accepté et facture atelier, deux avoirs, déclarations de règlement/remboursement/litige, conversation reçue et isolation entre ateliers. Transport manuel : adresses/colis/payeur, journal/proofs, labels privés aller/retour. PDFs fictifs sans achat ni expédition ; Sendcloud réel reste externe. Aucun forfait international inventé.

## Vérification et reprise

3 618 tests / 291 fichiers verts, TypeScript sans erreur, lint sans erreur (19 avertissements préexistants), CI PR/main verte. Quatorze contrôles HTTP de production sur deux domaines et inspections bureau/mobile. Sauvegarde/migrations additives répétées et douze empreintes historiques conservées ; aucun SQL lot9/10. Rollback compatible multi-avoirs vers Worker 3528f090 lot9 ou 656dabba lot8 ; conserver migrations/documents/webhooks/clé stable C.

QA B/C refermés, vitrine fictive retirée et approbation draft, Auth original rétabli, résiliation test originale restaurée, historiques conservés, secrets e-mail temporaires retirés. Les paramètres de recette ne valent aucune approbation live.

Actions externes : vérification personnelle Stripe live, onboarding personnel du compte connecté test puis recette C, validation expert-comptable TVA/immatriculations, revue juridique, secrets/couverture Sendcloud et test physique, premier paiement réel faible montant et remboursement. Zéro débit réel par Codex.

Lire [le lot 7](OPPE_LOT7_CONNECTED_JOURNEYS_20261006.md), [le lot 8](OPPE_LOT8_OWN_CLIENT_JOURNEYS_20261006.md) et [la nouvelle recette A](OPPE_LOT9_A_RECIPE_20261006.md) pour les preuves propres et leurs limites. Reçus, captures, PDFs et sauvegardes privés hors Git : D:/CodexProjects/oppe-model-operation. Le bloc Latest handoff de CODEX_HANDOFF.md constitue la mémoire opérationnelle courante ; ne pas afficher ses anciennes données sensibles.
