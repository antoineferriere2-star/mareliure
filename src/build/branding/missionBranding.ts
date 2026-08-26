/**
 * Reading the branding frozen onto a published Mission.
 *
 * `build_missions.branding` is a snapshot taken at publish time, so by the time
 * anyone reads it the shape may be older than the code doing the reading — and
 * it is served on the public runtime, where a malformed row must degrade rather
 * than throw. Everything here is therefore total: unknown in, a usable answer
 * out, never an exception.
 *
 * Deliberately narrower than the wizard's own Branding type. Only the fields a
 * visitor actually sees are exposed; `logoPath` is stored but read by nothing,
 * and passing it through the public API would advertise a capability that does
 * not exist.
 */
import { isHexColor } from "./contrast";

export interface PublicBranding {
  /** The business the visitor believes they are talking to. */
  displayName: string | null;
  /** Validated hex, or null. Never a raw string — it reaches a style attribute. */
  accentColor: string | null;
  introTitle: string | null;
  introText: string | null;
  ctaLabel: string | null;
}

export const EMPTY_BRANDING: PublicBranding = {
  displayName: null,
  accentColor: null,
  introTitle: null,
  introText: null,
  ctaLabel: null,
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Parses the frozen snapshot. An empty object — what a Mission published before
 * branding existed carries — yields every field null, which every caller reads
 * as "fall back to what you showed before".
 */
export function readMissionBranding(value: unknown): PublicBranding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_BRANDING;
  const raw = value as Record<string, unknown>;
  const accent = text(raw.accentColor, 20);
  return {
    displayName: text(raw.displayName, 200),
    // A colour that no longer parses is dropped rather than passed on: it ends
    // up in a style attribute, and the fallback is a colour we know is safe.
    accentColor: accent && isHexColor(accent) ? accent : null,
    introTitle: text(raw.introTitle, 400),
    introText: text(raw.introText, 1000),
    ctaLabel: text(raw.ctaLabel, 120),
  };
}

/**
 * The name to show the visitor, in order of how much someone meant it.
 *
 * The display name was typed for this Intake, so it wins. The workspace name is
 * the business's own name and used to be the only source — correct by accident
 * for a customer, and wrong for Métré's internal Sales workspace, where every
 * prospect demonstration announced itself as "Métré Sales / Demos" instead of
 * the prospect's company.
 */
export function visitorFacingName(
  branding: PublicBranding,
  workspaceName: string | null | undefined,
  missionName: string | null | undefined,
): string {
  return branding.displayName ?? workspaceName?.trim() ?? missionName?.trim() ?? "";
}
