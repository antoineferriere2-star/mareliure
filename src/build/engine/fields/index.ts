import type { ComponentType } from "react";
import type { PlaybookFieldType } from "@/build/schema/playbook";
import { AddressField } from "./AddressField";
import { BudgetField } from "./BudgetField";
import { ConsentField } from "./ConsentField";
import { CoordinatesField } from "./CoordinatesField";
import { InspirationPhotoField } from "./InspirationPhotoField";
import { MeasurementField } from "./MeasurementField";
import { MultiChoiceField } from "./MultiChoiceField";
import { NumberField } from "./NumberField";
import { PhotoField } from "./PhotoField";
import { SingleChoiceField } from "./SingleChoiceField";
import { TextField } from "./TextField";
import { TimelineField } from "./TimelineField";
import type { FieldComponentProps } from "./types";

/**
 * Registry keyed by PlaybookField.type. The cast below is safe by
 * construction: callers always look up a component by a field's own
 * `type`, so the `field` prop passed in always matches what that specific
 * component expects — TS can't express that invariant across a keyed map,
 * hence the widening cast at registration time only.
 */
export const FIELD_COMPONENTS: Record<PlaybookFieldType, ComponentType<FieldComponentProps>> = {
  single_choice: SingleChoiceField as ComponentType<FieldComponentProps>,
  multi_choice: MultiChoiceField as ComponentType<FieldComponentProps>,
  text: TextField as ComponentType<FieldComponentProps>,
  number: NumberField as ComponentType<FieldComponentProps>,
  measurement: MeasurementField as ComponentType<FieldComponentProps>,
  budget: BudgetField as ComponentType<FieldComponentProps>,
  timeline: TimelineField as ComponentType<FieldComponentProps>,
  address: AddressField as ComponentType<FieldComponentProps>,
  photo: PhotoField as ComponentType<FieldComponentProps>,
  coordinates: CoordinatesField as ComponentType<FieldComponentProps>,
  consent: ConsentField as ComponentType<FieldComponentProps>,
  inspiration_photo: InspirationPhotoField as ComponentType<FieldComponentProps>,
};

export type { FieldComponentProps, InspirationPhotoAnalysis } from "./types";
