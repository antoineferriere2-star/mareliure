/**
 * Idempotent seed for the Deck Playbook + its always-public demo Mission.
 *
 * Run with: npm run seed:deck
 *
 * This talks to Supabase directly via the service-role key because the
 * admin server functions (createBuildPlaybook/updatePlaybookDraft/
 * publishPlaybookVersion/createBuildMission) are wrapped in TanStack
 * Start's HTTP/auth request middleware and cannot execute outside a real
 * request. This script performs the exact same operations against the
 * exact same tables and the exact same Zod validation — there is no
 * Deck-specific route or business logic anywhere else in the app.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getPlaybookPublishIssues } from "../src/build/engine/validation";
import { playbookSchema } from "../src/build/schema/playbook";
import { deckPlaybookSchema } from "../src/build/playbooks/deckPlaybookSchema";
import { DECK_DEMO_PUBLIC_TOKEN, DECK_MISSION_ID, DECK_PLAYBOOK_ID } from "../src/build/constants";
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

  const parsed = playbookSchema.parse(deckPlaybookSchema);
  const issues = getPlaybookPublishIssues(parsed);
  if (issues.length > 0) {
    throw new Error(`Deck playbook schema is not publish-ready:\n- ${issues.join("\n- ")}`);
  }
  const schemaJson = parsed as unknown as Json;

  const { error: playbookErr } = await supabase.from("build_playbooks").upsert({
    id: DECK_PLAYBOOK_ID,
    name: "Terrasse / Deck — v1",
    description: "Qualification d'un projet de terrasse (deck) résidentiel.",
    project_type: "deck",
    is_active: true,
    draft_schema: schemaJson,
  });
  if (playbookErr) throw playbookErr;

  const { data: lastVersion, error: lastVersionErr } = await supabase
    .from("build_playbook_versions")
    .select("id, version_number, schema")
    .eq("playbook_id", DECK_PLAYBOOK_ID)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastVersionErr) throw lastVersionErr;

  let versionId = lastVersion?.id ?? null;
  const schemaChanged = JSON.stringify(lastVersion?.schema ?? null) !== JSON.stringify(parsed);

  if (!lastVersion || schemaChanged) {
    const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;
    const { data: version, error: versionErr } = await supabase
      .from("build_playbook_versions")
      .insert({
        playbook_id: DECK_PLAYBOOK_ID,
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
      .eq("id", DECK_PLAYBOOK_ID);
    if (pointerErr) throw pointerErr;
    console.log(`Published Deck playbook version ${nextVersionNumber}.`);
  } else {
    console.log("Deck playbook schema unchanged — reusing the existing published version.");
  }

  const { error: missionErr } = await supabase.from("build_missions").upsert({
    id: DECK_MISSION_ID,
    name: "Deck Project Intake Demo",
    objective: "Public demo of the generic Playbook engine.",
    playbook_id: DECK_PLAYBOOK_ID,
    playbook_version_id: versionId,
    playbook_name: "Terrasse / Deck — v1",
    status: "active",
    public_token: DECK_DEMO_PUBLIC_TOKEN,
    published_at: new Date().toISOString(),
    proposal: {
      visualPreview: { enabled: true, type: "simple-deck-3d", version: 1 },
    } as unknown as Json,
  });
  if (missionErr) throw missionErr;

  console.log(`Deck demo Mission seeded. public_token=${DECK_DEMO_PUBLIC_TOKEN}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
