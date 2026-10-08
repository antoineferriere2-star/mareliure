import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Le bouton « Classer sans suite » ne s'affiche que si la clôture peut aboutir : statut interne,
// aucun atelier sollicité, aucune proposition. Le serveur décide ; la page ne refait pas la règle.
const PAGE = readFileSync("src/marketplace/pages/admin/CaseMatchingPage.tsx", "utf8");
const FUNCTIONS = readFileSync("src/marketplace/services/marketplace.data.functions.ts", "utf8").replace(/\s+/g, " ");

describe("visibilité de « Classer sans suite »", () => {
  it("la page suit l'indicateur serveur, jamais le seul statut", () => {
    expect(PAGE).toContain("{data.closable && <CloseCaseForm caseId={caseId} />}");
    expect(PAGE).not.toContain("isClosableCaseStatus");
  });
  it("le serveur exige statut interne, aucune invitation et aucune proposition", () => {
    expect(FUNCTIONS).toContain('from("marketplace_commercial_proposals") .select("id", { count: "exact", head: true }).eq("case_id", data.caseId)');
    expect(FUNCTIONS).toContain("const closable = isClosableCaseStatus(caseContext.row.status) && !(matches ?? []).length && !(proposals.count ?? 0);");
  });
});
