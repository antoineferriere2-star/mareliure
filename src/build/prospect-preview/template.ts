/**
 * Premium sales preview template — sales tooling only, no product surface.
 *
 * Pure rendering: takes prospect facts (already validated by the CLI) and
 * returns the HTML that the local Chromium screenshots. No AI, no network,
 * no dependency: every word comes from the caller.
 */

export interface PreviewTemplateOptions {
  company: string;
  url: string;
  vertical: string;
  primaryColor: string;
  /** Headline of the mocked Project Intake. Defaults from the vertical. */
  intakeTitle?: string;
  /** Data URL of the prospect site capture, or null when it failed. */
  siteImage?: string | null;
}

export const PREVIEW_WIDTH = 1600;
export const PREVIEW_HEIGHT = 1000;

export const INTAKE_STEPS = [
  "Project type, size and site conditions",
  "Photos of the space, measured and reviewed",
  "Budget range and timeline, in the visitor's words",
  "Project Brief ready for the sales team",
] as const;

export function defaultIntakeTitle(vertical: string): string {
  return `Tell us about your ${vertical} project`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function renderPreviewHtml(options: PreviewTemplateOptions): string {
  const accent = options.primaryColor;
  const intakeTitle = options.intakeTitle?.trim() || defaultIntakeTitle(options.vertical);
  const left = options.siteImage
    ? `<img src="${options.siteImage}" alt="" />`
    : `<div class="placeholder">
         <p class="placeholder-title">${escapeHtml(options.company)}</p>
         <p class="placeholder-url">${escapeHtml(options.url)}</p>
         <p class="placeholder-note">Website preview unavailable</p>
       </div>`;

  const steps = INTAKE_STEPS.map(
    (step, index) =>
      `<div class="step"><span class="n">${index + 1}</span> ${escapeHtml(step)}</div>`,
  ).join("\n        ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; margin: 0; }
      body {
        width: ${PREVIEW_WIDTH}px; height: ${PREVIEW_HEIGHT}px;
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #e2e8f0;
        background:
          radial-gradient(1100px 600px at 12% -10%, rgba(56, 189, 248, 0.28), transparent 60%),
          radial-gradient(900px 620px at 100% 0%, rgba(129, 140, 248, 0.22), transparent 62%),
          linear-gradient(160deg, #071b34 0%, #0b2647 45%, #061529 100%);
        padding: 44px 48px 36px;
        display: flex; flex-direction: column; gap: 26px;
      }
      header { display: flex; flex-direction: column; gap: 10px; }
      .eyebrow {
        font-size: 12px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
        color: rgba(226, 232, 240, 0.66);
      }
      header h1 { font-size: 34px; line-height: 1.15; color: #f8fafc; font-weight: 700; }
      header p.sub { font-size: 16px; color: rgba(226, 232, 240, 0.74); }
      .panels { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; min-height: 0; }
      .panel { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
      .panel-label {
        font-size: 12px; font-weight: 700; letter-spacing: 0.16em;
        text-transform: uppercase; color: rgba(226, 232, 240, 0.72);
      }
      .card {
        flex: 1; min-height: 0; border-radius: 16px; overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: #fff; box-shadow: 0 26px 60px rgba(2, 8, 23, 0.45);
      }
      .browser-bar {
        height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px;
        background: #eef2f7; border-bottom: 1px solid #e2e8f0;
      }
      .dot { width: 10px; height: 10px; border-radius: 999px; background: #cbd5e1; }
      .browser-url {
        margin-left: 8px; font-size: 11px; color: #64748b; background: #fff;
        border-radius: 999px; padding: 3px 12px; border: 1px solid #e2e8f0;
      }
      .shot { height: calc(100% - 34px); overflow: hidden; }
      .shot img { width: 100%; height: auto; display: block; }
      .placeholder {
        height: 100%; display: flex; flex-direction: column; justify-content: center;
        align-items: center; gap: 10px; background: #f1f5f9; text-align: center; padding: 24px;
        color: #0f172a;
      }
      .placeholder-title { font-size: 24px; font-weight: 700; }
      .placeholder-url { font-size: 15px; color: #475569; }
      .placeholder-note { font-size: 13px; color: #94a3b8; }
      .intake {
        height: calc(100% - 34px); color: #0f172a; padding: 26px 28px;
        display: flex; flex-direction: column; gap: 14px;
      }
      .intake h2 { font-size: 24px; line-height: 1.2; }
      .intake p.lede { font-size: 14px; color: #475569; line-height: 1.5; }
      .step {
        border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px;
        display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: #1e293b;
      }
      .step span.n {
        width: 23px; height: 23px; flex: none; border-radius: 999px;
        background: ${accent}; color: #fff; font-size: 12px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .cta {
        margin-top: auto; border-radius: 10px; padding: 13px; text-align: center;
        background: ${accent}; color: #fff; font-weight: 700; font-size: 15px;
      }
      footer {
        display: flex; align-items: center; justify-content: space-between; gap: 20px;
        border-top: 1px solid rgba(148, 163, 184, 0.24); padding-top: 18px;
      }
      .flow { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; }
      .flow .node {
        border-radius: 999px; padding: 8px 16px;
        background: rgba(148, 163, 184, 0.16); border: 1px solid rgba(148, 163, 184, 0.3);
        color: #e2e8f0;
      }
      .flow .node.accent { background: ${accent}; border-color: ${accent}; color: #fff; }
      .flow .arrow { color: rgba(226, 232, 240, 0.6); }
      .brand { font-size: 13px; color: rgba(226, 232, 240, 0.7); }
    </style>
  </head>
  <body>
    <header>
      <p class="eyebrow">Concept preview</p>
      <h1>${escapeHtml(options.company)} — from website visit to Project Brief</h1>
      <p class="sub">
        Same traffic, same team. A guided Project Intake replaces the contact form for
        ${escapeHtml(options.vertical)} projects.
      </p>
    </header>
    <div class="panels">
      <section class="panel">
        <p class="panel-label">${escapeHtml(options.company)} today</p>
        <div class="card">
          <div class="browser-bar">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="browser-url">${escapeHtml(hostLabel(options.url))}</span>
          </div>
          <div class="shot">${left}</div>
        </div>
      </section>
      <section class="panel">
        <p class="panel-label">With a Métré Project Intake</p>
        <div class="card">
          <div class="browser-bar">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span class="browser-url">${escapeHtml(hostLabel(options.url))}/project-intake</span>
          </div>
          <div class="intake">
            <h2>${escapeHtml(intakeTitle)}</h2>
            <p class="lede">
              A guided intake that asks what ${escapeHtml(options.company)} needs to quote — and
              hands your team a Project Brief instead of a name and a phone number.
            </p>
            ${steps}
            <div class="cta">See my project brief</div>
          </div>
        </div>
      </section>
    </div>
    <footer>
      <div class="flow">
        <span class="node">Website</span>
        <span class="arrow">→</span>
        <span class="node accent">Project Intake</span>
        <span class="arrow">→</span>
        <span class="node">Project Brief</span>
      </div>
      <p class="brand">metre-pro.com · Guided project intake for ${escapeHtml(options.vertical)} contractors</p>
    </footer>
  </body>
</html>`;
}
