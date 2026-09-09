/**
 * Demonstration data for the Reliure marketplace: six workshops and eight
 * submitted projects, enough to exercise the matching screen, the relieur
 * dashboard and the managed pricing screen without waiting for real traffic.
 *
 * Run with: npm run seed:marketplace-demo   (after npm run seed:bookbinding)
 *
 * Every row it writes is marked. Relieurs carry `is_demo = true`, and every
 * project uses an @example.com address. §59 is not negotiable: nothing seeded
 * here may ever be counted in a public figure, and the marketplace shows no
 * rating or project count at all until the numbers are real.
 *
 * The Dossiers are produced by the real engine — `generateProjectBrief` over
 * the real published Playbook — rather than hand-written JSON, so a demo case
 * is byte-for-byte the shape a visitor's submission produces. Inserting them
 * also exercises the ingestion trigger: each Dossier becomes a
 * `marketplace_case` on its own, exactly as in production.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generateProjectBrief } from "../src/build/engine/brief";
import { playbookSchema } from "../src/build/schema/playbook";
import { bookbindingPlaybookSchema } from "../src/build/playbooks/bookbindingPlaybookSchema";
import type { Answers } from "../src/build/schema/answers";
import { BOOKBINDING_MISSION_ID, BOOKBINDING_WORKSPACE_ID } from "../src/build/constants";
import type { Database, Json } from "../src/integrations/supabase/types";
import { buildCaseProfile } from "../src/marketplace/cases/caseProfile";
import { suggestManagedPrice } from "../src/marketplace/pricing/pricing.engine";
import { aggregateRates, type BinderRate } from "../src/marketplace/pricing/rateCard";
import { TEST_BINDERS, TEST_RATES } from "../src/marketplace/pricing/testReferences.fixture";

/**
 * Agrège le jeu d'essai pour que les dossiers de démonstration ressortent
 * chiffrés. `includeTestData` est explicite ici et seulement ici : ce script
 * refuse de tourner ailleurs que sur une base de démonstration.
 */
