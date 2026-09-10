/**
 * Précharge le benchmark web de la console de prix.
 *
 * Run with: npm run seed:web-benchmarks
 *
 * Lit `.env` (la base de développement). Refuse la production sauf demande
 * explicite (`ALLOW_PRODUCTION_SEED=true`), parce qu'un `.env` copié d'un
 * environnement à l'autre est l'accident le plus banal du métier.
 *
 * Rejouable : un relevé déjà présent (même travail, format, unité, page et
 * libellé de format) n'est pas réécrit. Un relevé retiré depuis la console
 * n'est pas ressuscité — il est réinséré seulement s'il n'existe plus du tout
 * en actif, ce qui est le sens de « retirer ».
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { WEB_BENCHMARK_SEED } from "../src/marketplace/pricing/webBenchmarks.seed";

const PRODUCTION_REF = "hljxohondjvrkzqicexl";
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  if (url.includes(PRODUCTION_REF) && process.env.ALLOW_PRODUCTION_SEED !== "true")
    throw new Error(
      "Base de production : relancer avec ALLOW_PRODUCTION_SEED=true si c'est voulu.",
    );

  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data: existing, error } = await sb
    .from("marketplace_price_benchmarks")
    .select("work_item_key, size_class, unit_label, source_url, format_label")
    .eq("status", "active");
  if (error) throw error;

  const identity = (row: {
    work_item_key: string;
    size_class: string | null;
    unit_label: string | null;
    source_url: string;
    format_label: string | null;
  }) =>
    [
      row.work_item_key,
      row.size_class ?? "",
      row.unit_label ?? "",
      row.source_url,
      row.format_label ?? "",
    ].join("|");
  const present = new Set((existing ?? []).map(identity));

  const rows = WEB_BENCHMARK_SEED.map((seed) => ({
    work_item_key: seed.workItemKey,
    size_class: seed.sizeClass,
    complexity_class: null,
    low_price_cents: seed.lowPriceCents,
    high_price_cents: seed.highPriceCents,
    unit_label: seed.unitLabel,
    price_basis: seed.priceBasis,
    format_label: seed.formatLabel,
    source_name: seed.sourceName,
    source_url: seed.sourceUrl,
    source_excerpt: seed.sourceExcerpt,
    observed_at: seed.observedAt,
    provenance: "WEB_BENCHMARK",
    notes: seed.notes,
  })).filter((row) => !present.has(identity(row)));

  if (rows.length === 0) {
    console.log(
      `Benchmark web : ${WEB_BENCHMARK_SEED.length} relevés déjà présents, rien à écrire.`,
    );
    return;
  }
  const { error: insertError } = await sb.from("marketplace_price_benchmarks").insert(rows);
  if (insertError) throw insertError;
  console.log(
    `Benchmark web : ${rows.length} relevé(s) écrit(s), ${WEB_BENCHMARK_SEED.length - rows.length} déjà présent(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
