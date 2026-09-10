/**
 * Les repères préchargés : sourcés, rattachés sans invention, et hors du code
 * qui fabrique un prix.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBenchmark } from "./benchmark";
import { workItem } from "./catalog";
import { sizeClassOf } from "./workResolver";
import { WEB_BENCHMARK_SEED } from "./webBenchmarks.seed";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("les repères web préchargés", () => {
  it("existent, tous datés, sourcés, extraits et valides", () => {
    expect(WEB_BENCHMARK_SEED.length).toBeGreaterThanOrEqual(30);
    for (const row of WEB_BENCHMARK_SEED) {
      const label = `${row.sourceName} · ${row.workItemKey} · ${row.formatLabel ?? row.unitLabel ?? "—"}`;
      expect(validateBenchmark(row, new Date("2026-09-11")), label).toEqual([]);
      expect(workItem(row.workItemKey), label).not.toBeNull();
      expect(row.sourceUrl, label).toMatch(/^https:\/\//);
    }
  });

  it("citent chaque montant dans leur extrait", () => {
    const amount = (cents: number) => `${cents / 100}`;
    for (const row of WEB_BENCHMARK_SEED) {
      const excerpt = row.sourceExcerpt.replace(/,00/g, "");
      expect(excerpt, `${row.sourceName} ${row.workItemKey}`).toContain(amount(row.lowPriceCents));
      expect(excerpt, `${row.sourceName} ${row.workItemKey}`).toContain(amount(row.highPriceCents));
    }
  });

  it("rattachent un format à une classe par la règle du moteur, jamais à l'estime", () => {
    for (const row of WEB_BENCHMARK_SEED) {
      if (row.sizeClass === null) {
        expect(row.referenceHeightsCm).toEqual([]);
        continue;
      }
      expect(row.referenceHeightsCm.length).toBeGreaterThan(0);
      for (const height of row.referenceHeightsCm)
        expect(sizeClassOf(height), `${row.sourceName} ${row.workItemKey} ${height} cm`).toBe(
          row.sizeClass,
        );
    }
  });

  it("ne sont importés que par le script de seed et par les tests", () => {
    const root = process.cwd();
    const importers = [...files(join(root, "src")), ...files(join(root, "scripts"))]
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => readFileSync(path, "utf8").includes("webBenchmarks.seed"))
      .map((path) => relative(root, path).replace(/\\/g, "/"))
      .filter((path) => !path.endsWith(".test.ts"));
    expect(importers).toEqual(["scripts/seedWebBenchmarks.ts"]);
  });
});
