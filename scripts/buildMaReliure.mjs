/**
 * Construit le bundle Ma Reliure de production, et refuse de produire un
 * bundle qui viserait la mauvaise base.
 *
 * Pourquoi un script plutôt qu'un `vite build` direct : les valeurs Supabase du
 * navigateur sont figées dans le bundle au moment du build. Un build lancé sans
 * elles ne plante pas — il en prend d'autres, silencieusement. C'est exactement
 * ce qui est arrivé : la production a servi pendant une journée un bundle qui
 * pointait le navigateur vers le projet Métré d'origine. Rien ne s'est vu,
 * parce que la landing est statique et que le runtime passe par des server
 * functions ; ça se serait vu à la première connexion d'un client.
 *
 * Le script lit `.env.production.mareliure` (non versionné), le passe à Vite
 * par l'environnement, puis **relit le bundle produit** pour vérifier qu'il ne
 * référence que le projet attendu. Une vérification après coup, sur l'artefact
 * réel, plutôt qu'une promesse de configuration.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = ".env.production.mareliure";
const ASSETS_DIR = ".output/public/assets";

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!existsSync(ENV_FILE)) {
  fail(
    `${ENV_FILE} est introuvable.\n` +
      `  Ce fichier porte la configuration Supabase de production ; il n'est pas\n` +
      `  versionné (voir .gitignore) et doit être recréé à partir de .env.example.`,
  );
}

/** Un parseur volontairement minimal : ces fichiers sont des paires clé=valeur, rien de plus. */
const env = {};
for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_PUBLIC_BRAND"];
const missing = REQUIRED.filter((key) => !env[key]);
if (missing.length > 0) fail(`${ENV_FILE} ne définit pas : ${missing.join(", ")}`);

if (env.VITE_PUBLIC_BRAND !== "mareliure") {
  fail(`VITE_PUBLIC_BRAND vaut "${env.VITE_PUBLIC_BRAND}" au lieu de "mareliure".`);
}

const expectedRef = env.VITE_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!expectedRef) fail(`VITE_SUPABASE_URL ne ressemble pas à une URL de projet Supabase.`);

console.info(`\n→ Build Ma Reliure · projet Supabase attendu : ${expectedRef}\n`);

const build = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, ...env },
});
if (build.status !== 0) fail("le build a échoué.");

// Vérification sur l'artefact, pas sur l'intention.
if (!existsSync(ASSETS_DIR)) fail(`${ASSETS_DIR} est absent : le build n'a rien produit ?`);

const refs = new Set();
for (const file of readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"))) {
  const source = readFileSync(resolve(ASSETS_DIR, file), "utf8");
  for (const [, ref] of source.matchAll(/https:\/\/([a-z0-9]{15,})\.supabase\.co/g)) {
    refs.add(ref);
  }
}

if (refs.size === 0) {
  fail("aucune URL Supabase dans le bundle client : la configuration n'a pas été injectée.");
}

const wrong = [...refs].filter((ref) => ref !== expectedRef);
if (wrong.length > 0) {
  fail(
    `le bundle client référence un autre projet Supabase que celui attendu.\n` +
      `  attendu : ${expectedRef}\n` +
      `  trouvé  : ${[...refs].join(", ")}`,
  );
}

console.info(`\n✓ Bundle client vérifié : il ne référence que ${expectedRef}.\n`);
