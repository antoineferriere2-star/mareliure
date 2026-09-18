import { describe, expect, it } from "vitest";
import { CASE_STATUSES } from "@/marketplace/cases/state";
import {
  CUSTOMER_STATUS_KEYS,
  customerCopy,
  customerLocaleForBrand,
  customerNextStep,
  customerStatus,
  customerStatusKey,
  customerTimeline,
  formatCustomerDate,
  humanizeBoolean,
  humanizeDecisionAnswer,
  isEmptyValue,
  looksLikeRawEnum,
  presentBriefLines,
  pricingModeLabel,
  type CustomerCaseFacts,
  type CustomerLocale,
} from "./customerPresentation";

const base: CustomerCaseFacts = {
  status: "pricing",
  hasPrice: false,
  proposalAccepted: false,
  paymentEligible: false,
  paid: false,
  actionRequired: false,
};
const facts = (over: Partial<CustomerCaseFacts>): CustomerCaseFacts => ({ ...base, ...over });
const LOCALES: CustomerLocale[] = ["fr-FR", "en-US"];

describe("statuts client", () => {
  it("a un libellé dans les deux langues pour chaque clé — jamais une clé technique", () => {
    for (const locale of LOCALES) {
      for (const key of CUSTOMER_STATUS_KEYS) {
        const sample = facts(
          key === "received"
            ? { status: "under_review" }
            : key === "proposal_ready"
              ? { hasPrice: true, status: "matching" }
              : key === "awaiting_you"
                ? { actionRequired: true }
                : key === "payment_due"
                  ? { paymentEligible: true, hasPrice: true, proposalAccepted: true }
                  : key === "paid"
                    ? { paid: true }
                    : key === "workshop_selected"
                      ? { status: "binder_selected" }
                      : key === "in_progress"
                        ? { status: "in_progress" }
                        : key === "needs_approval"
                          ? { status: "awaiting_approval" }
                          : key === "travelling"
                            ? { status: "shipping_to_binder" }
                            : key === "returning"
                              ? { status: "shipping_to_customer" }
                              : key === "delivered"
                                ? { status: "delivered" }
                                : key === "completed"
                                  ? { status: "completed" }
                                  : key === "cancelled"
                                    ? { status: "cancelled" }
                                    : { status: "pricing" },
        );
        const status = customerStatus(sample, locale);
        expect(status.key).toBe(key);
        expect(status.label.length).toBeGreaterThan(2);
        expect(status.label).not.toMatch(/_/);
      }
    }
  });

  it("ne montre jamais une valeur brute, quel que soit le statut du domaine", () => {
    const facts2: Partial<CustomerCaseFacts>[] = [
      {},
      { hasPrice: true },
      { paymentEligible: true },
      { paid: true },
      { actionRequired: true },
    ];
    for (const raw of [...CASE_STATUSES, "un_statut_futur", "manual_review_required", "checkout_eligible"]) {
      for (const over of facts2) {
        for (const locale of LOCALES) {
          const { label } = customerStatus(facts({ status: raw, ...over }), locale);
          // Jamais un identifiant technique (avec underscore). Un mot simple comme
          // « delivered » peut légitimement être aussi le mot anglais du statut.
          expect(label, `${raw}`).not.toMatch(/[a-z]+_[a-z]+/);
          if (raw.includes("_")) expect(label.toLowerCase()).not.toContain(raw.toLowerCase());
        }
      }
    }
  });

  it("suit l'histoire du dossier : reçu, étude, proposition, paiement, atelier, travail, fin", () => {
    expect(customerStatusKey(facts({ status: "under_review" }))).toBe("received");
    expect(customerStatusKey(facts({ status: "pricing" }))).toBe("reviewing");
    expect(customerStatusKey(facts({ status: "matching", hasPrice: true }))).toBe("proposal_ready");
    expect(customerStatusKey(facts({ status: "matching", hasPrice: true, proposalAccepted: true, paymentEligible: true }))).toBe("payment_due");
    expect(customerStatusKey(facts({ status: "binder_selected", paid: true }))).toBe("paid");
    expect(customerStatusKey(facts({ status: "binder_selected" }))).toBe("workshop_selected");
    expect(customerStatusKey(facts({ status: "in_progress", paid: true }))).toBe("in_progress");
    expect(customerStatusKey(facts({ status: "shipping_to_customer" }))).toBe("returning");
    expect(customerStatusKey(facts({ status: "completed", paid: true }))).toBe("completed");
  });

  it("une confirmation attendue prime sur un état non terminal, jamais sur un état terminal", () => {
    expect(customerStatusKey(facts({ status: "binder_selected", paid: true, actionRequired: true }))).toBe("awaiting_you");
    expect(customerStatusKey(facts({ status: "in_progress", actionRequired: true }))).toBe("awaiting_you");
    expect(customerStatusKey(facts({ status: "completed", actionRequired: true }))).toBe("completed");
    expect(customerStatusKey(facts({ status: "cancelled", actionRequired: true }))).toBe("cancelled");
  });

  it("un statut inconnu se lit « à l'étude », jamais tel quel", () => {
    expect(customerStatusKey(facts({ status: "quelque_chose_de_nouveau" }))).toBe("reviewing");
  });

  it("parle français pour Ma Reliure et anglais pour Fine Bindery", () => {
    const f = facts({ status: "matching", hasPrice: true });
    expect(customerStatus(f, customerLocaleForBrand("MA_RELIURE")).label).toBe("Proposition disponible");
    expect(customerStatus(f, customerLocaleForBrand("FINE_BINDERY")).label).toBe("Proposal ready");
    expect(customerLocaleForBrand(null)).toBe("fr-FR");
  });
});

