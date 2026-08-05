import type { SupportedLocale } from "./locales";

export const enUSMessages = {
  "marketing.hero.title": "Turn vague website inquiries into sales-ready project briefs.",
  "marketing.hero.subtitle":
    "Métré Build guides customers through project scope, photos, dimensions, constraints, budget and timing.",
  "home.hero.eyebrow": "Guided project intake for project-based contractors",
  "home.hero.title":
    "Turn vague website inquiries into structured Project Briefs your team can act on.",
  "home.hero.description":
    "Métré Build guides customers through project scope, photos, dimensions, constraints, budget and timing — so your sales team has useful context before the first call.",
  "home.hero.kicker": "More useful than a contact form. Simpler than a custom configurator.",
  "home.hero.deckIntro": "Works with any project-based business — start from a",
  "home.hero.playbookTooltip": "A reusable industry-specific project discovery method.",
  "home.hero.primaryCta": "Try the Live Deck Intake",
  "home.hero.secondaryCta": "Analyze My Website Free",
  "home.hero.disclaimer":
    "Sales-ready means ready for a productive first conversation — not a final quote or technical approval.",
  "home.problem.title":
    "Your sales team should not have to rediscover the entire project on the first call.",
  "home.problem.description":
    "Most contact forms collect identity. They rarely collect the project.",
  "home.problem.classicTitle": "Classic forms often capture",
  "home.problem.missingTitle": "They usually miss",
  "navigation.language": "Language",
  "navigation.deckBuilders": "Deck builders",
  "navigation.howItWorks": "How it works",
  "navigation.pricing": "Pricing",
  "navigation.exampleBrief": "Example brief",
  "navigation.freeAudit": "Free analysis",
  "navigation.contact": "Contact",
  "navigation.logIn": "Log in",
  "navigation.createAccount": "Create account",
  "navigation.tryDemo": "Try demo",
  "footer.description":
    "Now available for US project-based contractors. Built to turn incomplete website inquiries into structured Project Briefs.",
  "footer.product": "Product",
  "footer.conversion": "Conversion",
  "footer.legal": "Legal",
  "footer.demo": "Demo",
  "footer.setupReview": "Request a setup review",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.contact": "Contact",
  "cta.getStarted": "Get started",
  "cta.title": "See what your current website form is missing.",
  "cta.description":
    "Two minutes to review the demo. Free analysis of your own website, no account required.",
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
  "home.hero.eyebrow": "Recorrido guiado para empresas que venden proyectos",
  "home.hero.title":
    "Convierta consultas vagas de su sitio web en Project Briefs estructurados para su equipo.",
  "home.hero.description":
    "Métré Build guía a sus clientes por alcance, fotos, dimensiones, restricciones, presupuesto y plazo para que su equipo comercial tenga contexto útil antes de la primera llamada.",
  "home.hero.kicker": "Más útil que un formulario. Más simple que un configurador a medida.",
  "home.hero.deckIntro": "Funciona con cualquier negocio basado en proyectos — comience desde un",
  "home.hero.playbookTooltip":
    "Un método reutilizable de descubrimiento de proyectos por industria.",
  "home.hero.primaryCta": "Probar el intake de decks",
  "home.hero.secondaryCta": "Analizar mi sitio gratis",
  "home.hero.disclaimer":
    "Listo para ventas significa listo para una primera conversación productiva, no una cotización final ni una aprobación técnica.",
  "home.problem.title":
    "Su equipo comercial no debería tener que redescubrir todo el proyecto en la primera llamada.",
  "home.problem.description":
    "La mayoría de los formularios recopilan identidad. Rara vez recopilan el proyecto.",
  "home.problem.classicTitle": "Los formularios clásicos suelen captar",
  "home.problem.missingTitle": "Normalmente les falta",
  "navigation.language": "Idioma",
  "navigation.deckBuilders": "Constructores de terrazas",
  "navigation.howItWorks": "Cómo funciona",
  "navigation.pricing": "Precios",
  "navigation.exampleBrief": "Ejemplo de resumen",
  "navigation.freeAudit": "Auditoría gratis",
  "navigation.contact": "Contacto",
  "navigation.logIn": "Iniciar sesión",
  "navigation.createAccount": "Crear cuenta",
  "navigation.tryDemo": "Probar demo",
  "footer.description":
    "Disponible para contratistas de proyectos en EE. UU. Creado para convertir consultas incompletas del sitio web en Project Briefs estructurados.",
  "footer.product": "Producto",
  "footer.conversion": "Conversión",
  "footer.legal": "Legal",
  "footer.demo": "Demo",
  "footer.setupReview": "Solicitar revisión de configuración",
  "footer.privacy": "Privacidad",
  "footer.terms": "Términos",
  "footer.contact": "Contacto",
  "cta.getStarted": "Comience",
  "cta.title": "Vea qué le falta a su formulario actual.",
  "cta.description":
    "Dos minutos para revisar la demo. Auditoría gratis de su formulario actual y flujo de consultas si la solicita.",
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
