/**
 * Les règles du suivi de commande qui ne demandent pas de base : coordonnées,
 * décisions, avancement, parcours, non-lus, travail commandé.
 */
import { describe, expect, it } from "vitest";
import { CASE_JOURNEY, visibleJourney } from "../cases/journey";
import { canTransitionCase, isCaseStatus } from "../cases/state";
import { detectContactDetails } from "./contactGuard";
import {
  allowsFreeText,
  buildDecisionOptions,
  decisionOutcome,
  GILDING_CONFIRM_OPTION,
  validateDecisionAnswer,
  validateDecisionRequest,
  type DecisionRequestInput,
  type ProjectDecision,
} from "./decisions";
import {
  binderGroup,
  customerGroup,
  customerStatusText,
  PROGRESS_STEPS,
  progressStep,
  progressStepsFor,
} from "./progress";
import { authorLabel, countUnread, customerActionFor } from "./thread";
import { describeWork, orderedWork } from "./views";

describe("les coordonnées ne passent pas par la conversation", () => {
  it.each([
    ["écrivez-moi à marie.dupont@gmail.com", "email"],
    ["appelez-moi au 06 12 34 56 78", "phone"],
    ["0612345678", "phone"],
    ["06.12.34.56.78 le soir", "phone"],
    ["+33 6 12 34 56 78", "phone"],
    ["0033612345678", "phone"],
    ["on se parle sur WhatsApp ?", "messaging_link"],
    ["https://wa.me/33612345678", "messaging_link"],
  ])("repère « %s »", (text, kind) => {
    expect(detectContactDetails(text)).toContain(kind);
  });

  it.each([
    "Votre livre RL-007 est bien arrivé.",
    "Relié le 10.09.2026, format 245 x 160.",
    "Je propose 3 cahiers à recoudre et 5 nerfs.",
    "Tome 12, édition de 1862.",
    "Préférez-vous ce rouge ou celui-ci ?",
  ])("laisse passer « %s »", (text) => {
    expect(detectContactDetails(text)).toEqual([]);
  });
});

const colorRequest: DecisionRequestInput = {
  decisionType: "COLOR",
  question: "Quelle couleur de cuir préférez-vous ?",
  description: null,
  options: [
    { label: "Bordeaux", description: null },
    { label: "Cognac", description: null },
  ],
  gildingText: null,
  allowFreeText: false,
};

const decision = (overrides: Partial<ProjectDecision> = {}): ProjectDecision => ({
  id: "decision-1",
  caseId: "case-1",
  createdByRole: "binder",
  decisionType: "COLOR",
  question: "Quelle couleur de cuir préférez-vous ?",
  description: null,
  options: buildDecisionOptions(colorRequest),
  gildingText: null,
  allowFreeText: false,
  status: "OPEN",
  selectedOptionId: null,
  freeTextAnswer: null,
  answeredAt: null,
  cancelledAt: null,
  cancelReason: null,
  supersedesDecisionId: null,
  createdAt: "2026-09-10T10:00:00.000Z",
  ...overrides,
});

