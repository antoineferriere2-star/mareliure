# Ma Reliure / Fine Bindery — publication vérifiée du 6 octobre 2026

Ce bilan décrit le travail effectué par Codex depuis la passation. Les nouvelles recettes ont été exécutées dans l'application hébergée QA, avec le compte Stripe **test** existant ; les informations héritées sont conservées dans les journaux datés des lots précédents. Aucun débit réel, virement bancaire ou achat d'étiquette payante.

## État des parcours

| Circuit | Branché | Testé dans l'application | Déployé | Ouverture / condition restante |
| --- | --- | --- | --- | --- |
| A — vente Oppe MR/FB | Oui | Deux nouveaux parcours complets, paiements test, fournisseurs, remboursements partiels/intégral ; confirmation Fine Bindery reprise après erreur | Oui | Ouvert avec décisions fiscales administratives ; premier paiement réel et remboursement restent à effectuer par le titulaire |
| B — logiciel atelier, 15 € HT/mois | Oui | Checkout, droits, factures, portail, renouvellement, échec/reprise, résiliation effective, événements anciens/dupliqués, accès historique | Oui | Fermé ; décisions fiscales/immatriculations et revue juridique non obtenues. Notifications rendues et capturées en QA, sans livraison à un atelier réel |
| C — encaissement direct atelier, 3 % TTC | Oui, Accounts v2 | Onboarding/reprise, exigences, refus du paiement sans capacités ; tests d'intégration de paiement, reprises, remboursements et litiges | Oui | Fermé ; succès de paiement, remboursement et litige C hébergés **non attestés**, car onboarding du compte test incomplet |

Vitrine : aperçu, publication/modification et demande provenant de la vitrine, conservée comme client propre. Devis/facture atelier, deux avoirs, règlement et remboursement déclarés, litige ouvert/clos, réception distincte de la livraison transporteur, incident, trajets aller/retour et PDFs privés vérifiés dans le portail client. Refus d'accès d'un autre atelier vérifié. Ces déclarations ne deviennent pas des preuves Stripe.

Transport : adresses, colis, payeur, journal, preuves et étiquettes privées branchés. Les PDFs utilisés sont explicitement fictifs « NE PAS EXPÉDIER », coût nul. A Fine Bindery couvre également retour prêt et adresse reconfirmée. Aucune expédition physique ni étiquette Sendcloud achetée ; clés Sendcloud absentes, conditions de couverture et test réel nécessaires. Aucun forfait international ajouté.

## Publications et preuves

