/**
 * Contrat de la migration 20260920110000 (états des événements Stripe, enregistrement atomique du
 * paiement). Le comportement réel des deux fonctions est vérifié sur Postgres lors du contrôle de
 * migration ; ici on fige ce que le code TypeScript suppose d'elles.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260920110000_marketplace_stripe_webhook_states.sql", import.meta.url),
  "utf8",
)
  .split("-- Retour arrière")[0]
  .replace(/--.*$/gm, "");

describe("migration des états d'événements Stripe", () => {
  it("les quatre états, et rien d'autre, sont autorisés", () => {
    expect(sql).toMatch(/CHECK \(status IN \('received', 'processing', 'processed', 'failed'\)\)/);
  });

  it("l'événement existant garde sa reprise : ni traité ni en erreur reste réclamable", () => {
    expect(sql).toMatch(/WHEN processed_at IS NOT NULL THEN 'processed' ELSE 'failed'/);
    expect(sql).toMatch(/WHERE status = 'received'\s+AND attempts = 0/);
  });

  it("le verrou de ligne sérialise deux livraisons du même événement", () => {
    expect(sql).toMatch(/SELECT \* INTO v FROM public\.marketplace_stripe_webhook_events WHERE id = p_id FOR UPDATE/);
  });

  it("seul un événement traité est absorbé ; un échec est repris avec une tentative de plus", () => {
    expect(sql).toMatch(/IF v\.status = 'processed' THEN/);
    expect(sql).toMatch(/attempts = attempts \+ 1/);
  });

  it("un paiement déjà enregistré n'est jamais réécrit", () => {
    expect(sql).toMatch(/DO UPDATE[\s\S]*WHERE p\.paid_at IS NULL/);
    expect(sql).toMatch(/'already_paid_same'/);
    expect(sql).toMatch(/'other_payment'/);
  });

  it("les deux fonctions sont réservées au service_role", () => {
    for (const fn of ["marketplace_claim_webhook_event", "marketplace_mark_proposal_paid"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`));
    }
  });

  it("additive : aucune suppression de table ni de donnée", () => {
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
