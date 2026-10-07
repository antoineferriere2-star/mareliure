# Analyse documentaire et décision administrative — 7 octobre 2026

Le propriétaire confirme directement : **« Oui, OPPE est redevable et collecte la TVA »**.
Cette confirmation établit le régime utilisé pour les nouveaux flux ; elle n'est ni une validation
par un expert-comptable ou un juriste, ni un rescrit. L'approbation des taux A du 6 octobre demeure
consignée dans son document d'origine. La présente décision précise B/C et corrige la qualification
du transport pour les nouveaux devis. Aucune facture historique n'est recalculée.

Identifiants repris des informations éditeur du projet, fournies le 10 septembre : OPPE SAS,
SIREN 943 317 610, SIRET 943 317 610 00013, TVA FR55 943 317 610. Aucun numéro supplémentaire créé.

| Flux, atelier établi en France métropolitaine | HT | TVA | TTC |
| --- | --- | --- | --- |
| B, mensuel, vitrine incluse | 15 € | 20 %, soit 3 € | 18 € |
| C, pour 100 € encaissés auprès du client | 2,50 € | 20 %, soit 0,50 € | 3 € |

**C : 3 % du montant encaissé, TVA comprise, hors frais Stripe.** La retenue Stripe est le règlement
des frais, pas une facture. OPPE émet une facture à l'atelier et des avoirs uniquement sur les frais
d'application effectivement remboursés. Aucun second prélèvement ni taxe ajoutée aux 3 %. Les frais
Stripe restent séparés, à la charge de l'atelier. Calcul en centimes et ventilation cumulative des
avoirs pour restituer exactement les bases et TVA de la facture initiale. Une convention indiquant
expressément des frais HT doit être signalée avant transition ; les anciennes acceptations sont
archivées et les paramètres des paiements déjà encaissés restent immuables.

La franchise en base du **client atelier** ne supprime pas la TVA facturée par OPPE. L'établissement
et son statut professionnel sont déclarés expressément, avec identité, adresse, pays, régime et
numéro de TVA s'il existe, à partir du profil de facturation. Le pays de l'annuaire ne suffit pas.
Un profil incomplet bloque ce seul atelier. UE/hors UE/territoires d'outre-mer : qualification
individuelle, sans taux français ni autoliquidation automatique. Une autoliquidation demanderait
notamment des preuves du statut et du lieu d'établissement et, pour l'UE, du numéro de TVA ; aucune
exonération n'est déduite d'une simple case « franchise ».

B conserve le prix Stripe live existant de 1 500 centimes, exclusif, mensuel. Taux manuel live actif
`txr_1UNpESK0Q47WbZPfjHzpVCbt`, France, TVA 20 %, hors taxes, créé le 7 octobre dans le compte existant.
Checkout applique ce seul taux à la ligne et désactive `automatic_tax`. Aucune immatriculation
Stripe Tax fictive. Le renouvellement conserve le taux de la ligne ; portail sans changement de
tarif ni prorata, résiliation en fin de période. Les quatre ateliers historiques gardent la gratuité
jusqu'à une transition explicitement demandée. Les documents restent accessibles après résiliation.

## Sources officielles consultées le 7 octobre 2026

