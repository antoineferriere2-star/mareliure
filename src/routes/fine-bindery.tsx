/**
 * A stable path to Fine Bindery's homepage, independent of which Host the
 * request arrived on — useful for review and QA before finebindery.com's
 * DNS points at this deployment, and afterwards as a permanent link that
 * works from either domain. The Host-based switch that makes `/` itself
 * serve this page on finebindery.com lives in routes/index.tsx.
 */
import { createFileRoute } from "@tanstack/react-router";
import { FineBinderyLandingPage } from "@/marketplace/pages/fineBindery/FineBinderyLanding";
import { EDITORIAL_FONT_PRELOAD } from "@/marketplace/pages/landing/content";

const TITLE = "Fine Bindery — Exceptional French Bookbinding";
const DESCRIPTION =
  "The international concierge for exceptional French bookbinding. Entrust your book to selected independent workshops in France — Fine Bindery manages every step.";

export const Route = createFileRoute("/fine-bindery")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      // Not indexed at this path: finebindery.com's DNS does not point here
      // yet (still resolves at its registrar), so this canonical would send
      // a crawler toward a domain showing unrelated parking content. Once
      // the domain is live, "/" (routes/index.tsx) serves the same page
      // there and indexes normally — this path stays a QA/preview link.
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
    links: [EDITORIAL_FONT_PRELOAD],
  }),
  component: FineBinderyLandingPage,
});
