/**
 * Identifiants d'entreprise français : SIREN (9 chiffres) et SIRET (14 chiffres), contrôlés par la clé de
 * Luhn — avec la règle propre aux établissements de La Poste (SIREN 356000000), dont la somme des chiffres
 * du SIRET doit être un multiple de 5. Mêmes règles que `marketplace_siren_valid` / `marketplace_siret_valid`
 * en base (migration 20261023100000) : le formulaire prévient, la base décide.
 */
const digitsOnly = (value: string) => value.replace(/[\s.\u00a0\u202f-]/g, "");

export function luhnValid(digits: string): boolean {
  if (!/^[0-9]+$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return total % 10 === 0;
}

/** SIREN tel que saisi (espaces et points tolérés) ramené à ses chiffres. */
export function normalizeSiren(value: string): string {
  return digitsOnly(value.trim());
}

export function isValidSiren(value: string | null | undefined): boolean {
  const digits = normalizeSiren(value ?? "");
  return /^[0-9]{9}$/.test(digits) && luhnValid(digits);
}

export function isValidSiret(value: string | null | undefined): boolean {
  const digits = normalizeSiren(value ?? "");
  if (!/^[0-9]{14}$/.test(digits)) return false;
  if (digits.startsWith("356000000") && digits !== "35600000000048") {
    return [...digits].reduce((sum, d) => sum + Number(d), 0) % 5 === 0;
  }
  return luhnValid(digits);
}
