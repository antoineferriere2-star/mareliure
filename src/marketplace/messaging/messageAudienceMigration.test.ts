/**
 * Contrat de la migration 20260920130000 (audiences des messages). Le comportement réel — reprise des
 * messages existants, déclencheur de transition, contrainte — est vérifié sur Postgres lors du contrôle
 * de migration ; ici on fige ce que le code TypeScript suppose et l'alignement des vocabulaires.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGE_AUDIENCES } from "./audience";

const raw = readFileSync(new URL("../../../supabase/migrations/20260920130000_marketplace_message_audiences.sql", import.meta.url), "utf8");
const sql = raw.split("-- Retour arrière")[0].replace(/--.*$/gm, "");

describe("migration des audiences de messages", () => {
  it("les audiences autorisées en base sont exactement celles du TypeScript", () => {
    const list = /CHECK \(audience IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? "";
    const inSql = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...MESSAGE_AUDIENCES].sort());
  });

  it("additive : la colonne a une valeur par défaut, aucun message n'est supprimé ni réécrit hors Fine Bindery", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'shared'/);
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|DROP TABLE|DROP COLUMN/i);
    expect(sql).toMatch(/c\.brand = 'FINE_BINDERY'\s+AND m\.audience = 'shared'/);
  });

  it("la reprise ne fait que restreindre : atelier → canal atelier, client et plateforme → canal client", () => {
    expect(sql).toMatch(/CASE m\.sender_role WHEN 'binder' THEN 'workshop_platform' ELSE 'customer_concierge' END/);
  });

  it("un déclencheur de transition classe lui-même tout message Fine Bindery inséré sans audience", () => {
    expect(sql).toMatch(/CREATE TRIGGER marketplace_messages_route_audience\s+BEFORE INSERT ON public\.marketplace_messages/);
    expect(sql).toMatch(/NEW\.audience = 'shared'[\s\S]*c\.brand = 'FINE_BINDERY'/);
  });

  it("la stratégie pour les messages existants est documentée dans la migration", () => {
    expect(raw).toMatch(/STRATÉGIE POUR LES MESSAGES EXISTANTS/);
    expect(raw).toMatch(/PENDANT LA TRANSITION/);
  });
});
