import { describe, expect, it } from "vitest";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import { collectFieldSummaries } from "./fieldSummaries";

describe("collectFieldSummaries against the real Deck Playbook", () => {
  it("collects every field with its options, without dropping or duplicating any", () => {
    const summaries = collectFieldSummaries(deckPlaybookSchema);
    const allFieldKeys = deckPlaybookSchema.sections.flatMap((s) => s.steps.flatMap((st) => st.fields.map((f) => f.key)));

    expect(summaries.map((s) => s.key)).toEqual(allFieldKeys);

    const projectType = summaries.find((s) => s.key === "projectType");
    expect(projectType?.options?.map((o) => o.value)).toContain("New deck");

    const email = summaries.find((s) => s.key === "email");
    expect(email?.options).toBeUndefined();
  });

  it("still reports zero publish issues for the real Deck Playbook (editor doesn't corrupt valid data)", () => {
    expect(getPlaybookPublishIssues(deckPlaybookSchema)).toEqual([]);
  });
});
