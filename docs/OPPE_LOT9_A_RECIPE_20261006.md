# Lot 9 — nouvelle recette A et reprise des confirmations, 6 octobre 2026

## Périmètre attesté

Cette recette est nouvelle, exécutée dans l'application hébergée sur `mareliure-oppe-lot7-qa.aferriere.workers.dev`, base isolée `qwfhebtxeubfmvvdsqdt`, compte Stripe test existant `acct_1UGISJKB3EBc6Slh`. Toutes les identités, prestations, décisions fiscales, références de règlement et étiquettes sont explicitement fictives. Aucun débit réel, virement ou achat d'affranchissement. Elle ne reprend pas comme preuves les recettes annoncées dans la passation.

Les parcours normaux ont servi à présenter les livres, inviter et choisir l'atelier, accepter les accords et devis, payer, déclarer le suivi, facturer et rapprocher. Les scripts privés lisent ensuite Stripe et la base pour corroborer le résultat ; ils ne fabriquent pas ces paiements ou documents.

## Ma Reliure — RL-057

Dossier `0ac300e6-ba14-478e-af41-c21fc6cebdca`, devis `26fd0589-37f1-4c42-b917-855667681392`, ouvrage importé `bafb3e5b-afab-44aa-850b-45b7572adfa1`.

- Présentation normale, mission atelier acceptée à 150 € HT et 21 jours, choix administratif de cet atelier. Vente Oppe à 200 € HT, marge cible de 25 % du prix de vente.
- Absence initiale de qualification/taux, puis décision manuelle explicitement fiscale de recette : service à 5,5 %, total 211 € TTC. Aucun taux automatique choisi pour un nouveau devis.
- Acceptation par le client connecté avec adresse de facturation et conditions enregistrées. Checkout test `cs_test_a1RfWJd8SFH3QJHCtbs83nl3ISQ91hj9bdMLRu5CHEvRae2sJThqLtfeUf`, carte de test, paiement confirmé par webhook.
- Une facture Oppe `MR-2026-00003`, 211 € TTC. PDF effectivement téléchargé depuis l'espace client, extrait et inspecté visuellement ; vendeur OPPE SAS et marque corrects. Frais Stripe réels 6,90 €.
- Import conservant origine Oppe et marque : l'atelier n'a ni devis ni facture au client final ; rémunération seule 150 € HT. Cinq déclarations normales : aller, livré transporteur avec référence de preuve, réception physique distincte, retour, remise finale déclarée par l'atelier. Ce scénario utilise le suivi manuel historique sans forfait organisé ni étiquettes achetées.
- Commande terminée, facture fournisseur `F-OPPE-RL-057` à 150 € HT, régime fictif de franchise en base, échéance 5 novembre. Contrôle administratif puis règlement déclaré simulé de 150 € ; aucun virement réel.
- Deux remboursements Stripe test de 20 € et 10 €, réussis, avoirs `MR-AV-2026-00003` et `MR-AV-2026-00004`. Facture originale inchangée à 211 €, un seul ordre et une seule facture fournisseur.
- Rejeux des véritables événements Stripe Checkout et PaymentIntent puis doublon : les identifiants et cumuls restent identiques.

La clé Resend était absente du Worker QA lors de ce paiement. La confirmation de ce dossier ancien reste sans horodatage d'envoi ; ne pas annoncer cet e-mail livré. L'événement avait été absorbé comme traité par l'ancien code, ce qui a motivé la correction ci-dessous.

## Fine Bindery — RL-058

Dossier `4f3c57d2-6ba7-4d4b-90da-dc8cd3567d93`, devis `010e465d-dbd0-444f-8c57-a9917a97a22b`, ouvrage `61c74b62-b5ca-4037-a366-9134272a8d9a`.

