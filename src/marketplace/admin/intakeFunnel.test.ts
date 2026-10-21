import { describe, expect, it } from "vitest";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";
import { buildIntakeFunnel, type IntakeSessionFacts } from "./intakeFunnel";

const session = (brand: IntakeSessionFacts["brand"], keys: string[], submitted = false, created_at = "2026-10-20T10:00:00.000Z"): IntakeSessionFacts =>
  ({ brand, keys, submitted, created_at });

const sessions = [
  session("MA_RELIURE", []),
  session("MA_RELIURE", ["_submission_locale"]),
  session("MA_RELIURE", ["intention"]),
  session("MA_RELIURE", ["intention", "titre", "etat"]),
  session("MA_RELIURE", ["intention", "titre"], true),
  session("FINE_BINDERY", [], false),
  session("FINE_BINDERY", ["intention", "budget"]),
  session("MA_RELIURE", ["intention"], false, "2026-09-01T10:00:00.000Z"),
];

describe("parcours « Présenter mon livre » au pilotage", () => {
  it("compte ouvertes, commencées et envoyées ; une clé hors Playbook n'est pas une réponse", () => {
    const funnel = buildIntakeFunnel(sessions, bookbindingPlaybookSchema, { brand: "MA_RELIURE", since: "2026-10-01T00:00:00.000Z" });
    expect(funnel).toMatchObject({ opened: 5, answeredFirst: 3, submitted: 1 });
  });

  it("donne, étape par étape, les arrivées et les arrêts ; une session envoyée va au bout", () => {
    const funnel = buildIntakeFunnel(sessions, bookbindingPlaybookSchema, { brand: "MA_RELIURE", since: "2026-10-01T00:00:00.000Z" });
    const steps = bookbindingPlaybookSchema.sections.flatMap((s) => s.steps);
    expect(funnel.steps.map((s) => s.id)).toEqual(steps.map((s) => s.id));
    expect(funnel.steps[0]).toMatchObject({ id: "intention", reached: 3, stoppedHere: 1 });
    const etat = funnel.steps.find((s) => s.id === "etat")!;
    expect(etat.stoppedHere).toBe(1);
    expect(funnel.steps.at(-1)).toMatchObject({ reached: 1, stoppedHere: 0 });
    expect(funnel.steps.reduce((total, s) => total + s.stoppedHere, 0) + funnel.submitted).toBe(funnel.answeredFirst);
  });

  it("filtre par marque et par période", () => {
    expect(buildIntakeFunnel(sessions, bookbindingPlaybookSchema, { brand: "FINE_BINDERY", since: null })).toMatchObject({ opened: 2, answeredFirst: 1, submitted: 0 });
    expect(buildIntakeFunnel(sessions, bookbindingPlaybookSchema, { brand: "ALL", since: null }).opened).toBe(8);
  });
  it("ne compte jamais les sessions des navigateurs de l'équipe", () => {
    const withInternal = [...sessions, { ...session("MA_RELIURE", ["intention"], true), internal: true }];
    expect(buildIntakeFunnel(withInternal, bookbindingPlaybookSchema, { brand: "ALL", since: null })).toMatchObject({ opened: 8, submitted: 1 });
  });
});