describe("prochaine étape", () => {
  it("propose de payer seulement quand le serveur dit que le paiement est possible", () => {
    for (const locale of LOCALES) {
      const payable = customerNextStep(facts({ paymentEligible: true, hasPrice: true, proposalAccepted: true }), locale);
      expect(payable.action).toBe("pay");
      expect(payable.requiresAction).toBe(true);
      const notPayable = customerNextStep(facts({ hasPrice: true, proposalAccepted: true }), locale);
      expect(notPayable.action).not.toBe("pay");
    }
    expect(customerNextStep(facts({ paymentEligible: true }), "fr-FR").actionLabel).toBe("Payer");
    expect(customerNextStep(facts({ paymentEligible: true }), "en-US").actionLabel).toBe("Pay securely");
  });

  it("ne propose jamais de payer un dossier déjà payé", () => {
    // `paymentEligible` est faux côté serveur dès que `paidAt` existe ; ici on
    // vérifie que même incohérent, un dossier payé passe avant « à payer ».
    const next = customerNextStep(facts({ paid: true, paymentEligible: true, status: "binder_selected" }), "fr-FR");
    expect(next.action).toBeNull();
  });

  it("dit « aucune action requise » quand il n'y a rien à faire", () => {
    expect(customerNextStep(facts({}), "fr-FR").hint).toBe("Aucune action requise de votre part.");
    expect(customerNextStep(facts({}), "en-US").hint).toBe("Nothing is required from you right now.");
    expect(customerNextStep(facts({}), "fr-FR").text).toBe("Nous étudions votre projet.");
  });

  it("une proposition prête invite à la lire, sans dire que le client doit agir", () => {
    const next = customerNextStep(facts({ hasPrice: true, status: "matching" }), "fr-FR");
    expect(next.action).toBe("proposal");
    expect(next.actionLabel).toBe("Voir ma proposition");
    expect(next.requiresAction).toBe(false);
  });

  it("une décision attendue donne un bouton « Répondre » / « Reply »", () => {
    expect(customerNextStep(facts({ actionRequired: true }), "fr-FR").actionLabel).toBe("Répondre");
    expect(customerNextStep(facts({ actionRequired: true }), "en-US").actionLabel).toBe("Reply");
  });

  it("chaque état a une phrase dans les deux langues", () => {
    for (const locale of LOCALES) {
      for (const status of CASE_STATUSES) {
        for (const over of [{}, { hasPrice: true }, { paymentEligible: true }, { paid: true }, { actionRequired: true }]) {
          const next = customerNextStep(facts({ status, ...over }), locale);
          expect(next.text.length).toBeGreaterThan(10);
          expect(next.text).not.toMatch(/_/);
        }
      }
    }
  });
});

