/**
 * Le catalogue de l'atelier face au référentiel : ajouter une opération à SES prestations, et mettre
 * une prestation en favori. Même patron que `binderQuotes.server.ts` : `binderId` vient de la session,
 * chaque écriture porte `binder_id`, un identifiant d'un autre atelier est « introuvable ».
 *
 * Ce que ce fichier ne fait JAMAIS :
 *  - proposer ou remplir un prix (il n'y en a aucun dans le référentiel : c'est l'atelier qui le saisit) ;
 *  - modifier le référentiel (c'est du code, en lecture seule) ;
 *  - modifier une prestation existante à partir du référentiel : ajouter, c'est CRÉER une prestation à soi.
 *    Après l'ajout, le libellé, l'unité, le prix, la description et la visibilité n'appartiennent qu'à l'atelier.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { findReferenceOperation, isImportable } from "@/marketplace/reference";
import type { FavoriteInput, ReferenceServiceInput } from "@/marketplace/reference/catalogInput";
import { assertOwnCategory, BinderQuotesError, serviceView, type ServiceView } from "./binderQuotes.server";

/**
 * Ajoute une opération du référentiel au catalogue de l'atelier. L'opération doit exister dans la version
 * indiquée ET être importable (active ; operation, package ou diagnostic) : une majoration, un choix de
 * matériau ou une opération inconnue est refusé, même si le navigateur l'envoie.
 */
export async function addReferenceService(sb: Supa, binderId: string, input: ReferenceServiceInput): Promise<ServiceView> {
  const found = await findReferenceOperation(input.referenceVersion, input.referenceOperationKey);
  if (!found || !isImportable(found.operation)) throw new BinderQuotesError("invalid_input");
  await assertOwnCategory(sb, binderId, input.categoryId);
  const { data, error } = await sb
    .from("marketplace_binder_services")
    .insert({
      binder_id: binderId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      vat_rate_bps: input.vatRateBps,
      is_active: true,
      is_favorite: input.isFavorite,
      // La version et la clé viennent de la ressource ; les deux ensemble (CHECK en base).
      reference_version: found.manifest.version,
      reference_operation_key: found.operation.key,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new BinderQuotesError("failed");
  return serviceView(data);
}

/** Met une prestation de l'atelier en favori, ou l'en retire. Rien d'autre ne change. */
export async function setServiceFavorite(sb: Supa, binderId: string, input: FavoriteInput): Promise<ServiceView> {
  const { data, error } = await sb
    .from("marketplace_binder_services")
    .update({ is_favorite: input.isFavorite })
    .eq("id", input.id)
    .eq("binder_id", binderId)
    .select("*")
    .maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
  return serviceView(data);
}
