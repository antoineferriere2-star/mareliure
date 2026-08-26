/**
 * Picking a readable text colour for a background we did not choose.
 *
 * The customer types a hex colour in the setup wizard. It ends up behind white
 * text on a button pasted into *their own* website — so a light brand colour
 * does not produce a slightly-off button, it produces an unreadable one, in
 * markup we generated, on a page we do not control. `#ffffff` was hardcoded,
 * and the only validation was that the value parsed as hex.
 *
 * Pure and dependency-free: this is the one part of the branding chain that has
 * a right answer, and it is worth being able to test it exhaustively.
 *
 * Follows WCAG 2.1 relative luminance and contrast ratio. AA for normal text is
 * 4.5:1; large/bold text may use 3:1, but the button is neither reliably large
 * nor reliably bold once a host stylesheet has had its say, so 4.5 is the bar.
 */

export const WCAG_AA_NORMAL = 4.5;

export const BLACK = "#000000";
export const WHITE = "#ffffff";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): boolean {
  return typeof value === "string" && HEX.test(value.trim());
}

/** `#abc` and `#aabbcc` are the same colour; normalising once keeps the maths in one shape. */
function toRgb(hex: string): [number, number, number] {
  const raw = hex.trim().slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance: sRGB channels linearised, then weighted for human sensitivity. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * Black or white, whichever is more readable on this background.
 *
 * Deliberately only these two: an arbitrary background admits no third choice
 * that is reliably better, and every extra option is another way to be subtly
 * wrong. A malformed colour returns white, matching the caller's own fallback
 * to the product's dark green.
 */
export function readableTextColor(background: string | null | undefined): string {
  if (!isHexColor(background)) return WHITE;
  return contrastRatio(background!, BLACK) >= contrastRatio(background!, WHITE) ? BLACK : WHITE;
}

/**
 * Whether the pair clears AA. Not used to *reject* a customer's colour — their
 * brand is their business, and refusing it would be worse than adapting to it —
 * but it lets the wizard warn, and it makes the guarantee testable.
 */
export function meetsAaContrast(background: string, text: string): boolean {
  return contrastRatio(background, text) >= WCAG_AA_NORMAL;
}
