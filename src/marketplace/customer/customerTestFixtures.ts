/**
 * Données synthétiques (aucun dossier réel) dans la forme renvoyée par
 * listMyCustomerCases / getMyCustomerCase / listCaseMessages / listCaseDecisions.
 * Partagées par les tests de rendu et par le harnais de QA local, pour que ce
 * que l'on teste soit exactement ce que l'on regarde.
 *
 * Scénarios : A projet sans prix · B plusieurs projets · C proposition présentée,
 * le client peut l'accepter · D proposition acceptée, paiement pas encore
 * possible · E acceptée, paiement possible · F payé · G atelier sélectionné +
 * décision en attente · H terminé · I prix validé, proposition pas encore
 * présentée · empty : aucun projet.
 *
 * Les fils de messages respectent le contrat serveur : un client Fine Bindery ne
 * reçoit jamais un message d'atelier.
 */
export type Brand = "MA_RELIURE" | "FINE_BINDERY";
const fr = (b: Brand) => b === "MA_RELIURE";

const PHOTOS = ["/photos/ferriere-baudelaire-480.webp", "/photos/academie-avant-480.webp", "/photos/academie-apres-480.webp"];

export const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";

function proposal(scenario: string) {
  if (["A", "I"].includes(scenario)) return null;
  const withTax = scenario !== "D";
  return {
    id: PROPOSAL_ID,
    pricingMode: "FIXED_PRICE" as const,
    currency: "EUR",
    serviceCents: 37500,
    // C et E : la même proposition avant et après acceptation — le total ne change pas.
    shippingCents: ["C", "E"].includes(scenario) ? 2400 : 0,
    totalHtCents: 37500 + (["C", "E"].includes(scenario) ? 2400 : 0),
    vatRateBps: withTax ? 2000 : null,
    vatCents: withTax ? (["C", "E"].includes(scenario) ? 7980 : 7500) : null,
    totalTtcCents: withTax ? (["C", "E"].includes(scenario) ? 47880 : 45000) : null,
    estimateMinCents: null,
    estimateMaxCents: null,
    preparedAt: "2026-09-13T09:00:00Z",
    // C : proposée, pas encore acceptée par le client.
    confirmedAt: scenario === "C" ? null : "2026-09-14T10:00:00Z",
  };
}

const STATUS: Record<string, string> = { A: "pricing", I: "matching", C: "matching", D: "matching", E: "matching", F: "paid", G: "binder_selected", H: "completed" };

export function listFixture(brand: Brand, scenario: string) {
  const F = fr(brand);
  const row = (over: Record<string, unknown>) => ({
    id: "11111111-1111-4111-8111-111111111111",
    status: "pricing",
    createdAt: "2026-09-12T09:30:00Z",
    title: F ? "Le Comte de Monte-Cristo" : "The Count of Monte Cristo",
    projectType: F ? "Réparation" : "Repair",
    thumbnailUrl: PHOTOS[0],
    currency: "EUR",
    amountCents: null as number | null,
    amountIncludesTax: false,
    hasPrice: false,
    proposalAccepted: false,
    proposalAcceptable: false,
    paymentEligible: false,
    paid: false,
    unreadCount: 0,
    actionRequired: false,
    ...over,
  });
  if (scenario === "empty") return [];
  if (scenario === "B")
    return [
      row({ id: "a1", status: "pricing" }),
      row({ id: "a2", status: "matching", createdAt: "2026-09-05T10:00:00Z", title: F ? "Les Fleurs du mal" : "Flowers of Evil", projectType: F ? "Restauration" : "Restoration", thumbnailUrl: PHOTOS[1], hasPrice: true, proposalAccepted: true, paymentEligible: true, amountCents: 47880, amountIncludesTax: true, unreadCount: 2 }),
      row({ id: "a3", status: "completed", createdAt: "2026-08-01T10:00:00Z", title: F ? "Dictionnaire de l'Académie" : "Dictionary of the Academy", projectType: F ? "Reliure" : "Binding", thumbnailUrl: PHOTOS[2], hasPrice: true, proposalAccepted: true, paid: true, amountCents: 60000, amountIncludesTax: true }),
      row({ id: "a4", status: "binder_selected", createdAt: "2026-09-01T10:00:00Z", title: F ? "Sans photo disponible" : "No photo available", projectType: F ? "Protection sur mesure" : "Bespoke protection", thumbnailUrl: null, hasPrice: true, proposalAccepted: true, paid: true, actionRequired: true, amountCents: 30000, amountIncludesTax: true }),
    ];
  const p = proposal(scenario);
  return [
    row({
      status: STATUS[scenario] ?? "pricing",
      hasPrice: scenario !== "A",
      proposalAccepted: p !== null && p.confirmedAt !== null,
      proposalAcceptable: scenario === "C",
      paymentEligible: scenario === "E",
      paid: scenario === "F" || scenario === "G" || scenario === "H",
      actionRequired: scenario === "G",
      amountCents: p?.totalTtcCents ?? (scenario === "I" ? 37500 : null),
      amountIncludesTax: p?.totalTtcCents != null,
    }),
  ];
}

