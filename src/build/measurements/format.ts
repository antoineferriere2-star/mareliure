import type { SupportedLocale } from "@/build/i18n";
import { convertArea, fromMeters } from "./conversion";
import type { MeasurementSystem } from "./types";

function numberFormatter(locale: SupportedLocale, maximumFractionDigits: number) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatNumber(
  locale: SupportedLocale,
  value: number,
  maximumFractionDigits: number,
): string {
  return numberFormatter(locale, maximumFractionDigits).format(value);
}

function plural(value: number, singular: string, pluralLabel: string): string {
  return Math.abs(value) === 1 ? singular : pluralLabel;
}

export function formatLength(
  meters: number,
  options: {
    locale: SupportedLocale;
    measurementSystem: MeasurementSystem;
    style?: "decimal" | "feet-inches";
    maximumFractionDigits?: number;
  },
): string {
  const maximumFractionDigits = options.maximumFractionDigits ?? 1;

  if (options.measurementSystem === "metric") {
    if (Math.abs(meters) < 1) {
      return `${formatNumber(options.locale, fromMeters(meters, "cm"), 0)} cm`;
    }
    return `${formatNumber(options.locale, meters, maximumFractionDigits)} m`;
  }

  if (options.style === "feet-inches") {
    const totalInches = Math.round(fromMeters(meters, "in"));
    const feet = Math.trunc(totalInches / 12);
    const inches = totalInches % 12;
    if (options.locale === "es-US") {
      const feetLabel = plural(feet, "pie", "pies");
      const inchLabel = plural(inches, "pulgada", "pulgadas");
      return inches === 0 ? `${feet} ${feetLabel}` : `${feet} ${feetLabel} ${inches} ${inchLabel}`;
    }
    return inches === 0 ? `${feet} ft` : `${feet} ft ${inches} in`;
  }

  const feet = fromMeters(meters, "ft");
  if (options.locale === "es-US") {
    return `${formatNumber(options.locale, feet, maximumFractionDigits)} ${plural(feet, "pie", "pies")}`;
  }
  return `${formatNumber(options.locale, feet, maximumFractionDigits)} ft`;
}

export function formatArea(
  squareMeters: number,
  options: {
    locale: SupportedLocale;
    measurementSystem: MeasurementSystem;
    maximumFractionDigits?: number;
  },
): string {
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (options.measurementSystem === "metric" ? 1 : 0);

  if (options.measurementSystem === "metric") {
    return `${formatNumber(options.locale, squareMeters, maximumFractionDigits)} m²`;
  }

  const squareFeet = convertArea(squareMeters, "sqm", "sqft");
  if (options.locale === "es-US") {
    return `${formatNumber(options.locale, squareFeet, maximumFractionDigits)} pies cuadrados`;
  }
  return `${formatNumber(options.locale, squareFeet, maximumFractionDigits)} sq ft`;
}
