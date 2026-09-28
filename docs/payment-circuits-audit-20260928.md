# Paiements — audit et socle du 28 septembre 2026

**Mise à jour :** les quatre orientations ont été validées pour les nouveaux contrats. Voir [les parcours contractuels, le premier circuit livré et les verrous d'activation](payment-activation-contracts.md). Les décisions de fin de cet audit constituent désormais l'historique, pas une nouvelle demande d'accord.

Branche `fix/payment-circuits-reconciliation`, base `origin/main` bbd4b57. PR #50 ouverte, non incluse. Aucun débit, migration production, merge ni déploiement. Les termes ci-dessous décrivent séparément le produit existant et la cible demandée ; cette PR n'active pas les commissions ni l'abonnement atelier.

## Flux constatés

| Parcours | Facturation / encaissement actuels | Montant / preuve | Écart avec la cible |
| --- | --- | --- | --- |
| Proposition commerciale réseau, deux marques | Modèle historique de revente : plateforme → client ; atelier réglé séparément | Proposition acceptée figée HT/TVA/TTC/devise, Checkout plein TTC serveur, webhook signé + rapprochement | Marge de revente, pas commission d'apport de 25 %. Aucun partage Connect exécuté |
| Devis et facture atelier | Atelier → son client ; facture émise depuis devis accepté ; règlement externe | Calcul serveur des lignes/TVA/remise, facture émise immuable, avoir intégral existant | Pas de Checkout facture atelier ni prélèvement 3 % |
| Conciergerie | Marque Fine Bindery et parcours projet existants ; pas de facturation séparée coordination/travaux/transport | L'ancien calcul Fine Bindery reste celui de la revente | Aucun partage automatique à activer ; la marque n'établit pas le circuit |
| Abonnement | Billing générique Métré, réservé au propriétaire du workspace, via connecteur Lovable | Plans du code USD 19,99 / 59 / 149 / 299, abonnement Stripe / portail | Ce ne sont pas des abonnements atelier à 15 € ou 39 € HT |

Sources principales : `docs/commercial-billing-model.md`, `src/marketplace/stripe/`, `commercialProposalRepository.server.ts`, `binderQuotes.server.ts`, migrations devis/factures, `src/build/billing/`, `src/build/services/billing.data.functions.ts`. Les propositions acceptées ont déjà une immutabilité SQL. Les taux de TVA, le multiplicateur Fine Bindery et le plancher de marge historiques ne sont pas modifiés.

La page relieurs annonce 0 €/mois et le paiement par carte facultatif « en préparation ». Les 15 €/mois et 39 € HT/mois du brief ne sont pas des tarifs atelier actifs démontrés par le dépôt. La FAQ précise désormais que 3 % est le modèle envisagé et distingue les frais Stripe. Aucun tarif d'abonnement n'a été remplacé.

Lecture production limitée à des agrégats, le 28 septembre : 8 dossiers (6 Ma Reliure, 2 Fine Bindery), 1 proposition commerciale acceptée en EUR, aucune ligne de paiement commercial, 2 factures atelier émises et non payées en EUR, 3 ateliers sans compte Connect renseigné, 2 workspaces clients sans statut d'abonnement. Les origines enregistrées ne prouvent pas à elles seules qui a apporté le client. Aucun identifiant client ni secret n'est publié dans ce rapport.

**Limite d'accès :** aucune clé Stripe test/live disponible dans l'environnement local. Catalogue Products/Prices actif, contrats hors dépôt, réglages Connect, moyens de paiement, frais négociés et abonnements réellement présents chez Stripe non vérifiés. Les identifiants de comptes documentés ne constituent pas cette vérification. Aucune conclusion « aucun abonnement Stripe actif » ne découle de la seule base applicative.

## Corrections

- Un Checkout terminé mais non encore confirmé ne crée plus un second paiement. Une session ouverte sans URL utilisable est bloquée pour contrôle.
- Une session expirée reçoit une nouvelle génération de clé d'idempotence, stable pour les retries ; l'ancienne URL expirée n'est plus réutilisée par la clé initiale.
- Réutilisation d'une session uniquement si dossier, proposition, mode, montant et devise correspondent. Une session étrangère n'est ni réutilisée ni expirée.
- Un `payment_intent.succeeded` doit appartenir à la session Checkout enregistrée, contrôlée auprès de Stripe. Copier les seules métadonnées ne suffit plus. Une livraison avant la persistance de la session échoue de façon rejouable.
- Signature asynchrone compatible Worker. Les échecs de traitement restent non-2xx après huit tentatives ; le seuil devient un indicateur d'attention, pas un acquittement mensonger.
- Index unique du journal de paiement par PaymentIntent, pour la concurrence entre événements session et intent. Les écritures de statut payé restent atomiques et vérifiées sur le TTC/devise attendus.
- Le webhook d'abonnement générique ne renvoie plus de succès lorsque la mise à jour en base échoue.

Les paramètres `checkout=success` / `cancelled` ne sont pas une preuve de paiement. L'acompte reste bloqué : aucun paiement en deux temps ajouté. Les cas d'échec, d'accès interdit, de montant/devise incohérents et de fiscalité non validée restent refusés.

## Socle et limites d'activation

Migration proposée `20260928090000_marketplace_payment_circuits.sql`, **non appliquée** :

- Classification serveur par dossier : `own_client`, `network_sale`, `concierge`, plus `legacy_resale` et `review_required` pour ne pas inventer une qualification historique.
- Accord commercial déjà accepté → conservation du modèle historique ; autres dossiers → revue nécessaire. Aucun montant existant réécrit.
- Revue admin contrôlée côté serveur et SQL, avec événement de preuve du même dossier, auteur et note. Une origine, une marque ou un lien référent ne suffit pas à attribuer une commission. L'API de revue est fournie ; son écran admin n'est pas construit dans cette PR.
- Circuit bloqué dès proposition commerciale envoyée ou devis atelier accepté/facturé. La preuve et les termes sont photographiés à l'acceptation du devis atelier, puis repris sur la facture. Les devis historiques restent sans snapshot inventé.
- Total/devise/référence acceptés contrôlés à l'émission de facture. Une modification exige une nouvelle proposition, jamais une réécriture de l'accord. Le parcours d'avenant réseau reste à concevoir.
- RLS et droits service uniquement sur la classification ; aucune classification autorisée au navigateur.

**Impact à examiner avant toute application :** les dossiers sans accord historique ne peuvent plus créer/accepter une proposition avec l'ancien calculateur de revente. Les circuits cibles ne peuvent pas utiliser son Checkout. Ce verrou est intentionnel mais interdit de présenter cette migration comme une activation prête à déployer : valider le modèle contractuel puis construire les nouvelles propositions/leur présentation avant ouverture commerciale. Les paiements des contrats historiques acceptés sont conservés. Ne pas appliquer cette migration isolément pour « essayer » un tarif en production.

`paymentCircuit.ts` est une règle pure, sans appel Stripe ni facture : 3 % uniquement sur encaissement plateforme d'un client propre ; 25 % sur l'assiette explicitement acceptée d'une vente apportée, jamais 28 % ; aucun gain pour demande/devis/paiement échoué ; totalité acceptée exigée ; remboursement renvoyé en revue ; conciergerie séparée. L'assiette et sa version doivent être acceptées, elles ne sont pas choisies par défaut. Ces résultats ne sont pas des commissions comptabilisées.

## Abonnement, remboursement, fiscalité

- Les tests d'habilitation existants couvrent la résiliation : le self-service ne peut plus publier de nouveaux projets, les projets déjà publiés restent selon les règles actuelles ; pas de suppression des données ni de baisse automatique du plan. Cela ne définit pas encore les droits du futur abonnement atelier.
- Le remboursement Stripe n'a pas de grand livre de remboursement applicatif ni d'avoir automatique. Les événements sont conservés dans le registre webhook ; la journalisation dossier dépend des métadonnées. Les avoirs atelier intégraux existent, sans transfert d'argent Stripe. Un `paid_at` historique n'est pas un solde net remboursé. Rapprochement manuel encore nécessaire ; ne pas exposer de revenu net automatique.
- La synchronisation des abonnements génériques ne résout pas encore l'arrivée hors ordre des mises à jour Stripe : reprise canonique depuis l'abonnement à prévoir avant réutilisation pour l'offre atelier.
- Pas de décision TVA nouvelle : les cas internationaux restent soumis à la validation fiscale existante. Identité du vendeur, assiette des honoraires, pays, B2B/B2C et redevable doivent être validés avec le comptable avant automatisation.

Documentation officielle consultée le 28 septembre : [webhooks, doublons et retries](https://docs.stripe.com/webhooks), [idempotence](https://docs.stripe.com/api/idempotent_requests), [types de charges Connect et responsabilités](https://docs.stripe.com/connect/charges), [tarification Connect](https://stripe.com/connect/pricing), [Stripe Tax avec Connect](https://docs.stripe.com/tax/connect), [frais de remboursement](https://support.stripe.com/questions/understanding-fees-for-refunded-payments). Le type de charge détermine notamment le compte débité pour frais, remboursements et litiges : aucun choix de Connect n'est activé sur la seule base du pourcentage commercial. Aucun taux de frais Stripe négocié n'est présumé.

## Vérification et précontrôle futur

Tests métier/Stripe simulé, contrôle TypeScript, lint et build ; résultats finaux dans la PR. Les tests SQL exécutent la vraie migration dans PostgreSQL embarqué PGlite sur un schéma environnant minimal : RLS, droits, preuves, termes figés et unicité, sans accès réseau. Ils ne remplacent pas une répétition de toute la chaîne Supabase sur une base de recette restaurée.

Avant toute autorisation de déployer : vérifier migrations réellement appliquées, doublons `CUSTOMER_PAYMENT_SUCCEEDED` par PaymentIntent (ne jamais les supprimer automatiquement), propositions en cours et contrats historiques ; répéter migration et émission facture/avoir sur copie anonymisée, régénérer tous les types depuis la recette puis contrôler le diff. `types.ts` ne reçoit ici que la signature RPC locale ; ce n'est pas une régénération depuis la production. Ensuite seulement recette Stripe test : paiement réussi/refusé/annulé/asynchrone, session expirée, retries concurrents, refund, portail et résiliation. Aucun test navigateur de paiement réel effectué faute d'identifiants Stripe test ; les contrats UI restent couverts par les tests du dépôt.

## Décisions du propriétaire

1. **Vendeur et commission réseau.** Proposition : atelier vendeur des travaux, plateforme facture 25 % du HT des travaux, hors transport et taxes, uniquement après paiement intégral prouvé, pour les nouveaux accords. Client : vendeur clairement identifié ; atelier : assiette prévisible ; plateforme : commission distincte de l'ancienne marge. Conserver les contrats de revente déjà acceptés. Faire valider le traitement TVA des honoraires.
2. **Encaissement du client propre.** Proposition : 3 % du TTC effectivement encaissé via plateforme, frais Stripe séparés à la charge de l'atelier et explicités avant activation ; zéro frais plateforme si règlement externe. Client : pas de surcharge surprise ; atelier : coût connu ; plateforme : rémunération distincte des frais techniques. Choix Connect à valider avec cette responsabilité, pas de partage implicite.
3. **Abonnement.** Proposition : 15 € HT/mois pour les nouveaux ateliers seulement, après validation du catalogue Stripe et du périmètre inclus ; conserver l'offre actuelle tant que les conditions ne sont pas publiées. Client final : inchangé ; atelier : prix et préavis explicites ; plateforme : pas de migration silencieuse depuis 0 € ou un éventuel contrat pilote 39 €.
4. **Conciergerie et remboursement.** Proposition : devis de coordination séparé, montant accepté au dossier ; client règle directement l'atelier, transport distinct avec bénéficiaire nommé. Fixer au contrat le sort des honoraires/commissions après annulation ou remboursement et qui supporte les frais Stripe non restitués. Client : remboursements lisibles ; atelier : aucun prélèvement caché ; plateforme : coordination facturée sans confusion avec les travaux.
