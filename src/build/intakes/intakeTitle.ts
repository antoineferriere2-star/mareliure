/**
 * The accessible name for an embedded Project Intake — the iframe's `title`,
 * which is what a screen reader announces when the user lands on the frame.
 *
 * Four call sites each built this by hand as `${name} project intake`, which
 * duplicated the word whenever the Mission was already called something like
 * "Deck Intake" ("Deck Intake project intake"). The rule is not "append a
 * suffix" but "make sure the name ends in Project Intake", which is why this
 * lives in one place.
 *
 * This never touches the visible label of a link or button — only the
 * accessible name of the embed.
 */

const PROJECT_INTAKE = "Project Intake";

/**
 * `\b` matters: without it "Reintake" would match and be mangled into
 * "Re Project Intake". Neither pattern is global, so no `lastIndex` state is
 * carried between calls.
 */
const ENDS_WITH_PROJECT_INTAKE = /\bproject\s+intake\s*$/i;
const ENDS_WITH_INTAKE = /\bintake\s*$/i;

export function intakeAccessibleTitle(missionName: string | null | undefined): string {
  // Collapse runs of whitespace: a title read aloud gains nothing from them,
  // and it makes the suffix checks below behave the same for "Deck  Intake".
  const name = (missionName ?? "").replace(/\s+/g, " ").trim();
  if (!name) return PROJECT_INTAKE;

  // Already correct — including when the author capitalised it differently.
  // Their wording is the commercial name and is left exactly as written.
  if (ENDS_WITH_PROJECT_INTAKE.test(name)) return name;

  // Ends in "Intake": upgrade that word in place rather than appending a
  // second one, so "Happy Deck — Deck Intake" reads as
  // "Happy Deck — Deck Project Intake".
  if (ENDS_WITH_INTAKE.test(name)) return name.replace(ENDS_WITH_INTAKE, PROJECT_INTAKE);

  return `${name} — ${PROJECT_INTAKE}`;
}