export function detailFixture(brand: Brand, scenario: string) {
  const F = fr(brand);
  const p = proposal(scenario);
  const paid = ["F", "G", "H"].includes(scenario);
  const line = (label: string, value: string, source = "visitor_answer") => ({ label, value, source, category: null });
  return {
    case: {
      id: "11111111-1111-4111-8111-111111111111",
      reference: "RL-006",
      status: STATUS[scenario] ?? "pricing",
      customerPriceCents: scenario === "A" ? null : 37500,
      currency: "EUR",
      priceIncludes: scenario === "A" ? [] : F ? ["reliure toile", "titrage doré"] : ["cloth binding", "gold lettering"],
      createdAt: "2026-09-12T09:30:00Z",
      projectType: F ? "Réparation" : "Repair",
      paymentEligible: scenario === "E",
      canAcceptProposal: scenario === "C",
      paidAt: paid ? "2026-09-15T08:00:00Z" : null,
      openDecisions: scenario === "G" ? 1 : 0,
      messagingChannel: (F ? "direct" : "concierge") as "direct" | "concierge",
    },
    proposal: p,
    view: {
      reference: "RL-006",
      title: F ? "Le Comte de Monte-Cristo" : "The Count of Monte Cristo",
      summary: F
        ? "Réparation d'un livre courant (Le Comte de Monte-Cristo, Alexandre Dumas, 1953). Format 21,8 × 14,2 × 4,8 cm. Couverture usée."
        : "Repair of an ordinary book (The Count of Monte Cristo, Alexandre Dumas, 1953). Format 21.8 × 14.2 × 4.8 cm. Worn cover.",
      project: [
        line(F ? "Type de projet" : "Project type", F ? "Réparation" : "Repair"),
        line("Dimensions", "21,8 × 14,2 × 4,8 cm"),
        line(F ? "État du livre" : "Condition", F ? "Couverture usée" : "Worn cover"),
        line(F ? "Matière souhaitée" : "Desired material", F ? "Toile" : "Cloth", "assumed_default"),
        line("Style", F ? "Classique" : "Classic", "deterministic_rule"),
        line(F ? "Importance du livre" : "Importance of the book", F ? "Souvenir familial" : "Family keepsake"),
        line(F ? "Année d'édition" : "Year of publication", F ? "À préciser" : "To clarify"),
        line(F ? "Consentement" : "Consent", "true"),
        line("Technical", "manual_review_required"),
        line("Empty", "null"),
      ],
      constraints: [],
      budgetAndTiming: [
        line("Budget", F ? "Entre 250 et 400 €" : "€250 – €400"),
        line(F ? "Délai souhaité" : "Desired timeline", F ? "1 à 2 mois" : "1 to 2 months"),
      ],
      missingInformation: [line(F ? "Photos des dommages" : "Photos of the damage", F ? "À préciser" : "To clarify")],
      photos: [
        { url: PHOTOS[0], caption: null },
        { url: PHOTOS[1], caption: null },
        { url: "/photos/does-not-exist.webp", caption: null },
        { url: null, caption: null },
      ],
      area: F ? "75001 Paris" : "London",
      contact: { name: "Test Client", email: "client@example.test", phone: null, location: F ? "75001 Paris" : "London" },
      heritage: false,
      manualReviewRequired: scenario === "A",
    },
    selectedBinder:
      ["G", "H", "F"].includes(scenario)
        ? { id: "b1", display_name: "Atelier Test", workshop_name: "Atelier Reliure Dorure Ferrière", city: "Orléans", bio: F ? "Atelier familial de reliure et dorure." : "Family workshop for binding and gilding.", avatar_path: null, years_experience: 25, rating_avg: null, rating_count: 0, skills: ["repair", "gilding"], selectedAt: "2026-09-16T10:00:00Z" }
        : null,
  };
}

export function conversationFixture(brand: Brand, scenario: string) {
  const F = fr(brand);
  if (scenario === "A" || scenario === "empty") return { messages: [], lastReadAt: null };
  return {
    messages: [
      { id: "m1", senderRole: "admin", isMine: false, body: F ? "Bonjour, nous avons bien reçu votre projet." : "Hello, we have received your project.", deleted: false, attachmentCount: 0, createdAt: "2026-09-13T08:00:00Z" },
      { id: "m2", senderRole: "customer", isMine: true, body: F ? "Merci, à quelle date pensez-vous avoir un prix ?" : "Thank you, when can I expect a price?", deleted: false, attachmentCount: 0, createdAt: "2026-09-13T09:10:00Z" },
      // Ma Reliure : le fil est partagé avec l'atelier. Fine Bindery : le serveur ne
      // renvoie jamais un message d'atelier à un client.
      ...(F && ["G", "H"].includes(scenario)
        ? [{ id: "m3", senderRole: "binder", isMine: false, body: F ? "Bonjour, j'ai bien reçu le livre." : "Hello, I have received the book.", deleted: false, attachmentCount: 0, createdAt: "2026-09-17T14:32:00Z" }]
        : []),
    ],
    lastReadAt: null,
  };
}

export function decisionsFixture(brand: Brand, scenario: string) {
  const F = fr(brand);
  if (scenario === "G")
    return [
      { id: "d1", kind: "COLOR", question: F ? "Quelle couleur de toile souhaitez-vous ?" : "Which cloth colour would you like?", options: F ? ["Bleu nuit", "Vert anglais", "Bordeaux"] : ["Midnight blue", "English green", "Burgundy"], status: "open", answer: null, answered_at: null, cancelled_at: null, superseded_by: null, created_at: "2026-09-17T08:00:00Z" },
      { id: "d0", kind: "GILDING_TEXT", question: F ? "Quel titre sur le dos ?" : "Which title on the spine?", options: [], status: "answered", answer: { text: "LE COMTE DE MONTE-CRISTO" }, answered_at: "2026-09-16T12:00:00Z", cancelled_at: null, superseded_by: null, created_at: "2026-09-16T08:00:00Z" },
      { id: "d00", kind: "MATERIAL", question: F ? "Quelle matière ?" : "Which material?", options: ["a"], status: "answered", answer: { choice: F ? "Toile écrue" : "Natural cloth" }, answered_at: "2026-09-16T11:00:00Z", cancelled_at: null, superseded_by: null, created_at: "2026-09-16T07:00:00Z" },
    ];
  return [];
}
