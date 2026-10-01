# Aller-retour d'un livre — activation

Branche `feat/book-roundtrip-shipping`, 1er octobre 2026. Aucune étiquette achetée, aucun débit, aucune production modifiée. Le prix client décidé est **15 € TTC pour l'aller-retour en France métropolitaine**. Une future proposition doit afficher une ligne distincte « Transport aller-retour » avant l'accord et le paiement. Les propositions déjà acceptées restent immuables. Le code de cette branche ne rend pas encore ce forfait achetable : l'offre automatique reste fermée tant que les préconditions contractuelles, fiscales et techniques ne sont pas réunies.

## Compte Sendcloud, lecture seule

- Compte connecté sur `app.sendcloud.com`, abonnement **Free (monthly)** ; tableau de bord affichant 0/50 étiquettes ce mois-ci.
- Aucun accord tarifaire disponible. Aucun contrat transporteur propre actif sur cette formule.
- L'écran « Prix d'expédition » présente les coûts comme des estimations non finales. Pour France → France, 35 × 25 × 8 cm et 0,5 kg, il reste sur « Chargement des prix » : **aucun prix de ce compte n'est confirmé**. Aucune étiquette de test représentative d'un livre aller-retour n'est confirmée.
- La fiche antérieure `docs/sendcloud-book-roundtrip-trial.md` reste une liste de contrôles ; son observation « compte non connecté » est désormais périmée.

À titre de repère **public, pas de tarif contractuel de ce compte**, Colissimo Domicile entreprises 2026 publie 8,76 € HT pour 0,5 kg avec signature par trajet. Deux trajets donnent 17,52 € HT, soit 21,02 € TTC **si** la TVA à 20 % s'applique : déficit indicatif de 6,02 € face au forfait de 15 € TTC, avant emballage, frais Sendcloud et suppléments. Cela ne confirme ni disponibilité de la méthode depuis l'adresse du client ni couverture du livre confié. [Tarifs Colissimo](https://www.colissimo.entreprise.laposte.fr/offres-et-services/tarifs-generaux/tarifs-colissimo-domicile-au-depart-de-la-france), [facturation Sendcloud](https://support.sendcloud.com/hc/fr/articles/360025143911-Facturation-des-exp%C3%A9ditions).

## Périmètre candidat, fermé par défaut

Le contrôleur `src/marketplace/shipping/roundTrip.ts` ne présélectionne qu'un livre ordinaire remplaçable de valeur justifiée inférieure à 100 €, emballé dans un colis de 500 g maximum et 35 × 25 × 8 cm maximum dans chaque sens. Ce sont des **limites de présélection métier**, jamais des promesses du transporteur. Corse et cas postaux atypiques sont soumis à traitement adapté jusqu'à preuve de méthode et coût. Pays, adresses, accord de réception de l'atelier, valeur, expéditeur physique du premier trajet, méthode aller/retour, conditions pour le livre confié et tous les frais doivent être vérifiés. Sans devis fournisseur vivant, ou si le coût complet connu excède 15 € TTC, l'automatisation est bloquée. Aucun supplément client silencieux.

Livres anciens, patrimoniaux, manuscrits, uniques ou de valeur non justifiée : traitement adapté. XCover comporte des exclusions et ne constitue pas une couverture générale des livres confiés ([conditions Sendcloud](https://support.sendcloud.com/hc/fr/articles/13359231923729-Conditions-d-assurance-de-la-Protection-de-l-envoi-Sendcloud-XCover)).

## Parcours à brancher une fois les préconditions réunies

1. Une **nouvelle** proposition porte la ligne « Transport aller-retour — 15 € TTC » et un identifiant de produit explicite. Le HT est dérivé de la fiscalité validée et la somme TTC doit être exactement 15 €. Aucun ancien devis n'est modifié ; le produit ne s'infère jamais du seul montant.
2. Après accord et paiement réellement confirmé, le serveur relit la proposition, l'atelier choisi, son accord de réception, les adresses et les mesures du colis emballé. Donnée manquante = traitement adapté, aucun achat.
3. Une réservation atomique par dossier et sens, avec clé d'idempotence stable chez le fournisseur, précède chaque achat. Après réponse ambiguë, relire fournisseur et réservation ; aucun second achat à l'aveugle.
4. Étiquettes et adresses restent privées, accessibles par serveur au client pour l'aller, à l'atelier sélectionné pour le retour, et à l'opérateur. URLs signées courtes ; aucune adresse, photo ou preuve privée dans le journal public ou les logs.
5. Les webhooks doivent être authentifiés puis rapprochés de l'état fournisseur. Les références s'ajoutent au journal. Une livraison transporteur **n'est pas** une réception physique ; l'atelier confirme celle-ci séparément et peut déclarer un incident. Le retour requiert réception physique et travaux terminés.
6. Échec, annulation et étiquette inutilisée conservent l'historique, bloquent l'achat concurrent et font vérifier les frais effectivement facturés. Une annulation ne vaut pas remboursement présumé. Un opérateur peut reprendre manuellement le suivi.

Le journal atelier publié reçoit déjà des numéros saisis à la main et distingue réception, incident et retour. Cette branche ajoute au portail client, **après paiement**, une projection des jalons et suivis sans adresses, photos, preuves ni notes privées. La livraison finale reste déclarée par l'atelier, jamais attribuée au client.

## Conditions d'activation et recette restante

Avant ouverture : devis réel pour les deux trajets, identité du créateur/payeur, expédition depuis l'adresse effective du client permise, conditions écrites applicables au bien confié, frais complets et TVA, fiscalité validée de la ligne 15 € TTC, accès API et recette isolée des reprises et refus. L'étiquette gratuite « Unstamped letter » documentée par Sendcloud n'est pas représentative d'un livre et ne valide pas ce circuit ([guide de test](https://sendcloud.dev/docs/getting-started/test-labels/)). Une étiquette ordinaire peut être facturée dès création. Aucun achat n'est autorisé ici.

La démonstration automatisée locale couvre la présélection, le calcul TTC et la projection du journal. Achat, webhooks, étiquettes privées, coût final et parcours transporteur client → atelier → client : **non testés et non activés**.