describe("une décision", () => {
  it("accepte une question à options, et fige ses options avec des identifiants stables", () => {
    expect(validateDecisionRequest(colorRequest)).toEqual([]);
    expect(buildDecisionOptions(colorRequest)).toEqual([
      { id: "option-1", label: "Bordeaux", description: null },
      { id: "option-2", label: "Cognac", description: null },
    ]);
  });

  it("refuse une question vide, des options en double ou une option unique sans réponse libre", () => {
    expect(validateDecisionRequest({ ...colorRequest, question: "?" })).not.toEqual([]);
    expect(
      validateDecisionRequest({
        ...colorRequest,
        options: [
          { label: "Bordeaux", description: null },
          { label: "bordeaux", description: null },
        ],
      }),
    ).not.toEqual([]);
    const single = { ...colorRequest, options: [{ label: "Bordeaux", description: null }] };
    expect(validateDecisionRequest(single)).not.toEqual([]);
    expect(validateDecisionRequest({ ...single, allowFreeText: true })).toEqual([]);
  });

  it("traite le texte à dorer à part : des lignes, une confirmation, toujours une correction possible", () => {
    const gilding: DecisionRequestInput = {
      decisionType: "GILDING_TEXT",
      question: "Confirmez le titrage",
      description: null,
      options: [],
      gildingText: {
        lines: [
          { position: "Titre", text: "LES MISÉRABLES" },
          { position: "Auteur", text: "VICTOR HUGO" },
        ],
      },
      allowFreeText: false,
    };
    expect(validateDecisionRequest(gilding)).toEqual([]);
    expect(buildDecisionOptions(gilding)).toEqual([GILDING_CONFIRM_OPTION]);
    expect(allowsFreeText(gilding)).toBe(true);
    expect(validateDecisionRequest({ ...gilding, gildingText: { lines: [] } })).not.toEqual([]);
    expect(
      validateDecisionRequest({ ...gilding, options: [{ label: "Oui", description: null }] }),
    ).not.toEqual([]);
  });

  it("se tranche une fois, avec une option qui existe", () => {
    expect(validateDecisionAnswer(decision(), { optionId: "option-1", freeText: null })).toEqual(
      [],
    );
    expect(
      validateDecisionAnswer(decision(), { optionId: "option-9", freeText: null }),
    ).not.toEqual([]);
    expect(validateDecisionAnswer(decision(), { optionId: null, freeText: "Vert" })).not.toEqual(
      [],
    );
    expect(
      validateDecisionAnswer(decision({ status: "ANSWERED" }), {
        optionId: "option-2",
        freeText: null,
      }),
    ).toEqual(["Cette décision est déjà tranchée."]);
  });

  it("dit ce qu'elle a retenu", () => {
    expect(decisionOutcome(decision())).toBeNull();
    expect(decisionOutcome(decision({ status: "ANSWERED", selectedOptionId: "option-1" }))).toBe(
      "Bordeaux",
    );
    expect(decisionOutcome(decision({ status: "CANCELLED" }))).toBe("Question retirée");
  });
});

describe("l'avancement", () => {
  it("ne déclare que des passages permis par la machine à états", () => {
    for (const step of PROGRESS_STEPS)
      for (const from of step.from)
        expect(canTransitionCase(from, step.to), `${from} → ${step.to}`).toBe(true);
  });

  it("réserve la confirmation de commande à Ma Reliure, et le travail à l'atelier", () => {
    expect(progressStep("binder", "binder_selected", "paid")).toBeNull();
    expect(progressStep("admin", "binder_selected", "paid")?.event).toBe("order_confirmed");
    expect(progressStep("admin", "paid", "received_by_binder")).toBeNull();
    expect(progressStep("binder", "paid", "received_by_binder")?.event).toBe("book_received");
    expect(progressStepsFor("binder", "in_progress").map((step) => step.to)).toEqual([
      "work_finished",
    ]);
  });

  it("refuse un saut d'étape", () => {
    expect(progressStep("binder", "paid", "work_finished")).toBeNull();
    expect(progressStep("binder", "received_by_binder", "work_finished")).toBeNull();
  });

  it("annonce un livre terminé sans promettre d'expédition", () => {
    expect(isCaseStatus("work_finished")).toBe(true);
    expect(customerStatusText("work_finished")).toEqual({
      headline: "Votre livre est terminé",
      detail: "Nous préparons son retour.",
    });
    expect(canTransitionCase("in_progress", "shipping_to_customer")).toBe(false);
  });

  it("range l'action attendue avant tout, et une offre close à part", () => {
    expect(customerGroup("in_progress", true)).toBe("action");
    expect(customerGroup("pricing", false)).toBe("study");
    expect(customerGroup("completed", true)).toBe("done");
    expect(binderGroup({ offerState: "declined", caseStatus: "matching", openDecisions: 0 })).toBe(
      "closed",
    );
    expect(
      binderGroup({ offerState: "selected", caseStatus: "in_progress", openDecisions: 1 }),
    ).toBe("waiting_customer");
  });
});

