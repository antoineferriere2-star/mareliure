/**
 * How well a relieur fits a case, as a number between 0 and 100.
 *
 * Deterministic arithmetic over declared facts — no model, no embedding, no
 * learning (§31). The score exists to *order* a list of candidates for the
 * admin, never to decide: `selectBinders` takes ids the admin picked, and the
 * score is recorded alongside only so it can be calibrated later against what
 * humans actually chose.
 *
 * The breakdown is returned in full because a number nobody can explain is a
 * number nobody will trust. The matching screen shows the terms.
 */
import type { CaseProfile } from "@/marketplace/cases/caseProfile";

export interface BinderMatchProfile {
  id: string;
  status: string;
  skills: string[];
  /** Empty means "no restriction declared", which reads as accepting everything. */
  acceptedProjectTypes: string[];
  minProjectCents: number | null;
  maxProjectCents: number | null;
  capacitySlots: number;
  /** Cases currently in this workshop's hands. */
  activeLoad: number;
  /** 0–1, or null for a relieur who has not been invited yet. */
  responseRate: number | null;
  /** 0–5, or null before the first review. */
  ratingAvg: number | null;
}

export interface MatchScore {
  total: number;
  breakdown: {
    skills: number;
    projectType: number;
    budget: number;
    heritage: number;
    workload: number;
    trackRecord: number;
  };
  /** Required skills this relieur has not declared. Shown as-is to the admin. */
  missingSkills: string[];
}

const WEIGHTS = {
  skills: 40,
  projectType: 15,
  budget: 15,
  heritage: 10,
  workload: 10,
  trackRecord: 10,
} as const;

/** Heritage work is the one place a missing skill is nearly disqualifying. */
const HERITAGE_SKILLS = ["restauration", "conservation"] as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Does the relieur's price range overlap the budget the visitor named?
 *
 * A visitor who did not name a budget scores full marks rather than zero: not
 * knowing what a reliure costs is the normal case, and penalising every
 * relieur equally for it only adds noise.
 */
function budgetFit(profile: CaseProfile, binder: BinderMatchProfile): number {
  if (profile.budgetMinCents === null) return 1;
  const caseMin = profile.budgetMinCents;
  const caseMax = profile.budgetMaxCents ?? Number.MAX_SAFE_INTEGER;
  const binderMin = binder.minProjectCents ?? 0;
  const binderMax = binder.maxProjectCents ?? Number.MAX_SAFE_INTEGER;

  if (binderMin > caseMax) return 0; // the workshop's floor is above the budget
  if (binderMax < caseMin) return 0.5; // it could take it, but it is below its usual range
  return 1;
}

export function scoreBinder(profile: CaseProfile, binder: BinderMatchProfile): MatchScore {
  const missingSkills = profile.requiredSkills.filter((skill) => !binder.skills.includes(skill));
  const skillCoverage =
    profile.requiredSkills.length === 0
      ? 1
      : (profile.requiredSkills.length - missingSkills.length) / profile.requiredSkills.length;

  const acceptsType =
    binder.acceptedProjectTypes.length === 0 ||
    (profile.intent !== null && binder.acceptedProjectTypes.includes(profile.intent));

  const heritageFit = !profile.heritage
    ? 1
    : clamp01(
        HERITAGE_SKILLS.filter((skill) => binder.skills.includes(skill)).length /
          HERITAGE_SKILLS.length,
      );

  const capacity = binder.capacitySlots > 0 ? binder.capacitySlots : 1;
  const workload = clamp01((capacity - binder.activeLoad) / capacity);

  // Absent history is treated as average, never as bad: a new workshop must be
  // able to receive its first project.
  const responseTerm = binder.responseRate === null ? 0.5 : clamp01(binder.responseRate);
  const ratingTerm = binder.ratingAvg === null ? 0.5 : clamp01(binder.ratingAvg / 5);
  const trackRecord = (responseTerm + ratingTerm) / 2;

  const breakdown = {
    skills: WEIGHTS.skills * clamp01(skillCoverage),
    projectType: acceptsType ? WEIGHTS.projectType : 0,
    budget: WEIGHTS.budget * budgetFit(profile, binder),
    heritage: WEIGHTS.heritage * heritageFit,
    workload: WEIGHTS.workload * workload,
    trackRecord: WEIGHTS.trackRecord * trackRecord,
  };

  const total = Math.round(
    breakdown.skills +
      breakdown.projectType +
      breakdown.budget +
      breakdown.heritage +
      breakdown.workload +
      breakdown.trackRecord,
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      skills: Math.round(breakdown.skills),
      projectType: Math.round(breakdown.projectType),
      budget: Math.round(breakdown.budget),
      heritage: Math.round(breakdown.heritage),
      workload: Math.round(breakdown.workload),
      trackRecord: Math.round(breakdown.trackRecord),
    },
    missingSkills,
  };
}

export interface RankedBinder extends MatchScore {
  binder: BinderMatchProfile;
}

/**
 * Every approved relieur, best first. Only `approved` workshops are ranked —
 * a draft or suspended profile must never appear on the matching screen, where
 * one click would invite it.
 */
export function rankBinders(
  profile: CaseProfile,
  binders: readonly BinderMatchProfile[],
): RankedBinder[] {
  return binders
    .filter((binder) => binder.status === "approved")
    .map((binder) => ({ binder, ...scoreBinder(profile, binder) }))
    .sort((a, b) => b.total - a.total || a.binder.id.localeCompare(b.binder.id));
}
