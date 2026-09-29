import { describe, expect, it, vi } from "vitest";
import { associateLogisticsPhoto } from "./logisticsPhotoRecovery";

describe("photo association failure recovery", () => {
  const failure = new Error("response lost or rejected");
  const reject = async () => { throw failure; };
  const full = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));

  it("removes only the losing file after the serialized last-slot race", async () => {
    const remove = vi.fn(async () => {});
    await expect(associateLogisticsPhoto("loser", reject, async () => full, remove)).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledOnce();
  });
  it("accepts a committed association after a lost response without deleting evidence", async () => {
    const remove = vi.fn(async () => {});
    await associateLogisticsPhoto("0", reject, async () => full, remove);
    expect(remove).not.toHaveBeenCalled();
  });
  it.each([undefined, [], full.slice(0, 7)])("retains the recoverable object when fullness is not proven: %j", async (photos) => {
    const remove = vi.fn(async () => {});
    await expect(associateLogisticsPhoto("retry", reject, async () => photos, remove)).rejects.toBe(failure);
    expect(remove).not.toHaveBeenCalled();
  });
  it("retains evidence if the verification read fails", async () => {
    const remove = vi.fn(async () => {});
    await expect(associateLogisticsPhoto("retry", reject, reject, remove)).rejects.toBe(failure);
    expect(remove).not.toHaveBeenCalled();
  });
  it("does not report cleanup success when Storage removal fails", async () => {
    const storageFailure = new Error("Storage unavailable");
    await expect(associateLogisticsPhoto("loser", reject, async () => full, async () => { throw storageFailure; })).rejects.toBe(storageFailure);
  });
});