- Présentation normale Fine Bindery sans lien personnel : circuit A. Mission atelier acceptée à 150 € HT et 21 jours. Prix de scénario 260 € HT ; la dérogation à la marge cible est refusée tant que sa motivation manque, puis enregistrée comme simulation seulement. Aucun tarif commercial inventé ou ajouté au catalogue.
- Le client saisit le plan France 450 g, 250 × 180 × 60 mm, adresses fictives. L'atelier accepte la réception sur ce même plan v1. Forfait organisé distinct 15 € TTC. Qualification manuelle de recette : service 260 € HT à 5,5 % et transport 12,50 € HT à 20 %, soit 272,50 € HT, TVA 16,80 €, total 289,30 € TTC.
- L'acceptation client montre les conditions OPPE SAS sous Fine Bindery, même lorsque le dossier est ouvert depuis l'hôte QA partagé Ma Reliure. La marque enregistrée du dossier décide la langue et le contrat ; les bandeaux généraux de cet hôte QA restent ceux de son portail.
- Checkout normal `cs_test_b1kXSg8yIzFk9F06MUdJuGDTrNNAIB0ywAANNQXhYC4fVkLP0cV9zREyVm` : refus réel en mode test de la carte officielle pour fonds insuffisants, session toujours ouverte/impayée, zéro facture. Reprise du même Checkout avec carte test valide : 289,30 € payés, une seule facture `FB-2026-00003`, frais Stripe réels 9,36 €.
- Dépôt administratif du PDF clairement fictif « NE PAS EXPÉDIER » pour l'aller, coût réel nul. Téléchargement client depuis son bouton normal : ouverture du PDF dans le bucket privé par lien signé temporaire, distinct du journal atelier.
- Import atelier gardant Fine Bindery et origine Oppe, aucune vente finale atelier. Aller déclaré, preuve transporteur, réception physique confirmée. Déclaration « retour prêt » avec colis dans les limites ; adresse ensuite reconfirmée par le client. Le dépôt du PDF retour devient alors disponible et est enregistré à coût nul. Étiquette retour visible côté atelier. Retour puis remise finale déclarée avec preuve ; cinq événements conservés.
- Commande terminée, facture fournisseur `F-OPPE-RL-058` à 150 € HT, échéance 5 novembre, contrôlée puis réglée par déclaration fictive de 150 €.
- Remboursement intégral Stripe test `re_3UNaxDKB3EBc6Slh1it5w3iZ` réussi : 28 930 centimes, un avoir `FB-AV-2026-00003` de même montant, facture originale inchangée. Pas de nouveau paiement ou de nouvelle commande.

## Confirmation échouée puis reprise hébergée

L'ancien code conservait commande/facture après une panne d'e-mail mais répondait 200 au webhook : Stripe ne pouvait pas reprendre la confirmation. Le lot conserve les écritures financières idempotentes et propage l'échec après tentative d'alerte ; l'événement reste en erreur et peut être rejoué.

Le nouveau paiement Fine Bindery a réellement rencontré l'absence de clé e-mail : `evt_1UNb04KB3EBc6Slhm7xDXULQ` et `evt_3UNaxDKB3EBc6Slh1zKqTF4W` enregistrés `failed`, une commande et une facture présentes, confirmation vide. La clé Resend existante du projet a ensuite été réutilisée sur QA, avec le mode de simulation protégé ; domaine `mareliure.fr` vérifié par l'API du prestataire.

Renvoi des deux véritables événements via Stripe CLI, puis doublon : événements `processed`, erreurs effacées, confirmation horodatée, même facture et même commande. Resend atteste une seule confirmation Fine Bindery, ID `01a11203-1f11-7c06-9225-0c5c6b958cba`, destinataire `delivered@resend.dev`, statut simulé `delivered`, montant 289,30 €, numéro de facture et lien canonique Fine Bindery corrects. Ceci atteste le transport API et la simulation de livraison ; aucun client réel n'a reçu cet e-mail.

