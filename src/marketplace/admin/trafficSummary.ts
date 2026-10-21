/**
 * Fréquentation des sites publics, pour le pilotage : calcul pur sur les lignes `build_page_views`.
 *
 * Ce que la mesure permet de dire, et pas plus :
 * - une vue = une page affichée ; une visite = une session navigateur (`session_hash`) ;
 * - un visiteur = une empreinte salée **par jour** (`visitor_hash`, aucun cookie, aucune IP en clair) :
 *   sur plusieurs jours, la même personne compte une fois par jour où elle vient ;
 * - les robots et outils automatisés ne sont plus enregistrés depuis le 21 octobre 2026 (#160) ; les
 *   lignes antérieures en contiennent.
 * La marque se déduit de l'adresse (`publicPageOwner`) ; les pages communes (connexion, espace client)
 * et les écrans internes ne sont pas comptés.
 */
import { BOOKBINDING_PUBLIC_TOKEN, FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { publicPageOwner } from "@/marketplace/brand/brandPages";

export interface PageViewRow {
  path: string;
  referrer_host: string | null;
  device: string | null;
  visitor_hash: string | null;
  session_hash: string | null;
  is_new_session: boolean | null;
  created_at: string;
}

export interface TrafficSummary {
  views: number;
  visits: number;
  visitors: number;
  /** Visites qui ont ouvert « Présenter mon livre / your project ». */
  intakeVisits: number;
  topPages: { path: string; views: number; visits: number }[];
  sources: { source: string; visits: number }[];
  devices: { device: string; views: number }[];
  perDay: { day: string; views: number; visits: number }[];
}

const OWN_HOSTS = /(^|\.)(mareliure\.fr|finebindery\.com|workers\.dev)$|^(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Marque d'une page vue, ou `null` pour une page commune ou interne (non comptée). */
export function viewBrand(rawPath: string): MarketplaceBrand | null {
  const path = rawPath.split(/[?#]/)[0] || "/";
  if (path === `/m/${BOOKBINDING_PUBLIC_TOKEN}`) return "MA_RELIURE";
  if (path === `/m/${FINE_BINDERY_PUBLIC_TOKEN}`) return "FINE_BINDERY";
  // La racine n'est servie que par Ma Reliure : finebindery.com/ redirige vers /en avant tout affichage.
  if (path === "/") return "MA_RELIURE";
  const owner = publicPageOwner(path);
  return owner === "MA_RELIURE" ? "MA_RELIURE" : owner === "FINE_BINDERY" ? "FINE_BINDERY" : null;
}

const isIntake = (path: string) => /^\/m\/[^/]+$/.test(path) || /^\/(en|fr|de|it|es)\/project$/.test(path);

export function buildTrafficSummary(rows: PageViewRow[], options: { brand: MarketplaceBrand | "ALL"; since: string | null; days: number | null; now: string }): TrafficSummary {
  const sinceMs = options.since ? Date.parse(options.since) : null;
  const views = rows.filter((row) => {
    const brand = viewBrand(row.path);
    if (!brand || (options.brand !== "ALL" && brand !== options.brand)) return false;
    const at = Date.parse(row.created_at);
    return Number.isFinite(at) && (sinceMs === null || at >= sinceMs);
  });
  const distinct = (values: (string | null)[]) => new Set(values.filter(Boolean)).size;
  const sessionOf = (row: PageViewRow) => row.session_hash ?? `${row.visitor_hash}:${row.created_at}`;

  const byPath = new Map<string, PageViewRow[]>();
  for (const row of views) {
    const path = row.path.split(/[?#]/)[0] || "/";
    byPath.set(path, [...(byPath.get(path) ?? []), row]);
  }
  const topPages = [...byPath]
    .map(([path, list]) => ({ path, views: list.length, visits: new Set(list.map(sessionOf)).size }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, 10);

  // Source d'une visite : le site d'où elle arrive (première vue de la session), sinon accès direct.
  const firstBySession = new Map<string, PageViewRow>();
  for (const row of [...views].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!firstBySession.has(sessionOf(row))) firstBySession.set(sessionOf(row), row);
  }
  const sourceCounts = new Map<string, number>();
  for (const row of firstBySession.values()) {
    const host = row.referrer_host?.toLowerCase().replace(/^www\./, "") ?? "";
    const source = !host || OWN_HOSTS.test(host) ? "Accès direct ou interne" : host;
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sources = [...sourceCounts].map(([source, visits]) => ({ source, visits })).sort((a, b) => b.visits - a.visits).slice(0, 8);

  const deviceCounts = new Map<string, number>();
  for (const row of views) deviceCounts.set(row.device ?? "inconnu", (deviceCounts.get(row.device ?? "inconnu") ?? 0) + 1);
  const devices = [...deviceCounts].map(([device, count]) => ({ device, views: count })).sort((a, b) => b.views - a.views);

  // Par jour, sur la période choisie (jusqu'à 90 jours) : jours sans vue compris, pour lire les creux.
  const perDay: TrafficSummary["perDay"] = [];
  if (options.days !== null) {
    const end = new Date(options.now);
    for (let offset = options.days - 1; offset >= 0; offset -= 1) {
      const day = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - offset)).toISOString().slice(0, 10);
      const list = views.filter((row) => row.created_at.slice(0, 10) === day);
      perDay.push({ day, views: list.length, visits: new Set(list.map(sessionOf)).size });
    }
  }

  return {
    views: views.length,
    visits: new Set(views.map(sessionOf)).size,
    visitors: distinct(views.map((row) => row.visitor_hash)),
    intakeVisits: new Set(views.filter((row) => isIntake(row.path.split(/[?#]/)[0])).map(sessionOf)).size,
    topPages,
    sources,
    devices,
    perDay,
  };
}
