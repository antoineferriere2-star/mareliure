import { PRICEABLE_SERVICE_MAPPINGS } from "@/marketplace/pricing/basePrices";
import { normalizeSearch } from "@/marketplace/reference/search";

export interface BaseService {
  pricingKey: string;
  label: string;
  unit: string;
  unitPriceCents: number | null;
  pricingMode: string;
}

export interface WorkshopService {
  id: string;
  name: string;
  referenceOperationKey: string | null;
  isActive: boolean;
  unitPriceCents: number;
}

/** Une prestation d'atelier liée ou nommée comme la prestation commerciale prime sur sa base. */
export function resolvePricePalette<T extends WorkshopService>(
  workshop: readonly T[],
  base: readonly BaseService[],
): { workshop: T[]; base: BaseService[] } {
  const active = workshop.filter((service) => service.isActive);
  const covered = new Set<string>();
  for (const price of base) {
    const mapping = PRICEABLE_SERVICE_MAPPINGS.find((item) => item.pricingKey === price.pricingKey);
    const exactReference = mapping?.mappingType === "exact" ? mapping.referenceOperationKeys[0] : null;
    if (active.some((service) =>
      normalizeSearch(service.name) === normalizeSearch(price.label)
      || (exactReference && service.referenceOperationKey === exactReference)
    )) covered.add(price.pricingKey);
  }
  return { workshop: active, base: base.filter((price) => !covered.has(price.pricingKey)) };
}

/** Les identifiants sont déjà limités à l'atelier par la requête serveur. */
export function recentServices<T extends { id: string }>(services: readonly T[], usedIds: readonly string[], limit = 8): T[] {
  const byId = new Map(services.map((service) => [service.id, service]));
  return [...new Set(usedIds)].flatMap((id) => byId.get(id) ?? []).slice(0, limit);
}
