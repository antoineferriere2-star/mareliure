/**
 * Ce que le suivi de commande ne doit jamais devenir, vérifié sur le texte.
 *
 * Des garanties qui tiennent à ce que le code ne fait pas : autoriser avant de
 * lire, ne jamais renvoyer la rémunération au client ni le prix client à
 * l'atelier, ne jamais écrire le contenu d'un message dans l'analytics, et une
 * migration additive, fermée, sans montant.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MARKETPLACE_EVENT_TYPES } from "./analytics/events";
import { CASE_STATUSES } from "./cases/state";
import { DECISION_TYPES } from "./project/decisions";
import { SCOPE_REASONS } from "./project/scopeIssues";
import { PROJECT_FILE_MIME_TYPES, UPDATE_TYPES } from "./project/thread";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

const SQL = read("supabase/migrations/20260911120000_project_thread.sql");
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const THREAD_FUNCTIONS = read("src/marketplace/services/projectThread.functions.ts");
const SERVICE = read("src/marketplace/services/marketplace.data.functions.ts");

function serverFunctions(source: string): { name: string; body: string }[] {
  const matches = [...source.matchAll(/export const (\w+) = createServerFn/g)];
  return matches.map((match, index) => ({
    name: match[1],
    body: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

const fn = (source: string, name: string) => {
  const found = serverFunctions(source).find((candidate) => candidate.name === name);
  expect(found, name).toBeDefined();
  return found!.body;
};

describe("les droits du fil", () => {
  it("chaque fonction autorise avant de lire ou d'écrire", () => {
    const functions = serverFunctions(THREAD_FUNCTIONS);
    expect(functions.length).toBeGreaterThanOrEqual(11);
    for (const { name, body } of functions)
      expect(body.includes("authorizeThread(") || body.includes("assertAdmin("), name).toBe(true);
  });

  it("seul le client tranche une décision, seul l'atelier signale un imprévu", () => {
    expect(fn(THREAD_FUNCTIONS, "answerProjectDecision")).toContain('actor.role !== "customer"');
    expect(fn(THREAD_FUNCTIONS, "reportScopeIssue")).toContain('actor.role !== "binder"');
    expect(fn(THREAD_FUNCTIONS, "updateScopeIssue")).toContain("assertAdmin(");
  });

  it("ne sert un fichier que par URL signée, jamais par chemin public", () => {
    const repository = read("src/marketplace/services/projectThreadRepository.server.ts");
    expect(repository).toContain("createSignedUrls(");
    expect(repository).not.toContain("getPublicUrl");
    expect(THREAD_FUNCTIONS).toContain("createSignedUploadUrl(");
  });
});

describe("ce qui ne quitte jamais le serveur", () => {
  it("le client ne reçoit ni la rémunération de l'atelier ni les notes internes", () => {
    for (const name of ["listMyCustomerCases", "getMyCustomerCase"]) {
      const body = fn(SERVICE, name);
      expect(body, name).not.toMatch(/binder_payout|payoutCents|admin_notes/);
    }
  });

  it("l'atelier ne reçoit ni le prix client ni la photographie du prix", () => {
    for (const name of ["listMyBinderCases", "getBinderCase"]) {
      const body = fn(SERVICE, name);
      expect(body, name).not.toMatch(/customer_price|customerPrice|admin_notes/);
      // La photographie ne sert qu'à lister le travail, par `orderedWork`.
      expect(body, name).not.toMatch(/snapshot:|pricing_snapshot,\n/);
    }
  });

  it("les événements du fil ne portent jamais le contenu d'un message", () => {
    const calls = [
      ...THREAD_FUNCTIONS.matchAll(/recordMarketplaceEvent\(sb, \{[\s\S]*?\n\s{6}\}\);/g),
    ];
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const [call] of calls) {
      expect(call).not.toMatch(/\bbody\b|question|description|freeText|free_text/);
    }
  });

  it("l'e-mail ne recopie ni le message ni la question", () => {
    const notifications = read("src/marketplace/services/projectNotifications.server.ts");
    const templateData = notifications.slice(notifications.indexOf("templateData: {"));
    expect(templateData.slice(0, templateData.indexOf("}"))).not.toMatch(/body|question|message/);
  });

  it("déclare tous les événements qu'il écrit", () => {
    const written = [
      ...THREAD_FUNCTIONS.matchAll(/type: "([a-z_]+)"/g),
      ...THREAD_FUNCTIONS.matchAll(/\["([a-z_]+)", "([a-z_]+)"\] as const/g),
      ...STATEMENTS.matchAll(/'([a-z_]+)', jsonb_build_object/g),
    ].flatMap((match) => match.slice(1));
    for (const type of [
      ...written,
      "message_sent",
      "project_update_posted",
      "order_confirmed",
      "book_received",
      "work_started",
      "work_finished",
    ])
      expect(MARKETPLACE_EVENT_TYPES, type).toContain(type);
  });
});

describe("la migration du fil", () => {
  const TABLES = [
    "marketplace_project_messages",
    "marketplace_project_decisions",
    "marketplace_project_files",
    "marketplace_project_reads",
    "marketplace_scope_issues",
  ];

  it("est additive, ne touche aucune politique build_ et ne porte aucun montant", () => {
    expect(STATEMENTS).not.toMatch(/DROP TABLE|DROP COLUMN/);
    expect(STATEMENTS).not.toMatch(/\bbuild_/);
    for (const table of TABLES) {
      const start = STATEMENTS.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`);
      expect(start, table).toBeGreaterThan(-1);
      const definition = STATEMENTS.slice(start, STATEMENTS.indexOf(");", start));
      expect(definition, table).not.toMatch(/_cents|price|amount/);
    }
  });

  it("ferme les cinq tables à anon et authenticated", () => {
    for (const table of TABLES) expect(STATEMENTS).toContain(`'${table}'`);
    expect(STATEMENTS).toContain("ENABLE ROW LEVEL SECURITY");
    expect(STATEMENTS).toContain("FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)");
  });

  it("garde les fichiers dans un bucket privé, borné en taille et en type", () => {
    const bucket = STATEMENTS.slice(STATEMENTS.indexOf("INSERT INTO storage.buckets"));
    const statement = bucket.slice(0, bucket.indexOf(";"));
    expect(statement).toMatch(/'marketplace-project-files',\s+false,\s+10485760/);
    for (const mime of PROJECT_FILE_MIME_TYPES) expect(statement).toContain(`'${mime}'`);
    expect(statement).toContain("public = false");
  });

  it("interdit de réécrire une décision, et de la trancher deux fois", () => {
    expect(STATEMENTS).toContain("BEFORE UPDATE ON public.marketplace_project_decisions");
    expect(STATEMENTS).toContain("IF OLD.status <> 'OPEN' THEN");
    expect(STATEMENTS).toContain("WHERE id = p_decision_id AND status = 'OPEN'");
    expect(STATEMENTS).toMatch(
      /REVOKE ALL ON FUNCTION public\.marketplace_answer_project_decision\([^)]*\)\s+FROM PUBLIC, anon, authenticated/,
    );
  });

  it("connaît exactement les vocabulaires du code", () => {
    const clause = (name: string) => {
      const start = STATEMENTS.indexOf(`${name} CHECK`);
      const rest = STATEMENTS.slice(start);
      return [...rest.slice(0, rest.indexOf("),\n")).matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
    };
    expect(new Set(clause("marketplace_project_decisions_type_check"))).toEqual(
      new Set(DECISION_TYPES),
    );
    expect(new Set(clause("marketplace_scope_issues_reason_check"))).toEqual(
      new Set(SCOPE_REASONS),
    );
    for (const type of UPDATE_TYPES) expect(STATEMENTS).toContain(`'${type}'`);
    const statuses = STATEMENTS.slice(STATEMENTS.indexOf("marketplace_cases_status_check CHECK"));
    const values = [...statuses.slice(0, statuses.indexOf("));")).matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1],
    );
    expect(new Set(values)).toEqual(
      new Set([...CASE_STATUSES, "sent_to_binders", "quotes_received"]),
    );
  });
});
