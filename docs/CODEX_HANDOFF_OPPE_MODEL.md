# Passation Codex — modèle Oppe, après publication du lot 6

Mise à jour du 5 octobre 2026. Le [journal du lot 6](OPPE_LOT6_PUBLICATION_20261005.md) atteste les résultats ; le [dossier technique B/C](OPPE_BC_COMPLETION.md) précise les limites. La [préparation Stripe live](OPPE_STRIPE_LIVE_PREPARATION_20261005.md) donne les identifiants créés et les blocages constatés. Cette version remplace l’état de reprise du lot 5. Son historique reste accessible dans Git.

## Production vérifiée

- PR #78 à #86 fusionnées. Code applicatif publié : `13f18d6`.
- Worker Ma Reliure/Fine Bindery : `8f9d80ce-82a3-4848-8e9a-0bc1edc383ae`, à 100 %, déployé le 5 octobre à 18:10:10 UTC. Même code que le lot 6 ; ajout du seul secret de signature Connect, 16 liaisons au total.
- Base : **107 migrations**, dernière `20261006140000`.
- Quatre ateliers historiques gratuits ; abonnement et encaissement en ligne fermés en base et dans les annonces publiques.
- CI main verte, 3 498 tests et 19 contrôles de publication. Smoke final : 28 contrôles réussis ; webhooks sans signature en 400 et HTTP vers HTTPS en 301.

## Livré et vérifié

**A — projets vendus par Oppe** : reste en production, vérifié de bout en bout sur qwf avec Stripe test lors des lots précédents. Origine Oppe distincte des clients propres, accord atelier sur prestation/rémunération/délai, marge cible de 25 % du prix de vente HT, devis accepté uniquement par le client, commande, facture OPPE SAS par marque, TVA qualifiée par ligne, remboursement et avoir, facture atelier vers Oppe, contrôle et règlement manuel à 30 jours. Aucun prix client ni marge transmis à l’atelier.

**B — outil atelier** : code d’abonnement à 15 € HT/mois publié, écran et consentement du propriétaire, Checkout/portail, synchronisation des preuves Stripe et droits en base. Les ateliers existants restent gratuits ; une tentative abandonnée ne supprime pas la gratuité. Consultation et téléchargement historiques conservés après suspension. Le cycle technique activation/résiliation est éprouvé sur Stripe test et qwf. **Le service payant reste fermé**, avec fiscalité, portail, Checkout et e-mails à valider avant ouverture.

**Vitrine** : aperçu privé et publication explicite, rendu professionnel commun MR/FB ; route Ma Reliure `/ateliers/$slug`. Les droits des images et les consentements restent requis.

**Avoirs atelier** : partiels par prestation, montants après remise, taux effectivement facturés, plafonds par ligne et taux, reprise sans doublon et avoir du reliquat. Franchise et anciennes factures sans ventilation traitées sans appliquer un nouveau taux. Une ancienne facture assujettie sans ventilation fiable conserve son avoir complet d’origine ; l’avoir partiel n’est pas proposé. Recette par l’interface qwf, facture d’origine inchangée.

**C — clients propres** : socle de paiement direct sur le compte Stripe de l’atelier publié, 3 % du TTC, frais Stripe distincts à charge de l’atelier. Facture émise en EUR, sans acompte, ouvrage propre ; projet Oppe refusé. Consentement, configuration du compte, lien privé expirant, contrôles de preuve, remboursement lié à un avoir et webhook dédié. **L’encaissement reste fermé et C n’est pas entièrement prêt** : recette Connect complète et reprise d’un Checkout complété en échec à terminer.

**Transport clients propres** : journal déclaratif avec facture, payeur, coût et référence de couverture. Aucun achat d’étiquette supplémentaire. Le forfait Oppe français n’est pas étendu à C ou à l’international.

## Travail restant, dans l’ordre

