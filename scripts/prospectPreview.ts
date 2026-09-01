/**
 * Prospect preview tooling — sales only, no product surface.
 *
 * Renders a single PNG that puts a prospect's own website on the left and a
 * Métré Project Intake mock-up on the right, so a prospect sees their site and
 * the intake they would get side by side.
 *
 * Deliberate constraints (do not relax without asking):
 * - No Browserbase, no third-party capture service: local Chromium only.
 * - Nothing is injected into the prospect's site; it is loaded read-only in a
 *   separate page and screenshotted.
 * - No generative AI: every word on the right panel comes from the CLI flags.
 * - No new dependency: Playwright (already a devDependency) and Node built-ins.
 * - Never fails hard on a capture problem: the left panel degrades to a
 *   placeholder and the PNG is still written.
 *
 * Usage:
 *   npm run prospect-preview -- \
 *     --company "Premier Pools of Central Florida" \
 *     --url "https://example.com" \
 *     --vertical "residential pools" \
 *     --primary-color "#075985" \
 *     --out tmp/prospect-previews/premier-pools.png
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import {
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  renderPreviewHtml,
} from "../src/build/prospect-preview/template";

const WIDTH = PREVIEW_WIDTH;
const HEIGHT = PREVIEW_HEIGHT;
const SITE_VIEWPORT = { width: 1280, height: 900 };

interface Options {
  company: string;
  url: string;
  vertical: string;
  primaryColor: string;
  intakeTitle?: string;
  out: string;
}


function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const eq = key.indexOf("=");
    if (eq >= 0) {
      flags.set(key.slice(0, eq), key.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, "true");
    }
  }

  const company = flags.get("company")?.trim();
  const url = flags.get("url")?.trim();
  if (!company) throw new Error("--company is required");
  if (!url) throw new Error("--url is required");
  if (!/^https?:\/\//i.test(url)) throw new Error("--url must start with http:// or https://");

  const primaryColor = (flags.get("primary-color") ?? "#0f766e").trim();
  if (!/^#[0-9a-f]{3,8}$/i.test(primaryColor)) throw new Error("--primary-color must be a hex color");

  return {
    company,
    url,
    vertical: flags.get("vertical")?.trim() || "project work",
    primaryColor,
    intakeTitle: flags.get("intake-title")?.trim() || undefined,
    out: flags.get("out")?.trim() || `tmp/prospect-previews/${slug(company)}.png`,
  };
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "prospect"
  );
}

/** Read-only screenshot of the prospect site. Returns null on any failure. */
async function captureSite(browser: Browser, url: string): Promise<string | null> {
  const context = await browser.newContext({
    viewport: SITE_VIEWPORT,
    // A sales preview reads the public page, exactly as an anonymous visitor.
    javaScriptEnabled: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);
    const buffer = await page.screenshot({ type: "png" });
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(
      `[prospect-preview] Could not capture ${url}: ${
        error instanceof Error ? error.message : String(error)
      }. Falling back to a placeholder panel.`,
    );
    return null;
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outPath = resolve(process.cwd(), options.out);
  await mkdir(dirname(outPath), { recursive: true });

  // Honors an explicit Chromium path when the machine already has one (CI
  // images, sandboxes) — otherwise Playwright's own download is used.
  const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    const siteImage = await captureSite(browser, options.url);
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
    const page = await context.newPage();
    await page.setContent(renderPreviewHtml({ ...options, siteImage }), { waitUntil: "load" });
    await page.screenshot({ path: outPath, type: "png" });
    await context.close();
    console.log(`[prospect-preview] Wrote ${outPath}${siteImage ? "" : " (placeholder panel)"}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[prospect-preview] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
