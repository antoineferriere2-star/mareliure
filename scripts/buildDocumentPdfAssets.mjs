#!/usr/bin/env node
/**
 * Régénère src/marketplace/quotes/documentPdfAssets.ts : quatre polices réduites
 * et le profil sRGB imposés par le PDF/A-3. À ne relancer que pour changer ces
 * ressources, le résultat est versionné.
 *
 *   npm i --no-save subset-font@2
 *   node scripts/buildDocumentPdfAssets.mjs <dossier liberation-fonts-ttf-2.1.5>
 *
 * Les Liberation ont les chasses de Times et d'Helvetica : la mise en page des
 * documents ne bouge pas. Leur licence (SIL OFL 1.1, nom réservé « Liberation »)
 * interdit ce nom sur une version réduite, d'où le renommage « MR Document ».
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import subsetFont from "subset-font";

const OUTPUT = "src/marketplace/quotes/documentPdfAssets.ts";
const FONTS = [
  { key: "serif", file: "LiberationSerif-Regular.ttf", family: "MR Document Serif", style: "Regular" },
  { key: "serifBold", file: "LiberationSerif-Bold.ttf", family: "MR Document Serif", style: "Bold" },
  { key: "sans", file: "LiberationSans-Regular.ttf", family: "MR Document Sans", style: "Regular" },
  { key: "sansBold", file: "LiberationSans-Bold.ttf", family: "MR Document Sans", style: "Bold" },
];
const COPYRIGHT = "Digitized data copyright (c) 2010 Google Corporation. Copyright (c) 2012 Red Hat, Inc. Modified subset. Licensed under the SIL Open Font License 1.1.";

// Latin de base, Latin-1, Latin étendu A et la ponctuation de Windows-1252.
const codePoints = [];
for (let code = 0x20; code <= 0x7e; code += 1) codePoints.push(code);
for (let code = 0xa0; code <= 0x17f; code += 1) codePoints.push(code);
codePoints.push(0x192, 0x2c6, 0x2dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122);
const text = String.fromCodePoint(...codePoints);

function nameTable(records) {
  const encoded = records.map(([id, value]) => ({ id, bytes: Buffer.from(value, "utf16le").swap16() }));
  const header = Buffer.alloc(6 + 12 * encoded.length);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(encoded.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  encoded.forEach(({ id, bytes }, index) => {
    const at = 6 + 12 * index;
    header.writeUInt16BE(3, at);
    header.writeUInt16BE(1, at + 2);
    header.writeUInt16BE(0x409, at + 4);
    header.writeUInt16BE(id, at + 6);
    header.writeUInt16BE(bytes.length, at + 8);
    header.writeUInt16BE(offset, at + 10);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...encoded.map(({ bytes }) => bytes)]);
}

const checksum = (buffer) => {
  let sum = 0;
  const padded = Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
  for (let at = 0; at < padded.length; at += 4) sum = (sum + padded.readUInt32BE(at)) >>> 0;
  return sum;
};

/** Remplace la table `name` et recalcule les sommes de contrôle du fichier TrueType. */
function withNameTable(font, name) {
  const count = font.readUInt16BE(4);
  const tables = [];
  for (let index = 0; index < count; index += 1) {
    const at = 12 + 16 * index;
    const tag = font.toString("latin1", at, at + 4);
    const offset = font.readUInt32BE(at + 8);
    const length = font.readUInt32BE(at + 12);
    tables.push({ tag, data: tag === "name" ? name : Buffer.from(font.subarray(offset, offset + length)) });
  }
  if (!tables.some((table) => table.tag === "name")) tables.push({ tag: "name", data: name });
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const head = tables.find((table) => table.tag === "head").data;
  head.writeUInt32BE(0, 8);

  const directory = Buffer.alloc(12 + 16 * tables.length);
  font.copy(directory, 0, 0, 4);
  const selector = Math.floor(Math.log2(tables.length));
  directory.writeUInt16BE(tables.length, 4);
  directory.writeUInt16BE(2 ** selector * 16, 6);
  directory.writeUInt16BE(selector, 8);
  directory.writeUInt16BE(tables.length * 16 - 2 ** selector * 16, 10);
  let offset = directory.length;
  const bodies = [];
  tables.forEach(({ tag, data }, index) => {
    const at = 12 + 16 * index;
    directory.write(tag, at, "latin1");
    directory.writeUInt32BE(checksum(data), at + 4);
    directory.writeUInt32BE(offset, at + 8);
    directory.writeUInt32BE(data.length, at + 12);
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    bodies.push(padded);
    offset += padded.length;
  });
  const assembled = Buffer.concat([directory, ...bodies]);
  const headOffset = directory.readUInt32BE(12 + 16 * tables.findIndex((table) => table.tag === "head") + 8);
  assembled.writeUInt32BE((0xb1b0afba - checksum(assembled)) >>> 0, headOffset + 8);
  return assembled;
}

