import { runPlaybookDraftGeneration } from "@/build/ai/playbookDraftGeneration";
import { expandPlaybookDraft } from "@/build/onboarding/expandPlaybookDraft";
import { matchPlaybookForProduct } from "@/build/onboarding/matchPlaybook";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const bt = "Atelier de reliure";
const pd = "Reliure de livres";

// 1. Generate
const gen = await runPlaybookDraftGeneration(bt, pd);
if (gen.status !== "ok" || !gen.data) throw new Error("gen failed: " + gen.error);
console.log("Steps count:", gen.data.steps.length);

// 2. Expand
const schema = expandPlaybookDraft(gen.data, bt, pd);
console.log("Total steps (with contact):", schema.sections?.[0]?.steps?.length ?? "n/a");
const lastStep = schema.sections?.[0]?.steps?.at(-1);
console.log("Last step title:", lastStep?.title);

// 3. Insert as draft playbook
const { data: pb, error: e1 } = await sb.from("build_playbooks").insert({
  name: `${pd} — v1`,
  description: `Brouillon test cycle`,
  project_type: `${bt} ${pd}`,
  draft_schema: schema as any,
}).select().single();
if (e1) throw e1;
console.log("Draft playbook id:", pb.id);

// 4. Simulate publish: create version, link published_version_id
const { data: ver, error: e2 } = await sb.from("build_playbook_versions").insert({
  playbook_id: pb.id,
  version_number: 1,
  schema: schema as any,
}).select().single();
if (e2) throw e2;
const { error: e3 } = await sb.from("build_playbooks").update({ published_version_id: ver.id }).eq("id", pb.id);
if (e3) throw e3;
console.log("Published version:", ver.id);

// 5. Re-fetch active published playbooks, run matcher
const { data: list } = await sb.from("build_playbooks").select("id, name, project_type").eq("is_active", true).not("published_version_id", "is", null);
console.log("Publishable playbooks:", list?.map(p => p.name));
const match = matchPlaybookForProduct(bt, pd, (list ?? []).map(p => ({ id: p.id, name: p.name, project_type: p.project_type })));
console.log("MATCH:", match?.playbook.name, "score=", match?.score);

// Cleanup
await sb.from("build_playbooks").delete().eq("id", pb.id);
console.log("Cleaned up.");
