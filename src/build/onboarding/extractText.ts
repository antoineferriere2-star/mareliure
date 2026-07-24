// Pure text extraction from raw HTML — no DOM parser dependency, kept
// framework-free and testable like src/build/engine/*.ts. Good enough to
// feed the AI extraction prompt; not meant to reproduce page structure.

export interface ExtractedSiteText {
  title: string | null;
  metaDescription: string | null;
  visibleText: string;
}

const MAX_VISIBLE_TEXT_LENGTH = 8000;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  const text = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function extractMetaDescription(html: string): string | null {
  const tagMatch = /<meta[^>]+name=["']description["'][^>]*>/i.exec(html);
  if (!tagMatch) return null;
  const contentMatch = /content=["']([^"']*)["']/i.exec(tagMatch[0]);
  if (!contentMatch) return null;
  const text = decodeEntities(contentMatch[1]).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function extractVisibleText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const stripped = withoutNoise.replace(/<[^>]+>/g, " ");
  const text = decodeEntities(stripped).replace(/\s+/g, " ").trim();
  return text.slice(0, MAX_VISIBLE_TEXT_LENGTH);
}

export function extractSiteText(html: string): ExtractedSiteText {
  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    visibleText: extractVisibleText(html),
  };
}
