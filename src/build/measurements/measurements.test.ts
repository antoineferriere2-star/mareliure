import { describe, expect, it } from "vitest";
import {
  calculateArea,
  convertArea,
  convertLength,
  formatArea,
  formatLength,
  normalizeArea,
  normalizeLength,
  parseImperialLength,
  resolveMeasurementSystem,
  type RuntimePreferences,
} from "./index";

describe("measurement conversions", () => {
  it("converts reference lengths exactly enough for normalized business rules", () => {
    expect(convertLength(20, "ft", "m")).toBeCloseTo(6.096, 6);
    expect(convertLength(16, "ft", "m")).toBeCloseTo(4.8768, 6);
    expect(parseImperialLength({ feet: 12, inches: 6 })).toBeCloseTo(3.81, 6);
    expect(convertLength(6, "m", "ft")).toBeCloseTo(19.685, 3);
  });

  it("converts reference areas", () => {
    expect(convertArea(320, "sqft", "sqm")).toBeCloseTo(29.7289728, 6);
    expect(convertArea(30, "sqm", "sqft")).toBeCloseTo(322.917, 3);
  });

  it("calculates area from normalized length values", () => {
    const length = convertLength(20, "ft", "m");
    const width = convertLength(16, "ft", "m");
    expect(calculateArea(length, width)).toBeCloseTo(29.7289728, 6);
    expect(calculateArea(6, 5)).toBe(30);
  });

  it("keeps raw and normalized measurement data", () => {
    expect(normalizeLength(20, "ft", true)).toEqual({
      rawValue: 20,
      rawUnit: "ft",
      normalizedValue: 6.096,
      normalizedUnit: "m",
      measurementSystem: "imperial",
      approximate: true,
    });
    expect(normalizeArea(320, "sqft", false).normalizedValue).toBeCloseTo(29.7289728, 6);
  });

  it("resolves supported measurement systems with an imperial default", () => {
    expect(resolveMeasurementSystem("metric")).toBe("metric");
    expect(resolveMeasurementSystem("imperial")).toBe("imperial");
    expect(resolveMeasurementSystem("us-customary")).toBe("imperial");
  });
});

describe("localized measurement formatting", () => {
  it("formats imperial measurements in English and Spanish", () => {
    const twentyFeetMeters = convertLength(20, "ft", "m");
    const areaSquareMeters = convertArea(320, "sqft", "sqm");

    expect(formatLength(twentyFeetMeters, { locale: "en-US", measurementSystem: "imperial" })).toBe(
      "20 ft",
    );
    expect(formatLength(twentyFeetMeters, { locale: "es-US", measurementSystem: "imperial" })).toBe(
      "20 pies",
    );
    expect(formatArea(areaSquareMeters, { locale: "en-US", measurementSystem: "imperial" })).toBe(
      "320 sq ft",
    );
    expect(formatArea(areaSquareMeters, { locale: "es-US", measurementSystem: "imperial" })).toBe(
      "320 pies cuadrados",
    );
  });

  it("formats metric measurements in English and Spanish with Intl.NumberFormat", () => {
    const twentyFeetMeters = convertLength(20, "ft", "m");
    const areaSquareMeters = convertArea(320, "sqft", "sqm");

    expect(formatLength(twentyFeetMeters, { locale: "en-US", measurementSystem: "metric" })).toBe(
      "6.1 m",
    );
    expect(formatLength(twentyFeetMeters, { locale: "es-US", measurementSystem: "metric" })).toBe(
      "6.1 m",
    );
    expect(formatArea(areaSquareMeters, { locale: "en-US", measurementSystem: "metric" })).toBe(
      "29.7 m²",
    );
    expect(formatArea(areaSquareMeters, { locale: "es-US", measurementSystem: "metric" })).toBe(
      "29.7 m²",
    );
  });

  it("formats feet plus inches without changing locale or measurement-system independence", () => {
    const meters = parseImperialLength({ feet: 12, inches: 6 });
    expect(
      formatLength(meters, {
        locale: "en-US",
        measurementSystem: "imperial",
        style: "feet-inches",
      }),
    ).toBe("12 ft 6 in");
    expect(
      formatLength(meters, {
        locale: "es-US",
        measurementSystem: "imperial",
        style: "feet-inches",
      }),
    ).toBe("12 pies 6 pulgadas");
  });

  it("allows all required locale and measurement-system combinations", () => {
    const combinations: RuntimePreferences[] = [
      { locale: "en-US", measurementSystem: "imperial" },
      { locale: "en-US", measurementSystem: "metric" },
      { locale: "es-US", measurementSystem: "imperial" },
      { locale: "es-US", measurementSystem: "metric" },
    ];

    expect(combinations).toHaveLength(4);
    for (const prefs of combinations) {
      expect(formatArea(30, prefs)).not.toContain("undefined");
    }
  });
});
