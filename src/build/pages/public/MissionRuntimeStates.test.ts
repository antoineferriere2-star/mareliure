// Structural check only (renderToStaticMarkup, no DOM/testing-library in
// this repo — see vitest.config.ts's node environment). The actual
// loading -> slowLoad -> retry state machine in MissionRuntime.tsx (timers,
// async fetch, cancellation) is NOT covered by an automated test: exercising
// it properly needs fake timers plus a DOM/event system this repo doesn't
// have configured. Documented here rather than silently skipped.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MissionRuntimeSkeleton } from "./MissionRuntimeStates";

describe("MissionRuntimeSkeleton", () => {
  it("reserves visible height and announces itself as busy with the given label", () => {
    const html = renderToStaticMarkup(
      createElement(MissionRuntimeSkeleton, { label: "Preparing your project intake…" }),
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Preparing your project intake…"');
    // Placeholder blocks give the skeleton non-zero height so nothing
    // collapses to a blank flash while data is loading.
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(0);
  });
});
