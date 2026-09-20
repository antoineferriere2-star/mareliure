/**
 * What a deployment may add around a Guided Project Intake without the Mission
 * knowing the business it runs for.
 *
 * `MissionRuntime` renders whatever Playbook it is given; it never decides what
 * a spine is, how long a workshop takes to answer, or which photo a binder
 * wants first. Those are the deployment's words, supplied by the route — the
 * same seam `renderAfterSubmission` already is for the screen after sending.
 * Every part is optional: a Mission run with no guidance renders exactly as it
 * did before this existed.
 */
import type { ReactNode } from "react";
import type { GlossaryEntry } from "@/build/engine/glossary";
import type { PhotoShot } from "@/build/engine/fields/types";

export type { GlossaryEntry, PhotoShot };

export interface IntakeGuidance {
  /**
   * What the visitor gets and what they must not do yet — shown once, above the
   * first question. The runtime places it and knows nothing of its content.
   */
  intro?: ReactNode;
  /** The views to capture for a photo field, keyed by that field's key. */
  photoShots?: Record<string, PhotoShot[]>;
  /** Words to explain, shown under the step whose text actually uses them. */
  glossary?: GlossaryEntry[];
  /** A reminder shown on the last look, just above "Send" — what sending does and does not commit the visitor to. */
  reviewNotice?: ReactNode;
}
