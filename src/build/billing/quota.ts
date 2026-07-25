// Pure quota logic, kept separate from the DB-wrapper server functions so
// it can be unit tested directly.

/** True once the workspace already has as many active Missions as its plan allows. */
export function wouldExceedActiveMissions(
  currentActiveCount: number,
  maxActiveMissions: number,
): boolean {
  return currentActiveCount >= maxActiveMissions;
}

export type UsageLevel = "ok" | "warning" | "over";

/** Project Briefs are never blocked on this — this only drives the 80%/100% warning display. */
export function usageLevel(used: number, quota: number): UsageLevel {
  if (quota <= 0) return "ok";
  const ratio = used / quota;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}
