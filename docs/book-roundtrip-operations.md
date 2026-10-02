# Aller-retour d'un livre — exploitation

Branche `feat/book-roundtrip-shipping` (PR #54, brouillon). État au 2 octobre 2026 : code complet, recette qwf exécutée, **rien en production**. Ce document décrit le parcours tel qu'il fonctionne, le traitement manuel (seul mode d'achat ouvert), l'ouverture contrôlée de l'automatisation, la publication et le retour arrière. Le prix client est décidé : **15 € TTC pour l'aller-retour en France métropolitaine** (12,50 € HT à 20 % de TVA).

## 1. Le parcours, rôle par rôle

| Étape | Client (`/mes-livres/:id`) | Atelier (`/atelier/cases/:id`, fiche ouvrage) | Opérateur (`/marketplace/cases/:id`) |
|---|---|---|---|
| Avant l'accord | Choisit : expédition organisée (15 € TTC, Ma Reliure), transport par ses soins, ou remise en main propre. Saisit adresse(s), téléphone, colis emballé (poids, L × l × ép.), nature et valeur déclarée ; accepte des conditions sans promesse d'assurance. Voit tout de suite si son envoi relève du forfait ou d'un traitement adapté. | Lit le plan sans l'adresse complète du client (code postal et ville seulement) ; accepte la réception en donnant son adresse de réception, ou refuse. | Voit le plan complet et le verdict ; crée la proposition **avec** la ligne « Transport aller-retour — 15 € TTC » (produit `book_round_trip_fr`) ou **sans** forfait. |
| Accord | La ligne transport apparaît séparément, avant acceptation. Le plan est figé dès qu'une offre aller-retour est présentée. | — | Valide la fiscalité (France 20 % obligatoire pour ce forfait). |
| Aller | Après paiement Stripe : télécharge l'étiquette aller (lien privé de 60 s), lit la méthode de dépôt, les conseils d'emballage et le suivi. Remise en main propre : voit l'adresse de réception de l'atelier. | Ouvre la fiche ouvrage depuis le dossier ; consigne « aller » puis, éventuellement, « livré selon le transporteur ». | Achète l'étiquette hors plateforme puis la **dépose** (PDF, transporteur, suivi, méthode, coût réel TTC). |
| Réception | Voit « réception physique confirmée par l'atelier » et un éventuel « incident signalé », jamais leurs notes, photos ni preuves. | Constate la réception physique (conforme / écart), photos privées, incidents. « Livré » selon le transporteur ne suffit jamais. | Lit le journal atelier. |
| Retour | Reconfirme son adresse de retour quand l'atelier a terminé. Voit le suivi retour. | Déclare « travaux terminés, retour prêt » avec le colis retour mesuré ; télécharge l'étiquette retour ; consigne « retour » puis la remise finale. | Dépose l'étiquette retour (possible seulement après retour prêt **et** adresse reconfirmée). |
| Clôture | « L'atelier a déclaré la remise de votre livre. » | Remise finale avec référence de preuve. | Frais réels consignés ; déficit éventuel visible. |

Fine Bindery : l'espace client et l'espace atelier sont traduits, mais **l'expédition organisée n'est pas proposée** sur un dossier Fine Bindery (un dossier Fine Bindery ne devient pas un ouvrage atelier : `marketplace_binder_import_case` est limité à Ma Reliure). Restent la remise en main propre et le transport par le client.

Dossiers historiques déjà acceptés sans plan : aucun changement pour le client ; leur suivi reste le journal atelier existant.

## 2. Ce qui rend le forfait proposable

Calcul en base (`marketplace_round_trip_plan_block`, jumeau TypeScript `roundTripPlanBlock`), dans cet ordre :
1. dossier Ma Reliure ; 2. mode « expédition organisée » ; 3. livre courant, valeur déclarée < 100 € ; 4. adresses client (et retour) en France métropolitaine hors Corse, Monaco et outre-mer ; 5. colis ≤ 500 g et 35 × 25 × 8 cm (dimensions comparées triées) ; 6. accord de réception de l'atelier **retenu**, pour la **version courante** du plan, adresse de réception en métropole.

Ces plafonds sont une présélection métier, **jamais une garantie du transporteur ni une assurance**. Hors périmètre : traitement adapté (devis distinct, aucune ligne à 15 €, aucun supplément ajouté en silence).

## 3. Traitement manuel (mode en vigueur)

1. Vérifier dans le panneau « Acheminement du livre » : proposition avec forfait **acceptée**, **payée (Stripe)**. Un règlement déclaré à l'atelier ne compte pas : sans paiement Stripe constaté, la saisie n'apparaît pas et la base refuse (`platform_payment_required`).
2. Acheter l'étiquette dans l'outil du transporteur avec les adresses du plan (aller : client → adresse de réception de l'atelier ; retour : atelier → adresse de retour reconfirmée).
3. « Déposer une étiquette achetée manuellement » : PDF, transporteur, suivi, méthode affichée au client (ex. « Dépôt en Point Relais Mondial Relay »), coût réel TTC. Le dépôt réserve le sens (une seule réservation active par dossier et par sens ; un double clic retrouve la même), stocke le PDF dans le bucket privé sans écrasement, puis confirme.
4. Si le coût total des deux étiquettes dépasse 15 € TTC, cocher la reconnaissance du déficit : il est **consigné** (`deficit_ttc_cents`), le client ne paie jamais plus.
5. Annulation : « Annulation demandée », puis « Annulée (référence) » quand le transporteur l'a confirmée. Aucun remboursement n'est présumé : saisir « Frais réels / remboursement constatés » d'après la facture. Une nouvelle étiquette après échec ou annulation exige de cocher « remplacement ».
6. Abandon d'une réservation sans étiquette : « Abandonner (aucune étiquette achetée) ».

## 4. Achat automatique (fermé)

Trois verrous cumulés, relus à chaque achat :
- table `marketplace_round_trip_automation` : fermée par défaut ; **ouverture** par un administrateur avec cinq preuves (devis fournisseur, conditions de couverture, validation fiscale, recette API, décision commerciale), tracée dans `marketplace_round_trip_automation_changes` ; **fermeture immédiate** à tout moment (bouton « Fermer l'achat automatique ») ;
- secrets Worker `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY`, `SENDCLOUD_WEBHOOK_SECRET` ;
- un **tarif revu** par dossier (`marketplace_round_trip_rate_approvals` : empreintes des adresses, codes méthode, coûts TTC ≤ 15 €, coût économique ≤ 12,50 € HT).

Une fois ouverts, l'opérateur déclenche « Acheter l'étiquette automatiquement (facturable) ». La réservation précède l'appel ; la référence fournisseur est l'identifiant de réservation (`external_reference_id`, un doublon renvoie l'envoi existant) ; après une réponse ambiguë, le fournisseur est relu avant toute nouvelle demande. Le webhook `/api/marketplace/sendcloud-webhook` (HMAC `Sendcloud-Signature`) relit le statut chez le fournisseur, déduplique, et continue de fonctionner après fermeture du verrou pour les étiquettes déjà achetées ; sans clés : 404.

## 5. Compte Sendcloud constaté le 2 octobre 2026 (lecture seule)

Compte connecté (Chrome de l'utilisateur), formule **Free (monthly)**, 0/50 étiquettes, aucun contrat transporteur propre. Tarifs Sendcloud actifs : Chronopost, Colissimo, Mondial Relay. Intégration **« mareliure » de type Sendcloud API déjà connectée** (1/2 intégrations). Comparateur de prix (indicatif, **hors TVA**, supplément carburant inclus), France → France, 500 g, 35 × 25 × 8 cm :

| Méthode | Prix HT |
|---|---:|
| Mondial Relay Point Relais (dépôt → point relais) | 3,91 € |
| Mondial Relay Locker | 3,81 € |
| Mondial Relay Home Domestic (→ domicile) | 5,17 € |
| Mondial Relay Point Relais – **Retour** (dépôt → adresse du compte), méthode **désactivée** dans le compte | 3,91 € |
| Colissimo Service Point | 6,97 € (6,11 + carburant 14,02 %) |
| Colissimo Home | 8,85 € |
| Colissimo Home Signature | 10,05 € |

Aucune étiquette créée, aucune méthode activée, aucun réglage modifié.

### Chiffrage réel du forfait

| Combinaison | Aller | Retour | Transport HT | TTC si TVA 20 % facturée |
|---|---:|---:|---:|---:|
| Retour MR relais → atelier + MR domicile → client | 3,91 | 5,17 | **9,08 €** | 10,90 € |
| Retour MR relais → atelier + MR point relais → client | 3,91 | 3,91 | 7,82 € | 9,38 € |
| Colissimo point + Colissimo domicile | 6,97 | 8,85 | 15,82 € | 18,98 € |

Recette du forfait : 15 € TTC = 12,50 € HT. Avec emballage retour (~1 € HT, estimation) et frais Stripe (~0,48 €), la combinaison Mondial Relay relais + domicile coûte ≈ **10,56 € HT** : **le forfait de 15 € TTC est tenable** avec la seule indemnisation de base du transporteur. Colissimo ne l'est pas.

### Conditions encore ouvertes avant l'automatisation
1. L'aller « relais → atelier » utilise la méthode **Retour**, qui livre l'**adresse du compte** : il faut une adresse de retour par atelier dans Sendcloud (ou un compte par atelier) et activer la méthode.
2. Une livraison client en point relais exige le choix d'un point relais (non collecté par le parcours) : le chiffrage retenu est donc **domicile** (5,17 € HT).
3. TVA réellement facturée par Sendcloud et récupérable : à lire sur une facture.
4. Couverture d'un livre confié : conditions écrites Mondial Relay/Sendcloud à obtenir ; la protection d'envoi Sendcloud (XCover) n'est pas souscrite et ses exclusions s'appliquent.
5. Recette API réelle : nécessite une étiquette facturable (voir § 7).

## 6. Publication (non autorisée à ce jour)

Production : 95 migrations (dernière `20261001150000`). À appliquer dans l'ordre, en une transaction chacune, après sauvegarde : `20261001160000_book_round_trip_shipping` puis `20261002090000_book_round_trip_journey` (97). Contrôles post-application : 97 migrations ; propositions existantes inchangées hors colonnes ajoutées (toutes `manual`, `logistics_plan_version` nulle) ; verrou d'automatisation **fermé** ; bucket `round-trip-labels-private` privé et politique RESTRICTIVE ; aucun privilège `anon`/`authenticated` sur les nouvelles tables et fonctions. Puis déploiement du Worker depuis `main` (secrets conservés, `--keep-vars`, plafond CPU 1 000 ms), smoke tests : `/mes-livres/:id` d'un dossier historique (aucun panneau), un dossier sans plan (formulaire), `/api/marketplace/sendcloud-webhook` → 404 sans clés.

Aucune clé Sendcloud n'est nécessaire pour le traitement manuel.

### Retour arrière
- Worker : redéployer la version précédente (`wrangler versions deploy <id>@100%`).
- Base, tant qu'aucun plan ni étiquette réels n'existent : supprimer triggers, fonctions et tables de `20261002090000`, puis de `20261001160000` (colonnes `shipping_offer_kind`, `logistics_plan_version`, bucket vide). Dès qu'un vrai plan ou une vraie étiquette existe : **ne rien supprimer** ; fermer l'automatisation, masquer l'option de proposition (redéploiement) et conserver l'historique.

## 7. Seul test fournisseur restant, à autoriser explicitement

Une paire d'étiquettes **facturables** Mondial Relay via l'API Sendcloud (intégration « mareliure ») sur un vrai colis de livre courant emballé (≤ 500 g) : aller « Point Relais – Retour » vers l'adresse d'un atelier pilote, retour « Home Domestic » vers une adresse de test appartenant à l'opérateur. Coût prévu ≈ **9,08 € HT** (≈ 10,90 € TTC si TVA facturée), destinataire : opérateur et atelier pilote (aucun vrai client). Prérequis : secrets Worker de recette, webhook configuré vers la recette, méthode Retour activée avec l'adresse de l'atelier pilote. Vérifie : création, PDF stocké en privé, suivi par webhook, annulation de l'une des deux et frais réellement facturés.
