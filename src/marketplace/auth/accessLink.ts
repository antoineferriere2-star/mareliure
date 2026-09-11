/**
 * Le lien de connexion d'un espace Ma Reliure.
 *
 * Pas de mot de passe côté client : une personne qui a confié un livre une
 * fois n'a pas à en créer un, et un mot de passe oublié serait la première
 * raison de ne jamais revenir. Elle donne son adresse, reçoit un lien, et
 * atterrit sur « Mes livres » — où le livre qu'elle a présenté l'attend,
 * rattaché côté serveur par l'adresse que ce lien vient de vérifier
 * (`claimCasesByVerifiedEmail`).
 *
 * Le premier lien ouvre l'espace (`shouldCreateUser`). Il ramène sur `/auth`,
 * qui demande au serveur où envoyer le compte : un atelier ou l'équipe qui
 * passeraient par là arrivent chez eux, pas chez un client.
 *
 * L'e-mail lui-même part de Supabase Auth, par le SMTP de Resend sur
 * mareliure.fr, avec les modèles de `supabase/templates/mareliure/`.
 */
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

/** Tel que la production le règle : `mailer_otp_exp` = 3600 secondes. */
export const ACCESS_LINK_VALIDITY = "une heure";

/** Tel que la production le règle : `smtp_max_frequency` = 60 secondes par adresse. */
export const ACCESS_LINK_RESEND_DELAY_SECONDS = 60;

export const ACCESS_LINK_MESSAGES = {
  invalid: "Cette adresse e-mail ne semble pas valide.",
  tooSoon:
    "Un lien vient d'être envoyé à cette adresse. Attendez une minute avant d'en demander un autre.",
  unavailable: `L'envoi du lien est momentanément indisponible. Votre projet est bien enregistré ; vous pouvez nous écrire à ${MARELIURE_CONTACT_EMAIL}.`,
  failed: "Le lien n'a pas pu être envoyé. Réessayez dans un instant.",
} as const;

/** La seule méthode du client Supabase dont ce module a besoin. */
export interface OtpAuth {
  signInWithOtp(credentials: {
    email: string;
    options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
  }): Promise<{ error: { code?: string; status?: number } | null }>;
}

export type AccessLinkResult = { ok: true } | { ok: false; message: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Une phrase pour chaque refus de Supabase qu'une personne peut rencontrer. */
export function accessLinkErrorMessage(error: { code?: string; status?: number }): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return ACCESS_LINK_MESSAGES.tooSoon;
    case "email_address_invalid":
    case "validation_failed":
      return ACCESS_LINK_MESSAGES.invalid;
    // Inscriptions fermées, e-mail désactivé, ou SMTP par défaut qui refuse
    // toute adresse hors de l'équipe du projet : rien que la personne puisse
    // corriger elle-même.
    case "signup_disabled":
    case "otp_disabled":
    case "email_provider_disabled":
    case "email_address_not_authorized":
      return ACCESS_LINK_MESSAGES.unavailable;
  }
  if (error.status === 429) return ACCESS_LINK_MESSAGES.tooSoon;
  return ACCESS_LINK_MESSAGES.failed;
}

export async function requestAccessLink(
  auth: OtpAuth,
  email: string,
  origin: string,
): Promise<AccessLinkResult> {
  const address = email.trim();
  if (!EMAIL_SHAPE.test(address)) return { ok: false, message: ACCESS_LINK_MESSAGES.invalid };
  try {
    const { error } = await auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${origin.replace(/\/+$/, "")}/auth`,
        shouldCreateUser: true,
      },
    });
    return error ? { ok: false, message: accessLinkErrorMessage(error) } : { ok: true };
  } catch {
    return { ok: false, message: ACCESS_LINK_MESSAGES.failed };
  }
}

/**
 * Le lien a échoué avant d'ouvrir une session : Supabase renvoie sur `/auth`
 * avec l'erreur dans le fragment (`#error_code=otp_expired`) ou, plus rarement,
 * dans la requête. Sans ce message, la personne retombe sur un formulaire
 * vierge sans savoir pourquoi son lien n'a rien fait.
 */
export function linkErrorFromUrl(hash: string, search: string): string | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const code = fragment.get("error_code") ?? query.get("error_code");
  const error = fragment.get("error") ?? query.get("error");
  if (!code && !error) return null;
  if (code === "otp_expired")
    return "Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.";
  return "Ce lien de connexion n'a pas pu être utilisé. Demandez-en un nouveau ci-dessous.";
}
