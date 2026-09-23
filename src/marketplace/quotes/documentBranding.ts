export const DOCUMENT_LOGOS_BUCKET = "marketplace-binder-document-logos";
export const DOCUMENT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const DOCUMENT_LOGO_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const DOCUMENT_ACCENT_COLORS = ["#7A2230", "#24483D", "#263A57", "#3B342E"] as const;

export type DocumentLogoMime = (typeof DOCUMENT_LOGO_MIME_TYPES)[number];
