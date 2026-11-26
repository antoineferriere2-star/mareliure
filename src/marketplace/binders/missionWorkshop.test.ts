import { describe, expect, it } from "vitest";
import { BOOKBINDING_MISSION_ID, FERRIERE_MISSION_ID, FINE_BINDERY_MISSION_ID } from "@/build/constants";
import { FERRIERE_WORKSHOP_ID } from "@/marketplace/config";
import { missionBoundWorkshopId } from "./missionWorkshop";

describe("Mission rattachée à un atelier", () => {
  it("rattache la Mission du site Ferrière à l'atelier Ferrière", () => {
    expect(missionBoundWorkshopId(FERRIERE_MISSION_ID)).toBe(FERRIERE_WORKSHOP_ID);
  });

  it("ne rattache aucune autre Mission, ni une valeur absente", () => {
    for (const id of [BOOKBINDING_MISSION_ID, FINE_BINDERY_MISSION_ID, "autre", "", null, undefined]) {
      expect(missionBoundWorkshopId(id)).toBeNull();
    }
  });
});