Le drapeau serveur `RESEND_TEST_DELIVERY=true` remplace tous les destinataires Resend par le [récepteur officiel de simulation](https://resend.com/changelog/sending-test-emails), y compris les alertes administratives, et refuse tout envoi si la clé Stripe n'est pas `sk_test_`. Il n'est pas installé en production. Expéditeur, contenu, lien et clé d'idempotence restent ceux du parcours normal. La confirmation Fine Bindery utilise le nom Fine Bindery et l'adresse technique authentifiée `noreply@mareliure.fr` ; `finebindery.com` n'est pas présenté comme domaine Resend vérifié.

## Corrections issues de cette recette

Marque du dossier dans la réponse client et son contrat ; marque dans la mission et les interlocuteurs atelier ; rôles Client/Vous correctement identifiés dans la conversation des clients propres. Invalidation immédiate du panneau de retour après un événement du journal, pour ne pas attendre son rafraîchissement périodique. Les documents et factures historiques ne sont pas réécrits.

Les preuves détaillées, captures et reçus sont conservés hors Git dans `oppe-model-operation` : `lot8-a-mr-final-proof-private.json`, `lot9-a-fb-final-proof-private.json`, `lot9-a-fb-real-event-replay.json`, `lot9-a-fb-resend-simulated-delivery-private.json`, PDFs et captures. Aucun secret dans ce journal.

Le lot ne comporte pas de SQL. Les 115 migrations du lot 8 restent en place ; retour arrière applicatif vers `656dabba-39db-4e53-b12b-9ba1dc655eda`, compatible avec plusieurs avoirs par facture, sans inverse SQL. B/C restent fermés en production. Les exigences personnelles Stripe, validations fiscales/juridiques, accès Sendcloud et premier test réel restent externes, comme précisé dans le journal du lot 8.

## Vérification locale et hébergée

Version QA finale `04cb7378-3f9d-4067-85e0-245f48ff1287`. Suite entière finale : 3 618 tests, 291 fichiers, réussis ; TypeScript réussi, lint sans erreur, 19 avertissements préexistants. Les tests de reprise reproduisaient l'échec de confirmation absorbé avant la correction ; ils couvrent désormais les reprises sans double facture/commande, clés de déduplication, marque et lien corrects, alerte en panne, frais Stripe temporairement indisponibles, ainsi que l'interdiction du mode e-mail simulé en Stripe live.

## Publication et dernière inspection des PDF

PR #92 fusionnée après CI verte : merge `a11866d15a073fefe9037314b276feb85a14b4ff`, Worker `3528f090-0c6b-4be0-83e7-c71480df65ce` publié à 100 % le 6 octobre à 16:52:48 UTC. Dix-huit bindings conservés, 115 migrations et offres fermées, quatorze contrôles HTTP réussis. Facture et avoir Fine Bindery réellement téléchargés et inspectés ; le PDF d'avoir a révélé une mention erronée d'annulation intégrale et de remboursement par l'atelier.

Correction publiée par #93, merge `a71f83e77f4b5201abbefc0412f2bf79020d7ef2` : Worker `42570020-0a67-48d0-812a-b05da1a4be70`, 100 %, 17:12:47 UTC. Nouvelle mention limitée au montant de l'avoir et neutre quant à l'acteur du remboursement. Nouveaux téléchargements normaux de l'avoir partiel MR -20 € et intégral FB -289,30 €, rendus et relus visuellement ; montants et factures originales conservés. Suite stable finale 3 618 / 291, CI PR/main vertes. Clients MR/FB sur mobile sans débordement ; réponse atelier effectivement reçue chez le client propre.

La vitrine et les ouvertures de recette ont été remises en état fermé, les seuls secrets e-mail ajoutés sur QA retirés ; les historiques restent disponibles. Version QA après retrait des secrets `d2cdebe0-d28f-41e7-812d-777201e8093f`. Voir [le reçu final](OPPE_FINAL_PUBLICATION_20261006.md) pour la publication, le retour arrière et les dépendances externes.
