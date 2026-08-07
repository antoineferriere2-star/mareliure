/**
 * Shared answer-value shape for the generic Playbook runtime. A flat map
 * keyed by PlaybookField.key (never by position — positions break once
 * fields can be conditionally hidden).
 */

export const NOT_SURE_VALUE = "__NOT_SURE__" as const;
export type NotSure = typeof NOT_SURE_VALUE;

export interface PhotoAnswerEntry {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  /**
   * Where the file actually lives, for a field whose Playbook sets
   * `storage: "supabase_storage"`. Absent on `filename_only` fields and on
   * every answer recorded before uploads existed — those entries carry the
   * name of a file nobody kept, and there is no way to recover it.
   */
  storagePath?: string;
}

export interface AddressAnswerValue {
  zip?: string;
  city_state?: string;
  street?: string;
  country?: string;
}

export interface CoordinatesAnswerValue {
  lat: number;
  lng: number;
  accuracyM?: number;
}

/** Dimensions the vision AI agent can propose for an inspiration photo — see schema/playbook.ts's inspirationPhotoField. */
export interface InspirationPhotoHypotheses {
  style?: string;
  materials: string[];
  shape?: string;
  elements: string[];
}

export type InspirationHypothesisKey = "style" | "materials" | "shape" | "elements";

export interface InspirationPhotoAnswer {
  /** Path in the build-inspiration-photos Storage bucket — never a raw URL, resolved to a signed URL on read. */
  photoPath: string;
  hypotheses: InspirationPhotoHypotheses;
  /** Which hypothesis dimensions the visitor explicitly confirmed or edited (vs. left as an unverified AI guess). */
  confirmed: Partial<Record<InspirationHypothesisKey, boolean>>;
  suggestedQuestions: string[];
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | PhotoAnswerEntry[]
  | AddressAnswerValue
  | CoordinatesAnswerValue
  | InspirationPhotoAnswer
  | NotSure;

export type Answers = Record<string, AnswerValue>;
