/**
 * Pays de facturation : code ISO 3166-1 alpha-2, seule forme stockée. Le statut France / Union européenne /
 * hors UE se déduit du code — il n'est jamais enregistré à part. Les libellés viennent d'`Intl.DisplayNames`.
 */
export const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

const OTHER_COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AU AW AX AZ BA BB BD BF BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX DJ DM DO DZ EC EG EH ER ET FJ FK FM FO GA GB GD GE " +
  "GF GG GH GI GL GM GN GP GQ GS GT GU GW GY HK HM HN HT ID IL IM IN IO IQ IR IS JE JM JO JP KE KG KH KI " +
  "KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MU MV MW " +
  "MX MY MZ NA NC NE NF NG NI NO NP NR NU NZ OM PA PE PF PG PH PK PM PN PR PS PW PY QA RE RS RU RW SA SB " +
  "SC SD SG SH SJ SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export const COUNTRY_CODES: readonly string[] = [...EU_COUNTRY_CODES, ...OTHER_COUNTRY_CODES].sort();

export const DEFAULT_COUNTRY = "FR";

export type CountryZone = "france" | "eu" | "outside_eu";

export function isCountryCode(value: string | null | undefined): boolean {
  return Boolean(value) && COUNTRY_CODES.includes(value!.toUpperCase());
}

export function countryZone(code: string | null | undefined): CountryZone {
  const value = (code || DEFAULT_COUNTRY).toUpperCase();
  if (value === "FR") return "france";
  return (EU_COUNTRY_CODES as readonly string[]).includes(value) ? "eu" : "outside_eu";
}

/** Anciennes saisies libres (« France », « fr ») ramenées au code ; toute autre valeur est rendue telle quelle. */
export function normalizeCountry(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(france|fr|fra)$/i.test(trimmed)) return "FR";
  return isCountryCode(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function countryName(code: string, locale = "fr"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** France d'abord, puis le reste par ordre alphabétique du libellé. */
export function countryOptions(locale = "fr"): Array<{ code: string; name: string }> {
  const options = COUNTRY_CODES.filter((code) => code !== "FR")
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [{ code: "FR", name: countryName("FR", locale) }, ...options];
}
