/**
 * L'acceptation d'une proposition par son client — le comportement réel de
 * `acceptProposalForCustomer` et de `loadCustomerCommerce`, contre un dépôt de
 * propositions en mémoire. Seuls les accès à la base sont remplacés ; les règles
 * (`customerAcceptance`, `checkoutEligibility`, `canViewCase`) sont les vraies.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  caseId: string;
  version: number;
  brand: string;
  status: string;
  acceptedAt: string | null;
  supersededAt: string | null;
  taxPolicy: string;
  taxValidatedAt: string | null;
  customerType: string;
  businessName: string | null;
  // La vue client
  currency: string;
  pricingMode: string;
  customerServicePriceCents: number;
  shippingTotalCents: number;
  customerTotalHtCents: number;
  customerVatRateBps: number | null;
  customerVatAmountCents: number | null;
  customerTotalTtcCents: number | null;
  depositType: string;
  depositAmountCents: number;
  estimateMinCents: number | null;
  estimateMaxCents: number | null;
  createdAt: string;
  // Ce qu'un client ne doit jamais recevoir
  binderPayoutCents: number;
  marginFloorCents: number;
  contributionFloorCents: number;
  pricebookProvenance: unknown;
  notes: string | null;
}

const store = vi.hoisted(() => ({
  proposals: [] as Row[],
  caseRow: null as null | {
    row: { pricing_status: string; status: string; customer_price_cents: number | null };
    customerUserId: string | null;
    invitedBinderIds: string[];
    selectedBinderId: string | null;
  },
  paidAt: null as string | null,
  acceptShouldThrow: null as null | Error,
  calls: { accept: 0, byId: 0, accepted: 0, latest: 0, case: 0 },
}));

vi.mock("@/marketplace/services/caseRepository.server", () => ({
  loadCaseContext: vi.fn(async () => {
    store.calls.case += 1;
    return store.caseRow;
  }),
}));
vi.mock("@/marketplace/services/commercialPaymentRepository.server", () => ({
  loadCommercialPaymentState: vi.fn(async () => (store.paidAt ? { paidAt: store.paidAt } : null)),
}));
vi.mock("@/marketplace/services/commercialProposalRepository.server", () => ({
  loadAcceptedCommercialProposal: vi.fn(async (_sb: unknown, caseId: string) => {
    store.calls.accepted += 1;
    return store.proposals.find((p) => p.caseId === caseId && p.acceptedAt) ?? null;
  }),
  loadCommercialProposalById: vi.fn(async (_sb: unknown, id: string) => {
    store.calls.byId += 1;
    return store.proposals.find((p) => p.id === id) ?? null;
  }),
  loadLatestCommercialProposal: vi.fn(async (_sb: unknown, caseId: string) => {
    store.calls.latest += 1;
    return (
      [...store.proposals].filter((p) => p.caseId === caseId).sort((a, b) => b.version - a.version)[0] ?? null
    );
  }),
  acceptCommercialProposal: vi.fn(async (_sb: unknown, id: string) => {
    store.calls.accept += 1;
    if (store.acceptShouldThrow) throw store.acceptShouldThrow;
    const row = store.proposals.find((p) => p.id === id);
    if (!row) throw new Error("proposal_not_found");
    if (row.acceptedAt) throw new Error("proposal_already_accepted");
    row.status = "accepted";
    row.acceptedAt = "2026-09-19T10:00:00.000Z";
    return row;
  }),
}));

const { acceptProposalForCustomer, acceptProposalInput, CustomerAcceptanceError } = await import(
  "./customerProposalAcceptance.server"
);
const { loadCustomerCommerce } = await import("./customerCommerce.server");

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CASE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CASE = "99999999-9999-4999-8999-999999999999";
const P1 = "22222222-2222-4222-8222-222222222221";
const P2 = "22222222-2222-4222-8222-222222222222";

const FORBIDDEN =
  /binderPayout|margin|contribution|pricebook|multiplier|floor|notes|internal|difficile|22000|9000|8000/i;

function proposal(over: Partial<Row> = {}): Row {
  return {
    id: P1,
    caseId: CASE_ID,
    version: 1,
    brand: "MA_RELIURE",
    status: "proposed",
    acceptedAt: null,
    supersededAt: null,
    taxPolicy: "FRANCE_STANDARD_VAT",
    taxValidatedAt: "2026-09-18T09:00:00.000Z",
    customerType: "CUSTOMER",
    businessName: null,
    currency: "EUR",
    pricingMode: "FIXED_PRICE",
    customerServicePriceCents: 37500,
    shippingTotalCents: 0,
    customerTotalHtCents: 37500,
    customerVatRateBps: 2000,
    customerVatAmountCents: 7500,
    customerTotalTtcCents: 45000,
    depositType: "NONE",
    depositAmountCents: 0,
    estimateMinCents: null,
    estimateMaxCents: null,
    createdAt: "2026-09-13T09:00:00.000Z",
    binderPayoutCents: 22000,
    marginFloorCents: 9000,
    contributionFloorCents: 8000,
    pricebookProvenance: [{ entryId: "x" }],
    notes: "note interne : client difficile",
    ...over,
  };
}

/** Un faux client Supabase qui n'enregistre que les événements écrits. */
function fakeSb() {
  const events: Record<string, unknown>[] = [];
  return {
    events,
    sb: {
      from: (table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          if (table === "marketplace_events") events.push(row);
          return { error: null };
        },
      }),
    } as never,
  };
}

