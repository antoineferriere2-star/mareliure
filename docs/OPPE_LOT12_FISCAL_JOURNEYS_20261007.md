# Lot 12 — fiscalité B/C et recette hébergée, 7 octobre 2026

Le propriétaire confirme directement : « Oui, OPPE est redevable et collecte la
TVA ». L'approbation administrative des taux A du 6 octobre est conservée. Le
[brief fiscal du 7 octobre](OPPE_FISCAL_DECISION_20261007.md) complète B/C ; aucun
avis obtenu d'un expert-comptable ou d'un juriste n'est déclaré.

## Configuration et conditions

B, professionnels établis en France métropolitaine : prix existant 15 € HT,
taux manuel Stripe actif et exclusif de 20 %, 3 € de TVA, 18 € TTC par mois,
vitrine incluse. La franchise de l'atelier client ne supprime pas cette TVA.
Checkout exige l'identité professionnelle mais ne demande pas un numéro de TVA
à un atelier en franchise. La taxation automatique est désactivée pour éviter
une double collecte ; aucune immatriculation Stripe Tax fictive n'est créée.
Les établissements étrangers, ultramarins ou dont les informations sont
incomplètes sont orientés vers une qualification individuelle.

C : « 3 % du montant encaissé, TVA comprise, hors frais Stripe ». Sur 100 €
encaissés : 3 € TTC = 2,50 € HT + 0,50 € de TVA. Une facture OPPE → atelier
constate la retenue réelle Stripe ; aucun second paiement. Les remboursements
effectifs de frais donnent lieu à des avoirs à ventilation cumulative exacte.
Le remboursement tardif de l'application fee est aussi rapproché. Les parties
et le tarif sont figés au paiement, les documents émis sont immuables. Les
anciennes conventions explicitement HT sont préservées avec historique des
consentements. Aucune convention C ni paiement C en production avant ce lot.

Les conditions professionnelles réellement publiées sont versionnées
`oppe-workshop-2026-10-07-v2` : prix, renouvellement, résiliation fin de période,
droits, disponibilité des documents et responsabilité des parties. L'absence
d'une revue juridique externe n'est pas transformée en certification obtenue.
Les quatre ateliers historiques ne basculent pas automatiquement au payant.

A conserve sa qualification administrative par prestation : reliure d'un livre
au sens fiscal à 5,5 %, réparation/restauration à 20 %, cas particuliers à
qualifier. Transport autonome, accessoire ou ambigu à identifier explicitement.
Une ligne séparée n'impose pas 20 %. Le forfait existant 12,50 € HT / 15 € TTC
exige une qualification autonome ; les autres cas nécessitent un prix validé
individuellement. Aucun document historique n'est recalculé.

## Recette B : application hébergée et Stripe test exclusivement

Worker isolé `mareliure-oppe-lot7-qa`, base `qwfhebtxeubfmvvdsqdt`, plateforme
Stripe test existante. Nouveau client fictif avec horloge de test ; aucun numéro
d'immatriculation inventé. Trois factures `RMMBUAFO-0006` à `0008`, chacune
15 € HT + 3 € de TVA = 18 € TTC.

- Souscription depuis l'espace atelier ; Checkout hébergé à 18 € TTC, paiement
  avec la carte officielle de test ; droits actifs et facture payée synchronisés.
- Renouvellement par horloge Stripe : facture à 18 € TTC payée, droits conservés.
- Moyen de paiement officiel de test défaillant : facture ouverte et abonnement
  `past_due`, droits de création retirés, notification capturée.
- Reprise depuis le portail hébergé avec la carte test fonctionnelle : facture
  régularisée, abonnement actif, droits rétablis.
- Résiliation depuis le portail : maintien jusqu'à fin de période, puis horloge
  avancée, statut `canceled`, droits retirés, trois factures conservées et toujours
  consultables/téléchargeables dans l'application.
- PDF initial téléchargé depuis l'application et rendu : ligne 15 €, TVA 20 %
  3 €, total 18 €, identité OPPE et identifiants existants en pied de page.
- Notifications rendues/capturées uniquement en QA ; aucun destinataire réel.

L'identité publique du compte OPPE live existant est cohérente : adresse publiée,
support `contact@oppe.fr`, descripteur `OPPE RELIURE`. Le taux manuel live est
`txr_1UNpESK0Q47WbZPfjHzpVCbt`. Le numéro de TVA existant d'OPPE et son pied de
page juridique sont enregistrés pour les futures factures Stripe. Aucun débit
live ni facture historique modifiée.

## C : limite externe maintenue

