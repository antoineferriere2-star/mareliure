# Photos d'exemple par opération — note technique (24 septembre 2026)

Branche `feat/service-example-photos`.

## Ce que ça fait

Le relieur range ses propres réalisations par opération, dans
**Paramètres › Photos d'exemple**. Quand il ajoute cette opération à un devis,
ses photos sont proposées sur la ligne, déjà retenues ; il peut les retirer,
changer leur légende ou les exclure du PDF. Une photo déposée directement sur
une ligne peut aussi être gardée comme exemple (« Garder dans mes exemples »).

Une opération est l'une des deux sources du constructeur de devis :

| Source | Clé | Lignes concernées |
| --- | --- | --- |
| Prestation personnelle de l'atelier | `service_id` | `lineFromService` |
| Tarif de base Ma Reliure | `pricing_key` | `lineFromBasePrice` |

Une ligne libre n'a pas d'opération, donc pas de bibliothèque.

## Décisions

- **Copie, jamais référence.** `attachOperationPhotoToQuoteItem` copie le
  fichier dans le dossier du devis et crée une ligne
  `marketplace_binder_quote_item_photos` ordinaire. Retirer un exemple de la
  bibliothèque ne modifie aucun devis ; le PDF et la facture n'ont rien de
  nouveau à connaître.
- **Même bucket privé** (`marketplace-quote-operation-photos`), sous
  `<binder_id>/library/`. La contrainte `storage_path LIKE binder_id || '/library/%'`
  empêche une ligne de pointer vers le fichier d'un autre atelier ou d'un devis.
- **Même limite** que sur une ligne : 6 photos JPEG ou PNG de 8 Mo par opération.
- **Uniquement les photos de l'atelier.** L'écran le rappelle. Une image
  fournie par Ma Reliure relèverait de `docs/content-assets.md` (option 2, non
  retenue).
- `QuoteLine.pricingKey` est une aide d'interface : il n'est pas enregistré avec
  le devis. Conséquence : en rouvrant un brouillon, une ligne issue d'un tarif de
  base ne propose plus « Mes exemples » (une ligne de prestation, si).

## Mise en production (non faite dans la PR)

1. Appliquer `supabase/migrations/20260924160000_marketplace_binder_operation_photos.sql`.
   Elle ne crée qu'une table, deux index et sa politique RLS ; elle ne modifie
   aucune donnée et réutilise le bucket existant.
2. Régénérer `src/integrations/supabase/types.ts` depuis la production. Le bloc
   `marketplace_binder_operation_photos` y a été écrit à la main au format
   généré ; la régénération doit le reproduire à l'identique.
3. Déployer le Worker, puis vérifier dans l'espace atelier : ajouter une photo
   dans Paramètres, créer un devis avec cette opération, contrôler le PDF.

Avant l'étape 1, l'onglet affiche « Vos photos d'exemple n'ont pas pu être
chargées » et le constructeur de devis fonctionne comme aujourd'hui (la
bibliothèque y est facultative) : déployer le code avant la migration ne casse
pas les devis.

## Limites

- Supprimer une prestation (rare : elles sont archivées, pas supprimées)
  supprime ses exemples en base mais laisse leurs fichiers dans le bucket.
- L'écran « Photos d'exemple » est en français seulement, comme le reste de
  Paramètres › Devis & documents ; il n'est pas traduit pour FineBindery.
