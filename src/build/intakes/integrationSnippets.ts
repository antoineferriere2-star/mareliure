export interface IntegrationSnippetInput {
  publicUrl: string;
  origin?: string;
  ctaLabel?: string;
  iframeTitle?: string;
  iframeHeight?: number;
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

  return {
    publicUrl,
    linkHtml: `<a href="${href}">${label}</a>`,
    buttonHtml: `<a href="${href}" class="metre-build-button">\n  ${label}\n</a>`,
    iframeHtml: `<iframe\n  src="${href}"\n  title="${title}"\n  loading="lazy"\n  width="100%"\n  height="${height}"\n></iframe>`,
  };
}