const s15 = (value) => { const out = Buffer.alloc(4); out.writeInt32BE(Math.round(value * 65536)); return out; };
const xyz = (x, y, z) => Buffer.concat([Buffer.from("XYZ \0\0\0\0", "latin1"), s15(x), s15(y), s15(z)]);
function textTag(value) { return Buffer.concat([Buffer.from("text\0\0\0\0", "latin1"), Buffer.from(`${value}\0`, "latin1")]); }
function descTag(value) {
  const ascii = Buffer.from(`${value}\0`, "latin1");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(ascii.length);
  return Buffer.concat([Buffer.from("desc\0\0\0\0", "latin1"), length, ascii, Buffer.alloc(4 + 4 + 2 + 1 + 67)]);
}
function curveTag() {
  const steps = 1024;
  const curve = Buffer.alloc(12 + steps * 2);
  curve.write("curv", 0, "latin1");
  curve.writeUInt32BE(steps, 8);
  for (let index = 0; index < steps; index += 1) {
    const linear = index / (steps - 1);
    const value = linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    curve.writeUInt16BE(Math.round(value * 65535), 12 + index * 2);
  }
  return curve;
}

/** Profil sRGB ICC v2 écrit ici plutôt que copié, pour ne dépendre d'aucune licence. */
function srgbProfile() {
  const curve = curveTag();
  const entries = [
    ["desc", descTag("sRGB")],
    ["cprt", textTag("No copyright, use freely")],
    ["wtpt", xyz(0.9642, 1, 0.8249)],
    ["rXYZ", xyz(0.4360, 0.2225, 0.0139)],
    ["gXYZ", xyz(0.3851, 0.7169, 0.0971)],
    ["bXYZ", xyz(0.1431, 0.0606, 0.7139)],
    ["rTRC", curve],
    ["gTRC", curve],
    ["bTRC", curve],
  ];
  const table = Buffer.alloc(4 + entries.length * 12);
  table.writeUInt32BE(entries.length, 0);
  const bodies = [];
  const placed = new Map();
  let offset = 128 + table.length;
  entries.forEach(([tag, data], index) => {
    if (!placed.has(data)) {
      placed.set(data, offset);
      const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
      bodies.push(padded);
      offset += padded.length;
    }
    const at = 4 + index * 12;
    table.write(tag, at, "latin1");
    table.writeUInt32BE(placed.get(data), at + 4);
    table.writeUInt32BE(data.length, at + 8);
  });
  const header = Buffer.alloc(128);
  header.writeUInt32BE(offset, 0);
  header.writeUInt32BE(0x02100000, 8);
  header.write("mntrRGB XYZ ", 12, "latin1");
  [2026, 11, 1, 0, 0, 0].forEach((value, index) => header.writeUInt16BE(value, 24 + index * 2));
  header.write("acsp", 36, "latin1");
  s15(0.9642).copy(header, 68);
  s15(1).copy(header, 72);
  s15(0.8249).copy(header, 76);
  return Buffer.concat([header, table, ...bodies]);
}

const directory = process.argv[2];
if (!directory) throw new Error("Indiquer le dossier des polices Liberation.");

const assets = {};
for (const font of FONTS) {
  const source = readFileSync(join(directory, font.file));
  const subset = await subsetFont(source, text, { targetFormat: "truetype" });
  const full = `${font.family} ${font.style}`;
  assets[font.key] = withNameTable(Buffer.from(subset), nameTable([[0, COPYRIGHT], [1, font.family], [2, font.style], [4, full], [6, full.replaceAll(" ", "")]])).toString("base64");
}
assets.srgb = srgbProfile().toString("base64");

const lines = Object.entries(assets).map(([key, value]) => `export const ${key} = "${value}";`);
writeFileSync(OUTPUT, `// Fichier généré par scripts/buildDocumentPdfAssets.mjs, ne pas modifier à la main.\n// Polices dérivées de Liberation 2.1.5, SIL OFL 1.1 : docs/einvoicing/fonts-OFL.txt.\n${lines.join("\n")}\n`);
console.log(Object.entries(assets).map(([key, value]) => `${key} ${Math.round(value.length * 0.75 / 1024)} Ko`).join(", "));
