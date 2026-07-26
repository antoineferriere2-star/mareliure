import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const email = "test-billing-sandbox@metre-pro-test.com";
let userId: string | undefined;
const { data: created, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
if (error) {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  userId = list.users.find(u => u.email === email)?.id;
  console.log("createUser error:", error.message, "existing:", userId);
} else userId = created.user.id;
if (!userId) throw new Error("no user");

let { data: ws } = await sb.from("build_workspaces").select("*").eq("name", "TEST Billing Sandbox").maybeSingle();
if (!ws) {
  const r = await sb.from("build_workspaces").insert({ name: "TEST Billing Sandbox", is_active: true }).select("*").single();
  if (r.error) throw r.error;
  ws = r.data;
}
const m = await sb.from("build_workspace_members").upsert({ workspace_id: ws.id, user_id: userId, email, role: "member" }, { onConflict: "workspace_id,user_id" }).select();
console.log("member:", m.error?.message ?? "ok");
console.log("userId", userId, "workspaceId", ws.id);
console.log("ROW", JSON.stringify(ws, null, 1));
