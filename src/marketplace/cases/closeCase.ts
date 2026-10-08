/** Statuts d'un dossier encore interne : aucun atelier sollicité, aucune proposition au client. */
export const CLOSABLE_CASE_STATUSES = ["under_review", "pricing", "matching"] as const;

export const isClosableCaseStatus = (status: string): boolean => (CLOSABLE_CASE_STATUSES as readonly string[]).includes(status);
