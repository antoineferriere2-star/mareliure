import { describe, expect, it } from "vitest";
import {
  BLACK,
  contrastRatio,
  isHexColor,
  meetsAaContrast,
  readableTextColor,
  relativeLuminance,
  WCAG_AA_NORMAL,
  WHITE,
} from "./contrast";

describe("relative luminance", () => {
  it("anchors at the two extremes", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("reads short hex as the same colour as long hex", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#ffffff"), 10);
    expect(relativeLuminance("#0a0")).toBeCloseTo(relativeLuminance("#00aa00"), 10);
  });

  it("weights green above red above blue", () => {
    // Human sensitivity, not an arbitrary constant: a pure green reads far
    // brighter than a pure blue of the same nominal intensity.
    expect(relativeLuminance("#00ff00")).toBeGreaterThan(relativeLuminance("#ff0000"));
    expect(relativeLuminance("#ff0000")).toBeGreaterThan(relativeLuminance("#0000ff"));
  });
});

describe("contrast ratio", () => {
  it("spans 1 to 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("does not depend on which colour is named first", () => {
    expect(contrastRatio("#f5d89f", "#000000")).toBeCloseTo(
      contrastRatio("#000000", "#f5d89f"),
      10,
    );
  });
});

describe("choosing the text colour", () => {
  it("puts black on a light brand colour", () => {
    // #f5d89f is a real prospect's sand. White text on it was the failure this
    // module exists to prevent — and it would have shipped inside markup we
    // generated, onto a customer's own site.
    expect(readableTextColor("#f5d89f")).toBe(BLACK);
    expect(meetsAaContrast("#f5d89f", WHITE)).toBe(false);
    expect(meetsAaContrast("#f5d89f", BLACK)).toBe(true);
  });

  it("puts white on a dark brand colour", () => {
    expect(readableTextColor("#3d2817")).toBe(WHITE); // the same prospect's brown
    expect(readableTextColor("#047857")).toBe(WHITE); // the product's own green
    expect(meetsAaContrast("#047857", WHITE)).toBe(true);
  });

  it("always picks the more readable of the two", () => {
    for (const color of ["#000000", "#ffffff", "#808080", "#f5d89f", "#3d2817", "#047857"]) {
      const chosen = readableTextColor(color);
      const other = chosen === BLACK ? WHITE : BLACK;
      expect(contrastRatio(color, chosen)).toBeGreaterThanOrEqual(contrastRatio(color, other));
    }
  });

  it("clears AA on every colour it is given", () => {
    // The interesting claim: for ANY background, one of black or white clears
    // 4.5:1. Mid-greys are where that is tightest, so they are swept densely.
    for (let v = 0; v <= 255; v += 1) {
      const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
      expect(
        meetsAaContrast(hex, readableTextColor(hex)),
        `${hex} has no readable text colour`,
      ).toBe(true);
    }
  });

  it("falls back to white on anything that is not a colour", () => {
    // Matches the snippet builder, which falls back to the product's dark
    // green for the same inputs.
    for (const value of [null, undefined, "", "red", "#12", "#1234567", "rgb(0,0,0)"]) {
      expect(readableTextColor(value as string | null | undefined)).toBe(WHITE);
    }
  });
});

describe("hex validation", () => {
  it("accepts the two shapes a browser colour input can produce", () => {
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("#AABBCC")).toBe(true);
    expect(isHexColor(" #aabbcc ")).toBe(true);
  });

  it("rejects anything that could carry a second CSS declaration", () => {
    // The value is interpolated into a style attribute. This is the first of
    // two defences, the other being escapeHtml in integrationSnippets.
    expect(isHexColor("red;background-image:url(x)")).toBe(false);
    expect(isHexColor("#aabbcc;color:red")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

it("states the AA threshold it enforces", () => {
  expect(WCAG_AA_NORMAL).toBe(4.5);
});
