/**
 * Idempotent seed for the Bookbinding Playbook, the workspace the Reliure
 * marketplace owns, and the single public Mission its "Présenter mon livre"
 * button opens.
 *
 * Run with: npm run seed:bookbinding
 *
 * Deliberately a near-copy of scripts/seedDeckPlaybook.ts rather than a shared
 * abstraction: both scripts talk to Supabase directly with the service-role key
 * because the admin server functions are wrapped in TanStack Start's HTTP/auth
 * middleware and cannot execute outside a real request. Two occurrences do not
 * make an abstraction, and factoring them together would couple the Deck demo's
 * lifecycle to the marketplace's.
 *
 * The one step the Deck seed has no equivalent of is the last: enrolling the
 * Mission in `marketplace_intake_missions`. That row is what makes a submitted
 * Dossier become a marketplace case — see
 * docs/reliure-marketplace-architecture.md §D.3.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getPlaybookPublishIssues } from "../src/build/engine/validation";
import { playbookSchema } from "../src/build/schema/playbook";
import { bookbindingPlaybookSchema } from "../src/build/playbooks/bookbindingPlaybookSchema";
import {
  BOOKBINDING_MISSION_ID,
  BOOKBINDING_PLAYBOOK_ID,
  BOOKBINDING_PUBLIC_TOKEN,
  BOOKBINDING_WORKSPACE_ID,
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

  const parsed = playbookSchema.parse(bookbindingPlaybookSchema);
  const issues = getPlaybookPublishIssues(parsed);
  if (issues.length > 0) {
    throw new Error(`Bookbinding playbook schema is not publish-ready:\n- ${issues.join("\n- ")}`);
  }
  const schemaJson = parsed as unknown as Json;

  // The marketplace is itself a Métré workspace: it owns the Mission and
  // receives the Dossiers. Nothing about it is special-cased in the engine.
  const { error: workspaceErr } = await supabase.from("build_workspaces").upsert({
    id: BOOKBINDING_WORKSPACE_ID,
    name: "Reliure Marketplace",
    is_active: true,
  });
  if (workspaceErr) throw workspaceErr;

  const { error: playbookErr } = await supabase.from("build_playbooks").upsert({
    id: BOOKBINDING_PLAYBOOK_ID,
    name: "Bookbinding Playbook",
    description: "Qualification d'un projet de reliure, de la réparation à l'édition collector.",
    project_type: "bookbinding",
    is_active: true,
    draft_schema: schemaJson,
  });
  if (playbookErr) throw playbookErr;

  const { data: lastVersion, error: lastVersionErr } = await supabase
    .from("build_playbook_versions")
    .select("id, version_number, schema")
    .eq("playbook_id", BOOKBINDING_PLAYBOOK_ID)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastVersionErr) throw lastVersionErr;

  let versionId = lastVersion?.id ?? null;
  const schemaChanged = JSON.stringify(lastVersion?.schema ?? null) !== JSON.stringify(parsed);

  // A published version is immutable: an edited Playbook produces a new one,
  // and Missions already pointing at the old version keep running it.
  if (!lastVersion || schemaChanged) {
    const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;
    const { data: version, error: versionErr } = await supabase
      .from("build_playbook_versions")
      .insert({
        playbook_id: BOOKBINDING_PLAYBOOK_ID,
        version_number: nextVersionNumber,
        schema: schemaJson,
      })
      .select("id")
      .single();
    if (versionErr) throw versionErr;
    versionId = version.id;

    const { error: pointerErr } = await supabase
      .from("build_playbooks")
      .update({ published_version_id: versionId })
      .eq("id", BOOKBINDING_PLAYBOOK_ID);
    if (pointerErr) throw pointerErr;
    console.log(`Published Bookbinding playbook version ${nextVersionNumber}.`);
  } else {
    console.log("Bookbinding playbook schema unchanged — reusing the existing published version.");
  }

  const { error: missionErr } = await supabase.from("build_missions").upsert({
    id: BOOKBINDING_MISSION_ID,
    workspace_id: BOOKBINDING_WORKSPACE_ID,
    name: "Reliure — présenter mon livre",
    objective: "Qualifier un projet de reliure avant de solliciter des relieurs.",
    playbook_id: BOOKBINDING_PLAYBOOK_ID,
    playbook_version_id: versionId,
    playbook_name: "Bookbinding Playbook",
    status: "active",
    public_token: BOOKBINDING_PUBLIC_TOKEN,
    published_at: new Date().toISOString(),
    proposal: {
      intro:
        "Quelques questions sur votre livre, et des relieurs sélectionnés vous répondront. Comptez cinq minutes.",
      confirmationText:
        "Merci. Nous examinons votre demande et sélectionnons les relieurs les plus adaptés à votre projet. Vous recevrez leurs propositions par e-mail.",
    } as unknown as Json,
    branding: {
      displayName: "Reliure",
    } as unknown as Json,
  });
  if (missionErr) throw missionErr;

  // The enrolment row: from here on, every Dossier this Mission produces
  // becomes a marketplace case (trigger `build_dossiers_marketplace_ingest`).
  const { error: enrolErr } = await supabase.from("marketplace_intake_missions").upsert({
    mission_id: BOOKBINDING_MISSION_ID,
    vertical_id: "bookbinding",
  });
  if (enrolErr) throw enrolErr;

  console.log(`Reliure Mission seeded and enrolled. public_token=${BOOKBINDING_PUBLIC_TOKEN}`);
  console.log(`Runtime: /m/${BOOKBINDING_PUBLIC_TOKEN}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
