/**
 * Règle l'authentification de la production Ma Reliure : ouverture des
 * inscriptions et e-mails de connexion en français.
 *
 * Run with:
 *   npm run configure:mareliure-auth              (montre ce qui changerait, n'écrit rien)
 *   npm run configure:mareliure-auth -- --apply   (écrit)
 *
 * Lit SUPABASE_ACCESS_TOKEN dans `.env.supabase` (non versionné) et ne
 * l'affiche jamais. N'écrit que les réglages nommés dans `DESIRED`, sur le
 * seul projet de production Ma Reliure.
 *
 * Refuse d'écrire tant que le SMTP de Resend n'est pas configuré dans
 * Supabase avec un expéditeur @mareliure.fr. Sans lui, Supabase n'envoie
 * qu'aux membres de l'équipe du projet, deux e-mails par heure : ouvrir les
 * inscriptions ferait promettre à des clients un lien qui n'arriverait jamais.
 * Le mot de passe SMTP — la clé Resend — se saisit dans le tableau de bord
 * Supabase ; ce script ne le lit ni ne l'écrit.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_REF = "hljxohondjvrkzqicexl";
const SENDER_DOMAIN = "mareliure.fr";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(name: string): Record<string, string> {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const template = (name: string) =>
  readFileSync(resolve(ROOT, "supabase/templates/mareliure", name), "utf8");

/**
 * Les délais doivent rester ceux que l'interface annonce
 * (`src/marketplace/auth/accessLink.ts`) : un lien « valable une heure », un
 * renvoi possible après une minute. Un test le vérifie.
 */
const DESIRED: Record<string, string | number | boolean> = {
  disable_signup: false,
  mailer_autoconfirm: false,
  mailer_otp_exp: 3600,
  smtp_max_frequency: 60,
  rate_limit_email_sent: 30,
  mailer_subjects_magic_link: "Votre lien de connexion Ma Reliure",
  mailer_templates_magic_link_content: template("magic-link.html"),
  mailer_subjects_confirmation: "Ouvrez votre espace Ma Reliure",
  mailer_templates_confirmation_content: template("confirmation.html"),
};

function describeValue(value: unknown): string {
  if (typeof value === "string" && value.length > 80) return `<modèle HTML, ${value.length} caractères>`;
  return JSON.stringify(value);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const token =
    process.env.SUPABASE_ACCESS_TOKEN ?? readEnvFile(".env.supabase").SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN est requis (.env.supabase).");

  const endpoint = `https://api.supabase.com/v1/projects/${PRODUCTION_REF}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const read = async (): Promise<Record<string, unknown>> => {
    const response = await fetch(endpoint, { headers });
    if (!response.ok) throw new Error(`Lecture de la configuration refusée (${response.status}).`);
    return (await response.json()) as Record<string, unknown>;
  };

  const current = await read();
  const sender = String(current.smtp_admin_email ?? "");
  const smtpReady =
    Boolean(current.smtp_host) &&
    Boolean(current.smtp_user) &&
    sender.toLowerCase().endsWith(`@${SENDER_DOMAIN}`);

  console.log(`Projet ${PRODUCTION_REF}`);
  console.log(
    `SMTP : ${current.smtp_host ? `${current.smtp_host}:${current.smtp_port}` : "non configuré"} · expéditeur ${sender || "—"}`,
  );

  const changes = Object.entries(DESIRED).filter(([key, value]) => current[key] !== value);
  for (const [key, value] of Object.entries(DESIRED))
    console.log(`  ${current[key] === value ? "=" : "→"} ${key} : ${describeValue(value)}`);

  if (changes.length === 0) {
    console.log("Rien à changer.");
    return;
  }
  if (!smtpReady) {
    const message = `SMTP Resend absent ou expéditeur hors @${SENDER_DOMAIN} : les inscriptions resteraient ouvertes sur un envoi qui n'atteint pas les clients.`;
    if (apply) throw new Error(`Refus d'écrire. ${message}`);
    console.log(`Attention : ${message}`);
  }
  if (!apply) {
    console.log("Aperçu seulement. Relancer avec --apply pour écrire.");
    return;
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(Object.fromEntries(changes)),
  });
  if (!response.ok)
    throw new Error(`Écriture refusée (${response.status}) : ${(await response.text()).slice(0, 300)}`);

  const after = await read();
  const mismatched = Object.entries(DESIRED).filter(([key, value]) => after[key] !== value);
  if (mismatched.length > 0)
    throw new Error(`Relecture : ${mismatched.map(([key]) => key).join(", ")} n'ont pas pris.`);
  console.log(`Écrit et relu : ${changes.length} réglage(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
