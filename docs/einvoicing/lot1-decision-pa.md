# Facturation électronique — Lot 1 : décision de plateforme agréée et cadrage comptable

Document du 26 novembre 2026. **Aucune décision n'est prise ici** : il prépare la décision d'Antoine et la validation de l'expert-comptable. Aucun contrat n'est signé, aucun compte n'est créé, aucune donnée n'est transmise.

Ce que ce lot produit : (1) le comparatif à compléter par devis, (2) la matrice des cas à couvrir, (3) la note de cadrage pour l'expert-comptable, (4) les demandes de devis, (5) la fiche de décision à signer. Il s'appuie sur le rapport de revue de Codex du 26 novembre et sur `docs/factur-x-feasibility.md`.

## 1. Rappel : où nous en sommes

- Fait : données et mentions (phase 1), PDF figé avec empreinte, journal chaîné, PDF/A-3B, prototype Factur-X validé en local (3 novembre), traduction EN 16931 non fusionnée (PR #185).
- Pas fait : aucun fichier structuré produit par le logiciel, aucune connexion à une plateforme agréée (PA), aucun statut, aucun e-reporting, aucune réception. Le fournisseur `ManualElectronicInvoiceProvider` ne transmet rien.
- Échéances : réception pour tous depuis le 1er septembre 2026 ; émission et e-reporting pour les PME et micro-entreprises au 1er septembre 2027.

## 2. Comparatif des plateformes (à compléter par devis)

Les statuts et les tarifs ci-dessous viennent du rapport de Codex et de sites tiers (comparateurs, parfois affiliés) : **non confirmés par contrat**. Le statut doit être revérifié sur la [liste officielle de la DGFiP](https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees) la veille de toute signature ; une certification Peppol n'est pas une immatriculation.

| Critère | Super PDP | IOPOLE | Invopop | Storecove |
|---|---|---|---|---|
| Date d'immatriculation indiquée | 22/12/2025 (une source dit 11/12/2025 : à trancher) | 11/12/2025 | 15/01/2026 | 28/04/2026 |
| Modèle pour un éditeur | API REST facturée à la facture, marque grise, webhooks, bac à sable | Offre éditeurs, API, recette, onboarding et mandats | API fondée sur GOBL, coûts en crédits | API d'émission et de réception, notifications |
| Tarif indiqué | Environ 0,01 € HT par facture jusqu'à 10 000 par mois (0,005 € puis 0,0025 € au-delà) ; vérification KYB 2 € HT ; minimum annuel de 10 € HT. Source tierce. | Sur devis ; archivage en option | Crédits, avec consommation récurrente par entreprise enregistrée : à chiffrer pour de nombreux petits ateliers | À obtenir |
| Réception des factures | À confirmer au contrat | À confirmer | À confirmer | À confirmer |
| E-reporting (ventes aux particuliers, paiements) | À confirmer | À confirmer | À confirmer | À confirmer |
| Archivage | À confirmer | Option | À confirmer | À confirmer |
| Couverture internationale (Fine Bindery) | À confirmer | À confirmer | Annoncée | Annoncée |
| Travail déjà réalisé chez nous | Essais en bac à sable, PR #185 | Aucun | Aucun | Aucun |
| Support et taille de l'équipe | Équipe réduite (source tierce) | À confirmer | À confirmer | À confirmer |

**Hypothèse de coût pour un atelier type** : 100 factures par an ≈ 1 € de facturation à la facture chez Super PDP, plus les frais de vérification et le minimum annuel. Le coût n'est pas le facteur déterminant au prix de l'abonnement (19,90 € HT par mois) ; le sont le périmètre (émission, réception, e-reporting, archivage) et la qualité de l'API. À confirmer sur devis.

### Grille de décision (note de 0 à 3, puis pondération à fixer par Antoine)

| Critère | Poids proposé |
|---|---|
| Couvre émission, réception et e-reporting dans le même contrat | 5 |
| API documentée, bac à sable, notifications authentifiées, reprise après panne | 5 |
| Cas métier : particulier, entreprise, franchise de TVA, avoirs, acomptes | 4 |
| Coût complet par atelier (KYB, minimum, archivage, support) | 3 |
| Délai réel d'accès à la recette et au contrat | 3 |
| Réversibilité : export des preuves, changement de plateforme | 3 |
| Couverture internationale (Fine Bindery) | 2 |
| Statut DGFiP confirmé à la date de signature | éliminatoire |

### Proposition (à confirmer)

Qualifier **Super PDP en premier** (travail réutilisable), le comparer à **IOPOLE**. Garder Invopop et Storecove en réserve pour Fine Bindery, si des ateliers étrangers sont réellement visés. Ne rien signer avant d'avoir les réponses aux demandes de devis (§5) et l'avis de l'expert-comptable (§4).

## 3. Matrice des cas à couvrir (traitement proposé, à valider)

| Cas | Facture électronique | E-reporting | Remarque |
|---|---|---|---|
| Client entreprise française assujettie | Oui, par la PA | Paiement selon l'exigibilité de la TVA | Cas nominal |
| Client particulier | Non (facture remise au client) | Oui : transaction, et paiement selon l'exigibilité | Cas majoritaire d'un relieur |
| Atelier en franchise de TVA | À confirmer | À confirmer | Hypothèse du prototype : identifiant SIREN, code d'exonération |
| Avoir | Oui, rattaché à la facture d'origine | Correction du e-reporting | Avoirs partiels existants dans l'outil |
| Acompte | À confirmer (refusé dans le prototype) | Paiement partiel | Limite ouverte de la PR #185 |
| TVA sur les débits | À confirmer (refusée dans le prototype) | À confirmer | |
| Plusieurs taux (reliure avec étui, transport) | Oui, ventilation par taux | Par taux | Qualification service ou bien à fixer |
| Client hors de France | À confirmer | À confirmer | Selon l'établissement de l'atelier et l'opération |
| Client du secteur public | Chorus Pro : hors périmètre à ce stade | | Refusé dans le prototype |
| Devise étrangère | Hors périmètre à ce stade | | Refusée dans le prototype |

## 4. Note de cadrage pour l'expert-comptable

Contexte à lui donner : l'atelier est seul vendeur ; Oppe fournit un outil de devis et de facturation et n'encaisse aucun paiement client ; l'atelier reste émetteur et responsable des informations déclarées ; une plateforme agréée tiers transmettrait les factures et les données de e-reporting. Questions :

1. **Franchise en base de TVA.** Un atelier en franchise est-il tenu d'émettre en facture électronique et de faire du e-reporting ? Quels identifiants et codes d'exonération faut-il porter ?
2. **Ventes aux particuliers.** Quelles données de transaction faut-il transmettre, à quelle fréquence, avec quelle ventilation par taux ? Comment traiter avoirs et corrections sans double déclaration ?
3. **Paiements.** Quand faut-il déclarer le paiement (encaissement, option pour les débits) ? Comment traiter acompte, paiement partiel et remboursement, sachant que les règlements sont déclarés par l'atelier et non par un prestataire de paiement ?
4. **Qualification des opérations.** Une reliure avec étui est-elle un service unique ou une opération mixte ? Quels taux, quelle présentation sur la facture ?
5. **Responsabilités et mandat.** Que doit mandater l'atelier à la plateforme ? Quelles opérations Oppe peut-elle exécuter pour lui ? Comment traiter à part les propres factures d'abonnement d'Oppe ?
6. **Ateliers hors de France.** Quelles obligations françaises s'appliquent selon l'établissement et l'opération ?
7. **Réception.** Chaque atelier doit-il déjà avoir une plateforme et une adresse de réception ? Que faire des factures de fournisseurs reçues avant raccordement ?

## 5. Demandes de devis (brouillons, non envoyés)

À adresser à Super PDP et à IOPOLE après accord d'Antoine :

> Objet : Intégration API d'une plateforme agréée dans un logiciel de devis et de facturation pour relieurs
>
> Bonjour, nous éditons OPPE SAS (Ma Reliure, Fine Bindery), un logiciel de devis, de facturation et de suivi de clientèle pour les relieurs et les ateliers de restauration. Nous cherchons une plateforme agréée à intégrer par API, en marque grise, pour nos ateliers (de très petites entreprises, la plupart en France, quelques-unes à l'étranger). Pouvez-vous nous indiquer :
> 1. le statut d'immatriculation à ce jour ;
> 2. le tarif complet pour un éditeur : mise en service, vérification de chaque atelier, minimum annuel, prix par facture émise, par facture reçue, par déclaration de e-reporting, archivage ;
> 3. les cas couverts : client particulier, entreprise, franchise de TVA, avoirs, acomptes, TVA sur les débits, plusieurs taux, client étranger ;
> 4. le fonctionnement de l'API : bac à sable, authentification, notifications, idempotence, reprise après panne, statuts de cycle de vie ;
> 5. la réception des factures de fournisseurs, avec mise à disposition de l'original ;
> 6. le mandat à confier par chaque atelier et le parcours d'inscription à l'annuaire ;
> 7. l'export des preuves et la réversibilité ;
> 8. le délai d'accès à un environnement de recette, et le support proposé.
>
> Cordialement,

## 6. Fiche de décision (à signer par Antoine)

| Rubrique | Contenu |
|---|---|
| Plateforme retenue | |
| Contrat et tarif | |
| Date de vérification du statut DGFiP | |
| Cas couverts au lancement | |
| Cas exclus et traitement manuel | |
| Avis de l'expert-comptable | |
| Décision d'Antoine, date | |

## 7. Ce qui ne dépend pas de la décision

Le lot 3 (reprise de la PR #185 : traduction EN 16931 et règles françaises) et le lot 4 (service Factur-X isolé) peuvent avancer avant le choix de la plateforme, car ils produisent le fichier et ne le transmettent pas. Les lots 2 (réception), 5, 6, 7 et 8 attendent la décision.
