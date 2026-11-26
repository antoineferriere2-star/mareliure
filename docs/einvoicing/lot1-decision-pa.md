# Facturation électronique — Lot 1 : décision de plateforme agréée et cadrage fiscal

Document du 26 novembre 2026. **Aucune décision n'est prise ici** : il prépare la décision d'Antoine. Le régime de TVA est choisi par chaque atelier (décision d'Antoine du 26 novembre 2026) : aucune validation d'un expert-comptable d'Oppe n'est requise. Aucun contrat n'est signé, aucun compte n'est créé, aucune donnée n'est transmise.

Ce que ce lot produit : (1) le comparatif à compléter par devis, (2) la matrice des cas à couvrir, (3) le partage des responsabilités fiscales et les questions techniques à poser à la plateforme, (4) les demandes de devis, (5) la fiche de décision à signer. Il s'appuie sur le rapport de revue de Codex du 26 novembre et sur `docs/factur-x-feasibility.md`.

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

Qualifier **Super PDP en premier** (travail réutilisable), le comparer à **IOPOLE**. Garder Invopop et Storecove en réserve pour Fine Bindery, si des ateliers étrangers sont réellement visés. Ne rien signer avant d'avoir les réponses aux demandes de devis (§5) et la confirmation écrite de la plateforme sur les cas techniques du §4.

## 3. Matrice des cas à couvrir (traitement proposé, à valider avec la plateforme)

| Cas | Facture électronique | E-reporting | Remarque |
|---|---|---|---|
| Client entreprise française assujettie | Oui, par la PA | Paiement selon l'exigibilité de la TVA | Cas nominal |
| Client particulier | Non (facture remise au client) | Oui : transaction, et paiement selon l'exigibilité | Cas majoritaire d'un relieur |
| Atelier en franchise de TVA | À confirmer avec la plateforme | À confirmer avec la plateforme | Hypothèse du prototype : identifiant SIREN, code d'exonération. Régime choisi par l'atelier |
| Avoir | Oui, rattaché à la facture d'origine | Correction du e-reporting | Avoirs partiels existants dans l'outil |
| Acompte | À confirmer (refusé dans le prototype) | Paiement partiel | Limite ouverte de la PR #185 |
| TVA sur les débits | À confirmer (refusée dans le prototype) | À confirmer | |
| Plusieurs taux (reliure avec étui, transport) | Oui, ventilation par taux | Par taux | Qualification service ou bien à fixer |
| Client hors de France | À confirmer | À confirmer | Selon l'établissement de l'atelier et l'opération |
| Client du secteur public | Chorus Pro : hors périmètre à ce stade | | Refusé dans le prototype |
| Devise étrangère | Hors périmètre à ce stade | | Refusée dans le prototype |

## 4. Responsabilité fiscale de l'atelier, et questions techniques à la plateforme

**Principe.** Chaque atelier choisit son régime de TVA (franchise en base, assujetti, option éventuelle pour les débits) et en est seul responsable, avec son propre conseil. Ma Reliure reproduit ce choix sur la facture, sans le décider ni le conseiller. Les conditions d'abonnement le disent expressément (brouillons juridiques, §1 article 2 et §4 « Responsabilité de l'Atelier »). Aucun avis d'expert-comptable n'est demandé par Oppe.

**Ce qui reste à valider n'est pas un choix fiscal mais un choix technique** : comment la plateforme attend que chaque cas soit représenté dans le format structuré, et ce qu'elle accepte ou rejette. Ces points se traitent avec la plateforme, dans son environnement de recette, et non par un conseil comptable. Questions à poser à la plateforme (à ajouter aux demandes de devis, §5) :

1. **Atelier en franchise de TVA :** quels identifiants et quel code d'exonération attend-elle ? Un atelier en franchise est-il traité comme les autres pour la transmission et le e-reporting ?
2. **Ventes aux particuliers :** quelles données de transaction transmettre, à quelle fréquence, avec quelle ventilation par taux ? Comment les avoirs et corrections sont-ils représentés sans double déclaration ?
3. **Paiements :** quelle représentation pour l'exigibilité de la TVA (encaissement ou option pour les débits), l'acompte, le paiement partiel et le remboursement ? Les règlements sont déclarés par l'atelier, non par un prestataire de paiement.
4. **Facture mêlant bien et service** (reliure avec étui) : quelle présentation est attendue, et quels taux sont acceptés par ligne ?
5. **Mandat :** que doit confier chaque atelier à la plateforme, et quelles opérations Oppe exécute-t-elle pour lui ? Les factures d'abonnement d'Oppe sont traitées séparément.
6. **Ateliers hors de France :** quels cas la plateforme couvre-t-elle ?

**Conséquence sur le produit.** Les refus de la traduction (acompte, TVA sur les débits, vente mixte à un particulier) ne sont plus « en attente d'une décision comptable » : ils sont en attente d'une **validation du format avec la plateforme**. Dès que la plateforme confirme la représentation attendue, ils pourront être traités sans autre prérequis. Les obligations légales elles-mêmes (qui doit émettre ou déclarer) s'imposent à l'atelier, qui en reste responsable.

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
| Confirmation écrite de la plateforme sur les cas techniques (§4) | |
| Décision d'Antoine, date | |

## 7. Ce qui ne dépend pas de la décision

Le lot 3 (reprise de la PR #185 : traduction EN 16931 et règles françaises) et le lot 4 (service Factur-X isolé) peuvent avancer avant le choix de la plateforme, car ils produisent le fichier et ne le transmettent pas. Les lots 2 (réception), 5, 6, 7 et 8 attendent la décision.