const owner = (over: Partial<{ caseId: string; proposalId: string; userId: string }> = {}) => ({
  caseId: CASE_ID,
  proposalId: P1,
  userId: OWNER,
  ...over,
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CustomerAcceptanceError) return error.code;
    throw error;
  }
  return "no error";
}

beforeEach(() => {
  store.proposals = [proposal()];
  store.caseRow = {
    row: { pricing_status: "validated", status: "matching", customer_price_cents: 37500 },
    customerUserId: OWNER,
    invitedBinderIds: [],
    selectedBinderId: null,
  };
  store.paidAt = null;
  store.acceptShouldThrow = null;
  store.calls = { accept: 0, byId: 0, accepted: 0, latest: 0, case: 0 };
});

describe("le propriétaire accepte sa proposition", () => {
  it("écrit l'acceptation une fois, avec un horodatage, et trace l'événement", async () => {
    const { sb, events } = fakeSb();
    const result = await acceptProposalForCustomer(sb, owner());

    expect(result.outcome).toBe("accepted");
    expect(store.calls.accept).toBe(1);
    expect(store.proposals[0].status).toBe("accepted");
    expect(store.proposals[0].acceptedAt).toBe("2026-09-19T10:00:00.000Z");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      case_id: CASE_ID,
      actor_user_id: OWNER,
      event_type: "commercial_proposal_accepted",
      metadata: { proposal_id: P1, version: 1, accepted_by: "customer" },
    });
  });

  it("RECALCULE la possibilité de payer après l'acceptation (checkoutEligibility), sans la supposer", async () => {
    const { sb } = fakeSb();
    const before = await loadCustomerCommerce(sb, CASE_ID, { priceValidated: true, customerPriceCents: 37500, caseStatus: "matching" });
    expect(before).toMatchObject({ canAccept: true, proposalAccepted: false, paymentEligible: false });

    const result = await acceptProposalForCustomer(sb, owner());
    expect(result.commerce).toMatchObject({ canAccept: false, proposalAccepted: true, paymentEligible: true, paidAt: null });
    expect(result.commerce.proposal?.confirmedAt).toBe("2026-09-19T10:00:00.000Z");
  });

  it("ne rend jamais payable une proposition dont la fiscalité a été reprise en revue après coup", async () => {
    const { sb } = fakeSb();
    await acceptProposalForCustomer(sb, owner());
    // L'immuabilité est garantie en base ; côté lecture, un état non payable reste non payable.
    store.proposals[0].taxPolicy = "MANUAL_TAX_REVIEW";
    store.proposals[0].taxValidatedAt = null;
    const commerce = await loadCustomerCommerce(sb, CASE_ID, { priceValidated: true, customerPriceCents: 37500, caseStatus: "matching" });
    expect(commerce.paymentEligible).toBe(false);
  });

  it("ne renvoie au client ni rémunération, ni marge, ni règle, ni note", async () => {
    const { sb } = fakeSb();
    const result = await acceptProposalForCustomer(sb, owner());
    const serialised = JSON.stringify(result);
    expect(serialised).not.toMatch(FORBIDDEN);
    // Ce que le client peut lire : la ventilation client, et son identifiant de proposition.
    expect(result.commerce.proposal).toMatchObject({ id: P1, serviceCents: 37500, totalTtcCents: 45000, vatCents: 7500 });
  });

  it("un dossier payé n'est plus payable, même après une seconde lecture", async () => {
    const { sb } = fakeSb();
    await acceptProposalForCustomer(sb, owner());
    store.paidAt = "2026-09-20T08:00:00.000Z";
    const commerce = await loadCustomerCommerce(sb, CASE_ID, { priceValidated: true, customerPriceCents: 37500, caseStatus: "paid" });
    expect(commerce).toMatchObject({ paymentEligible: false, paidAt: "2026-09-20T08:00:00.000Z", proposalAccepted: true });
  });
});

