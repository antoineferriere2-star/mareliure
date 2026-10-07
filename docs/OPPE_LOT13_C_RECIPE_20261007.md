# Lot 13 — recette C hébergée, 7 octobre 2026

## Décision et périmètre

Autorisation du propriétaire : configurer, tester, fusionner, déployer et ouvrir C après recette complète et vérification de la plateforme live. L'approbation fiscale est administrative, datée du 6 octobre 2026 ; le propriétaire a confirmé le 7 octobre qu'OPPE collecte la TVA. Aucune validation d'expert-comptable ni revue juridique obtenue n'est prétendue. Factures historiques et anciennes conventions explicitement HT conservées.

C : **3 % du montant encaissé, TVA comprise, hors frais Stripe**. Pour 100 EUR encaissés : 3 EUR TTC = 2,50 EUR HT + 0,50 EUR de TVA à 20 %. Frais Stripe réels séparés, à la charge de l'atelier vendeur. OPPE facture la retenue à l'atelier ; aucun second paiement. B reste à 15 EUR HT + 3 EUR de TVA = 18 EUR TTC/mois ; quatre ateliers historiques gratuits.

## Compte initial conservé et fixtures officielles

Le compte test initial `acct_1UNTDkKB3EC6OVAY`, Dashboard complet, reste lié au même atelier avec ses 14 exigences. Stripe refuse la modification API des données d'identité après démarrage de son onboarding ; aucune identité ni connexion personnelle n'a été inventée.

Compte de recette supplémentaire `acct_1UNrE7KB3EgQZewb`, créé uniquement en test, Express avec gestion du risque par Stripe : mêmes paiements directs et collecte des frais/pertes/exigences par Stripe, Dashboard différent. Onboarding terminé depuis l'application hébergée avec les fixtures officielles ; capacités cartes/virements effectivement actives. L'exception de recette exige simultanément cet identifiant précis, sa métadonnée de recette, `livemode=false`, Dashboard Express, clé test, plateforme QA épinglée et URL QWF exacte. Elle ne fonctionne jamais en live et son binding ne doit jamais être déployé en production.

