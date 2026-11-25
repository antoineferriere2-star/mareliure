import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WORKSHOP_TRIAL_DAYS, workshopCanCreate, workshopTrial } from "./workshopSubscription";

const NOW = Date.parse("2026-12-01T12:00:00Z");
const base = { legacy_free: false, status: "incomplete", current_period_end: null as string | null };

describe("essai gratuit de 14 jours", () => {
  it("annonce quatorze jours", () => {
    expect(WORKSHOP_TRIAL_DAYS).toBe(14);
  });

  it("compte les jours restants, arrondis au jour supérieur", () => {
    const trial = workshopTrial({ ...base, trial_ends_at: "2026-12-15T12:00:00Z" }, NOW);
    expect(trial).toMatchObject({ applies: true, active: true, daysLeft: 14 });
    expect(workshopTrial({ ...base, trial_ends_at: "2026-12-01T12:30:00Z" }, NOW).daysLeft).toBe(1);
  });

  it("est terminé à la date de fin, sans jour restant", () => {
    expect(workshopTrial({ ...base, trial_ends_at: "2026-12-01T12:00:00Z" }, NOW)).toMatchObject({ applies: true, active: false, daysLeft: 0 });
    expect(workshopTrial({ ...base, trial_ends_at: "2026-11-20T00:00:00Z" }, NOW).active).toBe(false);
  });

  it("ne s'applique pas à un atelier exempté ni sans date ni avec une date illisible", () => {
    expect(workshopTrial({ ...base, legacy_free: true, trial_ends_at: "2026-12-16T12:00:00Z" }, NOW).applies).toBe(false);
    expect(workshopTrial({ ...base, trial_ends_at: null }, NOW).applies).toBe(false);
    expect(workshopTrial({ ...base, trial_ends_at: "n'importe quoi" }, NOW).applies).toBe(false);
  });

  it("autorise la création pendant l'essai, la refuse après quand l'abonnement est ouvert", () => {
    const during = { ...base, trial_ends_at: "2026-12-10T00:00:00Z" };
    const after = { ...base, trial_ends_at: "2026-11-25T00:00:00Z" };
    expect(workshopCanCreate(during, true, NOW)).toBe(true);
    expect(workshopCanCreate(after, true, NOW)).toBe(false);
  });

  it("ne bloque personne tant que l'abonnement payant n'est pas ouvert", () => {
    expect(workshopCanCreate({ ...base, trial_ends_at: "2026-11-25T00:00:00Z" }, false, NOW)).toBe(true);
  });

  it("garde l'accès d'un abonné actif et d'un atelier exempté après la fin de l'essai", () => {
    const ended = "2026-11-25T00:00:00Z";
    expect(workshopCanCreate({ ...base, status: "active", current_period_end: "2027-01-01T00:00:00Z", trial_ends_at: ended }, true, NOW)).toBe(true);
    expect(workshopCanCreate({ ...base, legacy_free: true, trial_ends_at: ended }, true, NOW)).toBe(true);
  });
});

describe("migration de l'essai", () => {
  const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261124100000_workshop_trial_14_days.sql"), "utf8");

  it("ajoute la date de fin et la donne à tout nouvel atelier pour quatorze jours", () => {
    expect(sql).toContain("ADD COLUMN trial_ends_at timestamptz");
    expect(sql).toMatch(/now\(\) \+ interval '14 days'/);
  });

  it("laisse gratuits les ateliers existants sans abonnement Stripe, et eux seuls", () => {
    expect(sql).toMatch(/SET legacy_free = true[\s\S]*stripe_subscription_id IS NULL/);
  });

  it("compte l'essai dans le droit de créer", () => {
    expect(sql).toMatch(/OR s\.trial_ends_at > now\(\)/);
  });
});
