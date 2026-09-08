// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

/**
 * Which Supabase project the *browser* talks to.
 *
 * This has to be resolved here, at config time, because the values are inlined
 * into the bundle by `define`. And it has to read the .env files explicitly:
 * Vite loads them into `import.meta.env`, never into `process.env`, so a config
 * that only consults `process.env` sees nothing and silently falls through to
 * its default.
 *
 * That is not hypothetical. Until this was fixed, the Ma Reliure bundle shipped
 * to production pointed the browser at the original Métré project — the default
 * below — while the server, which reads its own variables at runtime, talked to
 * the right one. Nothing broke loudly: the landing is static and the Mission
 * runtime goes through server functions. It would have broken the first time a
 * customer tried to sign in.
 *
 * Order: shell environment, then .env files, then the historical Métré default.
 * The shell wins so a deployment can state its target explicitly, which is what
 * `scripts/buildMaReliure.mjs` does.
 */
const fileEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

function resolve(...candidates: (string | undefined)[]): string {
  return candidates.find((value) => value && value.length > 0) ?? "";
}

const SUPABASE_URL = resolve(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_URL,
  fileEnv.VITE_SUPABASE_URL,
  fileEnv.SUPABASE_URL,
  // Le projet Métré Build d'origine. C'est la bonne valeur pour le site Métré
  // et seulement pour lui : tout autre déploiement doit fournir la sienne.
  "https://imivilculbdgjvmfyohz.supabase.co",
);

const SUPABASE_PUBLISHABLE_KEY = resolve(
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  fileEnv.SUPABASE_PUBLISHABLE_KEY,
  "sb_publishable_0h5L1iNw9Zm_PfAWd3kE0A_tLDuD09P",
);

// Le projet visé est imprimé à chaque build. Une clé publiable n'est pas un
// secret — c'est la RLS qui protège les données — mais se tromper de projet
// coûte une soirée à comprendre pourquoi personne ne peut se connecter.
console.info(`[supabase] client → ${SUPABASE_URL}`);

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Co-located *.test.ts files under src/routes/** are not routes.
    router: { routeFileIgnorePattern: "\\.test\\.ts$" },
  },
});
