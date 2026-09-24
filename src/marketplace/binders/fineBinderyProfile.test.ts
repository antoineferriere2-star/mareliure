import operations from "@/marketplace/reference/reliure-fr-v1/operations.json";
import { describe, expect, it } from "vitest";
import { BINDER_SKILLS } from "./skills";
import {
  canPublishPublicProfile,
  fineBinderyProfilePath,
  PROFILE_REQUEST_SOURCE,
  PROFILE_SOURCE_ANSWER_KEY,
  PUBLIC_MATERIAL_KEYS,
  PUBLIC_SPECIALTY_KEYS,
  PUBLIC_TECHNIQUE_KEYS,
  publicProfileMissing,
  sourceLabel,
} from "./fineBinderyProfile";

describe("FineBindery public profile", () => {
  it("publishes only a complete professional identity", () => {
    expect(canPublishPublicProfile({ workshopName: "Atelier du Livre", city: "Tours", bio: "Reliure traditionnelle", skills: ["reliure-traditionnelle"] })).toBe(true);
    expect(publicProfileMissing({ workshopName: "", city: null, bio: "", skills: [] })).toEqual([
      "nom de l’atelier", "ville", "présentation", "au moins une spécialité",
    ]);
  });

  it("uses the existing specialty taxonomy and real reference keys", () => {
    expect(PUBLIC_SPECIALTY_KEYS).toEqual(BINDER_SKILLS.map((skill) => skill.slug));
    const operationKeys = new Set(operations.map((operation) => operation.key));
    for (const key of [...PUBLIC_TECHNIQUE_KEYS, ...PUBLIC_MATERIAL_KEYS]) {
      expect(operationKeys.has(key), key).toBe(true);
    }
  });

  it("uses reserved provenance data and stable public paths", () => {
    expect(PROFILE_REQUEST_SOURCE).toBe("finebindery_profile");
    expect(PROFILE_SOURCE_ANSWER_KEY.startsWith("_")).toBe(true);
    expect(fineBinderyProfilePath("atelier-du-livre")).toBe("/en/atelier-du-livre");
    expect(sourceLabel("FINEBINDERY_PROFILE")).toBe("Page FineBindery");
  });
});
