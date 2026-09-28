# Activation progressive des paiements — nouveaux accords uniquement

Les quatre orientations de l'audit ont été validées par le propriétaire le 28 septembre 2026. Ce document remplace la liste des décisions commerciales ouvertes de `payment-circuits-audit-20260928.md`. Il ne constitue pas des CGV acceptées par les ateliers ou leurs clients. PR #51 reste ouverte ; aucune migration production, aucun paiement ni déploiement.

## Ordre proposé

1. **Client propre / règlement externe** : livré ici, sans frais plateforme ni Stripe. Accord déclaré avec justificatif, facture atelier, journal des règlements et remboursements, litige. Recette PostgreSQL locale isolée.
2. **Client propre / encaissement plateforme** : même chaîne contractuelle, avec 3 % du TTC encaissé et frais Stripe séparés. Ouverture seulement après catalogue/compte test, configuration Connect, contrat atelier et validation fiscale. Le Checkout historique reste interdit à ce circuit.
3. **Vente apportée** : vendeur atelier, facture atelier au client, commission facturée par plateforme à l'atelier sur 25 % du HT des seuls travaux. Nécessite preuve d'apport, accord atelier sur l'assiette détaillée et rapprochement du paiement ; ni marque ni origine dossier ne déclenche la commission.
4. **Conciergerie**, puis **abonnement** : coordination séparée des travaux et du transport ; offre 15 € HT/mois sans migration des contrats existants. On peut préparer les textes et contrats en parallèle, mais pas créer des Prices ni abonnements réels.

## Contrats et responsabilités

| Circuit | Vendeur / facture | Avant accord | Exigibilité cible / preuve | Verrou restant |
| --- | --- | --- | --- | --- |
| Client propre externe | Atelier vend et facture les travaux au client | Identité atelier, lignes HT/TVA/TTC/devise, échéance, règlement direct, frais plateforme 0 € | Dette client selon échéance du devis ; règlement seulement déclaré après réception avec référence conservée | Recette complète Supabase/habilitations avant publication ; pas de banque connectée |
| Client propre plateforme | Atelier facture les travaux ; plateforme facture sa rémunération à l'atelier ; frais Stripe distincts | 3 % du TTC effectivement encaissé, exemples calculés depuis le vrai devis, traitement TVA des honoraires et grille de frais Stripe identifiée | Rémunération après paiement effectivement réussi et rapproché ; pas à la création de Checkout ou sur simple retour navigateur | Compte test, choix Connect, frais réels et leur payeur, contrat signé, fiscalité. Acompte toujours bloqué |
| Vente apportée | Atelier → client pour travaux ; plateforme → atelier pour commission | HT travaux remisés par ligne, transport isolé, taxes exclues ; 25 % affichés en montant, jamais cumulés avec 3 % ; identité vendeur et plateforme | Premier périmètre : paiement intégral réussi et vérifié, accord commercial et preuve d'apport liés au même dossier. Paiement externe exige un justificatif validé ; simple origine insuffisante | Proposition de commission acceptée par atelier, traitement fiscal, facture de commission et recouvrement non construits |
| Conciergerie | Plateforme → client pour coordination ; atelier → client pour travaux ; facture transport par bénéficiaire nommé | Trois rubriques séparées, chaque prix/devise/TVA/échéance et bénéficiaire. Honoraires de coordination chiffrés et acceptés au dossier | Coordination due selon prestation et échéance explicites du devis séparé ; aucune règle de prélèvement anticipé présumée | Montants coordination, conditions de service et fiscalité à finaliser ; aucun transfert automatique |
| Abonnement nouveau | Plateforme → atelier : 15 € HT/mois, vitrine + outil métier | TTC applicable, périodicité, contenu inclus, date de début, résiliation et conservation/export des données | Selon période explicitement souscrite, paiement confirmé par Stripe ; aucun prix changé sur contrat existant | Catalogue Stripe, éventuels engagements 0/39 €, CGV, taxe, droits après résiliation et portail à valider |

« Plateforme » doit être remplacé dans chaque pièce émise par l'identité juridique configurée et vérifiée ; aucune nouvelle identité fiscale n'est inventée. Les anciens contrats de revente acceptés, montants et factures restent strictement inchangés. Les circuits cibles ne réutilisent pas la marge historique ou son Checkout.

## Premier circuit livré

Le contact ou l'ouvrage doit être enregistré comme client propre sans dossier réseau lié. Les contacts libres sans provenance, les acomptes et les accords historiques sans version `own-external-v1` ne sont pas ouverts au nouveau journal. Aucun document ancien n'est requalifié.

Sur un devis envoyé, l'atelier voit le TTC/devise, son rôle de vendeur et les frais plateforme nuls. Il saisit la référence d'un accord déjà obtenu (e-mail ou devis signé). Le serveur résout l'atelier depuis la session, puis SQL revérifie le membre actif, l'origine, l'absence d'acompte et le statut. L'enregistrement fige version, auteur, heure, justificatif, identité vendeur et montant. Ce n'est pas une signature électronique ni une acceptation automatique à la place du client.

