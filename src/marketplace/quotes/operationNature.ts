/**
 * Nature d'une prestation : service (par défaut) ou bien livré. Elle est portée par chaque prestation du
 * catalogue et recopiée sur chaque ligne ; la nature de la facture s'en déduit (mixte si les deux).
 *
 * Seules les fournitures façonnées remises au client comme objets — étui, boîte, coffret, chemise — sont
 * proposées comme biens. Tout le reste (reliure, restauration, dorure…) est une prestation de service.
 */
export type LineNature = "service" | "bien";
export type InvoiceNature = "services" | "goods" | "mixed";

export const LINE_NATURES: readonly LineNature[] = ["service", "bien"];

// `\b` ignore les lettres accentuées : les bornes de mot sont posées à la main.
const GOODS_WORDS = /(^|[^\p{L}])(étuis?|etuis?|boîtes?|boites?|coffrets?|chemises?)(?![\p{L}])/iu;

/** Nature proposée pour une prestation nouvellement créée, d'après son nom ; toujours modifiable. */
export function defaultNatureForName(name: string): LineNature {
  return GOODS_WORDS.test(name) ? "bien" : "service";
}

export function invoiceNatureOf(natures: readonly (LineNature | null | undefined)[]): InvoiceNature {
  const goods = natures.some((nature) => nature === "bien");
  const services = natures.some((nature) => nature !== "bien");
  if (goods && services) return "mixed";
  return goods ? "goods" : "services";
}
