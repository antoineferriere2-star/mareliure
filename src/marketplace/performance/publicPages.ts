const PAGES = new Set(["/", "/tarifs", "/reparation-de-livres", "/partenaires-relieurs", "/en"]);

export function isPublicPerformancePage(pathname: string): boolean {
  return PAGES.has(pathname);
}