function aggregatesOf(rates: readonly (BinderRate & { binderName: string })[]) {
  const combinations = new Set(
    rates.map((rate) => `${rate.workItemKey}|${rate.sizeClass}|${rate.complexityClass}`),
  );
  return [...combinations]
    .map((combination) => {
      const [key, size, complexity] = combination.split("|");
      return aggregateRates(rates, key, size as BinderRate["sizeClass"], complexity as BinderRate["complexityClass"], {
        includeTestData: true,
      });
    })
    .filter((aggregate) => aggregate !== null);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

/** Stable ids so the seed is idempotent — re-running updates rather than duplicates. */
function demoId(prefix: string, n: number): string {
  const hex = createHash("sha1").update(`${prefix}:${n}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

interface DemoBinder {
  displayName: string;
  workshopName: string;
  city: string;
  postalCode: string;
  bio: string;
  years: number;
  training: string;
  skills: string[];
  acceptedProjectTypes: string[];
  minCents: number | null;
  maxCents: number | null;
  capacity: number;
  status: string;
  portfolio: { title: string; description: string; techniques: string[]; materials: string[] };
}

const BINDERS: DemoBinder[] = [
  {
    displayName: "Hélène Vasseur",
    workshopName: "Atelier Vasseur",
    city: "Paris",
    postalCode: "75011",
    bio: "Reliure traditionnelle, demi-cuir et plein cuir, dorure au fer sur presse à balancier.",
    years: 22,
    training: "École Estienne, puis douze ans chez un relieur du Marais.",
    skills: ["demi_cuir", "plein_cuir", "dorure", "reliure_toile"],
    acceptedProjectTypes: ["belle_reliure", "collector", "couverture"],
    minCents: 20_000,
    maxCents: null,
    capacity: 3,
    status: "approved",
    portfolio: {
      title: "Les Misérables, demi-chagrin rouge",
      description: "Demi-reliure à cinq nerfs, titrage et fleurons dorés, plats papier à la cuve.",
      techniques: ["couture sur ficelles", "dorure au fer"],
      materials: ["chagrin", "papier marbré"],
    },
  },
  {
    displayName: "Marc Delaunay",
    workshopName: "Delaunay Restauration",
    city: "Lyon",
    postalCode: "69005",
    bio: "Restauration et conservation d'ouvrages anciens : papier, parchemin, cuir d'époque.",
    years: 30,
    training: "Formation INP, département arts graphiques.",
    skills: ["restauration", "conservation", "plein_cuir", "dorure"],
    acceptedProjectTypes: ["restaurer", "reparer"],
    minCents: 30_000,
    maxCents: null,
    capacity: 2,
    status: "approved",
    portfolio: {
      title: "Missel du XVIIᵉ, consolidation",
      description:
        "Reprise des mors, comblement des lacunes de papier, remise en état de la couvrure d'origine.",
      techniques: ["comblement", "consolidation des mors"],
      materials: ["papier japon", "veau"],
    },
  },
  {
    displayName: "Salomé Kessler",
    workshopName: "Studio Kessler",
    city: "Nantes",
    postalCode: "44000",
    bio: "Rebinding contemporain : lignes nettes, matières actuelles, contrastes assumés.",
    years: 9,
    training: "DN MADE reliure, puis résidence en atelier à Bruxelles.",
    skills: ["rebinding_contemporain", "reliure_art", "papier_decore", "cartonnage"],
    acceptedProjectTypes: ["belle_reliure", "collector"],
    minCents: 25_000,
    maxCents: null,
    capacity: 4,
    status: "approved",
    portfolio: {
      title: "Coffret pour une édition d'artiste",
      description: "Emboîtage toilé, dos apparent, tranchefiles cousues main.",
      techniques: ["dos apparent", "emboîtage"],
      materials: ["toile de lin", "carton gris"],
    },
  },
  {
    displayName: "Pierre Aubry",
    workshopName: "Reliure Aubry",
    city: "Bordeaux",
    postalCode: "33000",
    bio: "Toile et papier décoré, reliure d'usage soignée pour les livres qu'on relit.",
    years: 15,
    training: "CAP reliure-dorure, formation continue à l'AFPA.",
    skills: ["reliure_toile", "papier_decore", "cartonnage"],
    acceptedProjectTypes: ["reparer", "couverture", "belle_reliure"],
    minCents: 8_000,
    maxCents: 45_000,
    capacity: 5,
    status: "approved",
    portfolio: {
      title: "Série d'atlas scolaires, pleine toile",
      description: "Remise en état du corps d'ouvrage et couvrure pleine toile, titrage à froid.",
      techniques: ["couture sur ruban"],
      materials: ["toile buckram"],
    },
  },
  {
    displayName: "Nadia Berthier",
    workshopName: "L'Or et le Fer",
    city: "Toulouse",
    postalCode: "31000",
    bio: "Dorure sur cuir : titrages, filets, décors au fer et à la roulette.",
    years: 18,
    training: "Compagnonnage doreur sur cuir.",
    skills: ["dorure", "demi_cuir", "plein_cuir"],
    acceptedProjectTypes: ["collector", "belle_reliure"],
    minCents: 30_000,
    maxCents: null,
    capacity: 2,
    status: "approved",
    portfolio: {
      title: "Décor doré sur maroquin vert",
      description: "Filets triples et fleurons d'angle, titrage en capitales romaines.",
      techniques: ["dorure à la feuille"],
      materials: ["maroquin"],
    },
  },
  {
    displayName: "Yann Le Guen",
    workshopName: "Atelier du Ponant",
    city: "Rennes",
    postalCode: "35000",
    bio: "Reliure d'art : chaque projet est une création pensée pour l'ouvrage.",
    years: 12,
    training: "DMA reliure, prix de la jeune reliure 2021.",
    skills: ["reliure_art", "plein_cuir", "dorure", "conservation"],
    acceptedProjectTypes: ["collector"],
    minCents: 60_000,
    maxCents: null,
    capacity: 1,
    // Left unapproved on purpose: the matching screen must visibly refuse to
    // invite a workshop nobody has vetted.
    status: "pending_review",
    portfolio: {
      title: "Reliure à décor mosaïqué",
      description: "Plein maroquin, mosaïque de cuirs teints, gardes en papier peint à la main.",
      techniques: ["mosaïque de cuir"],
      materials: ["maroquin", "papier peint main"],
    },
  },
];

interface DemoCase {
  label: string;
  answers: Answers;
}

const BASE_CONTACT = {
  phone: "0600000000",
  consentement: true,
};

const CASES: DemoCase[] = [
  {
    label: "réparation d'un roman de poche",
    answers: {
      intention: "reparer",
      titre: "L'Étranger",
      auteur: "Albert Camus",
      annee: "1971",
      nature: "livre_courant",
      hauteur: 18,
      largeur: 11,
      epaisseur: 1.5,
      etat: ["couverture_detachee", "pages_detachees"],
      etatDos: "fendu",
      etatPlats: "uses",
      cahiers: "quelques_uns",
      photos: [],
      photosDommages: [],
      valeurRaisons: ["sentimentale"],
      valeurFinanciere: "lt_100",
      budget: "lt_150",
      delai: "pas_urgent",
      name: "Claire Dumont",
      email: "claire.dumont@example.com",
      localisation: { zip: "35000", city_state: "Rennes" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "bible familiale",
    answers: {
      intention: "restaurer",
      titre: "Bible de famille Rousseau",
      annee: "1893",
      nature: "bible_familiale",
      hauteur: 31,
      largeur: 23,
      epaisseur: 9,
      etat: ["dos_abime", "pages_detachees", "humidite"],
      etatDos: "manquant",
      etatPlats: "detaches",
      cahiers: "desolidarises",
      photos: [],
      photosDommages: [],
      valeurRaisons: ["souvenir_familial", "historique"],
      valeurFinanciere: "500_1000",
      budget: "400_700",
      delai: "2_3_mois",
      name: "Bernard Rousseau",
      email: "bernard.rousseau@example.com",
      localisation: { zip: "69005", city_state: "Lyon" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "roman en édition collector",
    answers: {
      intention: "collector",
      titre: "Le Comte de Monte-Cristo",
      auteur: "Alexandre Dumas",
      annee: "1953",
      nature: "livre_courant",
      hauteur: 21.8,
      largeur: 14.2,
      epaisseur: 4.8,
      etat: ["couverture_usee"],
      photos: [],
      styleSouhaite: "traditionnel",
      materiau: "demi_cuir",
      couleur: "Vert foncé",
      finitions: ["nerfs", "dorure", "titre", "auteur"],
      nerfs: 5,
      valeurRaisons: ["sentimentale"],
      valeurFinanciere: "100_500",
      budget: "250_400",
      delai: "pas_urgent",
      name: "Marie Lefèvre",
      email: "marie.lefevre@example.com",
      localisation: { zip: "75011", city_state: "Paris" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "livre ancien (patrimonial)",
    answers: {
      intention: "restaurer",
      titre: "Traité de la lumière",
      auteur: "Christiaan Huygens",
      annee: "1690",
      nature: "livre_ancien",
      hauteur: 24,
      largeur: 17,
      epaisseur: 3,
      etat: ["dos_abime", "pages_dechirees"],
      etatDos: "fragile",
      etatPlats: "taches",
      cahiers: "solidaires",
      photos: [],
      photosDommages: [],
      valeurRaisons: ["historique", "collection"],
      valeurFinanciere: "500_1000",
      budget: "gt_700",
      delai: "pas_urgent",
      name: "Antoine Perrin",
      email: "antoine.perrin@example.com",
      localisation: { zip: "31000", city_state: "Toulouse" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "demi-cuir sur un essai",
    answers: {
      intention: "belle_reliure",
      titre: "Les Rêveries du promeneur solitaire",
      auteur: "Jean-Jacques Rousseau",
      annee: "1968",
      nature: "livre_courant",
      hauteur: 20,
      largeur: 13,
      epaisseur: 2.5,
      etat: ["bon_etat"],
      photos: [],
      styleSouhaite: "classique_sobre",
      materiau: "demi_cuir",
      couleur: "Bordeaux",
      finitions: ["titre", "auteur"],
      valeurRaisons: ["decoration"],
      valeurFinanciere: "lt_100",
      budget: "250_400",
      delai: "1_2_mois",
      name: "Sophie Nguyen",
      email: "sophie.nguyen@example.com",
      localisation: { zip: "44000", city_state: "Nantes" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "reliure toile sur une thèse",
    answers: {
      intention: "belle_reliure",
      titre: "Thèse de doctorat — géologie alpine",
      annee: "2019",
      nature: "autre",
      hauteur: 29.7,
      largeur: 21,
      epaisseur: 3.5,
      etat: ["bon_etat"],
      photos: [],
      styleSouhaite: "classique_sobre",
      materiau: "toile",
      couleur: "Bleu nuit",
      finitions: ["titre", "auteur"],
      valeurRaisons: ["sentimentale"],
      valeurFinanciere: "lt_100",
      budget: "150_250",
      delai: "1_2_mois",
      name: "Julien Moreau",
      email: "julien.moreau@example.com",
      localisation: { zip: "33000", city_state: "Bordeaux" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "ouvrage rare de plus de 1 000 € (revue manuelle)",
    answers: {
      intention: "collector",
      titre: "Voyage autour du monde — exemplaire numéroté",
      auteur: "Louis-Antoine de Bougainville",
      annee: "1772",
      nature: "ouvrage_rare",
      hauteur: 26,
      largeur: 19,
      epaisseur: 5,
      etat: ["couverture_usee", "humidite"],
      photos: [],
      styleSouhaite: "traditionnel",
      materiau: "plein_cuir",
      couleur: "Brun",
      finitions: ["dorure", "nerfs", "titre", "etui"],
      nerfs: 5,
      valeurRaisons: ["financiere", "historique", "collection"],
      valeurFinanciere: "gt_1000",
      budget: "gt_700",
      delai: "pas_urgent",
      name: "Isabelle Fabre",
      email: "isabelle.fabre@example.com",
      localisation: { zip: "75006", city_state: "Paris" },
      ...BASE_CONTACT,
    },
  },
  {
    label: "projet incomplet (le visiteur ne sait pas encore)",
    answers: {
      intention: "ne_sais_pas",
      titre: "Album de photos de famille",
      nature: "album",
      etat: ["ne_sais_pas"],
      photos: [],
      valeurRaisons: ["souvenir_familial"],
      valeurFinanciere: "inconnue",
      budget: "ne_sais_pas",
      delai: "pas_urgent",
      name: "Léa Girard",
      email: "lea.girard@example.com",
      localisation: { zip: "13001", city_state: "Marseille" },
      ...BASE_CONTACT,
    },
  },
];

async function main() {
  loadDotEnv();
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  const supabase = createClient<Database>(url, serviceKey);
  const schema = playbookSchema.parse(bookbindingPlaybookSchema);

  // ---- Relieurs -----------------------------------------------------------
  for (const [index, binder] of BINDERS.entries()) {
    const id = demoId("binder", index);
    const { error } = await supabase.from("marketplace_binders").upsert({
      id,
      display_name: binder.displayName,
      workshop_name: binder.workshopName,
      city: binder.city,
      postal_code: binder.postalCode,
      bio: binder.bio,
      years_experience: binder.years,
      training: binder.training,
      status: binder.status,
      capacity_slots: binder.capacity,
      accepted_project_types: binder.acceptedProjectTypes,
      min_project_cents: binder.minCents,
      max_project_cents: binder.maxCents,
      is_demo: true,
    });
    if (error) throw error;

    await supabase.from("marketplace_binder_skills").delete().eq("binder_id", id);
    const { error: skillError } = await supabase
      .from("marketplace_binder_skills")
      .insert(binder.skills.map((skill) => ({ binder_id: id, skill_slug: skill })));
    if (skillError) throw skillError;

    const { error: portfolioError } = await supabase.from("marketplace_binder_portfolio").upsert({
      id: demoId("portfolio", index),
      binder_id: id,
      title: binder.portfolio.title,
      description: binder.portfolio.description,
      techniques: binder.portfolio.techniques,
      materials: binder.portfolio.materials,
      position: 0,
    });
    if (portfolioError) throw portfolioError;
  }
  console.log(`Seeded ${BINDERS.length} demonstration relieurs.`);

  // ---- Rate cards ---------------------------------------------------------
  // Le jeu d'essai de la Phase 25 : trois ateliers, un demi-cuir à 320 / 350 /
  // 410 €. Il vit en base plutôt qu'en dur dans le moteur, ce qui est tout le
  // propos du chantier — et il est marqué TEST_ONLY, donc invisible pour
  // l'agrégation tant que MARKETPLACE_ALLOW_TEST_RATES ne l'autorise pas.
  const seededBinderIds = BINDERS.map((_, index) => demoId("binder", index));
  const rateRows = TEST_RATES.map((rate, index) => ({
    id: demoId("rate", index),
    // Les trois premiers ateliers de démonstration portent la grille d'essai.
    binder_id: seededBinderIds[TEST_BINDERS.findIndex((b) => b.id === rate.binderId)] ?? seededBinderIds[0],
    work_item_key: rate.workItemKey,
    minimum_payout_cents: rate.minimumPayoutCents,
    typical_payout_cents: rate.typicalPayoutCents,
    maximum_payout_cents: rate.maximumPayoutCents,
    size_class: rate.sizeClass,
    complexity_class: rate.complexityClass,
    effective_from: rate.effectiveFrom,
    status: "active",
    source: rate.source,
    provenance: rate.provenance,
  }));
  const { error: rateError } = await supabase
    .from("marketplace_binder_rates")
    .upsert(rateRows, { onConflict: "id" });
  if (rateError) throw rateError;
  console.log(`Seeded ${rateRows.length} TEST_ONLY rate lines across 3 relieurs.`);

  const demoAggregates = aggregatesOf(
    TEST_RATES.map((rate) => ({ ...rate, binderName: rate.binderName })),
  );

  // ---- Projects -----------------------------------------------------------
  for (const [index, demo] of CASES.entries()) {
    const sessionId = demoId("session", index);
    const dossierId = demoId("dossier", index);
    const submittedAt = new Date(Date.now() - (CASES.length - index) * 86_400_000).toISOString();

    const { error: sessionError } = await supabase.from("build_runtime_sessions").upsert({
      id: sessionId,
      mission_id: BOOKBINDING_MISSION_ID,
      status: "submitted",
      answers: demo.answers as unknown as Json,
      submitted_at: submittedAt,
      // Demonstration sessions are never resumed from a browser; the hash is a
      // placeholder that matches no secret anyone can present.
      session_secret_hash: createHash("sha256").update(`demo:${sessionId}`).digest("hex"),
    });
    if (sessionError) throw sessionError;

    const brief = generateProjectBrief(
      schema,
      demo.answers,
      { name: "Reliure — présenter mon livre" },
      submittedAt,
    );

    const { error: dossierError } = await supabase.from("build_dossiers").upsert({
      id: dossierId,
      workspace_id: BOOKBINDING_WORKSPACE_ID,
      mission_id: BOOKBINDING_MISSION_ID,
      session_id: sessionId,
      status: brief.missingInformation.length > 0 ? "draft" : "ready",
      summary: brief.projectSummary,
      content: brief as unknown as Json,
      next_questions: brief.missingInformation.map((line) => line.label),
      visitor_email: String(demo.answers.email),
      visitor_name: String(demo.answers.name),
    });
    if (dossierError) throw dossierError;

    // Le moteur ne chiffre plus à partir de montants codés en dur : il lit le
    // référentiel. Sur une base de démonstration sans grille saisie, il
    // s'abstient — et c'est le comportement juste, pas une régression du seed.
    const suggestion = suggestManagedPrice(buildCaseProfile(demo.answers), {
      aggregates: demoAggregates,
    });
    const abstained = suggestion.status === "manual_review";
    const { error: pricingError } = await supabase
      .from("marketplace_cases")
      .update({
        pricing_status: abstained ? "manual_review" : "suggested",
        suggested_customer_price_cents: suggestion.suggestedCustomerPriceCents,
        suggested_binder_payout_cents: suggestion.suggestedBinderPayoutCents,
        customer_price_cents: suggestion.suggestedCustomerPriceCents,
        binder_payout_cents: suggestion.suggestedBinderPayoutCents,
        pricing_low_estimate_cents: suggestion.lowEstimateCents,
        pricing_high_estimate_cents: suggestion.highEstimateCents,
        pricing_confidence: suggestion.confidence,
        pricing_reason_codes: suggestion.workItemKeys,
        pricing_components: suggestion.components as unknown as Json,
        pricing_reference_count: suggestion.referenceCount,
        pricing_rule_version: suggestion.ruleVersion,
        pricing_generated_at: submittedAt,
      })
      .eq("dossier_id", dossierId);
    if (pricingError) throw pricingError;

    console.log(`  · ${demo.label} — ${brief.missionName}`);
  }

  // The ingestion trigger turned each Dossier into a case as it was inserted.
  const { count } = await supabase
    .from("marketplace_cases")
    .select("id", { count: "exact", head: true });
  console.log(`Seeded ${CASES.length} demonstration projects. ${count ?? 0} case(s) in total.`);
  console.log("Every relieur is flagged is_demo and every customer uses @example.com.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
