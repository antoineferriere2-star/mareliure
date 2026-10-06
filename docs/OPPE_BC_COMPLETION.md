# Suite de la passation Oppe — 5 octobre 2026

## Périmètre et état

État final au 6 octobre : lots 7 à 10 publiés, code applicatif `711b5ab`, merge `a71f83e7`, Worker `42570020-0a67-48d0-812a-b05da1a4be70` à 100 %, 115 migrations, B/C fermés et quatre ateliers historiques gratuits. A rejoué sur les deux marques ; B renouvellement/échec/reprise/résiliation vérifiés dans l'application. C adapté à Accounts v2 et branché, mais recette de paiement C hébergée bloquée par les 14 exigences et capacités restreintes du compte test existant. Les étapes ci-dessous datées des lots précédents sont historiques ; [le bilan final](OPPE_FINAL_PUBLICATION_20261006.md) fait foi pour l'état courant.

Recette A complémentaire du 6 octobre : deux nouveaux dossiers Ma Reliure/Fine Bindery, paiement test, facture, suivi, facture fournisseur et règlement déclaré, deux remboursements partiels MR et un remboursement intégral FB. Échec de confirmation repris par les vrais événements Stripe puis livraison simulée Resend sans doublon. Les corrections et preuves propres au lot 9 figurent dans [le journal A](OPPE_LOT9_A_RECIPE_20261006.md) ; les validations fiscales/juridiques fictives de QA ne valent pas en production.

Suite du 6 octobre : PR #89 fusionnée (`4eebb775`), lot 7 publié par #90, puis lot 8 publié par #91 (`fee7c827`, Worker `656dabba`, 115 migrations). La recette B hébergée couvre paiement, renouvellement, échec, reprise, résiliation effective, événements anciens/dupliqués et téléchargement historique après résiliation. Les clients de vitrine disposent du devis, de la facture atelier, de deux avoirs, du journal manuel et du transport aller/retour privé dans leur portail. Les preuves et limites actuelles figurent dans [le journal du lot 8](OPPE_LOT8_OWN_CLIENT_JOURNEYS_20261006.md). B/C restent fermés ; le succès du paiement C applicatif n'est pas attesté tant que l'onboarding Stripe test du titulaire reste incomplet. Les paragraphes de recette des lots précédents restent des preuves historiques distinctes.

