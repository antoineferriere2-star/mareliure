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

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | PhotoAnswerEntry[]
  | AddressAnswerValue
  | CoordinatesAnswerValue
  | NotSure;

export type Answers = Record<string, AnswerValue>;
