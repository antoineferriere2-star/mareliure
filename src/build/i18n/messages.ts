import type { SupportedLocale } from "./locales";

export const enUSMessages = {
  "marketing.hero.title": "Turn vague website inquiries into sales-ready project briefs.",
  "marketing.hero.subtitle":
    "Métré Build guides customers through project scope, photos, dimensions, constraints, budget and timing.",
  "navigation.deckBuilders": "Deck builders",
  "navigation.howItWorks": "How it works",
  "navigation.exampleBrief": "Example brief",
  "navigation.freeAudit": "Free audit",
  "auth.forgotPassword": "Forgot password?",
  "intake.navigation.next": "Continue",
  "intake.navigation.back": "Back",
  "intake.navigation.submit": "Submit",
  "intake.answers.notSure": "Not sure",
  "intake.photo.noDetection":
    "We could not identify enough project-related information from this image. You can upload another photo or continue without image analysis.",
  "brief.sections.confirmed": "Confirmed information",
  "brief.sections.calculated": "Assumptions and calculated information",
  "brief.sections.constraints": "Constraints",
  "brief.sections.missing": "Missing information",
  "brief.sections.budgetAndTiming": "Budget and timing",
  "brief.provenance.customerProvided": "Customer provided",
  "brief.provenance.calculated": "Calculated",
  "brief.provenance.businessRule": "Business rule",
  "brief.provenance.needsVerification": "Needs verification",
  "brief.suggestedNextAction": "Suggested next action",
  "settings.language.title": "Language",
  "settings.visitorLanguages.title": "Languages available to visitors",
  "settings.measurementSystem.title": "Measurement system",
  "settings.measurementSystem.imperial": "Imperial — feet, inches, square feet",
  "settings.measurementSystem.metric": "Metric — meters, centimeters, square meters",
  "settings.measurementSystem.scope":
    "Measurement system controls dimensions and calculations in newly created Project Intakes.",
} as const;

export type TranslationKey = keyof typeof enUSMessages;
export type TranslationMessages = Record<TranslationKey, string>;

export const esUSMessages: Partial<TranslationMessages> = {
  "navigation.deckBuilders": "Constructores de terrazas",
  "navigation.howItWorks": "Cómo funciona",
  "navigation.exampleBrief": "Ejemplo de resumen",
  "navigation.freeAudit": "Auditoría gratis",
  "auth.forgotPassword": "¿Olvidó su contraseña?",
  "intake.navigation.next": "Continuar",
  "intake.navigation.back": "Atrás",
  "intake.navigation.submit": "Enviar",
  "intake.answers.notSure": "No estoy seguro",
  "intake.photo.noDetection":
    "No pudimos identificar suficiente información relacionada con el proyecto en esta imagen. Puede subir otra foto o continuar sin el análisis de imagen.",
  "brief.sections.confirmed": "Información confirmada",
  "brief.sections.calculated": "Suposiciones e información calculada",
  "brief.sections.constraints": "Restricciones",
  "brief.sections.missing": "Información pendiente",
  "brief.sections.budgetAndTiming": "Presupuesto y plazo",
  "brief.provenance.customerProvided": "Proporcionado por el cliente",
  "brief.provenance.calculated": "Calculado",
  "brief.provenance.businessRule": "Regla del negocio",
  "brief.provenance.needsVerification": "Requiere verificación",
  "brief.suggestedNextAction": "Próximo paso sugerido",
  "settings.language.title": "Idioma",
  "settings.visitorLanguages.title": "Idiomas disponibles para visitantes",
  "settings.measurementSystem.title": "Sistema de medidas",
  "settings.measurementSystem.imperial": "Imperial — pies, pulgadas, pies cuadrados",
  "settings.measurementSystem.metric": "Métrico — metros, centímetros, metros cuadrados",
  "settings.measurementSystem.scope":
    "El sistema de medidas controla dimensiones y cálculos en los nuevos recorridos guiados del proyecto.",
};

export const messagesByLocale: Record<SupportedLocale, Partial<TranslationMessages>> = {
  "en-US": enUSMessages,
  "es-US": esUSMessages,
};