describe("le parcours du client", () => {
  it("ne montre jamais une étape qui n'existe pas", () => {
    expect(CASE_JOURNEY.filter((stage) => !stage.available).map((stage) => stage.id)).toEqual([
      "travel",
      "return",
      "delivered",
    ]);
    expect(visibleJourney("in_progress").map((stage) => stage.id)).toEqual([
      "project",
      "estimate",
      "workshop",
      "order",
      "received",
      "work",
      "finished",
    ]);
  });

  it("marque fait, en cours et à venir — sans pourcentage", () => {
    expect(visibleJourney("in_progress").map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "current",
      "upcoming",
    ]);
    expect(visibleJourney("work_finished").find((stage) => stage.id === "finished")?.state).toBe(
      "current",
    );
    expect(visibleJourney("quotes_received").every((stage) => stage.state === "upcoming")).toBe(
      true,
    );
  });
});

describe("le fil", () => {
  it("nomme chacun sans jamais l'exposer", () => {
    const base = {
      authorUserId: "u-binder",
      viewerUserId: "u-customer",
      binderName: "Atelier Martin",
    };
    expect(authorLabel({ ...base, authorRole: "binder" })).toBe("Atelier Martin");
    expect(authorLabel({ ...base, authorRole: "admin", authorUserId: "u-admin" })).toBe(
      "Ma Reliure",
    );
    expect(authorLabel({ ...base, authorRole: "customer", authorUserId: "u-customer" })).toBe(
      "Vous",
    );
    expect(
      authorLabel({
        ...base,
        authorRole: "customer",
        authorUserId: "u-customer",
        viewerUserId: "u-binder",
      }),
    ).toBe("Client");
  });

  it("compte les messages d'autrui, non retirés, arrivés après la dernière lecture", () => {
    const items = [
      { authorUserId: "u-binder", createdAt: "2026-09-10T09:00:00Z", deleted: false },
      { authorUserId: "u-binder", createdAt: "2026-09-10T11:00:00Z", deleted: false },
      { authorUserId: "u-binder", createdAt: "2026-09-10T12:00:00Z", deleted: true },
      { authorUserId: "u-customer", createdAt: "2026-09-10T13:00:00Z", deleted: false },
    ];
    expect(countUnread(items, "u-customer", null)).toBe(2);
    expect(countUnread(items, "u-customer", "2026-09-10T10:00:00Z")).toBe(1);
  });

  it("met en avant la plus ancienne question ouverte", () => {
    const action = customerActionFor([
      {
        id: "d2",
        status: "OPEN",
        question: "Quel papier ?",
        createdAt: "2026-09-10T12:00:00Z",
        createdByRole: "binder",
      },
      {
        id: "d1",
        status: "OPEN",
        question: "Quel cuir ?",
        createdAt: "2026-09-10T10:00:00Z",
        createdByRole: "binder",
      },
      {
        id: "d0",
        status: "ANSWERED",
        question: "Quel titre ?",
        createdAt: "2026-09-09T10:00:00Z",
        createdByRole: "binder",
      },
    ]);
    expect(action?.decisionId).toBe("d1");
    expect(action?.title).toBe("Votre réponse est attendue");
    expect(customerActionFor([])).toBeNull();
  });
});

describe("le travail commandé", () => {
  it("vient de la photographie validée, et ne porte aucun montant", () => {
    const lines = orderedWork(
      {
        operations: [
          {
            workItemKey: "demi_cuir",
            label: "Demi-cuir",
            quantity: 1,
            mode: "FIXED",
            unitLabel: null,
            entryId: "e",
            entryVersion: 1,
            unitPayoutCents: 30_000,
            unitPriceHtCents: 40_000,
            payoutCents: 30_000,
            priceHtCents: 40_000,
            includedIn: null,
            modifiers: [],
          },
          {
            workItemKey: "dorure_fleurons",
            label: "Fleurons",
            quantity: 4,
            mode: "PER_UNIT",
            unitLabel: "par fleuron",
            entryId: "f",
            entryVersion: 1,
            unitPayoutCents: 450,
            unitPriceHtCents: 600,
            payoutCents: 1_800,
            priceHtCents: 2_400,
            includedIn: null,
            modifiers: [],
          },
        ],
      },
      ["pleine_toile"],
    );
    expect(lines).toEqual([
      { label: "Demi-cuir", quantity: 1 },
      { label: "Fleurons", quantity: 4 },
    ]);
    expect(describeWork(lines)).toBe("Demi-cuir · Fleurons × 4");
    expect(orderedWork(null, ["demi_cuir"])).toEqual([{ label: "Demi-cuir", quantity: 1 }]);
  });
});
