import {createElement} from "react";
import type { IntakeGuidance } from "@/build/pages/public/intakeGuidance";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { workshopIntakeCopy as copy } from "@/marketplace/customer/workshopIntakeCopy";
import {WorkshopIntakeNotice} from "./WorkshopIntakeCopy";
export function workshopIntakeGuidance(locale: FineBinderyLocale = "fr"): IntakeGuidance {
  const t = copy[locale];
  return { intro: createElement(WorkshopIntakeNotice,{locale,stage:"intro"}), reviewNotice: createElement(WorkshopIntakeNotice,{locale,stage:"review"}), stepExplanations: { ouvrage: t.book, "budget-delai": t.budget, contact: t.contact }, fieldHelpText: { budget: t.budget, localisation: t.location }, fieldLabels: { consentement: t.consent }, consentTexts: { consentement: t.consent } };
}