Compte atelier test **existant** `acct_1UNTDkKB3EC6OVAY`, `dashboard=full`, Stripe
collecte exigences, frais et pertes. Relecture du 7 octobre : paiements par carte
et virements `restricted`, 14 exigences à compléter par le titulaire, dont
connexion, identité, activité, coordonnées bancaires et acceptation Stripe.
Le compte OPPE live est déjà opérationnel ; son onboarding n'est pas à refaire.

La configuration de l'atelier peut être reprise indépendamment de l'ouverture
du paiement C. Les succès, reprises, remboursements partiel/intégral et litiges C
hébergés ne sont pas attestés tant que ce compte ne peut pas encaisser. C reste
fermé. Tests financiers serveur/SQL, arrondis et avoirs ne remplacent pas cette
recette hébergée. Transport Sendcloud réel et international restent inactifs.

## Sauvegarde, répétition et publication

Sauvegarde production `production-before-lot12.dump`, SHA-256
`ead92d4d62f5a2c2d716482a29934183a3a9e604d769e9a18f5dbb31c9ad4069`.
Restauration locale sur PostgreSQL 17 et migration additive
`20261007180000_workshop_fee_vat_documents` répétée avec journal, 10 empreintes
historiques conservées, quatre gratuités, offres fermées pendant la migration.
La copie locale ne reproduit pas Supabase Vault et ses déclencheurs de gestion ;
les diagnostics de restauration connus sont consignés, sans prétendre à une
copie complète de l'infrastructure Supabase.

Les preuves opérationnelles lot12-*, sauvegardes, captures, reçus et secrets
sont privés hors Git dans D:/CodexProjects/oppe-model-operation.

## Production vérifiée — 7 octobre 2026

PR #96 fusionnée après CI verte : code f237e7840b21dd792cb975d59a95ade6a2b16e33,
merge applicatif **f4415c89f3c878292736fa5684b94f294b7f338a**. CI PR et main vertes :
**3 645 tests / 296 fichiers**, 19 garde-fous de publication, TypeScript sans erreur,
lint sans erreur (19 avertissements existants), build réussi.

Worker **911386c8-7f72-4c45-afbd-280eab5a0858**, 100 %, déploiement
8fa10237-b956-4943-87a5-24fb500d90ba, publié à 2026-10-07T08:47:02.353966Z. Dix-huit bindings existants conservés,
quatre variables fiscales ajoutées et vérifiées ; runtime inchangé, aucune simulation
mail en production. **116 migrations**, dernière 20261007180000.

État relu en base après publication : **B ouvert**, onboarding Connect reprenable,
**C fermé**, **quatre ateliers historiques gratuits**, dix empreintes historiques
strictement identiques avant/après. A reste ouvert avec qualification fiscale explicite.
Transport Sendcloud réel et international non activés ; aucun débit live effectué.

Quatorze contrôles HTTP verts sur les deux marques : signatures Stripe absentes/invalides,
événements correctement signés hors périmètre rejetés, HTTP → HTTPS.
Les pages conditions-ateliers et partenaires-relieurs des deux domaines servent
18 EUR TTC, TVA 20 %, frais C à 3 % et indisponibilité du paiement C.
Inspection navigateur des conditions publiées sur les deux marques réalisée.

Dernière sauvegarde immédiatement avant publication :
production-before-lot12-publication.dump, SHA-256
358285d8e2f7430b69cf899d9313c81b6cf5c602234309ecbee6eb6f817e08de,
1 317 360 octets, 1 762 entrées. Migration et ouverture appliquées chacune une seule
fois par transaction TLS épinglée, commit confirmé, aucune réécriture historique.

**Intervention personnelle indispensable pour C uniquement :** reprendre la
configuration du compte atelier **de test existant** acct_1UNTDkKB3EC6OVAY.
Stripe présente la création du mot de passe du titulaire ; utiliser au besoin
« Utiliser une autre adresse e-mail » pour la connexion Stripe existante appropriée,
puis compléter identité, activité, banque et acceptation dans Stripe.
Ne pas refaire l'onboarding OPPE live. Aucun identifiant personnel, mot de passe
nouveau, KYC ou acceptation Stripe inventé par Codex. Après capacités actives,
terminer la recette C hébergée : succès, échec/reprise, remboursements partiel/intégral,
litige, frais, factures et avoirs, avant ouverture du paiement.

Reprise technique : conserver migration, documents, clé de liens C et webhooks.
Fermer B et la reprise d'onboarding en base avant un rollback du code au Worker
précédent 892add69-9222-4675-915d-6d86e34681c4. Les anciens bilans ne remplacent
ni la décision administrative actuelle ni cet état vérifié.
