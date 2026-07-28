import type {
  AreaUnit,
  LengthUnit,
  MeasurementSystem,
  NormalizedArea,
  NormalizedLength,
} from "./types";

const METERS_PER_FOOT = 0.3048;
const METERS_PER_INCH = 0.0254;
const SQM_PER_SQFT = 0.09290304;

export function measurementSystemForLengthUnit(unit: LengthUnit): MeasurementSystem {
  return unit === "ft" || unit === "in" ? "imperial" : "metric";
}

export function measurementSystemForAreaUnit(unit: AreaUnit): MeasurementSystem {
  return unit === "sqft" ? "imperial" : "metric";
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  const meters = toMeters(value, from);
  return fromMeters(meters, to);
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  const sqm = from === "sqft" ? value * SQM_PER_SQFT : value;
  return to === "sqft" ? sqm / SQM_PER_SQFT : sqm;
}

export function toMeters(value: number, unit: LengthUnit): number {
  switch (unit) {
    case "in":
      return value * METERS_PER_INCH;
    case "ft":
      return value * METERS_PER_FOOT;
    case "mm":
      return value / 1000;
    case "cm":
      return value / 100;
    case "m":
      return value;
  }
}

export function fromMeters(valueMeters: number, unit: LengthUnit): number {
  switch (unit) {
    case "in":
      return valueMeters / METERS_PER_INCH;
    case "ft":
      return valueMeters / METERS_PER_FOOT;
    case "mm":
      return valueMeters * 1000;
    case "cm":
      return valueMeters * 100;
    case "m":
      return valueMeters;
  }
}

export function parseImperialLength(input: { feet?: number; inches?: number }): number {
  return toMeters(input.feet ?? 0, "ft") + toMeters(input.inches ?? 0, "in");
}

export function normalizeLength(
  rawValue: number,
  rawUnit: LengthUnit,
  approximate = false,
): NormalizedLength {
  return {
    rawValue,
    rawUnit,
    normalizedValue: toMeters(rawValue, rawUnit),
    normalizedUnit: "m",
    measurementSystem: measurementSystemForLengthUnit(rawUnit),
    approximate,
  };
}

export function normalizeArea(
  rawValue: number,
  rawUnit: AreaUnit,
  approximate = false,
): NormalizedArea {
  return {
    rawValue,
    rawUnit,
    normalizedValue: convertArea(rawValue, rawUnit, "sqm"),
    normalizedUnit: "sqm",
    measurementSystem: measurementSystemForAreaUnit(rawUnit),
    approximate,
  };
}

export function calculateArea(lengthMeters: number, widthMeters: number): number {
  return lengthMeters * widthMeters;
}