describe("idempotence", () => {
  it("une seconde acceptation de la même proposition réussit sans rien réécrire", async () => {
    const { sb, events } = fakeSb();
    const first = await acceptProposalForCustomer(sb, owner());
    const second = await acceptProposalForCustomer(sb, owner());

    expect(first.outcome).toBe("accepted");
    expect(second.outcome).toBe("already_accepted");
    expect(second.commerce.paymentEligible).toBe(true);
    expect(store.calls.accept).toBe(1);
    expect(events).toHaveLength(1);
    expect(store.proposals[0].acceptedAt).toBe("2026-09-19T10:00:00.000Z");
  });

  it("deux onglets en course : si l'écriture perd mais que la même proposition est acceptée, c'est un succès sans événement", async () => {
    const { sb, events } = fakeSb();
    // On simule précisément l'instant de la course : la lecture initiale voit « pas encore
    // acceptée », l'écriture échoue, et la relecture trouve la proposition acceptée.
    const accepted = { ...store.proposals[0], status: "accepted", acceptedAt: "2026-09-19T09:59:59.000Z" };
    const repo = await import("@/marketplace/services/commercialProposalRepository.server");
    const acceptedReader = vi.mocked(repo.loadAcceptedCommercialProposal);
    // 1re lecture : rien d'accepté ; relecture après l'échec d'écriture, puis lecture
    // de l'état final pour le client : la proposition est acceptée. Valeurs « Once » :
    // rien ne fuit vers les tests suivants.
    acceptedReader
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(accepted as never)
      .mockResolvedValueOnce(accepted as never);
    store.acceptShouldThrow = new Error("PGRST116");

    const result = await acceptProposalForCustomer(sb, owner());
    expect(result.outcome).toBe("already_accepted");
    expect(events).toHaveLength(0);
  });

  it("si l'écriture échoue et que rien n'est accepté, c'est une erreur — sans événement", async () => {
    const { sb, events } = fakeSb();
    store.acceptShouldThrow = new Error("connection reset");
    expect(await codeOf(acceptProposalForCustomer(sb, owner()))).toBe("accept_failed");
    expect(events).toHaveLength(0);
  });
});

