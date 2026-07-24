import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateConditionGroup } from "./conditions";

describe("evaluateCondition", () => {
  it("is_empty / is_not_empty treat missing and blank values as empty", () => {
    expect(evaluateCondition({ fieldKey: "a", operator: "is_empty" }, {})).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "is_empty" }, { a: "  " })).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "is_not_empty" }, { a: "x" })).toBe(true);
  });

  it("equals / not_equals compare scalar values", () => {
    expect(evaluateCondition({ fieldKey: "a", operator: "equals", value: "Not sure" }, { a: "Not sure" })).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "not_equals", value: "Not sure" }, { a: "Yes" })).toBe(true);
  });

  it("includes / not_includes check array membership", () => {
    expect(evaluateCondition({ fieldKey: "a", operator: "includes", value: "x" }, { a: ["x", "y"] })).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "not_includes", value: "x" }, { a: ["y"] })).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "includes", value: "x" }, { a: "not-an-array" })).toBe(false);
  });

  it("numeric comparisons only apply to numbers", () => {
    expect(evaluateCondition({ fieldKey: "a", operator: "greater_than", value: 5 }, { a: 10 })).toBe(true);
    expect(evaluateCondition({ fieldKey: "a", operator: "greater_than", value: 5 }, { a: "10" })).toBe(false);
  });

  it("a __NOT_SURE__ answer is never empty but never comparable either", () => {
    expect(evaluateCondition({ fieldKey: "a", operator: "is_empty" }, { a: "__NOT_SURE__" })).toBe(false);
    expect(evaluateCondition({ fieldKey: "a", operator: "equals", value: "__NOT_SURE__" }, { a: "__NOT_SURE__" })).toBe(false);
  });
});

describe("evaluateConditionGroup", () => {
  it("is always true when absent", () => {
    expect(evaluateConditionGroup(undefined, {})).toBe(true);
  });

  it("combines all (AND) and any (OR) conjunctively", () => {
    const group = {
      all: [{ fieldKey: "a", operator: "is_not_empty" as const }],
      any: [{ fieldKey: "b", operator: "equals" as const, value: "x" }, { fieldKey: "b", operator: "equals" as const, value: "y" }],
    };
    expect(evaluateConditionGroup(group, { a: "1", b: "x" })).toBe(true);
    expect(evaluateConditionGroup(group, { a: "1", b: "z" })).toBe(false);
    expect(evaluateConditionGroup(group, { b: "x" })).toBe(false);
  });
});
