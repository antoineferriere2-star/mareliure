# TVA des prestations Oppe — approbation administrative du 6 octobre 2026

**Mise à jour opérationnelle du 7 octobre 2026 :** le propriétaire confirme qu'OPPE
est redevable et collecte la TVA. L'[analyse documentaire et décision administrative
du 7 octobre](OPPE_FISCAL_DECISION_20261007.md) fixe B à 15 € HT + 3 € de TVA
(20 %), soit 18 € TTC mensuels, pour les professionnels établis en France
métropolitaine, et C à 3 % du TTC encaissé, TVA comprise : sur 100 € encaissés,
2,50 € HT + 0,50 € de TVA. Les établissements hors de ce périmètre restent à
qualifier individuellement. Il ne s'agit pas d'un avis obtenu d'un expert-comptable
ou d'un juriste. Les exceptions B/C constatées le 6 octobre ci-dessous sont un
constat historique, résolu pour ce périmètre par cette nouvelle décision.

**Statut : taux déjà configurés approuvés par le propriétaire le 6 octobre 2026.**
Décision `oppe-administrative-tax-2026-10-06`, consignée sur instruction directe du propriétaire.
Elle ne constitue pas une validation obtenue d'un expert-comptable ou d'un juriste.
Elle couvre les valeurs de la matrice ci-dessous, sans inventer de régime, de taux supplémentaire
ou d'immatriculation. Aucun taux n'est appliqué automatiquement à un ouvrage non qualifié.
Un devis Oppe ne peut être envoyé au client qu'après une décision d'administration qui qualifie la
prestation, fixe le taux de chaque ligne et la justifie (conservée avec l'auteur et la date). Les
propositions et factures historiques ne sont pas modifiées.

## Ce que fait le logiciel

| Sujet | Règle codée | Fichier |
| --- | --- | --- |
| Taux | Un taux **par ligne** (prestation, transport), saisi et confirmé par l'administrateur | `taxMatrix.ts`, `OppeTaxForm.tsx`, trigger SQL `c_marketplace_guard_oppe_tax_validation` |
| Catégorie non validée | Devis en brouillon, non envoyable, non payable | `sendPriceToCustomer.data.functions.ts`, `checkoutEligibility` |
| Règle « France = 20 % » | Conservée pour l'historique, **refusée** sur les nouveaux devis (SQL + serveur) | migration `20261005210000` |
| TVA de vente / d'achat | Distinctes : TVA de vente sur la facture Oppe, TVA d'achat sur la facture de l'atelier (assujetti ou franchise avec mention art. 293 B) | lots 3 et 4 |
| Avoirs | Ventilés proportionnellement aux lignes de la facture, au taux de chaque ligne | `marketplace_issue_oppe_credit_note` |
| Fine Bindery | Pays de facturation saisi par le client, cohérent avec le pays de taxation ; catégories UE / hors UE / réexportation à décision manuelle | `taxPolicy.ts` |

## Taux de la matrice approuvés administrativement

| Prestation | Taux approuvé | Source officielle | Réserve de qualification |
| --- | --- | --- | --- |
| Reliure d'un livre (au sens fiscal) | 5,5 % | BOI-TVA-LIQ-30-10-40 § 150 | Seulement si l'ouvrage répond aux quatre critères du livre (§ 10) |
| Réparation, restauration, conservation d'un livre | 20 % | § 180 | Frontière avec la reliure à qualifier au cas par cas |
| Autre ouvrage ou objet | 20 % hors qualification particulière | § 10 à 60, 120 | L'étiquette « album » ou « carnet » ne suffit pas : vérifier la définition fiscale du livre et, pour l'étui, son caractère accessoire |
| Transport | Qualification préalable | § 110 ; BOI-TVA-CHAMP-60-20 | La ligne séparée ne prouve pas l'autonomie. Autonome en France : 20 % ; accessoire : taux de la prestation ; ambigu : décision motivée. Le forfait existant de 15 € TTC (12,50 € HT + 20 %) nécessite la qualification autonome ; sinon nouveau prix individuellement validé |

Sources actualisées le 7 octobre : BOFiP BOI-TVA-LIQ-30-10-40 et BOI-TVA-CHAMP-60-20 (versions du 29/07/2026) ; BOI-TVA-CHAMP-20-50-40 et art. 259 A du CGI
(travaux sur biens meubles corporels pour un non-assujetti, imposables au lieu d'exécution matérielle).

## Constat historique B/C en live le 6 octobre 2026 (avant la décision du 7 octobre)

- B : prix existant `price_1UNGCtK0Q47WbZPfij57EdX6`, 1 500 centimes EUR mensuels,
  TVA exclusive. Produit `oppe_workshop_subscription_v1` sans code fiscal ; Stripe Tax actif
  mais **zéro immatriculation**. Aucun taux effectif d'abonnement n'est défini. Le montant de
  18 € TTC utilisé dans la recette Stripe test est issu d'une configuration fictive et ne devient
  pas un taux live par cette approbation. Montant TTC live : **non déterminé**.
- C : 3 % du TTC encaissé est le tarif plateforme, pas un taux de TVA. Aucun taux ni traitement
  HT/TTC des frais plateforme n'est défini. Sur 100 € encaissés, les frais sont 3 € ; leur ventilation
  fiscale reste non définie. Les frais Stripe sont distincts et à la charge de l'atelier.
- Ces exceptions ne suspendent pas l'approbation des taux A déjà configurés. Les taux, pays et
  catégories non définis ne sont ni complétés ni approuvés par supposition.

## Questions conservées pour un avis professionnel éventuel

1. Taux applicable à la revente par Oppe d'une reliure, d'une restauration, d'une réparation et d'un étui, ligne par ligne.
2. Transport : base distincte ou accessoire de la prestation principale.
3. Correspondance entre les 195 opérations du référentiel et les taux ; ouvrages hors définition du livre.
4. Fine Bindery : particulier UE ou hors UE (travail exécuté en France, art. 259 A), professionnel, réexportation après travaux et justificatifs.
5. Atelier en franchise en base facturant Oppe : effet sur la marge et sur la TVA déductible d'Oppe.
6. Avoirs et remboursements partiels : ventilation par taux.
7. Abonnement B à 15 € HT/mois : qualification fiscale, taux et catégorie Stripe Tax applicables, pays concernés et immatriculations nécessaires. La création du prix hors taxe ne vaut pas approbation fiscale.
8. Frais plateforme C de 3 % du TTC encaissé : qualification et facturation de la prestation Oppe à l’atelier, assiette et traitement de TVA ; distinguer les frais de traitement facturés par Stripe.
9. Configuration Stripe Tax existante : statut actif mais aucune immatriculation enregistrée, catégorie par défaut `txcd_10202000`. Confirmer par écrit les changements requis avant ouverture de B/C.
