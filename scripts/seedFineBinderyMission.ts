/**
 * Idempotent seed for Fine Bindery's own Mission — the same published
 * Bookbinding Playbook as Ma Reliure, a second Mission row, enrolled in
 * `marketplace_intake_missions` with `brand = 'FINE_BINDERY'`.
 *
 * Run with: npm run seed:fine-bindery
 *
 * Near-copy of scripts/seedBookbindingPlaybook.ts, for the same reason that
 * one is a near-copy of scripts/seedDeckPlaybook.ts: this talks to Supabase
 * directly with the service-role key because the admin server functions
 * require a real HTTP/auth context this script does not have.
 *
 * Does not touch `BOOKBINDING_MISSION_ID` or its enrolment — Ma Reliure's
 * Mission is untouched. This only adds a second Mission pointing at the same
 * playbook_version_id, so a schema change published by seedBookbindingPlaybook
 * reaches Fine Bindery's Mission the next time this script runs, exactly as
 * it already reaches Ma Reliure's.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  BOOKBINDING_PLAYBOOK_ID,
  BOOKBINDING_WORKSPACE_ID,
  FINE_BINDERY_MISSION_ID,
  FINE_BINDERY_PUBLIC_TOKEN,
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
    id: FINE_BINDERY_MISSION_ID,
    // Same workspace as Ma Reliure: this is one product with two storefronts,
    // not two workspaces to keep in sync (§3 — "aucune règle... ne doit
    // entrer... deux fois").
    workspace_id: BOOKBINDING_WORKSPACE_ID,
    name: "Fine Bindery — start your project",
    objective:
      "Qualify a bookbinding project so Fine Bindery can price it and entrust it to the right French workshop.",
    playbook_id: BOOKBINDING_PLAYBOOK_ID,
    playbook_version_id: playbook.published_version_id,
    playbook_name: "Bookbinding Playbook",
    status: "active",
    public_token: FINE_BINDERY_PUBLIC_TOKEN,
    published_at: new Date().toISOString(),
    proposal: {
      // Switches the *engine's own chrome* — buttons, Project Canvas, the
      // Vérificateur — to English (src/build/i18n/, already covers en-US as
      // its base locale). The Playbook's own question labels are still
      // French text values (Phase D translates those; see
      // bookbindingPlaybookSchema.ts) — a real gap, not fixed by this flag.
      defaultLocale: "en-US",
      intro:
        "A few questions and a few photographs are enough to describe your book. Fine Bindery then reviews the work involved and presents its price. This takes about five minutes.",
      confirmationText:
        "Thank you. Fine Bindery is now reviewing the work your book needs. We will come back to you with pricing, then entrust your project to the workshop whose skills match it.",
    } as unknown as Json,
    branding: {
      displayName: "Fine Bindery",
    } as unknown as Json,
  });
  if (missionErr) throw missionErr;

  // The enrolment row: from here on, every Dossier this Mission produces
  // becomes a marketplace case tagged brand = 'FINE_BINDERY'
  // (marketplace_ingest_dossier(), migration 20260916090000).
  const { error: enrolErr } = await supabase.from("marketplace_intake_missions").upsert({
    mission_id: FINE_BINDERY_MISSION_ID,
    vertical_id: "bookbinding",
    brand: "FINE_BINDERY",
  });
  if (enrolErr) throw enrolErr;

  console.log(`Fine Bindery Mission seeded and enrolled. public_token=${FINE_BINDERY_PUBLIC_TOKEN}`);
  console.log(`Runtime: /m/${FINE_BINDERY_PUBLIC_TOKEN}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
