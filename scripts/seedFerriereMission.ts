/**
 * Idempotent seed for the Ferrière workshop's own Mission — the same published
 * Bookbinding Playbook as Ma Reliure, a third Mission row, enrolled in
 * `marketplace_intake_missions` with `brand = 'MA_RELIURE'` by the migration
 * 20261110120000_enrol_ferriere_mission.sql — this script only checks it.
 *
 * Run with: npm run seed:ferriere
 *
 * Near-copy of scripts/seedFineBinderyMission.ts. The difference is not the
 * brand but who the visitor is: this Mission is embedded in the workshop's own
 * website (reliure-ferriere.fr, « Présenter mon ouvrage »), so every case it
 * produces is the workshop's client and is attributed to it server-side by
 * Mission id (src/marketplace/binders/missionWorkshop.ts) — never by anything
 * the visitor's browser sends.
 *
 * Does not touch the Ma Reliure or Fine Bindery Missions or their enrolment.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  BOOKBINDING_PLAYBOOK_ID,
  BOOKBINDING_WORKSPACE_ID,
  FERRIERE_MISSION_ID,
  FERRIERE_PUBLIC_TOKEN,
} from "../src/build/constants";
import type { Database, Json } from "../src/integrations/supabase/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env or the environment).",
    );
  }
  const supabase = createClient<Database>(url, serviceKey);

  const { data: playbook, error: playbookErr } = await supabase
    .from("build_playbooks")
    .select("published_version_id")
    .eq("id", BOOKBINDING_PLAYBOOK_ID)
    .maybeSingle();
  if (playbookErr) throw playbookErr;
  if (!playbook?.published_version_id) {
    throw new Error(
      "Bookbinding playbook has no published version yet — run `npm run seed:bookbinding` first.",
    );
  }

  const { error: missionErr } = await supabase.from("build_missions").upsert({
    id: FERRIERE_MISSION_ID,
    // Same workspace as Ma Reliure and Fine Bindery: one product, one more
    // storefront — the workshop's own website.
    workspace_id: BOOKBINDING_WORKSPACE_ID,
    name: "Atelier Ferrière — présenter mon ouvrage",
    objective:
      "Qualifier une demande de reliure, de dorure ou de restauration pour que l'atelier Ferrière puisse l'étudier et établir son devis.",
    playbook_id: BOOKBINDING_PLAYBOOK_ID,
    playbook_version_id: playbook.published_version_id,
    playbook_name: "Bookbinding Playbook",
    status: "active",
    public_token: FERRIERE_PUBLIC_TOKEN,
    published_at: new Date().toISOString(),
    proposal: {
      defaultLocale: "fr-FR",
      // L'atelier établit lui-même son devis : rien ici ne parle d'un prix
      // fixé par Ma Reliure ni d'un choix entre ateliers.
      intro:
        "Quelques questions et quelques photos suffisent à décrire votre ouvrage. François Ferrière étudie ensuite le travail à réaliser et vous répond avec un devis. Comptez cinq minutes.",
      confirmationText:
        "Merci. Votre demande est transmise à l'atelier Ferrière, qui étudie le travail à réaliser et revient vers vous avec son devis.",
    } as unknown as Json,
    branding: {
      displayName: "Reliure Ferrière",
      // Le brun cuir du site de l'atelier (--cuir).
      accentColor: "#573223",
    } as unknown as Json,
  });
  if (missionErr) throw missionErr;

  // Enrolled as a Ma Reliure Mission: the case lives in the same back-office,
  // and missionWorkshop.ts attributes it to the Ferrière workshop at triage.
  // The enrolment row is written by the migration
  // 20261110120000_enrol_ferriere_mission.sql, not here: since the grants
  // hardening (20261020100000) service_role may only read
  // marketplace_intake_missions. This script only checks it.
  const { data: enrolment, error: enrolErr } = await supabase
    .from("marketplace_intake_missions")
    .select("brand")
    .eq("mission_id", FERRIERE_MISSION_ID)
    .maybeSingle();
  if (enrolErr) throw enrolErr;

  console.log(`Ferrière Mission seeded. public_token=${FERRIERE_PUBLIC_TOKEN}`);
  console.log(`Runtime: /m/${FERRIERE_PUBLIC_TOKEN}`);
  if (enrolment?.brand !== "MA_RELIURE") {
    console.error(
      "Not enrolled yet: apply supabase/migrations/20261110120000_enrol_ferriere_mission.sql " +
        "(the Mission must exist first). Until then its Dossiers never become Ma Reliure cases.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("Enrolment found: brand MA_RELIURE.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
