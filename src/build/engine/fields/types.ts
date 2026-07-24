import type { AnswerValue } from "@/build/schema/answers";
import type { PlaybookField } from "@/build/schema/playbook";

/** Result of analyzing an inspiration photo — mirrors the public runtime API's analyze_inspiration_photo response. */
export interface InspirationPhotoAnalysis {
  photoPath: string;
  hypotheses: { style?: string; materials: string[]; shape?: string; elements: string[]; suggestedQuestions: string[] };
}

/**
 * Shared contract for every generic field component. A component reads its
 * config entirely from `field` (options, labels, units, thresholds...) — it
 * must never hardcode copy or business rules itself (CLAUDE.md).
 */
export interface FieldComponentProps<F extends PlaybookField = PlaybookField> {
  field: F;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string | null;
  disabled?: boolean;
  /**
   * Injected by the runtime for field types that need a server round-trip
   * beyond the answer itself — today only inspiration_photo, which uploads
   * the image and runs vision analysis via the public runtime API. The
   * component itself never knows about session_id/session_secret.
   */
  analyzeInspirationPhoto?: (image: { base64: string; mediaType: string }) => Promise<InspirationPhotoAnalysis>;
}

export const CHOICE_BUTTON_CLASS = (selected: boolean) =>
  `rounded-md border p-4 text-left text-sm font-medium ${
    selected ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
  }`;
