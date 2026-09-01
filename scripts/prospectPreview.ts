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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function composition(options: Options, siteImage: string | null): string {
  const left = siteImage
    ? `<img src="${siteImage}" alt="" />`
    : `<div class="placeholder">
         <p class="placeholder-title">${escapeHtml(options.company)}</p>
         <p class="placeholder-url">${escapeHtml(options.url)}</p>
         <p class="placeholder-note">Website preview unavailable</p>
       </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: ${WIDTH}px; height: ${HEIGHT}px; display: grid;
        grid-template-columns: 1fr 1fr;
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #f8fafc; color: #0f172a;
      }
      .panel { padding: 32px; display: flex; flex-direction: column; gap: 16px; }
      .panel-label {
        font-size: 12px; font-weight: 700; letter-spacing: 0.14em;
        text-transform: uppercase; color: #64748b;
      }
      .frame {
        flex: 1; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0;
        background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1);
      }
      .frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
      .placeholder {
        height: 100%; display: flex; flex-direction: column; justify-content: center;
        align-items: center; gap: 10px; background: #f1f5f9; text-align: center; padding: 24px;
      }
      .placeholder-title { font-size: 26px; font-weight: 700; }
      .placeholder-url { font-size: 15px; color: #475569; }
      .placeholder-note { font-size: 13px; color: #94a3b8; }
      .right { background: ${options.primaryColor}; color: #fff; }
      .right .panel-label { color: rgba(255, 255, 255, 0.72); }
      .intake {
        flex: 1; border-radius: 12px; background: #fff; color: #0f172a; padding: 28px;
        display: flex; flex-direction: column; gap: 16px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.24);
      }
      .intake h1 { font-size: 24px; line-height: 1.2; }
      .intake p.lede { font-size: 15px; color: #475569; }
      .step {
        border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;
        display: flex; align-items: center; gap: 12px; font-size: 14px;
      }
      .step span.n {
        width: 24px; height: 24px; flex: none; border-radius: 999px;
        background: ${options.primaryColor}; color: #fff; font-size: 12px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .cta {
        margin-top: auto; border-radius: 10px; padding: 14px; text-align: center;
        background: ${options.primaryColor}; color: #fff; font-weight: 700; font-size: 15px;
      }
      .footer { font-size: 12px; color: rgba(255, 255, 255, 0.78); }
    </style>
  </head>
  <body>
    <section class="panel">
      <p class="panel-label">${escapeHtml(options.company)} today</p>
      <div class="frame">${left}</div>
    </section>
    <section class="panel right">
      <p class="panel-label">With a Métré Project Intake</p>
      <div class="intake">
        <h1>Tell us about your ${escapeHtml(options.vertical)} project</h1>
        <p class="lede">
          A guided intake that asks what ${escapeHtml(options.company)} needs to quote — and hands
          your team a Project Brief instead of a name and a phone number.
        </p>
        <div class="step"><span class="n">1</span> Project type, size and site conditions</div>
        <div class="step"><span class="n">2</span> Photos of the space, measured and reviewed</div>
        <div class="step"><span class="n">3</span> Budget range and timeline, in the visitor's words</div>
        <div class="step"><span class="n">4</span> Project Brief ready for the sales team</div>
        <div class="cta">See my project brief</div>
      </div>
      <p class="footer">metre-pro.com · Guided project intake for ${escapeHtml(options.vertical)} contractors</p>
    </section>
  </body>
</html>`;
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
    await page.setContent(composition(options, siteImage), { waitUntil: "load" });
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
