import type { AnswerValue } from "@/build/schema/answers";
import type { PlaybookField } from "@/build/schema/playbook";

/** Result of analyzing an inspiration photo — mirrors the public runtime API's analyze_inspiration_photo response. */
export interface InspirationPhotoAnalysis {
  photoPath: string;
  hypotheses: {
    style?: string;
    materials: string[];
    shape?: string;
    elements: string[];
    suggestedQuestions: string[];
  };
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
  analyzeInspirationPhoto?: (image: {
    base64: string;
    mediaType: string;
  }) => Promise<InspirationPhotoAnalysis>;
  /**
   * Stores one file for a `photo` field whose Playbook asks for
   * `supabase_storage`, and returns the entry to record in the answer. No
   * analysis — this one only puts the bytes somewhere the workspace can read
   * them. Absent for `filename_only` fields, which keep the old behaviour.
   */
  uploadProjectPhoto?: (file: {
    base64: string;
    mediaType: string;
    filename: string;
  }) => Promise<UploadedProjectPhoto>;
}

/** Mirrors the public runtime API's upload_project_photo response. */
export interface UploadedProjectPhoto {
  storagePath: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Marks a field the visitor cannot skip.
 *
 * Without it, an intake only tells you a field is required by refusing to
 * continue — on an eleven-step Playbook that means discovering the rule by
 * failing, sometimes on two fields of the same step at once. The asterisk is
 * aria-hidden because the input itself carries `aria-required`; announcing
 * both would read the requirement twice.
 */
export function RequiredMark({ field }: { field: PlaybookField }) {
  if (field.desirability !== "required") return null;
  return (
    <span className="ml-1 text-rose-600" aria-hidden="true">
      *
    </span>
  );
}

export const CHOICE_BUTTON_CLASS = (selected: boolean) =>
  `group min-h-20 rounded-lg border p-4 text-left text-[15px] font-medium leading-6 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2 ${
    selected
      ? "border-[color:var(--metre-accent)] bg-[color:var(--metre-accent-soft)] text-stone-950 shadow-[inset_0_0_0_1px_var(--metre-accent)]"
      : "border-stone-300 bg-[#fffdf8] text-stone-800 hover:border-stone-500 hover:bg-white"
  }`;

/**
 * Legend for choice-grid field types (single/multi choice, timeline, budget
 * ranges) — these render a custom button grid instead of native radio/
 * checkbox inputs, so a <legend> is the only thing telling a visitor which
 * question a given grid of buttons answers when a step has more than one
 * field (e.g. "property type" immediately followed by "existing condition").
 */
export const FIELD_LEGEND_CLASS = "mb-3 block text-base font-semibold text-stone-950";

/**
 * Every field component receives its own `error` prop (computed per
 * field.key in MissionRuntime's validateField loop), but most components
 * never rendered it — visitors only ever saw one generic top-level "Some
 * required information is missing or invalid" message with no indication
 * of which field caused it. This is the shared style for actually showing
 * it, matching the one component (PhotoField) that already did.
 */
export const FIELD_ERROR_CLASS = "mt-2 text-sm font-medium text-rose-700";