- [CGI, article 278 — version actuelle sur Légifrance](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069577/LEGISCTA000006179654/) : taux normal 20 %. Le texte courant consulté conserve l'article jusqu'au 1er janvier 2027 ; ne pas reprendre une ancienne date d'abrogation isolée issue d'un résultat de recherche.
- [BOI-TVA-LIQ-10, version du 14 mai 2025](https://bofip.impots.gouv.fr/bofip/1380-PGP.html/identifiant=BOI-TVA-LIQ-10-20250514), § 10, 40 et 50 : taux réduit seulement dans les cas prévus ; un intermédiaire transparent ne reçoit pas automatiquement le taux du bien ; base HT = TTC × 100/(100+taux). **Application documentaire retenue** : outil B et service plateforme C au taux normal.
- [CJUE Bookit, C-607/14, 26 mai 2016](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=ecli%3AECLI%3AEU%3AC%3A2016%3A355), notamment dispositif/§ 57 : une prestation de traitement de carte telle que celle de l'affaire ne relève pas de l'exonération des paiements/virements. **Déduction pour le projet** : la seule intégration Stripe ne transforme pas le service technique d'OPPE en opération financière exonérée. Consultation du texte indexé officiel ; l'ouverture directe EUR-Lex est limitée par sa vérification navigateur.
- [DGFiP, Prestations entre assujettis](https://www.impots.gouv.fr/professionnel/prestations-entre-assujettis), page mise à jour le 14 février 2025 : distinction assujetti/redevable, territorialité B2B et justificatifs ; le statut professionnel en franchise ne signifie pas absence d'assujettissement.
- [BOI-TVA-LIQ-30-10-40, version du 29 juillet 2026](https://bofip.impots.gouv.fr/bofip/1437-PGP.html/identifiant=BOI-TVA-LIQ-30-10-40-20260729), § 10 à 60, 110, 120, 150 et 180 : définition du livre, éléments accessoires, reliure 5,5 %, réparation/désinfection au taux normal. Une appellation « album » ou « carnet » ne suffit pas ; qualifier le contenu et les pages vierges.
- [BOI-TVA-CHAMP-60-20, version du 29 juillet 2026](https://bofip.impots.gouv.fr/bofip/13858-PGP.html/identifiant=BOI-TVA-CHAMP-60-20-20260729) : prestation unique et élément accessoire à examiner au regard de l'opération, sans déduire l'autonomie d'une facturation séparée.
- [Stripe, Tax rates](https://docs.stripe.com/tax/tax-rates) et [collecte dans Checkout](https://docs.stripe.com/billing/taxes/collect-taxes?tax-calculation=tax-rates#adding-tax-rates-to-checkout) : taux manuels applicables à la ligne Checkout et aux abonnements, distinction inclus/exclusif ; documentation lue avec le CLI officiel installé.

## A et transport

Reliure d'un livre qualifié : 5,5 %. Réparation/restauration/conservation : 20 %, avec examen du
périmètre réel et de toute re-reliure. Autre objet : taux normal, sauf élément réellement accessoire
à qualifier. Aucune généralisation de 5,5 % à toutes les restaurations.

La facturation du transport sur une ligne séparée **ne suffit pas à retenir 20 %**. L'administration
choisit autonome (taux normal en France), accessoire (taux de la prestation principale) ou examen
individuel motivé, puis confirme le taux. La qualification est conservée dans la justification du
devis et son événement fiscal. Le forfait existant 12,50 € HT/15 € TTC ne peut être retenu qu'après
qualification explicite d'autonomie à 20 % ; sinon établir une version sans ce forfait avec un
transport chiffré et qualifié individuellement. Aucun prix nouveau inventé, aucun taux historique modifié.

## Conditions et ouverture

Conditions ateliers version `oppe-workshop-2026-10-07-v2` : montants, TVA, vitrine, renouvellement,
résiliation, gratuité historique, conservation documentaire, atelier vendeur en C et assistance
explicités. La revue juridique externe reste une amélioration à obtenir ; son absence n'est pas
présentée comme une obligation légale automatique de fermer B/C. Les droits impératifs applicables
sont réservés ; une utilisation ne relevant pas exclusivement de l'activité professionnelle doit
être examinée individuellement. Aucun avis juridique, médiateur désigné ou agrément inventé.

L'accès à l'onboarding est distinct de l'ouverture des encaissements. C ne sera ouvert qu'après la
recette hébergée complète avec paiement, reprise, remboursements, litige et documents. Aucun débit
réel ni achat d'étiquette de recette n'est autorisé par cette décision.
