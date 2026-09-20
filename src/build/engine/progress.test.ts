import { describe, expect, it } from "vitest";
import { bookbindingPlaybookSchema as playbook } from "@/build/playbooks/bookbindingPlaybookSchema";
import type { Answers } from "@/build/schema/answers";
import type { PlaybookField } from "@/build/schema/playbook";
import {
  describeProgress,
  estimateFieldSeconds,
  remainingMinutes,
  resumeStepIndex,
  totalMayStillGrow,
} from "./progress";
import { computeVisibleSteps } from "./validation";

const steps = (answers: Answers) => computeVisibleSteps(playbook, answers);
const progressAt = (answers: Answers, index: number) =>
  describeProgress({ schema: playbook, answers, steps: steps(answers), index });

const REPAIR: Answers = { intention: "reparer" };
const DESIGN: Answers = { intention: "collector" };

describe("describeProgress — the total is only a promise when nothing can move it", () => {
  it("first screen: the path is not known yet, so the total is provisional", () => {
    const progress = progressAt({}, 0);
    // Every step gated on the intention is hidden, and the intention is blank.
    expect(progress.totalIsProvisional).toBe(true);
    expect(progress.position).toBe(1);
    expect(progress.total).toBe(steps({}).length);
  });

  it("once the visitor answers the question that shapes the path, the total is settled", () => {
    expect(progressAt(REPAIR, 1).totalIsProvisional).toBe(false);
    expect(progressAt(DESIGN, 1).totalIsProvisional).toBe(false);
  });

  it("the two paths really do differ — which is exactly why step 1 cannot state a total", () => {
    expect(steps(REPAIR).length).not.toBe(steps(DESIGN).length);
    expect(steps({}).length).toBeLessThan(steps(REPAIR).length);
  });

  it("a step hidden for good does not keep the total provisional because of its own fields", () => {
    // `finitions` is hidden for a repair (decided, not pending) although its
    // "number of ribs" field waits on the still-blank "finishes" answer.
    expect(totalMayStillGrow(playbook, REPAIR, steps(REPAIR))).toBe(false);
  });

  it("position follows the index and never leaves the path", () => {
    const answers = REPAIR;
    const total = steps(answers).length;
    expect(progressAt(answers, 0).position).toBe(1);
    expect(progressAt(answers, total - 1).position).toBe(total);
    expect(progressAt(answers, 999).position).toBe(total);
    expect(progressAt(answers, -3).position).toBe(1);
  });

  it("time left only ever goes down as the visitor advances", () => {
    const total = steps(REPAIR).length;
    let previous = Infinity;
    for (let index = 0; index < total; index++) {
      const { remainingSeconds } = progressAt(REPAIR, index);
      expect(remainingSeconds).toBeLessThan(previous);
      previous = remainingSeconds;
    }
  });

  it("a whole repair intake lands near the five minutes the Mission itself announces", () => {
    // seedBookbindingPlaybook.ts tells visitors "Comptez cinq minutes". The
    // estimate is computed from the shape of the questions; if a Playbook edit
    // moves it far from that, the promise or the weights need a look.
    const minutes = remainingMinutes(progressAt(REPAIR, 0).remainingSeconds);
    expect(minutes).toBeGreaterThanOrEqual(4);
    expect(minutes).toBeLessThanOrEqual(7);
  });

  it("an empty Playbook path has position 0 and nothing left", () => {
    const empty = describeProgress({ schema: { ...playbook, sections: [] }, answers: {}, steps: [], index: 0 });
    expect(empty).toEqual({ position: 0, total: 0, totalIsProvisional: false, remainingSeconds: 0 });
  });
});

describe("estimateFieldSeconds", () => {
  const photo = playbook.sections[0].steps
    .flatMap((step) => step.fields)
    .find((field) => field.key === "photos")!;
  const dimension = playbook.sections[0].steps
    .flatMap((step) => step.fields)
    .find((field) => field.key === "hauteur")!;

  it("a required photo costs more than an optional one, and more than a choice", () => {
    const optionalPhoto = { ...photo, desirability: "optional" } as PlaybookField;
    expect(estimateFieldSeconds(photo)).toBeGreaterThan(estimateFieldSeconds(optionalPhoto));
    const choice = playbook.sections[0].steps[0].fields[0];
    expect(estimateFieldSeconds(photo)).toBeGreaterThan(estimateFieldSeconds(choice));
  });

  it("a field the visitor may leave blank counts for half", () => {
    expect(dimension.desirability).not.toBe("required");
    expect(estimateFieldSeconds(dimension)).toBe(25 * 0.5);
  });
});

describe("remainingMinutes", () => {
  it("says nothing precise under a minute, and rounds up above it", () => {
    expect(remainingMinutes(0)).toBeNull();
    expect(remainingMinutes(59)).toBeNull();
    expect(remainingMinutes(60)).toBe(1);
    expect(remainingMinutes(61)).toBe(2);
    expect(remainingMinutes(300)).toBe(5);
  });
});

describe("resumeStepIndex — where a returning visitor lands", () => {
  const stepIds = (answers: Answers) => steps(answers).map((entry) => entry.step.id);

  it("a session with no answers starts at the beginning", () => {
    expect(resumeStepIndex(steps({}), {})).toBe(0);
  });

  it("lands on the first step that still has a required question", () => {
    const answers: Answers = { ...REPAIR, titre: "Monte-Cristo", nature: "livre_ancien" };
    const index = resumeStepIndex(steps(answers), answers);
    // dimensions is all-optional, so the visitor is not sent back to it.
    expect(stepIds(answers)[index]).toBe("etat");
  });

  it("does not send a visitor back to an optional step they skipped", () => {
    const answers: Answers = { ...REPAIR, titre: "X", nature: "livre_ancien", etat: ["dos_abime"] };
    const landing = stepIds(answers)[resumeStepIndex(steps(answers), answers)];
    expect(["dimensions", "etat"]).not.toContain(landing);
  });

  it("lands on the last step when every required answer is in", () => {
    const answers: Answers = {
      ...REPAIR,
      titre: "X",
      nature: "livre_ancien",
      etat: ["dos_abime"],
      photos: [{ filename: "a.jpg", sizeBytes: 10, mimeType: "image/jpeg", storagePath: "s/a" }],
      valeurRaisons: ["sentimentale"],
      valeurFinanciere: "lt_100",
      budget: "lt_150",
      delai: "pas_urgent",
      name: "Camille",
      email: "c@example.com",
      localisation: { zip: "69003" },
      consentement: true,
    };
    const list = steps(answers);
    const index = resumeStepIndex(list, answers);
    // Either nothing is left (last step) or only the contact step's own
    // remaining question is: never earlier than the contact step.
    expect(list[index].step.id).toBe(list[list.length - 1].step.id);
  });

  it("never returns an index outside the path", () => {
    expect(resumeStepIndex([], {})).toBe(0);
  });
});
