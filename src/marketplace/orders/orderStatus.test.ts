import { describe, expect, it } from "vitest";
import { oppeOrderStage } from "./orderStatus";

describe("statut d'une commande Oppe", () => {
  it("suit la proposition avant le paiement, la commande après", () => {
    expect(oppeOrderStage({ proposalStatus: "draft", paid: false, orderStatus: null })).toBe("draft");
    expect(oppeOrderStage({ proposalStatus: "proposed", paid: false, orderStatus: null })).toBe("sent");
    expect(oppeOrderStage({ proposalStatus: "accepted", paid: false, orderStatus: null })).toBe("accepted");
    expect(oppeOrderStage({ proposalStatus: "accepted", paid: true, orderStatus: null })).toBe("paid");
    expect(oppeOrderStage({ proposalStatus: "accepted", paid: true, orderStatus: "in_production" })).toBe("in_production");
    expect(oppeOrderStage({ proposalStatus: "accepted", paid: true, orderStatus: "completed" })).toBe("completed");
    expect(oppeOrderStage({ proposalStatus: "accepted", paid: true, orderStatus: "cancelled" })).toBe("cancelled");
    expect(oppeOrderStage({ proposalStatus: null, paid: false, orderStatus: null })).toBeNull();
  });
});