describe("mode de prix", () => {
  it("se lit en mots, jamais comme un enum", () => {
    expect(pricingModeLabel("FIXED_PRICE", "fr-FR")).toBe("Prix ferme");
    expect(pricingModeLabel("ESTIMATE_THEN_CONFIRM", "fr-FR")).toBe("Estimation avant confirmation");
    expect(pricingModeLabel("MANUAL_STUDY", "fr-FR")).toBe("Étude personnalisée");
    expect(pricingModeLabel("FIXED_PRICE", "en-US")).toBe("Fixed price");
    expect(pricingModeLabel("MANUAL_STUDY", "en-US")).toBe("Tailored study");
    expect(pricingModeLabel("QUELQUE_CHOSE", "fr-FR")).toBeNull();
    expect(pricingModeLabel(null, "fr-FR")).toBeNull();
  });
});

describe("valeurs du Brief", () => {
  const line = (label: string, value: string, source = "visitor_answer") => ({ label, value, source });

  it("masque le vide, le technique et l'inconnu au lieu de les afficher", () => {
    const { shown, toConfirm } = presentBriefLines(
      [
        line("Dimensions", "21,8 × 14,2 cm"),
        line("A", "null"),
        line("B", "undefined"),
        line("C", "-"),
        line("D", "N/A"),
        line("E", ""),
        line("F", "manual_review_required"),
        line("G", "livre_courant"),
        line("Année d'édition", "À préciser"),
        line("Year", "To clarify"),
      ],
      "fr-FR",
    );
    expect(shown.map((l) => l.label)).toEqual(["Dimensions"]);
    expect(toConfirm).toEqual(["Année d'édition", "Year"]);
  });

  it("ne montre jamais true/false : Oui/Non en français, Yes/No en anglais", () => {
    expect(humanizeBoolean("true", "fr-FR")).toBe("Oui");
    expect(humanizeBoolean("false", "fr-FR")).toBe("Non");
    expect(humanizeBoolean("true", "en-US")).toBe("Yes");
    expect(humanizeBoolean("FALSE", "en-US")).toBe("No");
    const { shown } = presentBriefLines([line("Consentement", "true")], "fr-FR");
    expect(shown[0]?.value).toBe("Oui");
  });

  it("garde ce que le client a écrit lui-même, y compris une référence ou un titre", () => {
    const { shown } = presentBriefLines(
      [line("Titre", "Le Comte de Monte-Cristo"), line("Référence", "RL-006"), line("Année", "1953")],
      "fr-FR",
    );
    expect(shown.map((l) => l.value)).toEqual(["Le Comte de Monte-Cristo", "RL-006", "1953"]);
  });

  it("dit « à confirmer » d'une hypothèse d'après photo, sans jargon", () => {
    const { shown } = presentBriefLines([line("Style", "Classique", "image_hypothesis")], "fr-FR");
    expect(shown[0]?.tentative).toBe(true);
    expect(customerCopy("fr-FR").tentative).toBe("à confirmer");
  });

  it("reconnaît un identifiant machine sans toucher au texte libre", () => {
    expect(looksLikeRawEnum("manual_review_required")).toBe(true);
    expect(looksLikeRawEnum("FIXED_PRICE")).toBe(true);
    expect(looksLikeRawEnum("RL-006")).toBe(false);
    expect(looksLikeRawEnum("Réparation")).toBe(false);
    expect(looksLikeRawEnum("half-leather")).toBe(false);
    expect(isEmptyValue("  N/A ")).toBe(true);
    expect(isEmptyValue("Na")).toBe(false);
  });
});

describe("réponses aux décisions", () => {
  it("relit la réponse en mots, jamais en JSON", () => {
    expect(humanizeDecisionAnswer({ choice: "Bleu nuit" })).toBe("Bleu nuit");
    expect(humanizeDecisionAnswer({ text: "  LE COMTE  " })).toBe("LE COMTE");
    expect(humanizeDecisionAnswer({ title: "Dune", author: "Herbert" })).toBe("Dune · Herbert");
    expect(humanizeDecisionAnswer(null)).toBe("");
    expect(humanizeDecisionAnswer({ choice: "x" })).not.toContain("{");
  });
});