Documentation primaire : [tests Connect](https://docs.stripe.com/connect/testing), [vérification de test](https://docs.stripe.com/connect/testing-verification?accounts-namespace=v2), [gestion du risque par Stripe](https://docs.stripe.com/connect/risk-management/connected-accounts-with-managed-risk), [SEPA Checkout et fixtures](https://docs.stripe.com/payments/sepa-debit/accept-a-payment?payment-ui=checkout).

## Preuves de recette

Worker QA hébergé `mareliure-oppe-lot7-qa`, base QWF uniquement, Stripe test uniquement. Réservation, factures, liens et remboursements créés par les fonctions de l'application ; Checkout et retour client dans le navigateur. États financiers rapprochés des vrais objets et événements Stripe test, jamais forcés en SQL ni attestés par de faux webhooks.

| Cas | Preuve test |
| --- | --- |
| Refus carte puis réussite, même session | Facture F-2026-0001, paiement `dfb14cf0-1705-49ec-90a9-a0785199f698`, PI `pi_3UNrtyKB3EgQZewb0ysqKYZP` : 100 EUR, plateforme 3 EUR, frais Stripe 3,40 EUR |
| Remboursement partiel | Avoir atelier A-2026-0001 de 20 EUR, remboursement `re_3UNrtyKB3EgQZewb0NbvT5Gt`, avoir OPPE 0,60 EUR TTC |
| Remboursement intégral du solde | Avoir atelier A-2026-0002 de 80 EUR, remboursement `re_3UNrtyKB3EgQZewb00pZrLcd`, avoir OPPE 2,40 EUR TTC ; cumul client 100 EUR et frais remboursés 3 EUR |
| Succès SEPA différé | F-2026-0002, PI `pi_3UNs2gKB3EgQZewb0Xe7U5Tx` : état processing non payé puis réussite, frais Stripe 0,35 EUR |
| Échec SEPA puis reprise carte MR | F-2026-0003, PI reprise `pi_3UNsEWKB3EgQZewb0lYgnxJn` : 3 EUR de frais plateforme, frais Stripe 3,40 EUR, aucun remboursement de frais de l'ancienne tentative reporté |
| Litige Stripe réel de test | F-2026-0004, PI `pi_3UNs6jKB3EgQZewb1W9B4FYn`, carte officielle de litige : litige enregistré, notification capturée, avoir/remboursement protégés |
| Échec SEPA puis reprise carte FB après correction | F-2026-0005, paiement `13fb3140-5278-4003-aaaf-40bb0537d217`, PI reprise `pi_3UNsknKB3EgQZewb1b3Ns9Qv` : ancienne preuve de frais/reçu effacée avant nouvelle tentative, réussite 100 EUR, plateforme 3 EUR, Stripe 3,40 EUR, remboursement des frais 0 ; facture OPPE-FB-C-F-2026-000001 |

Sept PDFs OPPE téléchargés depuis l'application : cinq factures et deux avoirs. MR : 2,50 + 0,50 = 3 EUR ; avoirs 0,50 + 0,10 = 0,60 et 2 + 0,40 = 2,40 EUR. FB : 2,50 + 0,50 = 3 EUR. Identité OPPE réelle conservée ; identité atelier clairement fictive de test. Notifications capturées en QA, aucun destinataire réel sollicité. Événements Stripe réellement renvoyés par la CLI officielle ; lien existant stable, pas de double paiement, pièce ou notification.

Douze contrôles HTTP hébergés : authentification, lecture facture/paiement/PDF et remboursement d'un autre atelier, rejet du montant de remboursement arbitraire, jeton invalide, refus pour le compte original non éligible, suivi de facture Stripe, lien idempotent, protection pendant litige. Une facture de client propre sans livre rattaché est admise ; toute référence présente doit appartenir à l'atelier et au circuit client propre.

## Corrections et migrations

- Origine client propre : migration `20261007190000`, sans modification de document ni paramètre d'ouverture.
- Reprise de tentative : migration `20261007200000`, archive la session et efface uniquement les frais/reçu de la tentative terminale non payée. Paiements reçus, remboursements et litiges restent protégés.
- Webhook : aucune projection d'un succès avant vérification des frais d'application réellement prélevés ; Stripe peut livrer le succès avant que les frais soient lisibles, l'événement reste alors à reprendre.
- Marque FB fixée avant scellement du premier lien ; marque d'une réservation déjà scellée conservée. Pièces et notifications utilisent la marque du paiement.
- Facture atelier suivie par Stripe affichée « suivi Stripe », sans réécrire son snapshot.

## Sendcloud et limites externes

Branchement au nouvel endpoint officiel `POST /shipping-options`, adresses départ/arrivée et colis, `calculate_quotes=true`. Un devis sans prix, vide, négatif ou non fini est rejeté ; aucun tarif zéro fabriqué. [Documentation officielle](https://sendcloud.dev/docs/shipments/shipping-options-and-quotes).

Tests de devis, signatures, rapprochement, permissions et garde-fous de transport passent dans la suite. L'intégration Sendcloud existante a ses clés masquées ; aucun secret récupérable dans les paramètres Worker. Les clés n'ont pas été régénérées. Le contrôle final a retrouvé un ancien indicateur administratif `enabled=true` du 2 octobre, déjà bloqué par l'absence de clés. Il a été explicitement refermé le 7 octobre à 11:29:54 UTC selon la consigne actuelle du propriétaire ; les anciennes preuves sont conservées et le motif de fermeture est ajouté. `enabled=false`, zéro job d'étiquette vérifiés. Transport automatique fermé tant que clés, devis/couverture et aller-retour réel ne sont pas vérifiés. Aucun achat d'étiquette ni expédition physique réalisé.

## Publication

Sauvegarde production avant lot 13 : SHA-256 `2df32835edc4778dc35605a42165464b88ab77dcf2e518e3bbf60193ec347161`. Deux migrations répétées sur cette sauvegarde restaurée ; dix empreintes historiques, quatre gratuités, B et onboarding conservés, C fermé pendant préparation. Production attendue après publication : 118 migrations. Plateforme OPPE live existante active, encaissements/virements autorisés, aucune exigence restante ; webhooks live actifs ; aucun atelier live connecté au moment du contrôle.

Contrôles locaux : 3 684 tests, 298 fichiers ; un contrôle de prix publics a dépassé 5 s sous charge et passe isolément (8/8), sans changement de son exigence. Typecheck sans erreur, lint sans erreur (19 avertissements préexistants), 19 garde-fous de publication. Tests d'ouverture B/C également réussis après activation de la source publique.

**Publication vérifiée :** PR [#98](https://github.com/antoineferriere2-star/mareliure/pull/98) fusionnée, code `251bcd59e7f3e5b6b85580e1d107cc957de0ae47`, merge `07fbcb7c518e660ae68b193d95c930dd4506461c`. CI PR et main verte. Worker `d4e58fd7-3a3c-4307-9a41-947077465763` à 100 %, déploiement `4b3de0b8-4a0a-4913-93c0-930fb4f80728`, 7 octobre 2026 à 11:22:50 UTC. 118 migrations, dix empreintes inchangées, quatre gratuités conservées. B, C et onboarding ouverts en base ; aucun compte atelier live encore connecté et aucun paiement C de production. Pas de binding de capture ni d'exception de compte test en production ; les 22 bindings et le runtime sont conservés.

Quatorze contrôles HTTP : webhooks sans signature/avec signature invalide rejetés, signatures snapshot/thin vérifiées avant refus d'un événement incomplet, HTTP redirigé vers HTTPS. Douze contrôles complémentaires : conditions B/C servies sur les deux marques, fonctions onboarding/lien de paiement refusant l'absence d'authentification, Checkout refusant un lien invalide, webhook Sendcloud fermé sans clés, empreintes et états d'ouverture. Le refus d'un atelier non éligible est éprouvé en QA contre le compte initial réellement restricted ; en production les quatre ateliers n'ont encore aucun compte Connect ni capacités d'encaissement, et l'exception QA est absente. Aucun onboarding personnel ni encaissement live n'est attesté à leur place.

Accès personnel externe restant : [intégration Sendcloud mareliure](https://app.sendcloud.com/v2/settings/integrations/api/621399). Clés publiques/confidentielles masquées, sans bouton de révélation ; webhook configuré vers `https://mareliure.fr/api/marketplace/sendcloud-webhook`. Le test proposé par l'interface échoue ; aucun secret n'est présent dans le Worker et le point d'entrée refuse la requête (404). Installer les clés existantes conservées, ou effectuer personnellement leur régénération si elles sont perdues, puis vérifier devis/couverture et transport réel. La régénération d'un identifiant via navigateur exige la prise en main du titulaire et ne doit pas être faite automatiquement. Ce blocage ne ferme pas C, dont les clients propres ne bénéficient d'aucun transport automatique Oppe promis.

Preuves, captures, PDFs, empreintes et sauvegardes privés hors Git : `D:/CodexProjects/oppe-model-operation/lot13-*`. Ne jamais publier les fichiers de secrets ou jetons. Référence financière finale : cinq paiements de recette, sept pièces OPPE, 32 événements Stripe traités, deux notifications FB capturées sans envoi réel. Aucun débit réel, achat d'étiquette ou transport physique.

Retour arrière : fermer C avant réactivation du Worker lot 12 `911386c8-7f72-4c45-afbd-280eab5a0858`, conserver migrations, pièces, clé de scellement et webhooks. Chaque atelier réel effectue son propre onboarding depuis son espace ; capacités Stripe nécessaires vérifiées à nouveau avant chaque encaissement.
