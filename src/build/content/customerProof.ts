/**
 * Content model for future real social proof (testimonials, customer
 * logos). Deliberately unused today — Métré Build has no real customer
 * quotes yet, and CLAUDE.md forbids inventing a testimonial, company name,
 * logo, or metric to fill this in. When a real quote exists, add it to
 * CUSTOMER_PROOFS below and wire a rendering component; until then, the
 * homepage's honest alternative is showing real, verifiable product
 * capabilities (Live Deck Intake, Example Project Brief, EN/ES, secure
 * Project Summary links) rather than fabricated praise.
 */
export interface CustomerProof {
  companyName: string;
  logoUrl?: string;
  quote: string;
  personName?: string;
  personRole?: string;
  verified: boolean;
}

export const CUSTOMER_PROOFS: CustomerProof[] = [];
