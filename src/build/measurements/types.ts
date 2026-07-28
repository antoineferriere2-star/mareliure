import type { SupportedLocale } from "@/build/i18n";

export const MEASUREMENT_SYSTEMS = ["imperial", "metric"] as const;
export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];
export const DEFAULT_MEASUREMENT_SYSTEM: MeasurementSystem = "imperial";

const measurementSystems = new Set<string>(MEASUREMENT_SYSTEMS);

export function isMeasurementSystem(value: unknown): value is MeasurementSystem {
  return typeof value === "string" && measurementSystems.has(value);
}

export function resolveMeasurementSystem(
  value: unknown,
  fallback: MeasurementSystem = DEFAULT_MEASUREMENT_SYSTEM,
): MeasurementSystem {
  return isMeasurementSystem(value) ? value : fallback;
}

export type LengthUnit = "in" | "ft" | "mm" | "cm" | "m";
export type AreaUnit = "sqft" | "sqm";

export interface RuntimePreferences {
  locale: SupportedLocale;
  measurementSystem: MeasurementSystem;
}

export interface NormalizedLength {
  rawValue: number;
  rawUnit: LengthUnit;
  normalizedValue: number;
  normalizedUnit: "m";
  measurementSystem: MeasurementSystem;
  approximate: boolean;
}

export interface NormalizedArea {
  rawValue: number;
  rawUnit: AreaUnit;
  normalizedValue: number;
  normalizedUnit: "sqm";
  measurementSystem: MeasurementSystem;
  approximate: boolean;
}
