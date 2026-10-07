# Sendcloud : revue tarifaire et publication du 7 octobre 2026

## Résultat en production

La PR [#101](https://github.com/antoineferriere2-star/mareliure/pull/101) est relue, complétée par sept tests d'enregistrement, fusionnée et déployée. Source : `cc17f5571ae36af2c5cfccb2c17588757089c826` ; correction initiale `9ec02e3`, tests supplémentaires `52364e3`.

Worker `9cd5fa31-3427-4e1d-9437-9de573807b17` à 100 %, déploiement `b8c122cb-d366-48ee-9ab8-d2b7c6163ede` du 7 octobre à 17:32:31 UTC. Retour arrière possible vers `cfb5c426-8a31-4672-aaa8-147a786af488`, qui contient les secrets Sendcloud actuels ; conserver le verrou fermé.

**Transport automatique fermé, zéro réservation d'étiquette.** Aucun achat d'étiquette, débit réel de recette ni transport physique. A/B/C restent ouverts ; quatre ateliers historiques gratuits, 118 migrations. Aucune migration nouvelle, aucun document historique modifié. Dix empreintes des données commerciales et de facturation identiques avant/après publication.

## Correction et limites

Le tarif revu acceptait un code libre, notamment une méthode nécessitant un point relais, alors que la demande de création n'en transmet aucun. L'enregistrement consulte maintenant les devis Sendcloud des deux trajets du dossier et refuse chaque code absent, sans prix en EUR ou nécessitant un point relais. Les codes sont normalisés avant stockage ; les colis, adresses et coûts restent contrôlés par les règles existantes. Le panneau signale les méthodes à point relais comme non achetables ici et traduit le refus.

Les sept tests supplémentaires vérifient le chemin complet avant écriture : refus d'un relais à l'aller ou au retour, code retour absent, prix absent, autre devise, fournisseur indisponible ; succès avec trajets/adresses/colis distincts et codes normalisés. Ils utilisent des réponses fictives et n'achètent rien.

Ce filtre supprime le défaut confirmé ; il ne prouve pas qu'une création, un PDF, le suivi, le rapprochement, les doublons ou l'annulation fonctionnent contre l'API réelle. La preuve de devis du branchement précédent reste dans [SENDCLOUD_WIRING_20261007.md](SENDCLOUD_WIRING_20261007.md). Les tarifs d'un exemple ne garantissent pas ceux d'un autre dossier.

Documentation du fournisseur : [méthodes et devis Sendcloud](https://sendcloud.dev/docs/shipments/shipping-options-and-quotes). La réponse décrit aussi les exigences de chaque méthode ; celles-ci doivent être vérifiées lors de la recette de création.

## Contrôles réussis

- 3 693 tests, 299 fichiers, sans échec au lancement complet ; 36 tests ciblés, dont les sept nouveaux cas.
- TypeScript sans erreur ; lint sans erreur, 19 avertissements existants.
- 19 garde-fous de publication ; build Ma Reliure avec le seul projet client `hljxohondjvrkzqicexl`, contrôle du bundle serveur réussi.
- CI PR sur `52364e3` et CI main sur `cc17f55` vertes.
- Sauvegarde fraîche : 1 347 650 octets, 1 801 entrées ; SHA-256 `b66a2f018973e4718121c2ade426833fde89d6e94edef3b00e1044bccb5c02d1`.
- Les 25 bindings et le runtime sont identiques à `cfb5c426`, dont les trois secrets Sendcloud et les paramètres fiscaux/conditions B/C. Aucune exception QA en production.
- 30 contrôles HTTP sur les deux domaines : conditions B/C, protections de l'onboarding et de Checkout, refus sans connexion des actions de revue tarifaire/achat/ouverture, webhooks Sendcloud sans signature ou mal signés en 401, protections des webhooks Stripe, redirection HTTP en 301.
- Lecture de production après publication : verrou fermé, zéro étiquette réservée, 118 migrations, quatre gratuités, B/C/onboarding ouverts ; dix empreintes commerciales et de facturation inchangées.

Preuves privées : `D:/CodexProjects/oppe-model-operation/sendcloud-pr101-*`, sauvegarde hors Git. Ne publier aucune clé, jeton ou donnée personnelle.

## Utilisation et ouverture

Le panneau est dans **Admin → dossier → Acheminement du livre → Achat automatique**. L'interrupteur est global, même lorsqu'il est affiché dans un dossier. Ouvrir le verrou ne crée aucune étiquette : l'achat est ensuite déclenché par une action distincte et facturable, avec tarif revu du dossier.

Ne pas enregistrer « recette API non faite » comme preuve de recette réussie. Ne pas présenter l'absence de couverture comme une assurance obtenue. La validation fiscale administrative existante ne vaut pas avis comptable ou juridique.

L'ouverture reste à conditionner aux preuves adaptées de couverture et à la recette réelle des étiquettes ; leur achat nécessite l'autorisation explicite du propriétaire. Le parcours relais nécessiterait aussi la configuration de la méthode Retour et la transmission du point relais, actuellement absente. Une méthode directe doit être réellement proposée pour les deux trajets du dossier. Vérifier la désactivation du feedback webhook de l'ancienne intégration `621399` ; l'intégration active est `633076`.