describe("accès : le propriétaire du dossier, et personne d'autre", () => {
  it("un autre compte est refusé avant toute lecture de proposition, sans aucune écriture", async () => {
    const { sb, events } = fakeSb();
    expect(await codeOf(acceptProposalForCustomer(sb, owner({ userId: STRANGER })))).toBe("forbidden");
    expect(store.calls.accept).toBe(0);
    expect(store.calls.byId + store.calls.accepted + store.calls.latest).toBe(0);
    expect(events).toHaveLength(0);
    expect(store.proposals[0].acceptedAt).toBeNull();
  });

  it("un dossier que personne n'a rattaché ne peut pas être accepté", async () => {
    const { sb } = fakeSb();
    store.caseRow!.customerUserId = null;
    expect(await codeOf(acceptProposalForCustomer(sb, owner()))).toBe("forbidden");
    expect(store.calls.accept).toBe(0);
  });

  it("un atelier invité n'est pas le client : refusé", async () => {
    const { sb } = fakeSb();
    store.caseRow!.invitedBinderIds = [STRANGER];
    store.caseRow!.selectedBinderId = STRANGER;
    expect(await codeOf(acceptProposalForCustomer(sb, owner({ userId: STRANGER })))).toBe("forbidden");
    expect(store.calls.accept).toBe(0);
  });

  it("un dossier inconnu est refusé", async () => {
    const { sb } = fakeSb();
    store.caseRow = null;
    expect(await codeOf(acceptProposalForCustomer(sb, owner()))).toBe("case_not_found");
  });
});

describe("le client n'accepte que ce qu'il a vu, et que ce qui est acceptable", () => {
  it("une proposition révisée entre-temps est refusée : le client relit la nouvelle version", async () => {
    const { sb, events } = fakeSb();
    store.proposals = [proposal({ status: "superseded", supersededAt: "2026-09-19T08:00:00.000Z" }), proposal({ id: P2, version: 2, customerServicePriceCents: 99900, customerTotalHtCents: 99900, customerVatAmountCents: 19980, customerTotalTtcCents: 119880 })];
    expect(await codeOf(acceptProposalForCustomer(sb, owner({ proposalId: P1 })))).toBe("proposal_changed");
    expect(store.calls.accept).toBe(0);
    expect(events).toHaveLength(0);
    // La nouvelle version, elle, est acceptable : le prix du dossier a été re-validé à 999 €.
    store.caseRow!.row.customer_price_cents = 99900;
    expect((await acceptProposalForCustomer(sb, owner({ proposalId: P2 }))).outcome).toBe("accepted");
  });

  it("une proposition d'un autre dossier reçoit la réponse d'une proposition inexistante", async () => {
    const { sb } = fakeSb();
    store.proposals = [proposal({ caseId: OTHER_CASE })];
    expect(await codeOf(acceptProposalForCustomer(sb, owner()))).toBe("proposal_not_found");
    expect(await codeOf(acceptProposalForCustomer(sb, owner({ proposalId: P2 })))).toBe("proposal_not_found");
    expect(store.calls.accept).toBe(0);
  });

  it("une autre proposition est déjà acceptée : la demande n'est plus la bonne", async () => {
    const { sb } = fakeSb();
    store.proposals = [
      proposal({ status: "accepted", acceptedAt: "2026-09-15T08:00:00.000Z" }),
      proposal({ id: P2, version: 2 }),
    ];
    expect(await codeOf(acceptProposalForCustomer(sb, owner({ proposalId: P2 })))).toBe("proposal_changed");
    expect(store.calls.accept).toBe(0);
  });

  const refused: [string, Partial<Row>, Partial<{ pricing_status: string; status: string; customer_price_cents: number | null }>][] = [
    ["une proposition en préparation (draft)", { status: "draft" }, {}],
    ["une proposition retirée (cancelled)", { status: "cancelled" }, {}],
    ["une proposition remplacée (superseded)", { status: "superseded", supersededAt: "2026-09-19T08:00:00.000Z" }, {}],
    ["une fiscalité pas encore validée", { taxPolicy: "MANUAL_TAX_REVIEW", taxValidatedAt: null }, {}],
    ["une fiscalité étiquetée validée sans date de validation", { taxValidatedAt: null }, {}],
    ["un client professionnel sans raison sociale", { customerType: "BUSINESS", businessName: null }, {}],
    ["un prix que personne n'a validé", {}, { pricing_status: "suggested" }],
    ["un prix re-validé depuis la création de la proposition (proposition périmée)", {}, { customer_price_cents: 40000 }],
    ["un projet annulé", {}, { status: "cancelled" }],
    ["un projet terminé", {}, { status: "completed" }],
  ];
  for (const [label, rowOver, caseOver] of refused) {
    it(`refuse ${label}`, async () => {
      const { sb, events } = fakeSb();
      store.proposals = [proposal(rowOver)];
      store.caseRow!.row = { ...store.caseRow!.row, ...caseOver };
      expect(await codeOf(acceptProposalForCustomer(sb, owner()))).toBe("not_acceptable");
      expect(store.calls.accept).toBe(0);
      expect(events).toHaveLength(0);
      expect(store.proposals[0].acceptedAt).toBeNull();
    });
  }

  it("accepte un client professionnel dont l'identité est complète", async () => {
    const { sb } = fakeSb();
    store.proposals = [proposal({ customerType: "BUSINESS", businessName: "Atelier Test SARL" })];
    const result = await acceptProposalForCustomer(sb, owner());
    expect(result.outcome).toBe("accepted");
    expect(result.commerce.paymentEligible).toBe(true);
  });
});

