# Lot 7 — parcours B/C reliés, 6 octobre 2026

Publié le 6 octobre 2026 : PR [#90](https://github.com/antoineferriere2-star/mareliure/pull/90), code `9d67ddb`, merge `a6923630600d5484c8be3e2202bb1d2e8def8cef`, Worker `6283a91b-1a56-4fac-ba3f-9e96e9896fbe` à 100 %, déploiement `e4ff1bbc-18d2-4fc7-aff9-299fccb5d4c8`. Les quatre migrations sont confirmées en production : 111 migrations, dernière `20261007130000`. B/C restent fermés, quatre ateliers historiques gratuits. PR #89 documentaire fusionnée après relance verte ; merge `4eebb7757866901c44b81257589bcc6c22322bde`.

## Changements vérifiés

- SDK Stripe 23.0.0 et API stable `2026-09-30.endive`, selon la documentation officielle actuelle. La passerelle Billing Métré conserve sa version contractuelle.
- Comptes atelier Accounts v2 : récupération par identifiant lié ou métadonnées uniques, configuration client et marchand sur le même compte, Dashboard complet et collecte des exigences par Stripe. Un compte lié n'est pas recréé. L'actualisation ne réécrit pas son identité.
- Onboarding hébergé, reprise et lecture des capacités. Paiement C refusé tant que les paiements par carte et virements ne sont pas actifs, ou si les responsabilités ne correspondent pas au modèle. Événements v2 thin signés avec un secret distinct ; anciens webhooks snapshot conservés.
- Checkout B/C réservé avec reprise des réponses perdues et des seuls échecs terminaux vérifiés. Montants, devises, vendeurs et frais rapprochés avant enregistrement. Retour navigateur sans effet sur les droits.
- Droits B issus de l'abonnement relu et de sa facture actuelle effectivement payée. Résiliation du portail normalisée depuis `cancel_at`, même lorsque `cancel_at_period_end` est faux. Documents historiques accessibles après perte des droits de création.
- Factures B, reçus C, frais Stripe réels, remboursements de frais d'application, remboursements par avoir avec reprises et journal des litiges. Aucun règlement déclaré ne se transforme en preuve Stripe.
- Notifications persistées, bail de livraison, clé fournisseur stable et reprise après erreur. En recette isolée, contenu des courriels rendu et capturé ; `sent_at` reste nul.
- Lien C récupérable par le propriétaire sans rotation du secret client, chiffrement AES-GCM avec liaison à l'atelier et au paiement. Clé de chiffrement stable à conserver avec les sauvegardes, indépendamment des rotations de clé Stripe.
- Nouveaux ateliers sans gratuité automatique ; les quatre ateliers historiques restent gratuits.

## Recette réellement effectuée dans l'application

Application Cloudflare dédiée : `mareliure-oppe-lot7-qa.aferriere.workers.dev`, Supabase `qwfhebtxeubfmvvdsqdt`, Stripe test `acct_1UGISJKB3EBc6Slh`. Authentification normale d'un propriétaire fictif, aucun en-tête d'usurpation. Paramètres fiscaux et juridiques explicitement simulés dans cet environnement uniquement, sans validation live revendiquée.

Version QA `e626d78f-db85-4a2f-b5c4-970b3dbb6a11` : abonnement accepté, Checkout hébergé payé par carte de test, webhooks réellement livrés, droits enregistrés, facture consultable et portail ouvert depuis l'application. Checkout `cs_test_a1YK5wACEzdGJAw2gIK5tZw4ksJJu8HVk4l5VWnMuzO6p3vRbfw4XARtXy`, abonnement `sub_1UNTIeKB3EBc6Slh423XaxEM`, facture `in_1UNTIcKB3EBc6SlhNMBdul9K` : 15 € HT et 18 € TTC, paiement fictif. Résiliation à échéance le 6 novembre constatée dans le portail puis en base ; droits conservés jusqu'à cette date. Notifications de facture et résiliation capturées, aucun destinataire réel contacté. Vue mobile 390 × 844 sans débordement horizontal, preuves bureau/mobile enregistrées dans les opérations privées.

Le même compte `acct_1UNTDkKB3EC6OVAY` est réutilisé pour C. L'onboarding test et sa reprise ont été ouverts depuis l'application ; les capacités sont encore restreintes. Après le démarrage de l'Account Link, Stripe refuse les modifications de l'identité par l'API et interdit l'acceptation des conditions par la plateforme lorsque Stripe collecte les exigences. Le parcours demande la création des identifiants personnels du titulaire du Dashboard complet. Aucun mot de passe Stripe, consentement ni identité personnelle saisis par l'agent. Le paiement C reste refusé : **succès, remboursement et litige C dans l'application ne sont pas encore attestés**. La démonstration Stripe du lot 6 n'est pas comptée comme recette de l'application.

Vitrine du même atelier fictif : enregistrement du profil, aperçu privé, refus de publication avant approbation, approbation simulée dans qwf puis publication par l'interface et affichage public attestés. La demande et les autres circuits restent en cours de recette.

## Contrôles et migrations

Suite complète : 3 548 tests / 283 fichiers réussis, exécution à un worker local pour éviter les délais d'analyse des fichiers sous Windows. Aucun délai d'assertion affaibli. Tests significatifs de notifications, doublons, concurrence, reprise Checkout, remboursements, signatures et récupération de compte inclus. TypeScript réussi ; lint sans erreur, 19 avertissements préexistants.

Quatre migrations additives, dans l'ordre : `20261007100000`, `20261007110000`, `20261007120000`, `20261007130000`. Répétées sur restauration PostgreSQL 17 de la production puis appliquées à qwf ; aucun document métier historique modifié. Extension Supabase Vault indisponible dans la restauration locale : huit diagnostics limités à cette extension et ses objets, sans effet sur les douze empreintes métier contrôlées. Transaction complète de production répétée sur une seconde restauration de la sauvegarde fraîche puis appliquée une seule fois, avec garde des 107 migrations attendues, offres fermées et comparaison des empreintes historiques ; COMMIT confirmé. Relecture de production : 111 migrations, offres fermées et quatre ateliers gratuits.

Sauvegarde production avant lot 7 : 1 270 567 octets, 1 696 entrées, SHA256 `e30d7e529133b2015db27666d1766a8205a5bdd7745a773810b026081656f1db`. Archives, secrets, accès test et reçus détaillés dans `oppe-model-operation`, hors Git.

Sauvegarde fraîche immédiatement avant application : 1 270 567 octets, 1 696 entrées, SHA256 `9f28bb6096bce2ae6af29048899b21af83b2083c9e4f5af8d4e1202c678b42eb`. Build production vérifié : référence Supabase `hljxohondjvrkzqicexl` seule dans le client, compatibilité workerd et CPU 1 000 ms conservés. Empreinte de code identique entre version uploadée et version avec les deux nouveaux secrets ; tous les secrets historiques conservés. Destination live v2 thin `ed_61VWrvm5wr8DZ5xbT16VPg0QA1DPv2rtG6rZlIVhI9t2`, secret de signature distinct et clé stable des liens C installés. Douze contrôles HTTP réussis sur les deux marques : refus sans signature, refus de signature invalide, vérification de la signature Connect historique et redirection HTTP vers HTTPS. Aucun débit réel ni nouveau compte atelier live.

## Conditions d'ouverture

Production B/C fermée jusqu'aux preuves nécessaires : identité Stripe live du titulaire, qualification fiscale et immatriculations validées par l'expert-comptable, revue juridique, recette C achevée et premier paiement réel expressément préparé. Aucun taux ni consentement n'est inventé. Les indicateurs d'approbation simulés de qwf ne sont jamais copiés en production.

Sendcloud : contrôle actuel du Worker de production, aucun secret `SENDCLOUD*` configuré. Aucun achat d'étiquette ni expédition réelle exécutés. Le transport international reste fermé faute de qualification et tarif fournisseur.

Retour arrière compatible : fermer B/C et conserver les migrations et documents ; Worker du lot 6 `8f9d80ce-82a3-4848-8e9a-0bc1edc383ae` compatible avec plusieurs avoirs, sans remise à une version antérieure au lot 6. Revenir à cette version suspendrait les événements v2 ; conserver leur destination et rejouer les événements après correction. Ne jamais remplacer les secrets des webhooks A et Connect existants.