Le propriétaire a demandé de poursuivre tous les chantiers à la suite de la passation.
Branche : `feat/oppe-b-c-completion`, base `43f9110` (PR #85 fusionnée).
Suite publiée : code applicatif `13f18d6`, Worker `cbd5667f`, 107 migrations. Voir [le journal de publication attesté](OPPE_LOT6_PUBLICATION_20261005.md).

Cette suite ajoute B, la vitrine commune, les avoirs partiels B, le socle C, le rattachement des transports clients propres, la documentation et les conditions ateliers.
**Les services payants B/C restent fermés**. La présence du code ne constitue ni une validation fiscale ou juridique, ni une recette Stripe live.

## B — abonnement

- 15 € HT/mois ; compte et catalogue Stripe marketplace distincts du Billing Métré.
- Les quatre ateliers historiques conservent leur gratuité. Le lot 7 retire l'attribution automatique de la gratuité aux nouveaux ateliers ; leur accès historique en lecture reste indépendant des droits de création.
- Accord explicite du propriétaire enregistré avant Checkout, avec date et version des conditions. Une tentative abandonnée conserve la gratuité ; celle-ci cesse à l'activation de l'abonnement accepté.
- Checkout réservé et idempotent, un seul abonnement actif par atelier ; portail Stripe pour factures et résiliation.
- Webhooks signés et journal commun avec reprise des échecs. Relecture de l'abonnement chez Stripe, prix fixe vérifié, garde sur client Stripe et événement ancien.
- Création/modification des devis, création/émission des factures et publication interdites en base après suspension/résiliation/expiration. Lecture et téléchargement historiques conservés ; avoirs autorisés pour rectifier une facture.
- Résiliation en fin de période ; maintien des droits jusqu'à cette date si l'abonnement reste actif.
- Ouverture : produit/prix live vérifiés, fiscalité approuvée (`WORKSHOP_SUBSCRIPTION_TAX_APPROVED=true`), configuration Stripe Tax et Billing Portal, revue juridique et recette hébergée. Puis indicateur en base et annonce `WORKSHOP_OFFER.subscriptionOpen` à mettre en cohérence.

Catalogue test créé avec `scripts/setupWorkshopStripeProducts.ts --test` : lookup key `oppe_workshop_monthly_15_eur_v1`, prix `price_1UNEP3KB3EBc6SlhrtzPgl4e`, compte test `acct_1UGISJKB3EBc6Slh`. Aucun débit réel.
Le script `--live` refuse une clé test et un compte différent du compte dédié.

## Vitrine et avoirs

- Même rendu professionnel pour Fine Bindery et Ma Reliure ; Ma Reliure expose `/ateliers/$slug`.
- Aperçu privé dans l'éditeur ; publication explicite par atelier approuvé, avec abonnement admissible. Les réalisations requièrent consentement et photo autorisée.
- Avoir partiel par prestation, assiette après remise, taux d'origine et cumuls plafonnés par prestation et taux. TVA calculée sur les cumuls pour éviter les dérives d'arrondi.
- Numérotation, idempotence et plafonds dans une transaction PostgreSQL ; documents émis immuables. L'avoir complet après un avoir partiel porte uniquement sur le reliquat.

## C — clients propres

Choix : [paiements directs Stripe Connect](https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted), sur le compte de l'atelier. Compte avec Dashboard complet, frais Stripe payés par l'atelier et pertes de paiement gérées par Stripe (`controller.fees.payer=account`, `controller.losses.payments=stripe`). L'ancien compte de type Express où Oppe supporte les frais n'est pas accepté pour encaisser C.

- Consentement du propriétaire aux conditions et aux 3 % du TTC encaissé, onboarding et contrôle réel des capacités Stripe.
- Facture atelier émise, sans acompte pour cette première version, ouvrage `mon_client` ou `workshop_platform`. Les commandes Oppe sont refusées.
- Lien client à secret de 256 bits, empreinte pour la recherche et copie chiffrée pour la reprise par le propriétaire, durée 30 jours renouvelable ; montant et frais calculés côté serveur. La facture et les avoirs émis restent consultables sur le lien existant après fermeture de l'offre.
- Paiement asynchrone conservé en attente. Montant, devise, session, compte connecté, atelier, facture et frais rapprochés avant confirmation.
- Règlement déclaré et encaissement traité séparés ; la base interdit d'insérer une déclaration sur une facture réservée à Connect.
- Remboursement demandé à partir d'un avoir, frais d'application remboursés proportionnellement ; idempotence par avoir et recherche Stripe avant reprise. Un remboursement extérieur sans avoir rapproché est signalé et bloque la suite.
- Webhook dédié `/api/marketplace/connect-webhook`, secret `STRIPE_CONNECT_WEBHOOK_SECRET`, événements Checkout, PaymentIntent, remboursements et litiges. Ne pas remplacer le secret du webhook A.
- Les Checkout complétés en attente de rapprochement ne permettent pas un second encaissement. Le lot 7 permet une nouvelle tentative après relecture d'un échec terminal chez Stripe et annulation idempotente du PaymentIntent encore réutilisable ; il interdit la reprise sur paiement en traitement, réussi ou inconnu.

**À éprouver avant ouverture :** onboarding réel d'un atelier, succès/refus/asynchrone avec Stripe test et application hébergée, portail, remboursements partiel/total, litige, e-mails, reçus et comptabilisation des frais. Les tests automatisés ne remplacent pas cette recette.

## Transport et international

Les nouveaux envois des clients propres se rattachent à une facture atelier du même ouvrage ; payeur client/atelier, coût TTC et référence des conditions de couverture sont obligatoires pour un colis. Le journal reste déclaratif, privé et immuable. Aucun achat d'étiquette supplémentaire.

Le forfait Oppe 15 € TTC reste limité à sa qualification française existante. Il n'est pas étendu à C, aux livres de valeur, aux colis non admissibles ou à l'international. L'offre internationale reste à chiffrer par transporteur, pays, format, couverture, douanes et fiscalité avant ouverture ; aucun tarif international n'est inventé.

## Publication et dépendances externes

Migrations dans l'ordre : `20261006100000`, `20261006110000`, `20261006120000`, `20261006130000`, `20261006140000`.
Elles ajoutent les tables B/C et les gardes sans modifier les factures, devis ou paiements historiques.
Procédure : CI verte, fusion, sauvegarde fraîche et empreintes, restauration PostgreSQL 17, répétition, application transactionnelle avec garde de dérive, build vérifié, upload/déploiement Worker, smoke et journal.
Retour arrière : fermer B/C, rétablir le Worker précédent compatible **avec plusieurs avoirs**, continuer les webhooks et ne jamais supprimer des documents. Après émission d'avoirs partiels, un ancien Worker supposant un seul avoir par facture ne constitue plus un retour arrière complet.

Suite live du 5 octobre : catalogue B, portail, webhooks et secret Connect configurés. Identité publique corrigée dans le Dashboard et relue par l’API : nom Ma Reliure / Fine Bindery, descripteur `OPPE RELIURE`, préfixe `OPPE`, support `contact@oppe.fr`, site et URL de support `https://mareliure.fr`, description reliure/restauration et outil atelier. Le MCC `5734` reste inchangé et à qualifier auprès de Stripe. Connect test préparé sur `acct_1UGISJKB3EBc6Slh` : compte fictif français `acct_1UNGxgKB3EtvZpEO` généré par Stripe, objet Accounts v2, Dashboard `full`, responsabilités frais/pertes/exigences collectées par Stripe relues par l’API. Démonstration automatique de paiement direct réussie : `pi_3UNH3cKB3EtvZpEO1rml1DuM`, 100 € fictifs, 3 € de frais plateforme, 3,40 € de frais Stripe, 93,60 € nets. Les capacités restent restreintes ; cette démonstration ne constitue pas une recette de l’application. Au retour live, la confirmation d’intégration est bloquée sur une vérification personnelle Stripe Identity : pièce d’identité avec photo et selfie du titulaire, traitement biométrique. L’écran est prêt ; aucun consentement ni image personnelle transmis par l’agent. Activation Connect live non attestée, aucun compte atelier live créé. Adapter le socle applicatif Accounts v1 à v2 et effectuer la recette complète avant ouverture. [Reçu et limites](OPPE_STRIPE_LIVE_PREPARATION_20261005.md). Zéro immatriculation Stripe Tax ; secrets Sendcloud et test réel transport manquants.
Validation expert-comptable de la TVA et revue juridique non obtenues. Premier paiement réel faible montant et remboursement non effectués.

## Vérifications avant PR

- 3 494 tests réussis sur la suite complète ; contrôle supplémentaire du montant réellement encaissé ajouté et testé (9 tests Connect). TypeScript sans erreur ; lint sans erreur, 19 avertissements existants.
- Build Cloudflare réussi ; 19 contrôles de publication réussis.
- Sauvegarde complète de production vérifiée, restauration PostgreSQL 17 puis cinq migrations répétées : empreintes des douze tables historiques conservées.
- qwf : sauvegarde vérifiée puis transaction confirmée, 108 migrations ; B/C fermés. Interface : gratuité historique, fermeture B/C et aperçu privé vérifiés avec compte fictif, sans erreur JavaScript.
- Création des comptes Connect limitée à la France ; offre internationale toujours fermée.

La recette a ajouté une correction de compatibilité : taux effectif nul en franchise, y compris les anciens documents sans ventilation. Les anciennes factures assujetties sans ventilation gardent la lecture et l’avoir complet original ; un avoir partiel exige une ventilation fiable. Neuf tests PostgreSQL couvrent ces cas et les circuits B/C.

Recette hébergée qwf complémentaire : émission d’un avoir partiel par l’interface, reprise RPC sans doublon, avoir du reliquat et facture originale inchangée. Cycle B sur un propriétaire fictif isolé : Stripe test actif, transition explicite enregistrée, résiliation à échéance sans perte anticipée des droits, résiliation effective et événement ancien sans rétablissement. Les indicateurs qwf ont été refermés et la gratuité de l’atelier fictif rétablie. Ce test technique n’atteste pas la validation fiscale du Checkout, du portail ni des e-mails.

Sauvegarde fraîche finale : 1 207 410 octets, SHA256 `81c4cf1f7e61e4acf04531bee3f1744a7861573c9dc4b23b65ead4d226138793`. Restauration PostgreSQL 17, cinq migrations répétées puis comparaison en UTC des douze empreintes historiques avec la production : identiques. La restauration locale omet uniquement l’extension Supabase Vault indisponible localement (huit diagnostics liés à Vault). Aucun document métier n’est modifié par les migrations.