PR [#89](https://github.com/antoineferriere2-star/mareliure/pull/89), [#90](https://github.com/antoineferriere2-star/mareliure/pull/90), [#91](https://github.com/antoineferriere2-star/mareliure/pull/91), [#92](https://github.com/antoineferriere2-star/mareliure/pull/92) et [#93](https://github.com/antoineferriere2-star/mareliure/pull/93) fusionnées après CI verte, par commits de fusion ; historique publié conservé.

- Lot 7 : code `9d67ddb`, merge `a6923630600d5484c8be3e2202bb1d2e8def8cef` ; Accounts v2, liens récupérables, webhooks, reprises B/C.
- Lot 8 : code `f9a661bf`, merge `fee7c827d388f589059656860f64c1bbc26cc896` ; clients propres, transport, imports et accords atomiques, garde B avant écriture.
- Lot 9 : code `cc772865adf5afc98e1e812b0c02e395b694d291`, merge `a11866d15a073fefe9037314b276feb85a14b4ff` ; marque du dossier, interlocuteurs, actualisation du retour, confirmation reprenable. Worker `3528f090-0c6b-4be0-83e7-c71480df65ce`, publié à 16:52:48 UTC.
- Dernier code applicatif : `711b5ab92f34daa974640cc3730a63a9aefb0dfa`, merge **`a71f83e77f4b5201abbefc0412f2bf79020d7ef2`** (#93). Mention PDF rectifiant la facture pour le montant de l'avoir, sans fausse annulation intégrale ni attribution systématique du remboursement à l'atelier. Montants et écritures historiques conservés.

**Worker actif : `42570020-0a67-48d0-812a-b05da1a4be70`, 100 %.** Déploiement `c6cb5d6e-aa52-4efa-af96-36736ea9b084`, 6 octobre à **17:12:47 UTC / 19:12:47 Paris**. CI PR #93 [37500768782](https://github.com/antoineferriere2-star/mareliure/actions/runs/37500768782) et main [37501246223](https://github.com/antoineferriere2-star/mareliure/actions/runs/37501246223) réussies.

Relecture production après bascule : **115 migrations**, dernière `20261007170000`, quatre ateliers historiques gratuits, `subscription_open=false`, `online_payment_open=false`. Dix-huit bindings et runtime strictement conservés, dont les secrets des anciens webhooks et la clé stable des liens C. Aucun mode d'e-mail simulé en production. Build client sur la seule base de production `hljxohondjvrkzqicexl`.

Quatorze contrôles HTTP réussis après la dernière bascule sur les deux marques : trois webhooks sans signature en 400, Connect signature invalide refusée, signatures snapshot/thin vérifiées jusqu'aux gardes de compte avant toute écriture, HTTP vers HTTPS en 301. Pages d'accueil relues et inspectées sur 1280 × 900 et 390 × 844, sans débordement horizontal ; image principale chargée. Captures enregistrées.

Suite locale finale stable : **3 618 tests / 291 fichiers réussis**, TypeScript sans erreur. Lint du lot 9 sans erreur, 19 avertissements préexistants. Huit tests PDF ciblés puis quatre contrôles workerd réussis. Une première suite locale avait lu un fichier de build pendant son remplacement (`ENOENT`) ; le résultat est conservé, le test ciblé et la suite entière sans build concurrent repassent. Aucune assertion modifiée pour masquer cet échec.

Factures Oppe MR et FB et avoirs effectivement téléchargés depuis les boutons client, extraits, rendus et inspectés visuellement. Nouveau PDF partiel MR -20 € et avoir intégral FB -289,30 € relus après la correction. Client MR et client FB vérifiés sur mobile ; conversation client propre et réponse atelier reçue avec les bons interlocuteurs.

## Sauvegarde et retour arrière

Les quatre migrations additives du lot 8 ont été répétées sur une nouvelle restauration PostgreSQL 17 avant application unique en production. Sauvegarde fraîche `production-before-lot8-final.dump`, 1 298 068 octets, 1 741 entrées, SHA256 `1854b194b1fb6606f50dd815a4ca3bce9d2671526e8658ca05c1003bb5f0a343`. Douze empreintes métier inchangées. La copie locale comporte les exclusions Supabase documentées : huit diagnostics Vault et six de propriétaire d'event triggers ; elle n'est pas présentée comme un clone complet Supabase. Aucun SQL pour les lots 9 et 10.

Retour arrière applicatif compatible : Worker du lot 9 `3528f090-0c6b-4be0-83e7-c71480df65ce`, ou lot 8 `656dabba-39db-4e53-b12b-9ba1dc655eda`, avec plusieurs avoirs par facture. Conserver migrations, documents, webhooks et clé des liens ; ne pas revenir aux anciens Workers à avoir unique.

## Recette fermée et dépendances externes

QA B/C refermés ; vitrine fictive retirée par son bouton normal puis approbation remise à `draft`, état initial. Adresse Auth fictive originale restaurée. L'abonnement test du premier atelier conserve sa résiliation originale `cancel_at=1793952033`, `cancel_at_period_end=false` ; le second reste effectivement résilié. Historiques, factures, avoirs, paiements test et preuves conservés. Les deux secrets Resend ajoutés pour la simulation ont été retirés, clé d'abord puis drapeau ; version QA finale `d2cdebe0-d28f-41e7-812d-777201e8093f`. Les décisions fiscales/juridiques de recette restent explicitement fictives et ne sont pas copiées en production.

Relecture Stripe finale : compte atelier test existant `acct_1UNTDkKB3EC6OVAY`, Dashboard `full`, **14 exigences**, cartes et virements `restricted / requirements_past_due`. Le titulaire doit terminer les identifiants/onboarding hébergé et les consentements personnels. Stripe refuse que la plateforme accepte les conditions ou modifie l'identité de ce compte après démarrage de l'onboarding. Aucun compte lié recréé, KYC ou consentement inventé.

Actions externes restantes : vérification personnelle live par pièce d'identité/selfie ; décision expert-comptable TVA et immatriculations ; revue juridique des clauses ; accès/conditions Sendcloud et aller-retour physique ; premier paiement réel de faible montant puis remboursement. Après résolution de l'onboarding test, la recette C hébergée doit constater réellement paiement, remboursements et litige avant ouverture. La démonstration Stripe isolée de la passation ne satisfait pas cette condition.

Les preuves propres détaillées sont dans [le lot 8](OPPE_LOT8_OWN_CLIENT_JOURNEYS_20261006.md) et [la nouvelle recette A](OPPE_LOT9_A_RECIPE_20261006.md). Reçus privés, captures, PDFs et logs conservés hors Git dans `D:/CodexProjects/oppe-model-operation` : `lot10-production-receipt.json`, `lot10-prod-smoke.json`, `lot10-prod-final.json`, `lot10-tests-stable-all.log`, `lot10-qa-cleanup.json`, `lot10-connect-test-requirements.json`. Aucun secret ou dump joint au dépôt.
