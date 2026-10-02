// Recette navigateur #54 : application locale (port 8095) branchée sur qwf. Sessions de test ouvertes
// côté serveur par lien magique de l'API d'administration de la RECETTE (aucun mot de passe saisi).
const fs = require("fs");
const { spawnSync } = require("child_process");
const { chromium } = require("D:/CodexProjects/mareliure-audit53-fixes/node_modules/@playwright/test");
const env = Object.fromEntries(fs.readFileSync("D:/CodexProjects/mareliure-roundtrip/.env", "utf8").split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
if (!env.SUPABASE_URL.includes("qwfhebtxeubfmvvdsqdt") || env.RESEND_API_KEY) throw Error("recette qwf sans Resend requise");
const BASE = "http://localhost:8095";
const OUT = `${__dirname}/browser`; fs.mkdirSync(OUT, { recursive: true });
const FX = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(`${__dirname}/11-fixtures-k.result.json`, "utf8"))).map(([k, v]) => [k.replace("RL-QA-K", "RL-QA-J"), v]));
const ACTORS = { customer: "733e639f-a971-4ffe-ad7d-6bf2f7d41468", fbCustomer: "0f1705b1-bf7e-4f2b-8fb4-2724af70941b",
  workshop: "fe4ef1b4-887b-47f8-b2b8-088e51f13ba5", draftWorkshop: "32db49b2-2cce-4db1-b382-136bb63d139c", admin: "33bc4a8e-2e59-4799-9ca6-59dacd635fb5" };
const sessions = {};
async function session(userId) {
  if (sessions[userId]) return sessions[userId];
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const user = await (await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: h })).json();
  if (!/(example\.invalid|example\.com|\.test)$/.test(user.email)) throw Error("compte non fictif refusé");
  const link = await (await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: user.email }) })).json();
  const verified = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, { method: "POST", headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: link.hashed_token ?? link.properties?.hashed_token }) });
  const s = await verified.json();
  if (!s.access_token) throw Error(`session_failed_${verified.status}`);
  return (sessions[userId] = s);
}
const results = [];
function record(scenario, pass, detail = "") {
  results.push({ at: new Date().toISOString(), scenario, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${scenario}${detail ? " — " + detail : ""}`);
}
async function open(browser, actor, brand, mobile) {
  const s = await session(ACTORS[actor]);
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.route("**/*", (route) => { const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1", "qwfhebtxeubfmvvdsqdt.supabase.co"].includes(host) ? route.continue() : route.abort(); });
  await ctx.addInitScript(([k, v, b]) => { localStorage.setItem(k, v); localStorage.setItem("marketplace-brand", b); },
    ["sb-qwfhebtxeubfmvvdsqdt-auth-token", JSON.stringify({ ...s, expires_at: Math.floor(Date.now() / 1000) + s.expires_in }), brand]);
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  // Espace client : la marque vient du domaine ; en local, l'instance 8096 force Fine Bindery.
  p.__base = brand === "FINE_BINDERY" && actor.toLowerCase().includes("customer") ? "http://localhost:8096" : BASE;
  const errors = []; p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  return { ctx, p, errors };
}
async function visit(p, path, waitText) {
  await p.goto(`${p.__base ?? BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  if (waitText) await p.getByText(waitText, { exact: false }).first().waitFor({ timeout: 120000 }).catch(async () => {
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByText(waitText, { exact: false }).first().waitFor({ timeout: 120000 }).catch(() => undefined);
  });
  return state(p);
}
async function state(p) {
  return { text: await p.locator("body").innerText(), overflow: await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) };
}
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
function sql(file, mode = "ro") {
  const r = spawnSync("node", ["D:/CodexData/Temp/claude/C--Users-antoi-Buil-AI/1c764891-58a2-409f-a884-96c731197f3e/scratchpad/pg/qwf.mjs", mode, file], { encoding: "utf8" });
  if (r.status) throw Error(r.stderr);
  return r.stdout.trim();
}
function sqlText(text, mode = "ro") { const f = `${__dirname}/.tmp.sql`; fs.writeFileSync(f, text); return sql(f, mode); }
function save(name) { fs.appendFileSync(`${__dirname}/${name}`, results.map((r) => JSON.stringify(r)).join("\n") + "\n"); results.length = 0; }
async function has(p, text, timeout = 45000) { return p.getByText(text, { exact: false }).first().waitFor({ timeout }).then(() => true, () => false); }
async function editIfSaved(p, form, summary, button) {
  await Promise.race([has(p, form, 90000), has(p, summary, 90000)]);
  const b = p.getByRole("button", { name: button, exact: true });
  if (await b.count()) { await b.first().click(); await has(p, form, 30000); }
}
module.exports = { has, editIfSaved, chromium, BASE, OUT, FX, ACTORS, open, visit, state, shot, record, sql, sqlText, save, results };
