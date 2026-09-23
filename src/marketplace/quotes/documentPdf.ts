/**
 * Moteur PDF commun aux devis et factures. Il imprime uniquement le snapshot
 * du document : identité, lignes et montants ne sont jamais recalculés ici.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { formatDimensions } from "./quoteLines";
import type { DocumentItemView, DocumentView } from "./quoteViews";

export interface RenderedPdf { base64: string; pageCount: number; printed: string[] }

export function formatMoneyPdf(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${euros},${String(abs % 100).padStart(2, "0")} €`;
}

export function formatDateFr(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const rateLabel = (bps: number) => `${(bps / 100).toString().replace(".", ",")} %`;
const quantityLabel = (quantity: number) => String(quantity).replace(".", ",");

export function toPrintable(text: string, allowed: ReadonlySet<number>): string {
  let result = "";
  for (const character of text.replace(/[\u00A0\u202F\u2009\u2007]/g, " ").replace(/[\r\t]/g, " ")) {
    const code = character.codePointAt(0)!;
    result += code === 10 || allowed.has(code) ? character : "?";
  }
  return result;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const INK = rgb(0.13, 0.1, 0.08);
const MUTED = rgb(0.39, 0.35, 0.31);
const RULE = rgb(0.78, 0.74, 0.68);
const IVORY = rgb(0.975, 0.958, 0.925);
const PALE = rgb(0.94, 0.92, 0.88);

function colorFromHex(value: string | null | undefined): RGB {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? "");
  if (!match) return rgb(0.478, 0.133, 0.188);
  const number = Number.parseInt(match[1], 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

async function fetchImage(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mime = response.headers.get("content-type") ?? "";
    if (mime.includes("png") || url.toLowerCase().includes(".png")) return pdf.embedPng(bytes);
    return pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function renderDocumentPdf(document: DocumentView): Promise<RenderedPdf> {
  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const allowed = new Set<number>(sans.getCharacterSet());
  const accent = colorFromHex(document.issuer.documentAccentColor);
  const printed: string[] = [];
  const isQuote = document.kind === "quote";
  const logo = await fetchImage(pdf, document.issuer.logoUrl);
  const imageCache = new Map<string, PDFImage | null>();
  let page: PDFPage;
  let y = 0;

  const clean = (text: string) => toPrintable(text, allowed);
  const measure = (font: PDFFont, size: number, text: string) => font.widthOfTextAtSize(clean(text), size);
  const draw = (text: string, x: number, size: number, font: PDFFont = sans, color: RGB = INK) => {
    const value = clean(text);
    if (!value) return;
    printed.push(value);
    page.drawText(value, { x, y, size, font, color });
  };
  const drawRight = (text: string, right: number, size: number, font: PDFFont = sans, color: RGB = INK) => {
    const value = clean(text);
    draw(value, right - measure(font, size, value), size, font, color);
  };
  const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    for (const source of clean(text).split("\n")) {
      let current = "";
      for (const word of source.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && measure(font, size, candidate) > maxWidth) { lines.push(current); current = word; }
        else current = candidate;
        while (measure(font, size, current) > maxWidth && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && measure(font, size, current.slice(0, cut)) > maxWidth) cut -= 1;
          lines.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  };
  const horizontalRule = (fromX = MARGIN, toX = PAGE_W - MARGIN, color: RGB = RULE, thickness = 0.55) => {
    page.drawLine({ start: { x: fromX, y }, end: { x: toX, y }, color, thickness });
  };
  const drawContinuationHeader = () => {
    page.drawRectangle({ x: 0, y: PAGE_H - 54, width: PAGE_W, height: 54, color: IVORY });
    page.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: accent });
    y = PAGE_H - 36;
    draw(document.issuer.workshopName || document.issuer.legalName || "Atelier", MARGIN, 10, serifBold);
    drawRight(`${isQuote ? "DEVIS" : "FACTURE"} ${document.number}`, PAGE_W - MARGIN, 8.5, sansBold, accent);
    y = PAGE_H - 76;
  };
  const newPage = (continuation = true) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    if (continuation) drawContinuationHeader();
  };
  function pageBreakIfNeeded(height: number) { if (y - height < 58) newPage(); }
  const paragraph = (text: string, x: number, size: number, maxWidth: number, font: PDFFont = sans, color: RGB = INK) => {
    const leading = size + 3;
    for (const line of wrap(text, font, size, maxWidth)) {
      pageBreakIfNeeded(leading);
      draw(line, x, size, font, color);
      y -= leading;
    }
  };
  const drawImage = async (url: string, maxWidth: number, maxHeight: number, x: number) => {
    let embedded = imageCache.get(url);
    if (embedded === undefined) { embedded = await fetchImage(pdf, url); imageCache.set(url, embedded); }
    if (!embedded) return 0;
    const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    pageBreakIfNeeded(height + 12);
    page.drawImage(embedded, { x, y: y - height, width, height });
    y -= height;
    return width;
  };

  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: PAGE_H - 190, width: PAGE_W, height: 190, color: IVORY });
    page.drawRectangle({ x: 0, y: PAGE_H - 5, width: PAGE_W, height: 5, color: accent });
    const issuer = document.issuer;
    const name = issuer.workshopName || issuer.legalName || "Atelier";
    let leftX = MARGIN;
    if (logo) {
      const scale = Math.min(74 / logo.width, 58 / logo.height, 1);
      const width = logo.width * scale;
      const height = logo.height * scale;
      page.drawImage(logo, { x: MARGIN, y: PAGE_H - 48 - height, width, height });
      leftX += width + 18;
    }
    y = PAGE_H - 55;
    draw(name, leftX, 18, serifBold);
    y -= 19;
    if (issuer.binderName) { draw(issuer.binderName, leftX, 9, sans, accent); y -= 13; }
    const identity = [issuer.legalName && issuer.legalName !== name ? issuer.legalName : null, issuer.legalForm, issuer.shareCapital ? `Capital ${issuer.shareCapital}` : null, issuer.addressLine1, issuer.addressLine2, [issuer.postalCode, issuer.city].filter(Boolean).join(" ") || null, issuer.siren ? `SIREN ${issuer.siren}` : null, issuer.siret ? `SIRET ${issuer.siret}` : null, issuer.vatNumber ? `TVA ${issuer.vatNumber}` : null, issuer.phone, issuer.email, issuer.website].filter((value): value is string => Boolean(value));
    for (const line of identity.slice(0, 9)) { draw(line, leftX, 8.2, sans, MUTED); y -= 11; }
    y = PAGE_H - 54;
    drawRight(isQuote ? "DEVIS" : "FACTURE", PAGE_W - MARGIN, 25, serif, accent);
    y -= 28;
    drawRight(`N° ${document.number}`, PAGE_W - MARGIN, 10.5, sansBold);
    y -= 18;
    drawRight(`Date : ${formatDateFr(document.issueDate)}`, PAGE_W - MARGIN, 9);
    y -= 14;
    if (isQuote && document.validUntil) { drawRight(`Valable jusqu'au ${formatDateFr(document.validUntil)}`, PAGE_W - MARGIN, 9); y -= 14; }
    if (!isQuote && document.invoiceCompliance?.serviceDate) { drawRight(`Prestation : ${formatDateFr(document.invoiceCompliance.serviceDate)}`, PAGE_W - MARGIN, 8.5, sans, MUTED); y -= 13; }
    if (!isQuote && document.invoiceCompliance?.dueDate) { drawRight(`Échéance : ${formatDateFr(document.invoiceCompliance.dueDate)}`, PAGE_W - MARGIN, 8.5, sans, MUTED); y -= 13; }
    if (!isQuote && document.linkedQuoteNumber) drawRight(`Facture issue du devis ${document.linkedQuoteNumber}`, PAGE_W - MARGIN, 8.5, sans, MUTED);
    y = PAGE_H - 208;
  };

  const drawPartyBlock = () => {
    const gap = 24;
    const width = (CONTENT_W - gap) / 2;
    const top = y;
    const blocks = [
      { x: MARGIN, title: "DESTINATAIRE", lines: [document.invoiceCompliance?.clientLegalName || document.client.name, document.invoiceCompliance?.billingAddressLine1 || document.client.addressLine1, [document.invoiceCompliance?.billingPostalCode || document.client.postalCode, document.invoiceCompliance?.billingCity || document.client.city].filter(Boolean).join(" ") || null, document.invoiceCompliance?.billingCountry || document.client.country, document.invoiceCompliance?.clientSiren ? `SIREN ${document.invoiceCompliance.clientSiren}` : null, document.invoiceCompliance?.clientVatNumber ? `TVA ${document.invoiceCompliance.clientVatNumber}` : null, document.invoiceCompliance?.purchaseOrderNumber ? `Bon de commande ${document.invoiceCompliance.purchaseOrderNumber}` : null, document.client.email, document.client.phone] },
      { x: MARGIN + width + gap, title: "OUVRAGE", lines: [document.book.title || "-", document.book.author, formatDimensions(document.book), document.book.notes] },
    ];
    let lowest = top;
    for (const block of blocks) {
      y = top;
      draw(block.title, block.x, 7.5, sansBold, accent);
      y -= 17;
      block.lines.filter((value): value is string => Boolean(value)).forEach((line, index) => {
        const font = index === 0 ? serifBold : sans;
        const size = index === 0 ? 11.5 : 8.7;
        for (const wrapped of wrap(line, font, size, width).slice(0, index === block.lines.length - 1 ? 4 : 3)) {
          draw(wrapped, block.x, size, font, index === 0 ? INK : MUTED);
          y -= index === 0 ? 14 : 11;
        }
      });
      lowest = Math.min(lowest, y);
    }
    y = lowest - 18;
    horizontalRule();
    y -= 18;
  };

  const columns = { quantity: MARGIN + 304, unit: MARGIN + 376, vat: MARGIN + 430, right: PAGE_W - MARGIN };
  const showVat = document.vatRegime === "VAT_LIABLE";
  const showLineVat = showVat && new Set(document.items.map((item) => item.vatRateBps)).size > 1;
  const drawItemsTableHeader = () => {
    pageBreakIfNeeded(26);
    draw("PRESTATION", MARGIN, 7.5, sansBold, accent);
    drawRight("QTÉ", columns.quantity + 28, 7.5, sansBold, accent);
    drawRight("PRIX HT", columns.unit + 43, 7.5, sansBold, accent);
    if (showLineVat) drawRight("TVA", columns.vat + 25, 7.5, sansBold, accent);
    drawRight("TOTAL HT", columns.right, 7.5, sansBold, accent);
    y -= 8;
    horizontalRule(MARGIN, PAGE_W - MARGIN, accent, 0.8);
    y -= 13;
  };
  const visibleDescription = (item: DocumentItemView) => item.description && !/^(Référentiel\s+\S+\s+·\s+\S+|Tarif de base Ma Reliure)$/i.test(item.description.trim()) ? item.description : null;
  const drawBookBlock = (key: string) => {
    const block = document.blocks.find((candidate) => candidate.key === key);
    if (!block) return;
    pageBreakIfNeeded(40);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 31, color: PALE });
    draw(block.label, MARGIN + 10, 10.5, serifBold);
    drawRight(`${block.bookCount} livre${block.bookCount > 1 ? "s" : ""}`, PAGE_W - MARGIN - 10, 8.5, sansBold, accent);
    y -= 14;
    const dimensions = formatDimensions(block);
    if (dimensions) draw(dimensions, MARGIN + 10, 7.8, sans, MUTED);
    const subtotal = document.items.filter((item) => item.blockKey === key).reduce((sum, item) => sum + item.totalHtCents, 0);
    drawRight(`Sous-total ${formatMoneyPdf(subtotal)}`, PAGE_W - MARGIN - 10, 7.8, sans, MUTED);
    y -= 24;
  };
  const drawItemsTable = async () => {
    drawItemsTableHeader();
    let currentBlock: string | null = null;
    for (const item of document.items) {
      if (item.blockKey !== currentBlock) { currentBlock = item.blockKey; drawBookBlock(item.blockKey); }
      const labels = wrap(item.label, sansBold, 9.3, 268);
      const description = visibleDescription(item);
      const descriptions = description ? wrap(description, sans, 8, 268) : [];
      const height = labels.length * 11 + descriptions.length * 10 + 12;
      if (y - height < 58) { newPage(); drawItemsTableHeader(); drawBookBlock(item.blockKey); }
      const top = y;
      labels.forEach((line) => { draw(line, MARGIN, 9.3, sansBold); y -= 11; });
      descriptions.forEach((line) => { draw(line, MARGIN, 8, sans, MUTED); y -= 10; });
      const bottom = y;
      y = top;
      const block = document.blocks.find((candidate) => candidate.key === item.blockKey);
      drawRight(`${quantityLabel(item.quantity * (block?.bookCount ?? 1))}${item.unit ? ` ${item.unit}` : ""}`, columns.quantity + 28, 9);
      drawRight(formatMoneyPdf(item.unitPriceCents), columns.unit + 43, 9);
      if (showLineVat) drawRight(rateLabel(item.vatRateBps), columns.vat + 25, 9);
      drawRight(formatMoneyPdf(item.totalHtCents), columns.right, 9, sansBold);
      y = bottom - 6;
      horizontalRule(MARGIN, PAGE_W - MARGIN, RULE, 0.35);
      y -= 8;
      for (const photo of item.photos.filter((candidate) => candidate.includeInPdf)) {
        const width = await drawImage(photo.url, 196, 128, MARGIN + 12);
        if (width > 0) {
          y -= 5;
          if (photo.caption) paragraph(photo.caption, MARGIN + 12, 7.8, Math.max(width, 196), sans, MUTED);
          y -= 9;
        }
      }
    }
  };

  const drawTotals = () => {
    pageBreakIfNeeded(150);
    const left = PAGE_W - MARGIN - 218;
    const right = PAGE_W - MARGIN;
    y -= 9;
    const row = (label: string, value: string, strong = false) => {
      pageBreakIfNeeded(strong ? 28 : 18);
      if (strong) page.drawRectangle({ x: left - 12, y: y - 9, width: right - left + 12, height: 27, color: accent });
      draw(label, left, strong ? 11 : 9, strong ? sansBold : sans, strong ? rgb(1, 1, 1) : MUTED);
      drawRight(value, right - (strong ? 8 : 0), strong ? 11 : 9, strong ? sansBold : sans, strong ? rgb(1, 1, 1) : INK);
      y -= strong ? 34 : 17;
    };
    if (document.discountCents > 0) {
      row("Sous-total HT", formatMoneyPdf(document.subtotalCents));
      row(document.discountType === "PERCENT" ? `Remise (${rateLabel(document.discountValue)})` : "Remise", `- ${formatMoneyPdf(document.discountCents)}`);
    }
    row("Total HT", formatMoneyPdf(document.totalHtCents));
    if (showVat) document.vatBreakdown.filter((group) => group.baseHtCents !== 0 || group.vatCents !== 0).forEach((group) => row(`TVA ${rateLabel(group.vatRateBps)}`, formatMoneyPdf(group.vatCents)));
    row(showVat ? "Total TTC" : "Total à payer", formatMoneyPdf(document.totalTtcCents), true);
    if (document.depositCents > 0) {
      row(document.depositType === "PERCENT" ? `Acompte demandé (${rateLabel(document.depositValue)})` : "Acompte demandé", formatMoneyPdf(document.depositCents));
      row("Solde restant", formatMoneyPdf(document.balanceCents));
    }
  };

  const drawClosingBlocks = () => {
    const section = (title: string, text: string) => {
      y -= 5;
      pageBreakIfNeeded(40);
      draw(title, MARGIN, 7.5, sansBold, accent);
      y -= 14;
      paragraph(text, MARGIN, 8.5, CONTENT_W);
    };
    if (document.vatMention) {
      y -= 5;
      pageBreakIfNeeded(24);
      paragraph(document.vatMention, MARGIN, 8.5, CONTENT_W);
    }
    if (document.paymentTerms) section("CONDITIONS DE PAIEMENT", document.paymentTerms);
    if (!isQuote && document.invoiceCompliance?.legalMentions.length) section("MENTIONS RÉGLEMENTAIRES", document.invoiceCompliance.legalMentions.filter((mention) => mention !== document.vatMention).join("\n"));
    if (!isQuote && document.issuer.iban) section("RÈGLEMENT", `IBAN ${document.issuer.iban}`);
    if (document.notes) section(isQuote ? "CONDITIONS" : "MENTIONS", document.notes);
    if (isQuote) {
      y -= 6;
      pageBreakIfNeeded(76);
      draw("Bon pour accord", MARGIN, 7.5, sansBold, accent);
      y -= 16;
      draw("Date :                                      Nom :", MARGIN, 8.5, sans, MUTED);
      y -= 15;
      draw("Mention : Bon pour accord", MARGIN, 8.5, sans, MUTED);
      page.drawRectangle({ x: MARGIN + 275, y: y - 34, width: 228, height: 46, borderColor: RULE, borderWidth: 0.6 });
      draw("Signature", MARGIN + 285, 7.5, sans, MUTED);
      y -= 47;
    }
  };
  const drawFooter = () => {
    const pages = pdf.getPages();
    const name = document.issuer.workshopName || document.issuer.legalName || "Atelier";
    const truncate = (value: string, maxWidth: number) => {
      let result = clean(value);
      while (result.length > 1 && sans.widthOfTextAtSize(result, 6.7) > maxWidth) result = result.slice(0, -1);
      return result.length < clean(value).length ? `${result.slice(0, -3)}...` : result;
    };
    pages.forEach((target, index) => {
      target.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: PAGE_W - MARGIN, y: 43 }, thickness: 0.4, color: RULE });
      const legalNotes = document.issuer.legalNotes ?? "";
      const legal = [
        document.issuer.legalName,
        document.issuer.legalForm,
        document.issuer.shareCapital ? `Capital ${document.issuer.shareCapital}` : null,
        legalNotes || null,
        document.issuer.siren && !legalNotes.includes(document.issuer.siren) ? `SIREN ${document.issuer.siren}` : null,
        document.issuer.siret && !legalNotes.includes(document.issuer.siret) ? `SIRET ${document.issuer.siret}` : null,
        document.issuer.vatNumber && !legalNotes.includes(document.issuer.vatNumber) ? `TVA ${document.issuer.vatNumber}` : null,
      ].filter(Boolean).join(" · ");
      if (legal) {
        const value = truncate(legal, 398);
        printed.push(value);
        target.drawText(value, { x: MARGIN, y: 29, size: 6.7, font: sans, color: MUTED });
      }
      const contact = [
        [document.issuer.addressLine1, document.issuer.postalCode, document.issuer.city].filter(Boolean).join(" "),
        document.issuer.phone,
        document.issuer.email,
        document.issuer.website,
        document.issuer.documentFooter,
      ].filter(Boolean).join(" · ");
      if (contact) {
        const value = truncate(contact, 398);
        printed.push(value);
        target.drawText(value, { x: MARGIN, y: 17, size: 6.7, font: sans, color: MUTED });
      }
      const footer = clean(`${name} - ${document.number} - page ${index + 1}/${pages.length}`);
      printed.push(footer);
      const pageLabel = `Page ${index + 1} / ${pages.length}`;
      target.drawText(pageLabel, { x: PAGE_W - MARGIN - sans.widthOfTextAtSize(pageLabel, 7.2), y: 28, size: 7.2, font: sansBold, color: accent });
    });
  };

  newPage(false);
  drawHeader();
  drawPartyBlock();
  await drawItemsTable();
  drawTotals();
  drawClosingBlocks();
  drawFooter();
  const pages = pdf.getPages();
  return { base64: await pdf.saveAsBase64(), pageCount: pages.length, printed };
}
