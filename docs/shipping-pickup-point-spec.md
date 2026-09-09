# Expédition en point relais — cahier des charges

> **Statut : spécifié, non commencé.** Rien de ce document n'est construit. Il
> est écrit ici pour qu'aucune décision ne se perde entre deux sessions, et
> parce que l'ordre de travail arrêté place ce chantier **après** le référentiel
> tarifaire et le cadrage Stripe Connect.
>
> Les livrables A à I (§10) sont exigés **avant** toute ligne de code
> d'intégration.

---

## 1. L'objectif d'expérience

> « Je présente mon livre, je paie, Ma Reliure me dit simplement où le
> déposer. »

Le client ne doit jamais avoir à organiser lui-même un transport avec
l'artisan. La référence assumée est Vinted : recherche de points relais,
sélection, étiquette ou QR code, dépôt, suivi automatique.

## 2. Deux trajets, un seul modèle

`CLIENT_TO_BINDER` puis `BINDER_TO_CUSTOMER`. Le second n'est pas une
symétrie automatique du premier : le mode de retour peut différer selon
l'option commerciale retenue.

## 3. Le parcours cible

```
commande confirmée
  → choix du mode d'expédition (point relais / domicile)
  → recherche des points relais proches (API fournisseur, jamais une liste locale)
  → sélection du point relais, modifiable jusqu'à création de l'expédition
  → checklist de préparation du livre
  → constat avant envoi (photos Métré réutilisées)
  → génération de l'étiquette / QR code
  → dépôt
  → tracking normalisé
  → réception confirmée par l'atelier + constat à réception
  → travail
  → photos finales
  → expédition retour
  → tracking
  → livraison au client
```

## 4. Décisions déjà prises

- **Le point relais est l'option privilégiée au lancement**, sous réserve
  qu'elle offre coût inférieur, dépôt simple, traçabilité et réseau national.
- **Aucune liste statique de points relais.** Les données viennent du
  fournisseur, à l'adresse ou au code postal du client.
- **Le QR code sans impression n'est jamais simulé.** Si le transporteur ne le
  supporte pas, on ne l'affiche pas.
- **Le coût de transport est séparé du prix du travail.** Modèle :
  `carrier_cost_cents`, `customer_shipping_price_cents`,
  `shipping_margin_cents`. Au lancement `shipping_margin_cents = 0`, sauf
  décision commerciale explicite. Le transport ne se finance pas sur la marge
  de reliure sans décision volontaire.
- **Les dimensions se déduisent de Métré** plutôt que d'être demandées au
  client. Le Playbook collecte déjà hauteur, largeur et épaisseur.
- **Aucune assurance n'est promise** que le fournisseur ne garantit pas.

## 5. Questions ouvertes

- **Point relais retour** : choisi au départ (A) ou au moment où le livre est
  prêt (B) ? Pour le MVP, retenir ce que le fournisseur rend le plus simple.
  Ne pas construire d'UX complexe sans nécessité.
- **Seuils de valeur déclarée** — `STANDARD` / `ELEVATED_VALUE` /
  `HIGH_VALUE` : non fixés. `HIGH_VALUE` déclenche une revue manuelle avant
  expédition. La valeur vient de `marketplace_cases.declared_value_band`, qui
  existe déjà.
- **Formats colis standards** — `SMALL_BOOK` / `STANDARD_BOOK` / `LARGE_BOOK` :
  dimensions à ne pas figer sans test réel.

## 6. Checklist de préparation (à afficher avant génération de l'envoi)

Protéger contre l'humidité · ne jamais coller d'adhésif directement sur le
livre · protéger les coins · envelopper l'ouvrage · empêcher tout mouvement
interne · carton suffisamment rigide · fermeture correcte.

Le « Kit Ma Reliure » est prévu plus tard. **Ne pas le construire maintenant.**

## 7. Constats d'état

Trois moments, trois enregistrements :

| Clé                      | Quand                                                    | Par qui   |
| ------------------------ | -------------------------------------------------------- | --------- |
| `client_before_shipping` | avant expédition aller                                   | le client |
| `binder_on_receipt`      | à réception, « conforme » ou « signaler une différence » | l'atelier |
| `binder_before_return`   | travail terminé                                          | l'atelier |

**Réutiliser les photos déjà présentes dans le Dossier Métré** plutôt que de
les dupliquer : des références suffisent. Le client peut en ajouter.

## 8. Abstraction

Aucun écran ne parle à Sendcloud ou Boxtal. Une interface `ShippingProvider` :

```
searchPickupPoints()   getRates()          createShipment()
getLabel()             getTracking()       cancelShipment()
createReturnShipment()
```

Adaptée aux capacités réelles du fournisseur retenu, pas à l'union des deux.

## 9. Modèle de données — `marketplace_shipments`

`direction` (`CLIENT_TO_BINDER` / `BINDER_TO_CUSTOMER`) · `delivery_method`
(`PICKUP_POINT` / `HOME`) · `pickup_point_id`, `pickup_point_name`,
`pickup_point_address` · `provider`, `carrier`, `service_code` ·
`external_shipment_id`, `tracking_number`, `tracking_url` · `label_url`,
`qr_code_data` · `status` · `carrier_cost_cents`,
`customer_shipping_price_cents` · poids, dimensions, valeur déclarée ·
`shipped_at`, `delivered_at`.

Les statuts transporteur sont **normalisés** dans le vocabulaire Ma Reliure,
jamais stockés bruts comme état de référence.

Le rattachement se fait à `marketplace_cases` : la notion de commande n'existe
pas encore.

## 10. Livrables exigés avant tout code

**A.** comparaison Sendcloud / Boxtal · **B.** recommandation · **C.** coûts
réels · **D.** limites · **E.** architecture · **F.** modèle de données ·
**G.** écrans · **H.** environnement · **I.** risques.

La comparaison doit trancher explicitement sur : recherche Points Relais,
Mondial Relay, Colissimo Pickup, Chronopost Pickup, création d'étiquette, QR
code sans impression, tracking, webhooks, retours, assurance, France, futur
international, coûts réels, API.

**La question à laquelle répondre : lequel permet le parcours le plus proche
de Vinted ?**

## 11. Critère de sortie

Une vraie expédition de test, de bout en bout : point relais réel → étiquette
réelle → dépôt → webhook reçu → tracking visible → réception atelier →
confirmation → étiquette retour → tracking → client.

**Ne jamais utiliser un livre important pour le premier test logistique.** Un
objet sans valeur, et rien d'autre.
