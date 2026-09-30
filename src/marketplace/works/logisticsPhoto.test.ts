import { describe, expect, it } from "vitest";
import { logisticsPhotoId, samePhotoBytes } from "./logisticsPhoto";

describe("private photo retry identity", () => {
  it("reuses one id for unchanged evidence, while isolating actor, event and contents", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const scope = "binder/work/event/actor";
    const id = await logisticsPhotoId(scope, bytes);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await logisticsPhotoId(scope, new Uint8Array(bytes))).toBe(id);
    for (const other of ["other/work/event/actor", "binder/other/event/actor", "binder/work/other/actor", "binder/work/event/other"])
      expect(await logisticsPhotoId(other, bytes)).not.toBe(id);
    expect(await logisticsPhotoId(scope, new Uint8Array([137, 80, 78, 72]))).not.toBe(id);
  });

  it("does not treat a truncated or altered private object as the supplied evidence", () => {
    expect(samePhotoBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(samePhotoBytes(new Uint8Array([1, 2]), new Uint8Array([1]))).toBe(false);
    expect(samePhotoBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
});
