export interface IntegrationSnippetInput {
  publicUrl: string;
  origin?: string;
  ctaLabel?: string;
  iframeTitle?: string;
  iframeHeight?: number;
  /** Hex colour for the button's background. Anything else falls back to the default. */
  brandColor?: string;
}

/** Emerald 700 — the product's own accent, and AA-contrast against white text. */
const DEFAULT_BUTTON_COLOR = "#047857";

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The value is interpolated into a `style` attribute, so it must not be able
 * to carry extra CSS declarations. `escapeHtml` already neutralises quotes, so
 * an attribute break-out is impossible; this additionally stops a value like
 * `red;background-image:url(...)` from smuggling in a second property.
 */
function safeButtonColor(value: string | undefined): string {
  return value && HEX_COLOUR.test(value.trim()) ? value.trim() : DEFAULT_BUTTON_COLOR;
}

export interface IntegrationSnippets {
  publicUrl: string;
  linkHtml: string;
  buttonHtml: string;
  iframeHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toAbsolutePublicUrl(publicUrl: string, origin = "https://metre-pro.com"): string {
  if (/^https?:\/\//i.test(publicUrl)) return publicUrl;
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = publicUrl.startsWith("/") ? publicUrl : `/${publicUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

export function buildIntegrationSnippets(input: IntegrationSnippetInput): IntegrationSnippets {
  const publicUrl = toAbsolutePublicUrl(input.publicUrl, input.origin);
  const href = escapeHtml(publicUrl);
  const label = escapeHtml(input.ctaLabel ?? "Start your project");
  const title = escapeHtml(input.iframeTitle ?? "Project intake");
  const height = Math.max(320, Math.min(input.iframeHeight ?? 800, 2000));
  const buttonStyle = escapeHtml(
    [
      "display:inline-block",
      "padding:14px 28px",
      `background-color:${safeButtonColor(input.brandColor)}`,
      "color:#ffffff",
      "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
      "font-size:16px",
      "font-weight:600",
      "line-height:1.25",
      "text-align:center",
      "text-decoration:none",
      "border-radius:8px",
    ].join(";"),
  );

  return {
    publicUrl,
    linkHtml: `<a href="${href}">${label}</a>`,
    // Self-contained inline styles, not a CSS class: we ship no stylesheet to
    // the customer's site, so the previous `class="metre-build-button"`
    // rendered as a plain underlined link — visually identical to linkHtml,
    // making the two options indistinguishable once pasted. Inline styles also
    // survive CMS sanitisers that strip <style> blocks, and they override the
    // host site's own `a { color; text-decoration }` rules, which a class
    // sitting at the same specificity would not reliably do.
    buttonHtml: [`<a href="${href}" style="${buttonStyle}">`, `  ${label}`, `</a>`].join("\n"),
    iframeHtml: `<iframe\n  src="${href}"\n  title="${title}"\n  loading="lazy"\n  width="100%"\n  height="${height}"\n></iframe>`,
  };
}
