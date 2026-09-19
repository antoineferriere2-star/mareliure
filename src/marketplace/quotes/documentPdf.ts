/**
 * Le PDF d'un devis ou d'une facture de relieur — généré côté serveur avec
 * `pdf-lib` (JavaScript pur : aucun DOM, aucun navigateur, il tourne sur
 * Cloudflare Workers).
 *
 * Il ne calcule aucun montant : il imprime exactement ce que le document a
 * enregistré (`DocumentView`). Une seule mise en page pour le devis et la
 * facture ; seuls le titre, la validité, le lien « facture issue du devis » et le
 * bloc d'accord changent.
 *
 * Polices standard (Helvetica) : aucun fichier de police à embarquer. Elles
 * n'encodent que WinAnsi ; le texte est donc assaini (`toPrintable`) — les espaces
 * insécables de la typographie française et tout caractère hors jeu deviennent
 * un espace ou un « ? » au lieu de faire échouer la génération.
 *
 * Ce n'est PAS une facture électronique réglementaire (Factur-X, plateforme
 * agréée) : c'est un document imprimable ; voir docs/CODEX_HANDOFF.md.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDimensions } from "./quoteLines";
import type { DocumentView } from "./quoteViews";

export interface RenderedPdf {
  base64: string;
  pageCount: number;
  /** Tout le texte imprimé, dans l'ordre — la source des tests de contenu. */
  printed: string[];
}

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/** « 1 234,56 € » avec des espaces ordinaires (les insécables ne sont pas imprimables en WinAnsi). */
export function formatMoneyPdf(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${euros},${String(abs % 100).padStart(2, "0")} €`;
}

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const rateLabel = (bps: number) => `${(bps / 100).toString().replace(".", ",")} %`;
const quantityLabel = (q: number) => String(q).replace(".", ",");

/** Texte imprimable en WinAnsi. */
export function toPrintable(text: string, allowed: ReadonlySet<number>): string {
  let out = "";
  for (const char of text.replace(/[\u00A0\u202F\u2009\u2007]/g, " ").replace(/[\r\t]/g, " ")) {
    const code = char.codePointAt(0)!;
    out += code === 10 || allowed.has(code) ? char : "?";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const INK = rgb(0.14, 0.1, 0.07);
const MUTED = rgb(0.42, 0.36, 0.3);
const RULE = rgb(0.8, 0.76, 0.7);

export async function renderDocumentPdf(doc: DocumentView): Promise<RenderedPdf> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const allowed = new Set<number>(regular.getCharacterSet());
  const printed: string[] = [];
  const isQuote = doc.kind === "quote";

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const clean = (t: string) => toPrintable(t, allowed);
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  };
  const ensure = (height: number) => {
    if (y - height < M + 30) newPage();
  };
  const width = (font: PDFFont, size: number, t: string) => font.widthOfTextAtSize(t, size);

  const draw = (t: string, x: number, size: number, font: PDFFont = regular, color = INK) => {
    const text = clean(t);
    if (!text) return;
    printed.push(text);
    page.drawText(text, { x, y, size, font, color });
  };
  const drawRight = (t: string, xRight: number, size: number, font: PDFFont = regular, color = INK) => {
    const text = clean(t);
    if (!text) return;
    draw(text, xRight - width(font, size, text), size, font, color);
  };
  const wrap = (t: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of clean(t).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (width(font, size, candidate) <= maxWidth || !current) current = candidate;
        else {
          lines.push(current);
          current = word;
        }
      }
      lines.push(current);
    }
    return lines;
  };
  /** Un paragraphe qui peut passer sur plusieurs pages. */
  const paragraph = (t: string, x: number, size: number, maxWidth: number, font: PDFFont = regular, color = INK) => {
    const lead = size + 3;
    for (const line of wrap(t, font, size, maxWidth)) {
      ensure(lead);
      draw(line, x, size, font, color);
      y -= lead;
    }
  };
  const rule = (color = RULE) => {
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.6, color });
  };

  // --- En-tête : l'émetteur à gauche, le document à droite ------------------
  const issuer = doc.issuer;
  const headerTop = y;
  const nameLine = issuer.workshopName || issuer.legalName || "";
  draw(nameLine, M, 15, bold);
  y -= 18;
  const issuerLines = [
    issuer.legalName && issuer.legalName !== nameLine ? issuer.legalName : null,
    issuer.addressLine1,
    issuer.addressLine2,
    [issuer.postalCode, issuer.city].filter(Boolean).join(" ") || null,
    issuer.siret ? `SIRET ${issuer.siret}` : null,
    issuer.vatNumber ? `TVA ${issuer.vatNumber}` : null,
    issuer.email,
    issuer.phone,
  ].filter((l): l is string => Boolean(l));
  for (const line of issuerLines) {
    draw(line, M, 9, regular, MUTED);
    y -= 12;
  }
  const leftBottom = y;

  y = headerTop;
  drawRight(isQuote ? "DEVIS" : "FACTURE", PAGE_W - M, 20, bold);
  y -= 20;
  drawRight(`N° ${doc.number}`, PAGE_W - M, 11, bold);
  y -= 15;
  drawRight(`Date : ${formatDateFr(doc.issueDate)}`, PAGE_W - M, 9.5);
  y -= 13;
  if (isQuote && doc.validUntil) {
    drawRight(`Valable jusqu'au ${formatDateFr(doc.validUntil)}`, PAGE_W - M, 9.5);
    y -= 13;
  }
  if (!isQuote && doc.linkedQuoteNumber) {
    drawRight(`Facture issue du devis ${doc.linkedQuoteNumber}`, PAGE_W - M, 9.5, regular, MUTED);
    y -= 13;
  }
  y = Math.min(y, leftBottom) - 16;
  rule();
  y -= 20;

  // --- Client et ouvrage ------------------------------------------------------
  const colW = (PAGE_W - 2 * M - 24) / 2;
  const blockTop = y;
  draw("CLIENT", M, 8, bold, MUTED);
  y -= 13;
  draw(doc.client.name, M, 11, bold);
  y -= 14;
  for (const line of [
    doc.client.addressLine1,
    [doc.client.postalCode, doc.client.city].filter(Boolean).join(" ") || null,
    doc.client.country,
    doc.client.email,
    doc.client.phone,
  ].filter((l): l is string => Boolean(l))) {
    draw(line, M, 9.5);
    y -= 12;
  }
  const clientBottom = y;

  y = blockTop;
  const x2 = M + colW + 24;
  draw("OUVRAGE", x2, 8, bold, MUTED);
  y -= 13;
  draw(doc.book.title || "—", x2, 11, bold);
  y -= 14;
  if (doc.book.author) {
    draw(doc.book.author, x2, 9.5);
    y -= 12;
  }
  const dims = formatDimensions({
    heightMm: doc.book.heightMm,
    widthMm: doc.book.widthMm,
    spineMm: doc.book.spineMm,
  });
  if (dims) {
    draw(dims, x2, 9.5);
    y -= 12;
  }
  if (doc.book.notes) {
    for (const line of wrap(doc.book.notes, regular, 9, colW).slice(0, 4)) {
      draw(line, x2, 9, regular, MUTED);
      y -= 11;
    }
  }
  y = Math.min(y, clientBottom) - 14;

  // --- Lignes -------------------------------------------------------------------
  const colQty = M + 285;
  const colUnit = M + 355;
  const colVat = M + 415;
  const right = PAGE_W - M;
  const labelW = colQty - M - 20;
  const showVat = doc.vatRegime === "VAT_LIABLE";

  const tableHead = () => {
    ensure(24);
    draw("Désignation", M, 8.5, bold, MUTED);
    drawRight("Qté", colQty + 30, 8.5, bold, MUTED);
    drawRight("Prix HT", colUnit + 45, 8.5, bold, MUTED);
    if (showVat) drawRight("TVA", colVat + 30, 8.5, bold, MUTED);
    drawRight("Total HT", right, 8.5, bold, MUTED);
    y -= 6;
    rule();
    y -= 14;
  };
  tableHead();
  for (const item of doc.items) {
    const labelLines = wrap(item.label, bold, 10, labelW);
    const descLines = item.description ? wrap(item.description, regular, 8.5, labelW) : [];
    const rowH = labelLines.length * 12 + descLines.length * 10.5 + 8;
    if (y - rowH < M + 30) {
      newPage();
      tableHead();
    }
    const rowTop = y;
    for (const line of labelLines) {
      draw(line, M, 10, bold);
      y -= 12;
    }
    for (const line of descLines) {
      draw(line, M, 8.5, regular, MUTED);
      y -= 10.5;
    }
    const rowBottom = y;
    y = rowTop;
    drawRight(`${quantityLabel(item.quantity)}${item.unit ? ` ${item.unit}` : ""}`, colQty + 30, 9.5);
    drawRight(formatMoneyPdf(item.unitPriceCents), colUnit + 45, 9.5);
    if (showVat) drawRight(rateLabel(item.vatRateBps), colVat + 30, 9.5);
    drawRight(formatMoneyPdf(item.totalHtCents), right, 9.5);
    y = rowBottom - 6;
  }
  rule();
  y -= 18;

  // --- Totaux -----------------------------------------------------------------------
  const totalsX = PAGE_W - M - 210;
  const totalRow = (label: string, value: string, strong = false) => {
    ensure(18);
    draw(label, totalsX, strong ? 11 : 9.5, strong ? bold : regular);
    drawRight(value, right, strong ? 11 : 9.5, strong ? bold : regular);
    y -= strong ? 18 : 14;
  };
  if (doc.discountCents > 0) {
    totalRow("Sous-total HT", formatMoneyPdf(doc.subtotalCents));
    const label = doc.discountType === "PERCENT" ? `Remise (${rateLabel(doc.discountValue)})` : "Remise";
    totalRow(label, `- ${formatMoneyPdf(doc.discountCents)}`);
  }
  totalRow("Total HT", formatMoneyPdf(doc.totalHtCents));
  if (showVat) {
    for (const group of doc.vatBreakdown) {
      if (group.baseHtCents === 0 && group.vatCents === 0) continue;
      totalRow(`TVA ${rateLabel(group.vatRateBps)}`, formatMoneyPdf(group.vatCents));
    }
  }
  totalRow(showVat ? "Total TTC" : "Total à payer", formatMoneyPdf(doc.totalTtcCents), true);
  if (doc.depositCents > 0) {
    y -= 2;
    const label =
      doc.depositType === "PERCENT" ? `Acompte demandé (${rateLabel(doc.depositValue)})` : "Acompte demandé";
    totalRow(label, formatMoneyPdf(doc.depositCents));
    totalRow("Solde restant", formatMoneyPdf(doc.balanceCents));
  }
  y -= 8;

  // --- Mentions ------------------------------------------------------------------------
  const textW = PAGE_W - 2 * M;
  if (doc.vatMention) paragraph(doc.vatMention, M, 9, textW, regular, INK);
  if (doc.paymentTerms) {
    y -= 4;
    draw("Conditions de paiement", M, 8.5, bold, MUTED);
    y -= 12;
    paragraph(doc.paymentTerms, M, 9, textW);
  }
  if (doc.notes) {
    y -= 4;
    draw(isQuote ? "Conditions" : "Mentions", M, 8.5, bold, MUTED);
    y -= 12;
    paragraph(doc.notes, M, 9, textW);
  }
  if (isQuote) {
    y -= 10;
    ensure(60);
    draw("Bon pour accord — date et signature du client :", M, 9, regular, MUTED);
    y -= 44;
    page.drawRectangle({ x: M, y, width: 220, height: 40, borderColor: RULE, borderWidth: 0.6 });
    y -= 12;
  }
  if (issuer.legalNotes) {
    y -= 8;
    paragraph(issuer.legalNotes, M, 8, textW, regular, MUTED);
  }

  // --- Pied de page sur chaque page --------------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    const footer = clean(`${nameLine} — ${doc.number} — page ${index + 1}/${pages.length}`);
    printed.push(footer);
    p.drawText(footer, { x: M, y: 24, size: 8, font: regular, color: MUTED });
  });

  return { base64: await pdf.saveAsBase64(), pageCount: pages.length, printed };
}
