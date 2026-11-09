/**
 * Décline le favicon SVG de chaque marque marketplace en icônes raster.
 *
 *   node scripts/buildBrandIcons.mjs
 *
 * Source unique : `public/icons/<marque>/favicon.svg`, dessiné à la main sur
 * une grille de 32. Ce script n'invente rien, il ne fait que rendre :
 *
 * - `favicon.ico` (16, 32, 48) — les PNG sont rendus à leur taille exacte,
 *   pas réduits depuis un grand format, pour que les cotes paires du SVG
 *   tombent sur des pixels entiers ;
 * - `apple-touch-icon.png` (180) et `icon-192.png` / `icon-512.png` (manifeste) :
 *   fond plein bord à bord, sans coins arrondis — iOS et Android découpent
 *   eux-mêmes leur forme — et motif réduit pour rester dans la zone sûre
 *   d'une icône « maskable » (cercle de 80 % du côté).
 *
 * Rendu par le Chromium de Playwright, déjà présent pour les tests e2e : pas
 * de dépendance d'image supplémentaire. À relancer après toute retouche d'un
 * favicon.svg, et committer les fichiers produits.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRANDS = ["mareliure", "finebindery"];

/** Le premier `<rect>` 32×32 est le fond ; le reste est le motif. */
function splitSvg(svg) {
  const body = svg.replace(/<!--[\s\S]*?-->/g, "").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const background = body.match(/<rect width="32" height="32"[^>]*fill="(#[0-9a-fA-F]{3,6})"[^>]*\/>/);
  if (!background) throw new Error("favicon.svg : fond 32×32 introuvable (premier <rect>)");
  return { fill: background[1], motif: body.replace(background[0], "").trim() };
}

/** Fond bord à bord, motif centré à l'échelle donnée. */
function fullBleedSvg({ fill, motif }, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/><g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${motif}</g></svg>`;
}

/** ICO à entrées PNG (lu par tous les navigateurs depuis Windows Vista). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`);
  await page.locator("img").evaluate((img) => img.decode());
  return page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
}

try {
  for (const brand of BRANDS) {
    const dir = join(ROOT, "public", "icons", brand);
    const svg = readFileSync(join(dir, "favicon.svg"), "utf8");
    const parts = splitSvg(svg);

    const pngs = [];
    for (const size of [16, 32, 48]) pngs.push({ size, data: await render(svg, size) });
    writeFileSync(join(dir, "favicon.ico"), ico(pngs));

    writeFileSync(join(dir, "apple-touch-icon.png"), await render(fullBleedSvg(parts, 0.8), 180));
    const maskable = fullBleedSvg(parts, 0.72);
    writeFileSync(join(dir, "icon-192.png"), await render(maskable, 192));
    writeFileSync(join(dir, "icon-512.png"), await render(maskable, 512));
    console.log(`${brand} : favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png`);
  }
} finally {
  await browser.close();
}
