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

## Mise en production — réalisée le 24 septembre 2026

- La migration
  `supabase/migrations/20260924160000_marketplace_binder_operation_photos.sql`
  a été appliquée sur la production `hljxohondjvrkzqicexl`. Le contrôle à blanc
  ne listait qu'elle ; l'historique local/distant a ensuite été aligné jusqu'à
  `20260924160000`.
- La migration a ajouté uniquement la table
  `marketplace_binder_operation_photos`, deux index et sa politique RLS sans
  accès direct. Aucune donnée existante n'a été modifiée et le bucket privé
  `marketplace-quote-operation-photos` est réutilisé sous
  `<binder_id>/library/`.
- `src/integrations/supabase/types.ts` a été régénéré depuis la production. Son
  seul ajout est la nouvelle table, identique au bloc préparé dans la PR.
- La PR #34 a été fusionnée par merge commit
  `5bfd2dd96ab0b4dbac8fd0b6bed12612af7c8fad`, puis le Worker `mareliure` a été
  publié dans la version `d3a59185-6a22-4ec9-99e1-d5a23d7006a3`. La première
  commande de publication a échoué sur `fetch failed` après l'envoi des assets,
  sans activer de version ; `npx wrangler deploy --name mareliure` a publié le
  même build avec succès.
- Contrôle production : les nouvelles fonctions serveur et leurs dépendances
  répondent `Unauthorized` sans session et aucune ne répond 500. `/`,
  `/atelier`, `/atelier/tarifs` et `/atelier/devis/nouveau` répondent 200.
  L'accès REST anonyme à la nouvelle table retourne une liste vide en lecture
  et 401 en écriture, conformément à la RLS.

## Limites

- Supprimer une prestation (rare : elles sont archivées, pas supprimées)
  supprime ses exemples en base mais laisse leurs fichiers dans le bucket.
- L'écran « Photos d'exemple » est en français seulement, comme le reste de
  Paramètres › Devis & documents ; il n'est pas traduit pour FineBindery.
