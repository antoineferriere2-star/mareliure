import { describe, expect, it } from "vitest";
import { demoJaneMillerBrief } from "./demoProductData";

describe("demoJaneMillerBrief", () => {
  it("produces a usable brief with confirmed and missing information", () => {
    expect(demoJaneMillerBrief.confirmedInformation.length).toBeGreaterThan(0);
    expect(demoJaneMillerBrief.missingInformation.length).toBeGreaterThan(0);
    expect(demoJaneMillerBrief.assumptionsAndCalculated.length).toBeGreaterThan(0);
  });

  it("never presents an unconfirmed value as a visitor answer", () => {
    for (const line of demoJaneMillerBrief.missingInformation) {
      expect(line.source).not.toBe("visitor_answer");
    }
  });
});
