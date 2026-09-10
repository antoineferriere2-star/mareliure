// The service-role key bypasses RLS. Reaching the browser with it would hand
// any visitor every Dossier, every visitor's answers and every customer's
// contact details — the single worst failure this codebase can have.
//
// It is protected by convention today: only `*.server.ts` and the seed scripts
// read it, and Vite only injects the two public VITE_ values into the bundle.
// Conventions are exactly what a deployment under time pressure breaks, so this
// turns them into assertions.
//
// The last test scans the built client output when one exists. It is skipped
// rather than failed when there is no build, because a unit-test run must not
// depend on a two-minute build — but CI, and the deployment procedure in
// docs/deployment-mareliure-ovh.md, run it after `npm run build`, where it
// becomes the real check.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SECRET_ENV = "SUPABASE_SERVICE_ROLE_KEY";

/** Files allowed to read the service-role key. */
const SERVER_ONLY = [
  "src/integrations/supabase/client.server.ts",
  "scripts/seedBookbindingPlaybook.ts",
  "scripts/seedDeckPlaybook.ts",
  "scripts/seedMarketplaceDemo.ts",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

describe("the service-role key never reaches the browser", () => {
  it("is read only by server-only modules", () => {
    const sources = [...walk(resolve(ROOT, "src")), ...walk(resolve(ROOT, "scripts"))].filter((f) =>
      [".ts", ".tsx"].includes(extname(f)),
    );

    const readers = sources
      .filter((file) => readFileSync(file, "utf8").includes(SECRET_ENV))
      .map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"))
      // This file names the variable in order to forbid it.
      .filter((file) => file !== "src/marketplace/secretsContract.test.ts");

    expect(readers.sort()).toEqual([...SERVER_ONLY].sort());
  });

  it("has no VITE_ variant, which would put it in the bundle by construction", () => {
    // Everything prefixed VITE_ is inlined into client JavaScript by Vite.
    // A `VITE_SUPABASE_SERVICE_ROLE_KEY` anywhere is game over, and it is the
    // kind of line someone adds at 2am to make a deployment work.
    const sources = [
      ...walk(resolve(ROOT, "src")),
      ...walk(resolve(ROOT, "scripts")),
      resolve(ROOT, "vite.config.ts"),
      resolve(ROOT, ".env.example"),
    ].filter(
      (f) => existsSync(f) && [".ts", ".tsx", ".example"].includes(extname(f) || ".example"),
    );

    for (const file of sources) {
      if (file.endsWith("secretsContract.test.ts")) continue;
      expect(readFileSync(file, "utf8"), file).not.toContain(`VITE_${SECRET_ENV}`);
    }
  });

  it("is not among the values Vite inlines into the client bundle", () => {
    const config = readFileSync(resolve(ROOT, "vite.config.ts"), "utf8");
    const injected = [...config.matchAll(/"import\.meta\.env\.([A-Z0-9_]+)"/g)].map((m) => m[1]);
    expect(injected.length).toBeGreaterThan(0);
    for (const name of injected) {
      expect(name, "only VITE_ values may be inlined").toMatch(/^VITE_/);
      expect(name).not.toContain("SERVICE_ROLE");
      expect(name).not.toContain("SECRET");
    }
  });

  it("does not appear in the built client assets", () => {
    const publicDir = resolve(ROOT, ".output/public");
    if (!existsSync(publicDir)) {
      // No build in this working tree; the deployment procedure runs this
      // after `npm run build`, where the assertion below actually bites.
      return;
    }
    // A *key*, not the bare prefix. Both the app's own key-format check and the
    // Supabase SDK legitimately ship the literal "sb_secret_" inside
    // `startsWith(...)`, so matching the prefix alone flags the guard rather
    // than the leak. What must never appear is the prefix followed by an actual
    // key body.
    const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{10,}/;

    const offenders = walk(publicDir)
      .filter((f) => [".js", ".mjs", ".css", ".json", ".html"].includes(extname(f)))
      .filter((f) => {
        const body = readFileSync(f, "utf8");
        return SECRET_KEY.test(body) || body.includes(SECRET_ENV);
      })
      .map((f) => f.slice(ROOT.length + 1));

    expect(offenders).toEqual([]);
  });
});
