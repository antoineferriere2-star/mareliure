/**
 * Which product a given deployment is.
 *
 * One codebase serves two public brands: Métré Build, the qualification engine
 * sold to contractors, and Ma Reliure, the marketplace built on it. They share
 * everything below the surface and differ only in what a visitor sees at the
 * root of the domain they arrived on.
 *
 * This is a *deployment* setting, not a runtime one. It is read at build time
 * from `VITE_PUBLIC_BRAND`, so each deployment ships the homepage it is meant
 * to serve — no request-time host sniffing, no redirect. A permanent redirect
 * from `/` to `/reliure` would have been simpler to write and wrong to live
 * with: it makes the canonical URL a path, splits the domain's authority
 * between two URLs, and costs every visitor a round trip on the one page that
 * has to load fastest.
 *
 * `metre` is the default, so an unset variable keeps Métré Build's own site
 * exactly as it was.
 */

export const PUBLIC_BRANDS = ["metre", "mareliure"] as const;
export type PublicBrand = (typeof PUBLIC_BRANDS)[number];

export const DEFAULT_PUBLIC_BRAND: PublicBrand = "metre";

function readBrand(): PublicBrand {
  // `import.meta.env` is replaced at build time by Vite, on both the client and
  // the server bundle, so this is a constant by the time it runs.
  const declared = import.meta.env.VITE_PUBLIC_BRAND;
  return (PUBLIC_BRANDS as readonly string[]).includes(declared as string)
    ? (declared as PublicBrand)
    : DEFAULT_PUBLIC_BRAND;
}

export const PUBLIC_BRAND: PublicBrand = readBrand();

export const isMaReliure = PUBLIC_BRAND === "mareliure";

/**
 * Total, and deliberately so: an unknown value falls back to Métré rather than
 * throwing. A typo in a deployment variable must not take the site down — it
 * must serve the default and be visible in the page, which is far easier to
 * notice than a 500.
 */
export function resolvePublicBrand(value: unknown): PublicBrand {
  return (PUBLIC_BRANDS as readonly string[]).includes(value as string)
    ? (value as PublicBrand)
    : DEFAULT_PUBLIC_BRAND;
}