describe("ce que le client voit d'une proposition avant de l'accepter", () => {
  const facts = { priceValidated: true, customerPriceCents: 37500, caseStatus: "matching" };

  it("la proposition acceptable est présentée, sans être payable", async () => {
    const { sb } = fakeSb();
    const commerce = await loadCustomerCommerce(sb, CASE_ID, facts);
    expect(commerce).toMatchObject({ canAccept: true, proposalAccepted: false, paymentEligible: false, paidAt: null });
    expect(commerce.proposal).toMatchObject({ id: P1, confirmedAt: null, totalTtcCents: 45000 });
    expect(JSON.stringify(commerce)).not.toMatch(FORBIDDEN);
  });

  it("une proposition en préparation n'existe pas encore pour le client", async () => {
    const { sb } = fakeSb();
    for (const over of [{ status: "draft" }, { taxValidatedAt: null, taxPolicy: "MANUAL_TAX_REVIEW" }] as Partial<Row>[]) {
      store.proposals = [proposal(over)];
      expect(await loadCustomerCommerce(sb, CASE_ID, facts)).toMatchObject({ proposal: null, canAccept: false });
    }
    store.proposals = [proposal()];
    expect(await loadCustomerCommerce(sb, CASE_ID, { priceValidated: false, customerPriceCents: 37500, caseStatus: "matching" })).toMatchObject({
      proposal: null,
      canAccept: false,
    });
  });

  it("seule la dernière version est présentée", async () => {
    const { sb } = fakeSb();
    store.proposals = [proposal({ status: "superseded", supersededAt: "2026-09-19T08:00:00.000Z" }), proposal({ id: P2, version: 2, customerServicePriceCents: 42500, customerTotalHtCents: 42500, customerVatAmountCents: 8500, customerTotalTtcCents: 51000 })];
    const commerce = await loadCustomerCommerce(sb, CASE_ID, { ...facts, customerPriceCents: 42500 });
    expect(commerce.proposal?.id).toBe(P2);
    expect(commerce.proposal?.totalTtcCents).toBe(51000);
  });

  it("une proposition acceptée n'est jamais remplacée par une version plus récente", async () => {
    const { sb } = fakeSb();
    store.proposals = [proposal({ status: "accepted", acceptedAt: "2026-09-15T08:00:00.000Z" }), proposal({ id: P2, version: 2, customerTotalTtcCents: 99999 })];
    const commerce = await loadCustomerCommerce(sb, CASE_ID, facts);
    expect(commerce.proposal?.id).toBe(P1);
    expect(commerce.proposal?.totalTtcCents).toBe(45000);
    expect(commerce).toMatchObject({ canAccept: false, proposalAccepted: true });
  });

  it("aucune proposition : rien à montrer ni à accepter", async () => {
    const { sb } = fakeSb();
    store.proposals = [];
    expect(await loadCustomerCommerce(sb, CASE_ID, facts)).toMatchObject({ proposal: null, canAccept: false, paymentEligible: false });
  });
});

