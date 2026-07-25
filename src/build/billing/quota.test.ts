import { describe, expect, it } from "vitest";
import { usageLevel, wouldExceedActiveMissions } from "./quota";

describe("wouldExceedActiveMissions", () => {
  it("allows activating when under the limit", () => {
    expect(wouldExceedActiveMissions(0, 1)).toBe(false);
    expect(wouldExceedActiveMissions(2, 3)).toBe(false);
  });

  it("blocks once the workspace is already at its limit", () => {
    expect(wouldExceedActiveMissions(1, 1)).toBe(true);
    expect(wouldExceedActiveMissions(3, 3)).toBe(true);
    expect(wouldExceedActiveMissions(5, 3)).toBe(true);
  });
});

describe("usageLevel", () => {
  it("is ok below 80%", () => {
    expect(usageLevel(0, 50)).toBe("ok");
    expect(usageLevel(39, 50)).toBe("ok");
  });

  it("is warning from 80% up to (not including) 100%", () => {
    expect(usageLevel(40, 50)).toBe("warning");
    expect(usageLevel(49, 50)).toBe("warning");
  });

  it("is over at or beyond 100%", () => {
    expect(usageLevel(50, 50)).toBe("over");
    expect(usageLevel(75, 50)).toBe("over");
  });

  it("treats a non-positive quota as ok rather than dividing by zero", () => {
    expect(usageLevel(10, 0)).toBe("ok");
  });
});
