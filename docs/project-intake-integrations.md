# Project Intake Integrations

Metré Build publishes every Guided Project Intake as a public `/m/:publicToken` URL. The portal and admin console generate three copyable integration formats from the same source:

- a direct HTML link;
- a styled HTML button anchor with `class="metre-build-button"`;
- a responsive iframe.

## Plain HTML

Paste the direct link, button, or iframe into the page where visitors should start the intake. The iframe is self-contained and should not inherit styles from the host page.

## WordPress

Use a Custom HTML block and paste the generated link, button, or iframe. This has not been validated against every WordPress theme or security plugin; if the iframe is stripped, check the site's HTML sanitization settings.

## Webflow

Use an Embed element and paste the generated snippet. Publish to a staging Webflow domain first, then confirm the iframe loads and scrolls correctly on mobile.

## Shopify

Use a Custom Liquid section/block or a page template that allows HTML embeds. Test on an unpublished theme preview before publishing the theme.

## Revocation

If a Mission token is revoked or the Mission is unpublished, existing links and embeds stop loading the public intake. Copy a fresh snippet after reactivation if a new token is issued.