1. Stripe live `acct_1UGI34K0Q47WbZPf` : Identité publique corrigée dans le Dashboard et relue par l’API : nom Ma Reliure / Fine Bindery, descripteur `OPPE RELIURE`, préfixe `OPPE`, support `contact@oppe.fr`, site et URL de support `https://mareliure.fr`, description reliure/restauration et outil atelier. Le MCC `5734` reste inchangé et à qualifier auprès de Stripe. Connect test vérifié ; le passage live requiert maintenant la pièce d’identité et le selfie du titulaire. Voir le reçu Stripe pour les preuves et l’écran de reprise.
2. Obtenir les décisions fiscales de l’expert-comptable et la revue juridique des clauses marquées. Ne pas présenter une validation comme acquise sans sa preuve.
3. B : produit/prix et portail live créés, événements abonnement activés. Stripe Tax a un statut actif mais aucune immatriculation enregistrée ; catégorie fiscale du produit non choisie et approbation fiscale non obtenue. Après décision comptable : configuration Tax, liens juridiques du portail et recette hébergée Checkout → paiement → facture/reçu/e-mail → résiliation, puis cohérence de l’indicateur en base et de l’offre publique.
4. C : webhook et secret Connect configurés. Démonstration Stripe test réussie (100 € fictifs, 3 € de frais plateforme), compte Accounts v2 avec Dashboard complet et responsabilités Stripe ; capacités restreintes. Après vérification personnelle du titulaire, confirmer l’activation live, adapter le socle v1 à v2 et configurer un atelier français. Achever la reprise après échec puis recette applicative succès/refus/asynchrone, remboursements, litiges, frais et e-mails avant ouverture.
5. Sendcloud : secrets, données de colis et couverture admissible, test physique réel aller-retour. Aucun tarif international inventé.
6. Premier paiement réel de faible montant puis remboursement. **Aucun débit réel réalisé par le lot 6.**
7. Offre internationale : pays, devises, transporteur, tarif réel, couverture, douanes et fiscalité à décider avant construction/ouverture.

Catalogue B : lookup `oppe_workshop_monthly_15_eur_v1`, prix test `price_1UNEP3KB3EBc6SlhrtzPgl4e`, prix live `price_1UNGCtK0Q47WbZPfij57EdX6` (1 500 centimes EUR, mensuel, TVA exclue). Portail live par défaut `bpc_1UNGGgK0Q47WbZPfn3zFcKbl`, résiliation à échéance. Le script `scripts/setupWorkshopStripeProducts.ts --live` refuse une clé test ou le mauvais compte ; il ne constitue pas une autorisation fiscale et ne doit pas ouvrir B automatiquement.

## Méthode de reprise

Lire `AGENTS.md`, `CLAUDE.md` et le dernier bloc de `CODEX_HANDOFF.md`. Vérifier branche et état local ; un seul agent à la fois. Règles métier dans `src/marketplace/`, aucun secret versionné, aucun prix commercial ou visuel inventé.

Outillage et preuves privés : `D:/CodexProjects/oppe-model-operation/`. La base qwf est exclusivement de recette ; Stripe test, acteurs fictifs et aucun e-mail réel. La production Supabase est `hljxohondjvrkzqicexl` ; le build Ma Reliure vérifie le projet réellement inclus dans le bundle.

Pour chaque migration : CI verte, fusion, sauvegarde fraîche, restauration, empreintes comparées en UTC, répétition du script transactionnel exact, contrôle de dérive et d’identité, application unique avec marqueur de commit, build vérifié, version Worker inactive, bascule et smoke. Sur résultat incertain, inspecter en lecture seule avant toute autre écriture ; ne jamais rejouer aveuglément.

Le précédent Worker est `b812e4cc-a6ea-4050-81a8-508044caed0c`. Après émission d’avoirs partiels, il ne constitue plus un retour arrière complet : fermer les offres et utiliser une correction compatible avec plusieurs avoirs, garder les documents et les webhooks. Ne jamais supprimer des pièces pour revenir en arrière.

La mise à jour de ce dossier et du journal est documentaire ; elle ne nécessite pas de redéployer le code applicatif `13f18d6`.
