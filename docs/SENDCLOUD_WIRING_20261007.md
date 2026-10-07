# Branchement Sendcloud, 7 octobre 2026

## Résultat

Les clés Sendcloud sont installées sur le Worker de production et vérifiées contre l'API réelle. Aucune modification de code : l'adaptateur, le devis et le webhook déjà déployés fonctionnent tels quels. **L'achat automatique reste fermé** (`enabled=false`), zéro réservation d'étiquette, aucune étiquette achetée, aucune expédition physique.

## Intégration utilisée

L'ancienne intégration « mareliure 1 » (`621399`) avait ses clés masquées, non conservées, et sa régénération échouait côté Sendcloud (« Impossible de régénérer les clés »). Le propriétaire a créé lui-même une seconde intégration de type Sendcloud API, **« mareliure api » (`633076`)**, avec « Feedback des Webhooks » vers `https://mareliure.fr/api/marketplace/sendcloud-webhook`, sans Webhook Signature Key. Le feedback webhook de `621399` est à désactiver : ses notifications, signées avec une autre clé, seraient refusées (401) et relancées par Sendcloud.

Secrets du Worker `mareliure`, posés par le propriétaire avec `wrangler secret put` (valeurs jamais affichées ni transmises à un agent) :

| Secret | Valeur |
| --- | --- |
| `SENDCLOUD_PUBLIC_KEY` | clé publique de `633076` (36 caractères, fin `…b7a2`) |
| `SENDCLOUD_SECRET_KEY` | clé confidentielle de `633076` (32 caractères, fin `…c518`) |
| `SENDCLOUD_WEBHOOK_SECRET` | **même valeur** que `SENDCLOUD_SECRET_KEY` : une intégration « Sendcloud API » sans Webhook Signature Key signe avec sa clé confidentielle ([portail développeur](https://sendcloud.dev/api/v2/webhooks)) |

Version de Worker active après ces ajouts : `cfb5c426-8a31-4672-aaa8-147a786af488` (source « Secret Change », même code que `d4e58fd7`). Après une rotation des clés, poser à nouveau les **trois** secrets.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Secrets présents sur le Worker | les trois noms listés par `wrangler secret list` |
| Webhook sans signature | HTTP 401 (404 avant les clés) |
| Webhook avec signature invalide | HTTP 401 `invalid_signature` |
| « Tester l'API Webhook » depuis `633076` | « Envoyé avec succès » côté Sendcloud, donc 2xx du site : la signature est vérifiée avant tout traitement, seule une signature valide atteint 2xx. Événement de test ignoré, rien écrit |
| Authentification API, `GET /api/v2/user` | HTTP 200 |
| Devis `POST /api/v3/shipping-options`, `calculate_quotes=true` | HTTP 200 dans les deux sens, 18 méthodes, **0 sans prix**, toutes en EUR |
| Verrou d'achat en production (lecture seule) | `enabled=false` depuis le 7 octobre 11:29:54 UTC |
| Réservations d'étiquette en production | 0 |
| Migrations en production | 118 |

Le devis a été obtenu avec `scripts/sendcloudQuoteCheck.mjs`, lancé par le propriétaire : clés saisies masquées, seuls longueur et quatre derniers caractères affichés, aucune étiquette créée, aucun nom ni adresse envoyés (pays, codes postaux, poids, dimensions). Relance : `node scripts/sendcloudQuoteCheck.mjs`.

### Devis réels, France → France, 500 g, 35 × 25 × 8 cm

Paris 75011 → Lyon 69002 et retour, prix identiques dans les deux sens (EUR, tarifs Sendcloud, hors TVA d'après la facturation Sendcloud documentée au § 5 bis de `book-roundtrip-operations.md`) :

| Méthode | Code | Prix | Point relais requis |
| --- | --- | --- | --- |
| Mondial Relay Point Relais | `mondial_relay:service_point,dualapi/size=l,c2c` | 3,91 | oui |
| Mondial Relay Locker | `mondial_relay:locker_delivery,dualapi` | 3,81 | oui |
| Mondial Relay Domicile | `mondial_relay:home_domestic,dualapi/c2c` | 5,17 | non |
| Colissimo Bureau de poste | `colissimo:post-office` | 6,97 | oui |
| Colissimo Domicile | `colissimo:home/fr` | 8,85 | non |
| Colissimo Domicile signature | `colissimo:home/signature,fr` | 10,05 | non |
| Chronopost Shop2Shop | `chronopost:shop2shop` | 3,46 | oui |
| Chronopost 18 | `chronopost:18` | 13,35 | non |

La paire retenue le 2 octobre (relais 3,91 + domicile 5,17) donne **9,08 €**, identique au relevé de l'interface : le forfait aller-retour reste tenable.

## Ce qui n'est pas vérifié, et pourquoi

- **Méthode « Retour »** : aucune méthode renvoyée n'a `functionalities.returns=true`. L'aller « relais → atelier » prévu au § 5 de `book-roundtrip-operations.md` exige une méthode Retour activée avec l'adresse de l'atelier pilote dans Sendcloud ; non configurée à ce jour.
- **Couverture d'un livre confié** : inchangée. L'indemnisation Mondial Relay (25 €, plafonnée à une facture de vente) ne couvre pas un livre confié pour travaux ; aucune assurance souscrite ni présentée.
- **Création, PDF, suivi réel, rapprochement, doublons et annulation** : couverts par les tests de la suite (réponses simulées, PGlite), pas contre l'API réelle. Les vérifier en réel exige d'acheter une paire d'étiquettes (≈ 9,08 € HT) : non autorisé à ce jour.
- **Espace atelier, transport client propre** : `workshopTransportOptions` écarte les méthodes à point relais requis ; restent Mondial Relay Domicile, Colissimo Domicile et Chronopost, avec prix. Non appelé depuis une session atelier réelle.

## Ouverture du transport automatique : préalables restants

1. Méthode Retour Mondial Relay activée dans `633076`, adresse de l'atelier pilote.
2. Accord explicite du propriétaire pour une paire d'étiquettes facturables, destinataires opérateur et atelier pilote, aucun client réel.
3. Recette réelle : création, PDF privé, webhook de suivi rapproché, annulation de l'une des deux, frais réellement facturés lus sur la facture Sendcloud.
4. Seulement ensuite, ouverture du verrou par l'opérateur avec ses preuves.
