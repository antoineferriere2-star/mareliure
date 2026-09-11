/**
 * L'envoi par Resend, réduit à ce que l'application en fait.
 *
 * Un appel HTTP plutôt qu'un SDK : le Worker n'a besoin que de `fetch`, et une
 * dépendance de plus serait une surface de plus à maintenir pour un POST.
 *
 * La clé n'est jamais lue ici : l'appelant la passe. Ce module ne sait donc
 * pas d'où elle vient et ne peut pas la journaliser par inadvertance — une
 * erreur ne reprend que le statut et le message renvoyés par Resend.
 */

export const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Resend ignore un second envoi portant la même clé pendant 24 heures. */
  idempotencyKey?: string;
  /** Le gabarit, pour retrouver un envoi dans le tableau de bord Resend. */
  tag?: string;
}

export class ResendEmailError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, detail: string) {
    super(
      `Resend a refusé l'envoi (${status}${code ? ` ${code}` : ""})${detail ? ` : ${detail}` : ""}`,
    );
    this.name = "ResendEmailError";
    this.status = status;
    this.code = code;
  }
}

/** Resend n'accepte dans une étiquette que lettres, chiffres, `_` et `-`. */
const TAG_VALUE = /^[A-Za-z0-9_-]{1,256}$/;
const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

export async function sendResendEmail(
  message: ResendMessage,
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<{ id: string | null }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey)
    headers["Idempotency-Key"] = message.idempotencyKey.slice(0, IDEMPOTENCY_KEY_MAX_LENGTH);

  const body = {
    from: message.from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    ...(message.tag && TAG_VALUE.test(message.tag)
      ? { tags: [{ name: "template", value: message.tag }] }
      : {}),
  };

  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await doFetch(RESEND_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new ResendEmailError(
      response.status,
      typeof payload?.name === "string" ? payload.name : null,
      typeof payload?.message === "string" ? payload.message.slice(0, 200) : "",
    );
  }
  return { id: typeof payload?.id === "string" ? payload.id : null };
}
