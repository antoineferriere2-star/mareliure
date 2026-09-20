/**
 * Le nom d'affichage d'un contact — celui qu'on lit dans une liste, et celui qu'un devis
 * recopie dans son bloc « client ».
 *
 * `marketplace_binder_clients.name` reste obligatoire (les devis et les factures en
 * prennent un snapshot) : il est DÉDUIT du prénom, du nom et de l'entreprise, jamais saisi
 * en double. Pour une personne : « Claire Martin » ; pour une institution : son nom ;
 * pour une personne rattachée à une institution : « Claire Martin — Bibliothèque municipale »,
 * parce que c'est ce que le devis doit dire.
 */
export interface ContactNameParts {
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
}

export function contactDisplayName(parts: ContactNameParts): string {
  const person = [parts.firstName, parts.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  const organization = parts.organization?.trim() ?? "";
  if (person && organization) return `${person} — ${organization}`;
  return person || organization;
}

/** Une adresse e-mail plausible — pas une preuve : la vérification est celle du destinataire. */
export const LOOSE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