La facture est préparée puis émise par les RPC existantes, avec contrôles fiscaux et mentions existants. Le montant, la devise et la référence devis doivent correspondre à l'accord ; les documents émis restent immuables. L'atelier peut déclarer les sommes reçues directement, avec une référence unique de justificatif. Le serveur dérive la devise de la facture et calcule le solde sous verrou transactionnel. Un retry identique ne crée rien ; changement de contenu avec la même clé, doublon de justificatif ou dépassement du solde est refusé. Le statut partiel est distinct d'un acompte : aucun échéancier d'acompte n'est activé.

Le journal est append-only, accessible via fonctions authentifiées seulement. Le reçu est **déclaré par l'atelier**, pas vérifié auprès d'une banque : conserver le justificatif original. Aucun upload de relevé bancaire ou stockage de coordonnées bancaires n'est demandé.

## Annulation, remboursement et litige

- Avant accord : refuser/laisser expirer le devis, aucune commission ni encaissement. Après accord : ne pas réécrire son prix ; établir une nouvelle proposition. L'annulation contractuelle doit être convenue et conservée par l'atelier.
- Facture émise : avoir intégral existant conservé, bloque toute nouvelle déclaration de règlement. Il n'effectue pas de remboursement bancaire. Pour un avoir partiel, le générateur applicatif reste absent : pièce rectificative conforme à établir avec l'outil comptable de l'atelier avant mise en service d'une automatisation.
- Remboursement externe partiel/total : l'atelier effectue d'abord le remboursement hors plateforme, puis référence son justificatif. Le journal plafonne la somme au net reçu et recalcule ce net. Un remboursement ne crée pas d'avoir automatiquement et ne décide pas du droit à remboursement. Frais plateforme toujours nuls.
- Litige externe : ouverture tracée, nouvelles déclarations de recettes bloquées jusqu'à clôture documentée ; remboursements possibles dans la limite reçue. Aucun effacement d'historique ni décision juridique automatique. La clôture ne verse ni ne prélève d'argent.
- Circuits Stripe futurs : aucun automatisme de restitution de commission/frais, de chargeback ou de compensation. Bloquer le calcul définitif en présence de remboursement/litige ; valider la règle contractuelle de restitution (totale ou prorata du HT travaux remboursés pour le réseau), le traitement TVA/avoir et la prise en charge des frais Stripe non restitués avant activation. L'orientation 3 % / 25 % ne tranche pas à elle seule ces points.

## Recette et limites

`externalSettlement.recipe.test.ts` crée une base PostgreSQL/PGlite éphémère et applique huit migrations réelles, dont les six migrations devis/factures/contacts/blocs/identité et les deux migrations de PR #51. Tables auth, membres, dossiers, stockage et propositions historiques environnantes sont minimales ; les tables, triggers et RPC devis/factures sont ceux du dépôt. Tests : devis envoyé → accord documenté → facture brouillon → facture émise, règlements partiels et total, retries, double justificatif, dépassement, remboursements, litiges, avoir intégral, permissions membre/anon/service_role et immutabilité.

Cette base est une recette SQL locale, pas une instance Supabase distante ni une restauration complète de production. Auth, Storage, envoi de devis et signature client ne sont pas testés de bout en bout. La QA visuelle utilise des données fictives locales ; aucune donnée client réelle n'est créée.

Aucune clé Stripe test/live détectée lors de cette reprise. Pas de catalogue consulté, de création de Product/Price, de Checkout Stripe test ni de remboursement Stripe testé. Le choix Connect est volontairement ouvert : [les types de charges](https://docs.stripe.com/connect/charges) répartissent différemment frais, remboursements et litiges ; [Stripe Tax avec Connect](https://docs.stripe.com/tax/connect) n'enlève pas la nécessité de déterminer le redevable. Les [webhooks](https://docs.stripe.com/webhooks) doivent être rapprochés et rejouables. Aucun frais Stripe négocié n'est supposé.

## Conditions exactes d'ouverture

Pour publier le premier circuit externe : revue PR, recette sur instance Supabase jetable avec membres authentifiés, émission/PDF/avoir, droits et sauvegarde, puis autorisation distincte pour migrations et Worker. Migration `20260928110000` après `20260928090000`, types régénérés depuis recette, diff contrôlé ; pas de production dans cette mission. Les nouveaux dossiers réseau restent bloqués par le verrou de la première migration : ne pas déployer globalement sans assumer ce verrou ou séparer son activation.

Pour ouvrir la carte : fournir un accès Stripe **test** au bon compte, vérifier catalogue/contrats actuels, choisir la configuration Connect avec vendeur atelier et frais à sa charge, faire approuver les clauses annulation/remboursement/litige et la fiscalité, puis implémenter uniquement le Checkout client propre 3 % et son rapprochement facture. Recette obligatoire : succès, refus, annulation, expiration, paiement asynchrone, doublons, ordre inversé, refund partiel/total, litige et rapprochement des frais. Garder le verrou jusqu'à validation de cette chaîne complète.