describe("historique", () => {
  it("ne raconte que des jalons que le client reconnaît, jamais un événement interne", () => {
    const entries = customerTimeline(
      {
        status: "in_progress",
        createdAt: "2026-09-12T09:00:00Z",
        proposalPreparedAt: "2026-09-13T09:00:00Z",
        proposalConfirmedAt: "2026-09-14T09:00:00Z",
        paidAt: "2026-09-15T09:00:00Z",
        workshopSelectedAt: "2026-09-16T09:00:00Z",
      },
      "fr-FR",
    );
    expect(entries.map((e) => e.label)).toEqual([
      "Projet envoyé",
      "Proposition préparée",
      "Proposition confirmée",
      "Paiement confirmé",
      "Atelier sélectionné",
      "Travail commencé",
    ]);
    for (const e of entries) expect(e.key).not.toMatch(/commercial_proposal|event|payout/);
  });

  it("n'affiche que ce qui existe : un projet neuf n'a qu'un jalon", () => {
    const entries = customerTimeline(
      { status: "under_review", createdAt: "2026-09-12T09:00:00Z", proposalPreparedAt: null, proposalConfirmedAt: null, paidAt: null, workshopSelectedAt: null },
      "en-US",
    );
    expect(entries.map((e) => e.label)).toEqual(["Project sent"]);
  });
});

describe("langue", () => {
  const collect = (locale: CustomerLocale): string[] => {
    const c = customerCopy(locale);
    const out: string[] = [];
    for (const value of Object.values(c)) {
      if (typeof value === "string") out.push(value);
      else if (typeof value === "function") {
        const fn = value as (...a: never[]) => unknown;
        for (const args of [[1], [2], ["12 septembre 2026"], [null], ["20 %"], [3]]) {
          try {
            const r = fn(...(args as never[]));
            if (typeof r === "string") out.push(r);
          } catch {
            /* argument inadapté à cette fonction */
          }
        }
      }
    }
    return out;
  };

  it("Fine Bindery : aucun texte français, aucune fuite de Ma Reliure", () => {
    const strings = collect("en-US");
    expect(strings.length).toBeGreaterThan(80);
    for (const s of strings) {
      expect(s, s).not.toMatch(/[àâçéèêëîïôùûœ]/i);
      expect(s, s).not.toMatch(/\b(votre|vos|mes|livres?|paiement|projet|atelier|proposition)\b/i);
      expect(s, s).not.toMatch(/Ma Reliure|mareliure/i);
    }
  });

  it("Ma Reliure : aucun texte anglais de l'espace client, aucune fuite de Fine Bindery", () => {
    for (const s of collect("fr-FR")) {
      expect(s, s).not.toMatch(/Fine Bindery|finebindery/i);
      expect(s, s).not.toMatch(/\b(your|please|payment|project|workshop|loading)\b/i);
    }
  });

  it("les statuts et prochaines étapes de chaque statut du domaine sont dans la bonne langue", () => {
    for (const status of CASE_STATUSES) {
      const en = customerStatus(facts({ status }), "en-US").label;
      const fr = customerStatus(facts({ status }), "fr-FR").label;
      expect(en, status).not.toMatch(/[àâçéèêëîïôùûœ]|\b(votre|projet|atelier)\b/i);
      expect(fr, status).not.toMatch(/\b(your|project|workshop|payment)\b/i);
      const nextEn = customerNextStep(facts({ status }), "en-US").text;
      expect(nextEn, status).not.toMatch(/[àâçéèêëîïôùûœ]|\b(votre|projet|atelier)\b/i);
    }
  });
});

describe("dates", () => {
  it("se formatent dans la langue de la marque, et jamais « Invalid Date »", () => {
    expect(formatCustomerDate("2026-09-12T09:30:00Z", "fr-FR")).toBe("12 septembre 2026");
    expect(formatCustomerDate("2026-09-12T09:30:00Z", "en-US")).toBe("September 12, 2026");
    expect(formatCustomerDate("pas une date", "fr-FR")).toBeNull();
    expect(formatCustomerDate(null, "fr-FR")).toBeNull();
  });
});