describe("le contrat : deux identifiants, jamais un montant", () => {
  it("l'entrée est exactement { caseId, proposalId } — et refuse tout champ en plus", () => {
    expect(Object.keys(acceptProposalInput.shape).sort()).toEqual(["caseId", "proposalId"]);
    expect(acceptProposalInput.safeParse({ caseId: CASE_ID, proposalId: P1 }).success).toBe(true);
    for (const extra of ["amountCents", "totalCents", "price", "status", "taxRate", "binderPayoutCents"]) {
      expect(acceptProposalInput.safeParse({ caseId: CASE_ID, proposalId: P1, [extra]: 1 }).success, extra).toBe(false);
    }
    expect(acceptProposalInput.safeParse({ caseId: "not-a-uuid", proposalId: P1 }).success).toBe(false);
    expect(acceptProposalInput.safeParse({ caseId: CASE_ID }).success).toBe(false);
  });

  const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const service = stripComments(
    readFileSync(resolve(process.cwd(), "src/marketplace/services/customerProposalAcceptance.server.ts"), "utf8"),
  );
  const wrapper = stripComments(
    readFileSync(resolve(process.cwd(), "src/marketplace/services/customerProposalAcceptance.data.functions.ts"), "utf8"),
  );

  it("le service ne lit jamais un montant, une taxe ou un statut dans l'entrée du navigateur", () => {
    expect(service).not.toMatch(/input\.(amount|price|total|cents|status|tax|vat)/i);
    expect(service).not.toMatch(/data\.(amount|price|total|cents|status|tax|vat)/i);
  });

  it("le serveur recharge : dossier, propriétaire, proposition, dernière version, règle — puis écrit", () => {
    const order = ["loadCaseContext(", "canViewCase(", "loadAcceptedCommercialProposal(", "loadCommercialProposalById(", "loadLatestCommercialProposal(", "customerAcceptance(", "acceptCommercialProposal("];
    let last = -1;
    for (const marker of order) {
      const at = service.indexOf(marker, last + 1);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });

  it("n'écrit aucune ligne de proposition lui-même : il délègue à la même écriture que l'admin", () => {
    expect(service).not.toMatch(/\.update\(|\.upsert\(|\.delete\(/);
    expect(service).toContain("acceptCommercialProposal(sb, proposal.id)");
  });

  it("l'action est authentifiée, valide son entrée, et ne renvoie que deux faits", () => {
    expect(wrapper).toContain("requireSupabaseAuth");
    expect(wrapper).toContain("acceptProposalInput.parse(data)");
    expect(wrapper).toContain("userId: context.userId");
    expect(wrapper).toMatch(/return \{ outcome: result\.outcome, paymentEligible: result\.commerce\.paymentEligible \}/);
    expect(wrapper).not.toMatch(/commerce\.proposal|binder|margin|payout/i);
  });

  it("ne touche ni Stripe, ni le prix, ni la fiscalité", () => {
    for (const source of [service, wrapper]) {
      expect(source).not.toMatch(/stripe|pricing\.engine|pricebook|recomputeProposalTax|updateProposalTaxValidation|applyAutomaticFranceTax/i);
    }
  });
});
