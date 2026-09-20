import { remainingMinutes, type IntakeProgress } from "@/build/engine/progress";

/**
 * The line under the step segments: "Step 3 of 9 · about 4 min left".
 *
 * Whole dictionary entries composed the way the old "Step / of / complete"
 * were — never one sentence with holes, so a locale keeps its own word order
 * for each piece. No percentage: it was computed from a total that moves.
 */
export function formatProgress(
  progress: IntakeProgress,
  copy: (text: string) => string,
): string {
  const of = copy(progress.totalIsProvisional ? "of at least" : "of");
  const position = `${copy("Step")} ${progress.position} ${of} ${progress.total}`;
  const minutes = remainingMinutes(progress.remainingSeconds);
  const left =
    minutes === null
      ? copy("Less than a minute left")
      : `${copy("About")} ${minutes} ${copy("min left")}`;
  return `${position} · ${left}`;
}
