import * as React from "react";
import { render } from "@react-email/render";
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { isMaReliure } from "@/brand";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { TEMPLATES } from "./registry";
import { sendResendEmail } from "./resend";

// Server-only: reads RESEND_API_KEY or LOVABLE_API_KEY. Never import from
// client components.

/**
 * Chaque marque envoie depuis son propre domaine, par un seul prestataire.
 *
 * Métré Build passe par l'API e-mail de Lovable, sur le sous-domaine délégué
 * `notify.metre-pro.fr`. Ma Reliure passe par Resend, sur `mareliure.fr` : une
 * personne qui confie un livre ne reçoit pas un message d'un domaine Métré, et
 * le Worker Cloudflare de Ma Reliure n'a pas de clé Lovable — c'est pour cela
 * qu'aucun récapitulatif n'en partait.
 *
 * Le choix est une constante de compilation (`isMaReliure`) : jamais deux
 * prestataires pour une même marque, jamais de repli silencieux de l'un vers
 * l'autre.
 */
const METRE_SITE_NAME = "Métré Build";
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.metre-pro.fr";
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "notify.metre-pro.fr";

/** Le domaine vérifié chez Resend. `noreply` : aucune boîte ne lit les réponses. */
export const MARELIURE_FROM = "Ma Reliure <noreply@mareliure.fr>";

/**
 * Domaines réellement vérifiés dans Resend pour l'envoi marketplace, au
 * 18 septembre 2026 — un seul aujourd'hui. `finebindery.com` a un DKIM
 * absent (`resend._domainkey.finebindery.com` ne résout pas, vérifié par
 * requête DNS directe) : y envoyer échouerait à l'appel Resend plutôt que
 * de livrer un e-mail mal authentifié, et cet échec ferait échouer la
 * connexion Fine Bindery elle-même (le hook d'authentification traite tout
 * ce qui n'est pas un envoi réussi comme un blocage de connexion, sur les
 * deux marques). Ne pas retirer `mareliure.fr` de cette liste avant d'avoir
 * vérifié `finebindery.com` dans Resend et confirmé son DKIM par requête
 * DNS — jamais en supposant qu'une configuration Dashboard a été faite.
 */
const VERIFIED_SENDING_DOMAINS = new Set(["mareliure.fr"]);

/**
 * Le nom affiché suit toujours la marque réelle ; l'adresse technique reste
 * sur `mareliure.fr` tant que `finebindery.com` n'a pas son propre domaine
 * vérifié — voir VERIFIED_SENDING_DOMAINS. Un client Fine Bindery voit donc
 * "Fine Bindery <noreply@mareliure.fr>", pas "Ma Reliure" : le nom est ce
 * qu'un client lit en premier dans la plupart des clients mail, l'adresse
 * elle-même ne l'est presque jamais.
 */
async function resolveMarketplaceSender(brand?: MarketplaceBrand): Promise<string> {
  if (!brand || brand === "MA_RELIURE") return MARELIURE_FROM;
  // Import différé : send-email.ts sert aussi Métré Build, qui ne doit pas
  // dépendre du module marketplace pour un envoi qui ne le concerne jamais.
  const { MARKETPLACE_BRAND_CONFIGS } = await import("@/marketplace/brand/brandConfig");
  const identity = MARKETPLACE_BRAND_CONFIGS[brand].contactIdentity;
  const domain = identity.senderEmail.split("@")[1] ?? "";
  const address = VERIFIED_SENDING_DOMAINS.has(domain)
    ? identity.senderEmail
    : "noreply@mareliure.fr";
  return `${identity.senderName} <${address}>`;
}

export type SendTemplateEmailResult =
  { sent: true } | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
  /** Marketplace only — decides the display name (and, once verified, the domain) of the sender. Ignored for Métré Build sends. */
  brand?: MarketplaceBrand;
}

/**
 * Renders a registered template and sends it through the brand's provider —
 * Resend for Ma Reliure, Lovable's managed email API for Métré Build. A
 * suppressed recipient (Lovable only) is an expected outcome
 * ({ sent: false }); any other failure throws, a missing key included.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;
  const idempotencyKey = options.idempotencyKey || crypto.randomUUID();

  if (isMaReliure) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    const from = await resolveMarketplaceSender(options.brand);
    await sendResendEmail(
      {
        from,
        to: recipient,
        subject,
        html,
        text,
        replyTo: options.replyTo,
        idempotencyKey,
        tag: templateName,
      },
      { apiKey },
    );
    return { sent: true };
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  try {
    await sendLovableEmail(
      {
        to: recipient,
        from: `${METRE_SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: templateName,
        idempotency_key: idempotencyKey,
        reply_to: options.replyTo,
      },
      { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
    );
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      return { sent: false, reason: "recipient_suppressed" };
    }
    throw error;
  }

  return { sent: true };
}
