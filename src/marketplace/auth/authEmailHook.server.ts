/**
 * Le hook « Send Email » de Supabase Auth (Phase F, e-mails
 * d'authentification brand-aware).
 *
 * Ma Reliure et Fine Bindery partagent un seul projet Supabase (audit
 * multi-brand, 12 septembre 2026), qui n'a qu'un seul jeu de modèles
 * d'e-mail par projet. Sans ce hook, un client Fine Bindery recevait son
 * lien de connexion en français, signé Ma Reliure, quel que soit le domaine
 * par lequel il était arrivé. Ce hook intercepte l'envoi avant que Supabase
 * ne rende son propre modèle, et le remplace par un e-mail rendu ici —
 * brand-aware, langue comprise.
 *
 * Un seul signal de marque existe à ce point : `email_data.redirect_to`,
 * l'URL que le client a demandée (`accessLink.ts`, `emailRedirectTo`), déjà
 * garantie appartenir à `uri_allow_list` avant d'atteindre ce hook — jamais
 * un paramètre que l'appelant du hook (Supabase, pas le navigateur)
 * choisirait lui-même.
 *
 * Deux flux seulement déclenchent un envoi aujourd'hui (voir
 * MaReliureAuthPage.tsx) : le lien/code client (`signInWithOtp`, type
 * "magiclink") et l'inscription par mot de passe de l'atelier
 * (`signUp`, type "signup" — jamais sur Fine Bindery, `showBinderTab` le
 * masque). Un type imprévu (récupération de mot de passe, invitation...)
 * n'est déclenché nulle part dans le produit ; il reçoit quand même le
 * modèle "magiclink" plutôt qu'un échec silencieux si un jour il l'est.
 */
import { z } from "zod";
import {
  MARKETPLACE_BRAND_CONFIGS,
  resolveMarketplaceBrandForHostname,
  type MarketplaceBrand,
} from "@/marketplace/brand/brandConfig";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const sendEmailHookPayloadSchema = z.object({
  user: z.object({ email: z.string() }),
  email_data: z.object({
    token: z.string(),
    token_hash: z.string(),
    redirect_to: z.string(),
    email_action_type: z.string(),
  }),
});

export type SendEmailHookPayload = z.infer<typeof sendEmailHookPayloadSchema>;

/** `null` si la charge utile n'a pas la forme attendue — jamais une exception. */
export function parseSendEmailHookPayload(raw: unknown): SendEmailHookPayload | null {
  const parsed = sendEmailHookPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Un `redirect_to` qui ne correspond à aucun hôte connu (prévisualisation,
 * `*.workers.dev`, `localhost` en test) retombe sur Ma Reliure — jamais Fine
 * Bindery par défaut (§57), et jamais une exception qui ferait échouer
 * l'envoi.
 */
export function resolveHookBrand(redirectTo: string): MarketplaceBrand {
  try {
    return resolveMarketplaceBrandForHostname(new URL(redirectTo).hostname);
  } catch {
    return "MA_RELIURE";
  }
}

/**
 * Le lien que Supabase aurait construit lui-même pour `.ConfirmationURL` :
 * son propre point de vérification, jamais un chemin que cette application
 * hébergerait — lui seul sait valider `token_hash` et ouvrir la session.
 */
export function buildVerifyUrl(payload: SendEmailHookPayload, supabaseUrl: string): string {
  const params = new URLSearchParams({
    token: payload.email_data.token_hash,
    type: payload.email_data.email_action_type,
    redirect_to: payload.email_data.redirect_to,
  });
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/verify?${params.toString()}`;
}

export async function handleSendEmailHook(
  payload: SendEmailHookPayload,
  supabaseUrl: string,
): Promise<void> {
  const confirmationUrl = buildVerifyUrl(payload, supabaseUrl);
  const to = payload.user.email;
  const idempotencyKey = `auth-${payload.email_data.email_action_type}-${payload.email_data.token_hash}`;

  if (payload.email_data.email_action_type === "signup") {
    await sendTemplateEmail("auth-signup-confirmation", to, {
      templateData: { confirmationUrl, code: payload.email_data.token },
      idempotencyKey,
    });
    return;
  }

  const brand = resolveHookBrand(payload.email_data.redirect_to);
  const config = MARKETPLACE_BRAND_CONFIGS[brand];
  await sendTemplateEmail("auth-magic-link", to, {
    templateData: {
      brandName: config.displayName,
      locale: config.defaultLocale,
      confirmationUrl,
      code: payload.email_data.token,
    },
    idempotencyKey,
    brand,
  });
}
