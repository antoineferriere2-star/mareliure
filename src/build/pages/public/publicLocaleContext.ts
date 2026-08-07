import { createContext, useContext } from "react";
import { DEFAULT_LOCALE } from "@/build/i18n";
import type { SupportedLocale } from "@/build/i18n";

export type { SupportedLocale } from "@/build/i18n";

export const PUBLIC_LOCALE_STORAGE_KEY = "metre-build-public-locale";

export interface PublicLocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

export const PublicLocaleContext = createContext<PublicLocaleContextValue | null>(null);

export const PUBLIC_LANGUAGE_OPTIONS: Array<{
  locale: SupportedLocale;
  shortLabel: string;
  label: string;
}> = [
  { locale: "en-US", shortLabel: "EN", label: "English" },
  { locale: "es-US", shortLabel: "ES", label: "Español" },
];

export function usePublicLocale() {
  const context = useContext(PublicLocaleContext);
  if (!context) {
    throw new Error("usePublicLocale must be used within PublicLocaleProvider.");
  }
  return context;
}

export function useOptionalPublicLocale() {
  const context = useContext(PublicLocaleContext);
  return context ?? { locale: DEFAULT_LOCALE, setLocale: () => undefined };
}

export const ES_PUBLIC_COPY: Record<string, string> = {
  "Your project summary is ready": "El resumen de su proyecto está listo",
  "Your information has been sent to": "Su información ha sido enviada a",
  "No details were provided yet.": "Aún no se proporcionaron detalles.",
  "photo attached": "foto adjunta",
  "photos attached": "fotos adjuntas",
  "Still to confirm": "Aún por confirmar",
  "What happens next": "Qué sigue",
  "The team will review your project information and contact you to discuss the next step.":
    "El equipo revisará la información de su proyecto y se pondrá en contacto para hablar del próximo paso.",
  "We sent a copy of this summary to your email.":
    "Le enviamos una copia de este resumen a su correo electrónico.",
  "Review your summary": "Revisar su resumen",
  "Loading…": "Cargando…",
  "This summary link is not available.": "Este enlace de resumen no está disponible.",
  "Deck Builders": "Constructores de terrazas",
  "Qualify deck projects before the first sales call.":
    "Califique proyectos de terraza antes de la primera llamada comercial.",
  "Métré Build helps deck builders turn vague website inquiries into structured Project Briefs with scope, site context, photos, budget, timing and contact consent.":
    "Métré Build ayuda a constructores de terrazas a convertir consultas vagas del sitio web en Project Briefs estructurados con alcance, contexto del sitio, fotos, presupuesto, plazo y consentimiento de contacto.",
  "Analyze My Website Free": "Analizar mi sitio gratis",
  "Try the Live Deck Intake": "Probar el intake de decks",
  "Frequent inquiry gaps": "Brechas frecuentes en las consultas",
  "Prospects do not know dimensions": "Los prospectos no conocen las dimensiones",
  "Photos arrive later by text": "Las fotos llegan después por mensaje",
  "Existing structure condition is unclear": "El estado de la estructura existente no está claro",
  "Budget and timing are missing": "Faltan presupuesto y plazo",
  "Access constraints are discovered too late":
    "Las restricciones de acceso se descubren demasiado tarde",
  "Sales has to rediscover the project from scratch":
    "Ventas tiene que redescubrir el proyecto desde cero",
  "What the Deck Playbook collects": "Qué recopila el Deck Playbook",
  "New deck, replacement, extension or resurfacing":
    "Terraza nueva, reemplazo, ampliación o renovación de superficie",
  "Property and existing site condition": "Propiedad y estado actual del sitio",
  "Approximate length, width or area": "Longitud, ancho o área aproximados",
  "Height, stairs and access limitations": "Altura, escaleras y limitaciones de acceso",
  "Material preference": "Preferencia de material",
  "Photos or plans": "Fotos o planos",
  "Budget range and timeline": "Rango de presupuesto y plazo",
  "ZIP code, contact details and consent": "Código postal, datos de contacto y consentimiento",
  "A reusable industry-specific project discovery method.":
    "Un método reutilizable de descubrimiento de proyectos por industria.",
  "A guided project journey, not a longer contact form.":
    "Un recorrido guiado del proyecto, no un formulario más largo.",
  "Each screen asks for one important decision and explains why it matters. Visitors can choose Not sure when dimensions, materials or scope are not ready yet.":
    "Cada pantalla pide una decisión importante y explica por qué importa. Los visitantes pueden elegir No estoy seguro cuando las dimensiones, materiales o alcance aún no están listos.",
  "What the sales team receives": "Qué recibe el equipo comercial",
  "A Project Brief separates confirmed visitor answers from deterministic checks, missing information and suggested next action.":
    "Un Project Brief separa respuestas confirmadas del visitante, verificaciones determinísticas, información pendiente y la siguiente acción sugerida.",
  "See what this could look like on your website.": "Vea cómo podría verse esto en su sitio web.",
  "Benefits for the sales team": "Beneficios para el equipo comercial",
  "Start the first call with project context":
    "Empezar la primera llamada con contexto del proyecto",
  "Spot missing information before follow-up":
    "Detectar información pendiente antes del seguimiento",
  "Prioritize clearer projects": "Priorizar proyectos más claros",
  "Prepare site visit questions": "Preparar preguntas para la visita al sitio",
  "Keep early prospects in a useful workflow": "Mantener prospectos tempranos en un flujo útil",
  FAQ: "Preguntas frecuentes",
  "Does it produce a final estimate?": "¿Produce un presupuesto final?",
  "No. The demo produces a project brief, not a contractual estimate.":
    "No. La demo produce un Project Brief, no un presupuesto contractual.",
  "Can we use our own questions?": "¿Podemos usar nuestras propias preguntas?",
  "You can customize the journey around your sales process.":
    "Puede personalizar el recorrido según su proceso comercial.",
  "Does it replace sales?": "¿Reemplaza al equipo comercial?",
  "No. It prepares the first conversation so sales can move faster with better context.":
    "No. Prepara la primera conversación para que ventas avance más rápido con mejor contexto.",
  "Is this self-service?": "¿Es autoservicio?",
  "Setup is currently guided - we configure your first Playbook with you, and once published it runs on your site for visitors who choose to start it.":
    "La configuración actualmente es guiada: configuramos su primer Playbook con usted y, una vez publicado, funciona en su sitio para los visitantes que decidan iniciarlo.",
  "How it works": "Cómo funciona",
  "From vague inquiry to structured Project Brief.":
    "De una consulta vaga a un Project Brief estructurado.",
  "Métré Build gives prospects a guided project journey and gives the business a brief that prepares the first sales call.":
    "Métré Build ofrece a los prospectos un recorrido guiado y al negocio un brief que prepara la primera llamada comercial.",
  "See an example brief": "Ver un brief de ejemplo",
  "From website audit to live Project Intake": "De auditoría del sitio a Project Intake en vivo",
  "We review your website": "Revisamos su sitio web",
  "We identify what your current inquiry journey collects and what your sales team still has to ask.":
    "Identificamos qué recopila su recorrido actual y qué todavía debe preguntar su equipo comercial.",
  "You start from a ready-to-use Playbook": "Comienza con un Playbook listo para usar",
  "We match your business and selected service with the closest available Project Intake.":
    "Conectamos su negocio y servicio seleccionado con el Project Intake disponible más cercano.",
  "You review and adjust it": "Lo revisa y ajusta",
  "Confirm the wording, optional questions, branding and Project Brief.":
    "Confirme textos, preguntas opcionales, marca y Project Brief.",
  "Add it to your site": "Añádalo a su sitio",
  "Publish it with a link or simple website snippet.":
    "Publíquelo con un enlace o un snippet simple para el sitio web.",
  "What stays private": "Qué permanece privado",
  "Runtime sessions": "Sesiones de ejecución",
  "Real Project Briefs": "Project Briefs reales",
  "Visitor answers": "Respuestas de visitantes",
  "Private Playbooks": "Playbooks privados",
  "Knowledge Records": "Registros de conocimiento",
  Administration: "Administración",
  "Example - fictional project created for demonstration purposes":
    "Ejemplo: proyecto ficticio creado con fines de demostración",
  "Example Project Brief": "Project Brief de ejemplo",
  "This page uses fictional data only. It shows the kind of structured output a deck builder can review after a guided Project Intake.":
    "Esta página usa solo datos ficticios. Muestra el tipo de salida estructurada que un constructor de terrazas puede revisar después de un Project Intake guiado.",
  "Want Project Briefs like this from your own website?":
    "¿Quiere Project Briefs como este desde su propio sitio web?",
  "Start with a ready-to-use industry journey, adapt it to your business and add it to your website with a link or simple snippet.":
    "Comience con un recorrido sectorial listo para usar, adáptelo a su negocio y agréguelo a su sitio con un enlace o snippet simple.",
  // /free-inquiry-audit — the analysis page. The strings it replaced (the
  // old contact form: "Audit My Website", "Free Website Inquiry Audit for
  // Deck Builders") are gone with the form itself.
  "Free website analysis": "Análisis gratis de su sitio web",
  "See what Métré Build finds on your website.":
    "Vea lo que Métré Build encuentra en su sitio web.",
  "Enter your website URL. We'll analyze what your business offers and suggest a project intake. No account, no email address.":
    "Ingrese la URL de su sitio web. Analizaremos lo que ofrece su negocio y le propondremos un intake de proyecto. Sin cuenta y sin correo electrónico.",
  "Your website address": "La dirección de su sitio web",
  "Analyze my site": "Analizar mi sitio",
  "Analyzing…": "Analizando…",
  "Analyzing your website… this takes a few seconds.":
    "Analizando su sitio web… esto toma unos segundos.",
  "Try again": "Intentar de nuevo",
  "We could not analyze that address. Check it and try again.":
    "No pudimos analizar esa dirección. Verifíquela e intente de nuevo.",
  "We read the public page at that address. Nothing is published and nothing is sent to anyone.":
    "Leemos la página pública de esa dirección. No se publica nada ni se envía nada a nadie.",
  "Analyzed page": "Página analizada",
  "Business type": "Tipo de negocio",
  "Services detected": "Servicios detectados",
  "No specific service was named on this page.":
    "Esta página no menciona ningún servicio específico.",
  "What we found": "Lo que encontramos",
  "Proved means the page says it. Assumed means we inferred it — you correct those during setup.":
    "Comprobado significa que la página lo dice. Supuesto significa que lo dedujimos: usted lo corrige durante la configuración.",
  "Create your account to publish this on your website":
    "Cree su cuenta para publicar esto en su sitio web",
  "We turn this into a guided project intake your customers fill in, and you get a structured brief instead of a name and a phone number. You confirm everything before anything goes live.":
    "Lo convertimos en un intake de proyecto guiado que sus clientes completan, y usted recibe un brief estructurado en lugar de un nombre y un teléfono. Usted confirma todo antes de que algo se publique.",
  "Create my account": "Crear mi cuenta",
  "Analyze another address": "Analizar otra dirección",
  Proved: "Comprobado",
  Assumed: "Supuesto",
  "Nothing conclusive on this page.": "Nada concluyente en esta página.",
  "Website URL": "URL del sitio web",
  "Work email": "Email laboral",
  "First name": "Nombre",
  "What is your biggest issue with website inquiries? (optional)":
    "¿Cuál es su mayor problema con las consultas del sitio web? (opcional)",
  "I consent to Métré Build processing this request for review and follow-up.":
    "Acepto que Métré Build procese esta solicitud para revisión y seguimiento.",
  "Request received. We will review it internally before any follow-up.":
    "Solicitud recibida. La revisaremos internamente antes de cualquier seguimiento.",
  Submitting: "Enviando",
  "Unable to submit this request.": "No se pudo enviar esta solicitud.",
  "Name is required.": "El nombre es obligatorio.",
  "Subject is required.": "El asunto es obligatorio.",
  "Message is required.": "El mensaje es obligatorio.",
  "Enter a valid email.": "Ingrese un email válido.",
  "Consent is required.": "El consentimiento es obligatorio.",
  "Contact Métré Build": "Contactar a Métré Build",
  "Send a direct message to the Métré Build team. We reply from contact@metre-pro.com.":
    "Envíe un mensaje directo al equipo de Métré Build. Respondemos desde contact@metre-pro.com.",
  "Company (optional)": "Empresa (opcional)",
  Subject: "Asunto",
  "Send message": "Enviar mensaje",
  Sending: "Enviando",
  "Unable to send this message.": "No se pudo enviar este mensaje.",
  "Message sent. We will reply from contact@metre-pro.com.":
    "Mensaje enviado. Responderemos desde contact@metre-pro.com.",
  "Setup review": "Revisión de configuración",
  "Request a setup review": "Solicitar revisión de configuración",
  "Tell us about your business and we'll get back to you about setting up a guided Project Intake for your website.":
    "Cuéntenos sobre su negocio y le responderemos sobre la configuración de un Project Intake guiado para su sitio web.",
  Website: "Sitio web",
  "Monthly inquiries": "Consultas mensuales",
  Contact: "Contacto",
  "Deck builder": "Constructor de terrazas",
  "General contractor": "Contratista general",
  Other: "Otro",
  "Not sure": "No estoy seguro",
  "What best describes your business?": "¿Qué describe mejor su negocio?",
  "Tell us what your business does": "Cuéntenos qué hace su negocio",
  "How many website inquiries do you get per month?":
    "¿Cuántas consultas del sitio web recibe por mes?",
  Email: "Email",
  Back: "Atrás",
  Continue: "Continuar",
  "Submit request": "Enviar solicitud",
  "Before / after": "Antes / después",
  "Same inquiry. A structured Project Brief instead of a blank message.":
    "La misma consulta. Un Project Brief estructurado en lugar de un mensaje vacío.",
  "The same visitor, guided by a Playbook instead of a single text box, produces a brief the sales team can act on immediately.":
    "El mismo visitante, guiado por un Playbook en lugar de una sola caja de texto, produce un brief sobre el que ventas puede actuar de inmediato.",
  "Generic website form": "Formulario web genérico",
  Name: "Nombre",
  Message: "Mensaje",
  "No dimensions, no site conditions, no budget range, no timeline — the sales team starts from a blank slate.":
    "Sin dimensiones, condiciones del sitio, rango de presupuesto ni plazo: el equipo comercial empieza desde cero.",
  "Approximate answers are welcome": "Las respuestas aproximadas son bienvenidas",
  "Ranges, 'not sure' and 'need to check' are first-class answers.":
    "Rangos, 'no estoy seguro' y 'necesito verificar' son respuestas válidas.",
  "Missing information is clearly identified":
    "La información pendiente queda claramente identificada",
  "Gaps are flagged in the brief so sales can prepare the right questions.":
    "Las brechas se marcan en el brief para que ventas prepare las preguntas correctas.",
  "Assumptions are never presented as facts": "Las suposiciones nunca se presentan como hechos",
  "Every line shows its source: customer answer, business rule, or calculated value.":
    "Cada línea muestra su fuente: respuesta del cliente, regla de negocio o valor calculado.",
  "Inside Métré Build": "Dentro de Métré Build",
  "What your team sees, and how a Playbook gets set up in the first place.":
    "Lo que ve su equipo y cómo se configura un Playbook desde el inicio.",
  "Project Intakes at a glance": "Project Intakes de un vistazo",
  "Every guided journey, its status and its Playbook in one list.":
    "Cada recorrido guiado, su estado y su Playbook en una sola lista.",
  "Project Briefs ready to work": "Project Briefs listos para trabajar",
  "Confidence and missing information surfaced before the first call.":
    "Confianza e información pendiente visibles antes de la primera llamada.",
  "Website setup in minutes": "Configuración web en minutos",
  "Point it at a business's website — the business type and a matching Playbook are proposed automatically.":
    "Apúntelo al sitio web de un negocio: el tipo de negocio y un Playbook compatible se proponen automáticamente.",
  "Guided Project Intake": "Project Intake guiado",
  "Project Brief": "Project Brief",
  "Detected from the provided information": "Detectado a partir de la información proporcionada",
  Confirmed: "Confirmado",
  "Not detected — add details if needed": "No detectado: agregue detalles si hace falta",
  "Analyzing the image…": "Analizando la imagen…",
  "AI observations — review and confirm": "Observaciones de IA: revisar y confirmar",
  Style: "Estilo",
  Materials: "Materiales",
  Shape: "Forma",
  Elements: "Elementos",
  "Topics to review with the sales team:": "Temas para revisar con el equipo comercial:",
  Confidence: "Confianza",
  "One guided Mission in, one structured Project Brief out.":
    "Una Mission guiada entra, un Project Brief estructurado sale.",
  Mission: "Mission",
  Completion: "Completitud",
  "Qualification confidence": "Confianza de calificación",
  "items to verify": "elementos por verificar",
  "item to verify": "elemento por verificar",
  "None provided.": "No proporcionado.",
  Source: "Fuente",
  "Suggested next action": "Siguiente acción sugerida",
  "Project summary": "Resumen del proyecto",
  "Confirmed details": "Detalles confirmados",
  Constraints: "Restricciones",
  "Missing information": "Información pendiente",
  "Nothing critical missing.": "No falta nada crítico.",
  "View the full example brief": "Ver el brief completo de ejemplo",
  "View the full example brief →": "Ver el brief completo de ejemplo →",
  "Preparing your project intake…": "Preparando el recorrido de su proyecto…",
  "This is taking longer than usual.": "Esto está tardando más de lo habitual.",
  "Mission complete": "Mission completa",
  "Project brief generated": "Project Brief generado",
  "This mission has no questions yet.": "Esta Mission aún no tiene preguntas.",
  "Working…": "Procesando…",
  "Generate project brief": "Generar Project Brief",
  "Your answers are saved as you go — you can close this tab and come back.":
    "Sus respuestas se guardan sobre la marcha: puede cerrar esta pestaña y volver después.",
  "Unable to load mission": "No se pudo cargar la Mission",
  "Unable to save answers": "No se pudieron guardar las respuestas",
  "Unable to submit": "No se pudo enviar",
  confidence: "confianza",
  complete: "completo",
  "before the first call — nothing here is a final quote.":
    "antes de la primera llamada: nada de esto es una cotización final.",
  "Customer provided": "Proporcionado por el cliente",
  Calculated: "Calculado",
  "Business rule": "Regla de negocio",
  "Needs verification": "Requiere verificación",
  "Confirmed information": "Información confirmada",
  "Assumptions & calculated information": "Suposiciones e información calculada",
  "Budget and timing": "Presupuesto y plazo",
  high: "alta",
  medium: "media",
  low: "baja",
  High: "Alta",
  Medium: "Media",
  Low: "Baja",
  draft: "borrador",
  active: "activo",
  paused: "pausado",
  archived: "archivado",
  New: "Nuevo",
  Contacted: "Contactado",
  Quoted: "Cotizado",
  Won: "Ganado",
  Lost: "Perdido",
  Status: "Estado",
  Created: "Creado",
  Summary: "Resumen",
  "Project Intake": "Project Intake",
  missing: "pendiente",
  Playbook: "Playbook",
  "Deck Project Journey": "Recorrido Deck Project",
  "Deck Projects": "Proyectos de terrazas",
  "Pool & Spa Intake": "Intake de piscinas y spas",
  "Pools & Spas": "Piscinas y spas",
  "Window Replacement — Spring promo": "Reemplazo de ventanas: promo de primavera",
  "Windows & Doors": "Ventanas y puertas",
  "Qualify inbound deck requests before the first call":
    "Calificar solicitudes de terraza antes de la primera llamada",
  "Early-access Playbook for pool builders":
    "Playbook de acceso temprano para constructores de piscinas",
  "New deck for Jane Miller — Fort Myers, FL": "Terraza nueva para Jane Miller — Fort Myers, FL",
  "Deck resurfacing — exact dimensions unclear":
    "Renovación de terraza: dimensiones exactas no claras",
  "Pool inquiry — budget not confirmed": "Consulta de piscina: presupuesto no confirmado",
  "Deck Project — Jane Miller": "Deck Project — Jane Miller",
  "Deck Project Intake Demo": "Demo de Deck Project Intake",
  "New deck for a single-family home around 320 sq ft with interest in composite":
    "Terraza nueva para una vivienda unifamiliar de unos 320 pies cuadrados con interés en material composite",
  "Deck replacement for a single-family home around 252 sq ft with interest in composite":
    "Reemplazo de terraza para una vivienda unifamiliar de unos 252 pies cuadrados con interés en material composite",
  "Project type": "Tipo de proyecto",
  "Property type": "Tipo de propiedad",
  "Existing situation": "Situación existente",
  "Approximate area": "Área aproximada",
  "Height / access": "Altura / acceso",
  "Desired material": "Material deseado",
  "Desired features": "Elementos deseados",
  Photos: "Fotos",
  "Budget range": "Rango de presupuesto",
  Timeline: "Plazo",
  Location: "Ubicación",
  "Contact details": "Datos de contacto",
  "Preferred contact": "Contacto preferido",
  Consent: "Consentimiento",
  Access: "Acceso",
  Permits: "Permisos",
  "New deck": "Terraza nueva",
  "Deck replacement": "Reemplazo de terraza",
  "Deck resurfacing": "Renovación de superficie de terraza",
  "Single-family home": "Vivienda unifamiliar",
  "No existing deck": "Sin terraza existente",
  "Existing wood deck": "Terraza de madera existente",
  "Ground-level": "A nivel del suelo",
  Elevated: "Elevada",
  "Stairs required": "Escaleras requeridas",
  "Access limitations": "Limitaciones de acceso",
  Composite: "Composite",
  Railing: "Barandilla",
  Stairs: "Escaleras",
  Lighting: "Iluminación",
  "Privacy screen": "Pantalla de privacidad",
  "Within 3 months": "Dentro de 3 meses",
  Phone: "Teléfono",
  true: "sí",
  "Budget/timeline": "Presupuesto/plazo",
  "Missing photos": "Fotos pendientes",
  "Permit requirements": "Requisitos de permisos",
  "Permit requirements were not assessed in this demo.":
    "Los requisitos de permisos no se evaluaron en esta demo.",
  "Visitor reported access limitations.": "El visitante indicó limitaciones de acceso.",
  "Need to confirm exact permit requirements and whether the existing framing can be reused.":
    "Hay que confirmar los requisitos exactos de permisos y si se puede reutilizar la estructura existente.",
  "Confirm permit requirements and existing structure condition before any estimate.":
    "Confirme requisitos de permisos y estado de la estructura existente antes de cualquier estimación.",
  "How would you like to start?": "¿Cómo le gustaría empezar?",
  "I know what I want": "Sé lo que quiero",
  "I'm not sure yet": "Aún no estoy seguro",
  "Tell us about the property and current site": "Cuéntenos sobre la propiedad y el sitio actual",
  "Approximate dimensions": "Dimensiones aproximadas",
  "Height and access": "Altura y acceso",
  "Height/access": "Altura/acceso",
  "Budget and timeline": "Presupuesto y plazo",
  "Project location": "Ubicación del proyecto",
  "Contact details and consent": "Datos de contacto y consentimiento",
  Townhouse: "Casa adosada",
  "Commercial property": "Propiedad comercial",
  "Existing composite deck": "Terraza de composite existente",
  "Patio or concrete slab": "Patio o losa de concreto",
  "Deck extension": "Ampliación de terraza",
  "Length (ft)": "Largo (pies)",
  "Width (ft)": "Ancho (pies)",
  "Approx. total area": "Área total aprox.",
  "Second-story": "Segundo piso",
  "Pressure-treated wood": "Madera tratada a presión",
  "Cedar or hardwood": "Cedro o madera dura",
  PVC: "PVC",
  Pergola: "Pérgola",
  "Built-in seating": "Asientos empotrados",
  "Upload up to 6 photos": "Suba hasta 6 fotos",
  "No photos were attached in this demo session.":
    "No se adjuntaron fotos en esta sesión de demostración.",
  "JPG, PNG, WEBP or HEIC. 8 MB max each.": "JPG, PNG, WEBP o HEIC. Máximo 8 MB cada una.",
  "Under $10k": "Menos de $10k",
  "Not sure yet": "Aún no estoy seguro",
  "As soon as possible": "Lo antes posible",
  "3-6 months": "3-6 meses",
  "6-12 months": "6-12 meses",
  "Just exploring": "Solo explorando",
  "ZIP code": "Código postal",
  "City / State": "Ciudad / Estado",
  "No preference": "Sin preferencia",
  "I consent to sharing this demo request for review and follow-up.":
    "Doy mi consentimiento para compartir esta solicitud de demostración para su revisión y seguimiento.",
  "Phone number was not provided.": "No se proporcionó número de teléfono.",
  "Exact dimensions": "Dimensiones exactas",
  "Approximate dimensions were not confirmed.":
    "Las dimensiones aproximadas no fueron confirmadas.",
  "Existing structure": "Estructura existente",
  Timing: "Cronograma",
  "Fast timeline should be confirmed before promising availability.":
    "El plazo acelerado debe confirmarse antes de prometer disponibilidad.",
  "Structural condition": "Condición estructural",
  "Existing structure condition requires human review.":
    "La condición de la estructura existente requiere revisión humana.",
  "Confirm dimensions and site constraints, then schedule a site visit before preparing a detailed estimate.":
    "Confirme las dimensiones y las limitaciones del sitio, luego programe una visita antes de preparar una estimación detallada.",
  "Deck project brief": "Project Brief de terraza",
  "Deck project inquiry with limited information.":
    "Consulta de proyecto de terraza con información limitada.",
  "Some visitors already know exactly what they want; others prefer to start from an inspiration photo.":
    "Algunos visitantes ya saben exactamente lo que quieren; otros prefieren empezar desde una foto de inspiración.",
  "We'll help you turn that inspiration into a project your contractor can understand.":
    "Le ayudaremos a convertir esa inspiración en un proyecto que su contratista pueda entender.",
  "The project type changes the questions a builder needs before the first call.":
    "El tipo de proyecto cambia las preguntas que un constructor necesita antes de la primera llamada.",
  "Existing conditions help separate a simple resurfacing request from a structural project.":
    "El estado actual ayuda a diferenciar una simple renovación de superficie de un proyecto estructural.",
  "Rough measurements are enough for a first qualification brief. Exact dimensions can be confirmed later.":
    "Medidas aproximadas son suficientes para un primer brief de calificación. Las dimensiones exactas pueden confirmarse después.",
  "I'm not sure": "No estoy seguro",
  "Elevation, stairs and access constraints can change feasibility and the next sales step.":
    "La elevación, las escaleras y las limitaciones de acceso pueden cambiar la viabilidad y el siguiente paso comercial.",
  "Material preference helps sales prepare the right conversation without treating it as a final estimate.":
    "La preferencia de material ayuda a ventas a preparar la conversación adecuada sin tratarla como una estimación final.",
  "Features often reveal complexity that a free-text form misses.":
    "Las características suelen revelar una complejidad que un formulario de texto libre no capta.",
  Features: "Características",
  "Photos reduce back-and-forth and help the team spot visible constraints.":
    "Las fotos reducen las idas y vueltas y ayudan al equipo a detectar limitaciones visibles.",
  "Ranges help prioritize follow-up without making a contractual estimate.":
    "Los rangos ayudan a priorizar el seguimiento sin generar una estimación contractual.",
  "$10k-$25k": "$10k-$25k",
  "$25k-$50k": "$25k-$50k",
  "$50k+": "$50k+",
  "ZIP code and city/state help route the request and prepare local questions.":
    "El código postal y la ciudad/estado ayudan a dirigir la solicitud y preparar preguntas locales.",
  "The business needs permission to review and respond to the project request.":
    "El negocio necesita permiso para revisar y responder a la solicitud del proyecto.",
  Text: "Mensaje de texto",
  "Project scope": "Alcance del proyecto",
  "Visitor is unsure which deck project type fits.":
    "El visitante no está seguro de qué tipo de proyecto de terraza corresponde.",
  "Modern minimalist": "Minimalista moderno",
  "Composite decking": "Tarima composite",
  "Black aluminum railing": "Barandilla de aluminio negro",
  "Rectangular, multi-level": "Rectangular, multinivel",
  "Built-in bench": "Banco integrado",
  "Recessed lighting": "Iluminación empotrada",
  "Confirm whether the multi-level layout follows the yard's slope or is a design preference.":
    "Confirme si el diseño multinivel sigue la pendiente del patio o es una preferencia de diseño.",
  "Ask if recessed lighting needs a dedicated electrical run.":
    "Pregunte si la iluminación empotrada necesita una línea eléctrica dedicada.",
  "Upload an inspiration photo": "Subir una foto de inspiración",
  "A photo of your own space, a Pinterest/Instagram screenshot, or a catalog picture — whatever inspired your project.":
    "Una foto de su espacio, una captura de Pinterest/Instagram o una imagen de catálogo: lo que haya inspirado su proyecto.",
  "Schematic illustration of a backyard deck with railing and stairs":
    "Ilustración esquemática de una terraza trasera con barandilla y escaleras",
  "Schematic — not an actual photo": "Esquema: no es una foto real",
  "Start from a photo": "Comenzar con una foto",
  "Customers who don't have the words can start from a picture instead.":
    "Los clientes que no tienen las palabras pueden empezar con una imagen.",
  "An inspiration photo — their own yard, a screenshot, a catalog picture — is analyzed and turned into hypotheses the visitor confirms or corrects. Nothing is presented as fact until they say so.":
    "Una foto de inspiración — su propio patio, una captura o una imagen de catálogo — se analiza y se convierte en hipótesis que el visitante confirma o corrige. Nada se presenta como hecho hasta que lo diga.",
  "What kind of deck project is this?": "¿Qué tipo de proyecto de terraza es?",
  "Where is this project?": "¿Dónde está este proyecto?",
  "What is the existing situation?": "¿Cuál es la situación existente?",
  "About how large is the deck area?": "¿Qué tamaño aproximado tiene el área de la terraza?",
  "Show us what inspired your project": "Muéstrenos qué inspiró su proyecto",
  "What material are you considering?": "¿Qué material está considerando?",
  "Which features matter?": "¿Qué elementos importan?",
  "What budget range feels realistic?": "¿Qué rango de presupuesto parece realista?",
  "When would you like this done?": "¿Cuándo le gustaría terminarlo?",
  "How should the business contact you?": "¿Cómo debería contactarlo el negocio?",
  "Start with a new deck, replacement, resurfacing or expansion.":
    "Comience con una terraza nueva, reemplazo, renovación o ampliación.",
  "ZIP code helps route the request and identify regional constraints.":
    "El código postal ayuda a enrutar la solicitud e identificar restricciones regionales.",
  "Existing conditions change scope, demolition and inspection needs.":
    "Las condiciones existentes cambian el alcance, demolición e inspección necesarias.",
  "Approximate dimensions are enough for early qualification.":
    "Las dimensiones aproximadas bastan para la calificación inicial.",
  "A photo can communicate style, materials and site constraints faster than text.":
    "Una foto puede comunicar estilo, materiales y restricciones del sitio más rápido que el texto.",
  "Material preference affects budget, maintenance and lead time.":
    "La preferencia de material afecta presupuesto, mantenimiento y plazo.",
  "Features help the sales team understand complexity before calling.":
    "Los elementos ayudan a ventas a entender la complejidad antes de llamar.",
  "A range is enough; this is not a final quote.":
    "Un rango basta; esto no es una cotización final.",
  "Timing affects prioritization and feasibility.": "El plazo afecta la prioridad y viabilidad.",
  "Contact consent is required before follow-up.":
    "Se requiere consentimiento de contacto antes del seguimiento.",
  "Two sides of the same journey": "Dos lados del mismo recorrido",
  "Easier for your customers. More useful for your sales team.":
    "Más fácil para sus clientes. Más útil para su equipo comercial.",
  "For your customers": "Para sus clientes",
  "No technical vocabulary required": "Sin vocabulario técnico requerido",
  "Guided questions and visual choices": "Preguntas guiadas y opciones visuales",
  "“Not sure” options when details are unknown":
    "Opciones “No estoy seguro” cuando faltan detalles",
  "Photos instead of long explanations": "Fotos en lugar de explicaciones largas",
  "A clear recap before submission": "Un resumen claro antes de enviar",
  "Live example — start from a photo": "Ejemplo en vivo: empezar con una foto",
  "For your sales team": "Para su equipo comercial",
  "Structured project context": "Contexto estructurado del proyecto",
  "Confirmed details separated from assumptions":
    "Detalles confirmados separados de las suposiciones",
  "Photos, budget and timing in one place": "Fotos, presupuesto y plazo en un solo lugar",
  "A suggested next action": "Una siguiente acción sugerida",
  "Live example": "Ejemplo en vivo",
  "Help customers explain the project. Help sales teams act on it.":
    "Ayude a los clientes a explicar el proyecto. Ayude a ventas a actuar.",
  "A simple path from inquiry to commercial context.":
    "Un camino simple desde la consulta hasta el contexto comercial.",
  "Choose or confirm the right": "Elija o confirme el",
  "The guided experience completed by the customer.":
    "La experiencia guiada que completa el cliente.",
  "Add it to your website.": "Añádalo a su sitio web.",
  "Receive structured Project Briefs.": "Reciba Project Briefs estructurados.",
  "Start with an industry-specific discovery method, or let us match one from your website.":
    "Comience con un método de descubrimiento específico de su industria, o deje que lo conectemos desde su sitio web.",
  "Publish it with a link or a small website snippet.":
    "Publíquelo con un enlace o un pequeño snippet para el sitio web.",
  "Review a structured brief before the first call.":
    "Revise un brief estructurado antes de la primera llamada.",
  "Every Project Brief carries its own qualification confidence and lists exactly what is still missing — never a fake certainty.":
    "Cada Project Brief incluye su propia confianza de calificación y enumera exactamente lo que aún falta: nunca una falsa certeza.",
  Product: "Producto",
  "Not a generic form builder.": "No es un generador de formularios genérico.",
  "Métré Build uses industry Playbooks to guide customers and turn incomplete inquiries into structured, actionable Project Briefs.":
    "Métré Build usa Playbooks por industria para guiar a los clientes y convertir consultas incompletas en Project Briefs estructurados y accionables.",
  "The structured, actionable output received by the sales team.":
    "La salida estructurada y accionable que recibe el equipo comercial.",
  "The missing layer between forms and configurators":
    "La capa que falta entre formularios y configuradores",
  "Generic form": "Formulario genérico",
  "Custom configurator": "Configurador a medida",
  "Collects answers": "Recopila respuestas",
  "Guides project discovery": "Guía el descubrimiento del proyecto",
  "Configures a technical solution": "Configura una solución técnica",
  "Generic questions": "Preguntas genéricas",
  "Industry Playbooks": "Playbooks por industria",
  "Product-specific rules": "Reglas específicas del producto",
  "Customer must know what to write": "El cliente debe saber qué escribir",
  "Customer can answer approximately": "El cliente puede responder aproximadamente",
  "Customer makes technical choices": "El cliente toma decisiones técnicas",
  "Form submission": "Envío de formulario",
  "Sales-ready Project Brief": "Project Brief listo para ventas",
  "Configuration or quote": "Configuración o cotización",
  "Fast but often vague": "Rápido pero a menudo vago",
  "Fast and structured": "Rápido y estructurado",
  "Powerful but complex": "Potente pero complejo",
  "Low setup": "Configuración baja",
  "Accessible SaaS": "SaaS accesible",
  "Custom software project": "Proyecto de software a medida",
  "Métré Build helps customers clarify their project without forcing your business to build a custom configurator.":
    "Métré Build ayuda a los clientes a aclarar su proyecto sin obligar a su negocio a crear un configurador a medida.",
  "Built from field experience": "Creado desde experiencia de campo",
  "Built by a construction entrepreneur who got tired of starting every sales call from scratch.":
    "Creado por un emprendedor de construcción que se cansó de empezar cada llamada comercial desde cero.",
  "Métré Build was founded by Antoine Ferrière, a construction entrepreneur with more than 15 years of experience across timber construction, renovation and project delivery.":
    "Métré Build fue fundado por Antoine Ferrière, emprendedor de construcción con más de 15 años de experiencia en construcción en madera, renovación y ejecución de proyectos.",
  "Founder, Métré Build": "Fundador, Métré Build",
  "View on LinkedIn": "Ver en LinkedIn",
  Privacy: "Privacidad",
  Terms: "Términos",
  "Last updated": "Última actualización",
  "Who operates Métré Build": "Quién opera Métré Build",
  "Métré Build (metre-pro.com) is a project intake product for project-based contractors. The legal entity operating this service, its registration details and registered address will be published here once confirmed — until then, use the Contact page for any verification you need.":
    "Métré Build (metre-pro.com) es un producto de captación de proyectos para contratistas que trabajan por proyecto. La entidad legal que opera este servicio, sus datos de registro y su domicilio social se publicarán aquí una vez confirmados; mientras tanto, use la página de Contacto para cualquier verificación que necesite.",
  "Data we collect": "Datos que recopilamos",
  "We collect information you submit directly through our audit request, setup request and contact forms, and information a visitor submits through a Guided Project Intake published by one of our client workspaces.":
    "Recopilamos la información que usted envía directamente a través de nuestros formularios de solicitud de auditoría, solicitud de configuración y contacto, así como la información que un visitante envía a través de un Project Intake guiado publicado por uno de nuestros workspaces de clientes.",
  "Information collected in a Guided Project Intake":
    "Información recopilada en un Project Intake guiado",
  "Depending on the Playbook a workspace publishes, a Guided Project Intake may ask for project details, dimensions, material or feature preferences, budget range, timing, site photos, and consent to be contacted.":
    "Según el Playbook que publique un workspace, un Project Intake guiado puede solicitar detalles del proyecto, dimensiones, preferencias de materiales o características, rango de presupuesto, plazo, fotos del sitio y consentimiento para ser contactado.",
  "Name, email address, phone number and ZIP/postal code, when provided, are used to let the relevant workspace follow up on a project.":
    "El nombre, la dirección de correo electrónico, el número de teléfono y el código postal, cuando se proporcionan, se utilizan para que el workspace correspondiente pueda dar seguimiento a un proyecto.",
  "Photos and documents": "Fotos y documentos",
  "Photos or plans uploaded to a Guided Project Intake are stored so the workspace can review the project and, where that feature is enabled, may be analyzed by an AI vision service to surface observations for the workspace to confirm.":
    "Las fotos o planos subidos a un Project Intake guiado se almacenan para que el workspace pueda revisar el proyecto y, cuando esa función está habilitada, pueden ser analizados por un servicio de visión por IA para señalar observaciones que el workspace debe confirmar.",
  "Technical data": "Datos técnicos",
  "We collect limited technical data needed to operate the service and protect it from abuse: IP address (hashed before storage for rate-limiting), browser locale, and basic request metadata. We do not use this data for advertising.":
    "Recopilamos datos técnicos limitados necesarios para operar el servicio y protegerlo contra abusos: dirección IP (con hash antes de almacenarse, para limitar la frecuencia de solicitudes), idioma del navegador y metadatos básicos de la solicitud. No utilizamos estos datos con fines publicitarios.",
  "Purposes of processing": "Finalidades del tratamiento",
  "We use this information to operate the Guided Project Intake, generate a Project Brief for the relevant workspace, respond to audit, contact and setup requests, protect the service from abuse, and improve the product.":
    "Utilizamos esta información para operar el Project Intake guiado, generar un Project Brief para el workspace correspondiente, responder a solicitudes de auditoría, contacto y configuración, proteger el servicio contra abusos y mejorar el producto.",
  "Legal basis": "Base jurídica",
  "The applicable legal basis for processing (for example consent, contract performance, or legitimate interest) depends on the visitor's jurisdiction and the specific data involved, and is to be confirmed with legal counsel for each territory we serve.":
    "La base jurídica aplicable al tratamiento (por ejemplo, consentimiento, ejecución de un contrato o interés legítimo) depende de la jurisdicción del visitante y de los datos concretos implicados, y está pendiente de confirmación con asesoría legal para cada territorio en el que operamos.",
  "Workspaces and team members": "Workspaces y miembros del equipo",
  "A business using Métré Build operates its own workspace. Project Briefs and visitor information submitted through that workspace's Guided Project Intake are visible to the members of that workspace, not to other Métré Build customers.":
    "Una empresa que utiliza Métré Build opera su propio workspace. Los Project Briefs y la información de los visitantes enviada a través del Project Intake guiado de ese workspace son visibles para los miembros de ese workspace, no para otros clientes de Métré Build.",
  "Service providers and subprocessors": "Proveedores de servicios y subencargados",
  "We rely on third-party service providers to operate Métré Build. We have not yet published a complete, versioned subprocessor list — the categories of providers we currently use are described in the sections below.":
    "Dependemos de proveedores de servicios externos para operar Métré Build. Aún no hemos publicado una lista completa y versionada de subencargados; las categorías de proveedores que utilizamos actualmente se describen en las secciones siguientes.",
  Hosting: "Alojamiento",
  "The application and its database are hosted on Supabase.":
    "La aplicación y su base de datos están alojadas en Supabase.",
  "Email delivery": "Envío de correo electrónico",
  "Transactional emails — confirmations, Project Summary copies, and contact replies — are sent through Lovable's managed email delivery service.":
    "Los correos transaccionales (confirmaciones, copias del Project Summary y respuestas de contacto) se envían a través del servicio de entrega de correo gestionado de Lovable.",
  "AI-assisted processing": "Tratamiento asistido por IA",
  "Some features — drafting a Project Brief, analyzing an uploaded photo, or answering a free-text question in the site's FAQ assistant — send the relevant text or image to an AI model through the Lovable AI Gateway. We do not use this content to train AI models ourselves.":
    "Algunas funciones (redactar un Project Brief, analizar una foto subida o responder una pregunta de texto libre en el asistente de preguntas frecuentes del sitio) envían el texto o la imagen correspondiente a un modelo de IA a través de Lovable AI Gateway. No utilizamos este contenido para entrenar modelos de IA nosotros mismos.",
  Retention: "Conservación",
  "We keep this information for as long as the relevant Mission or workspace account is active, plus a reasonable period afterward to respond to follow-up questions. We have not yet set contractual, jurisdiction-specific retention periods — this section will be updated once that review is complete.":
    "Conservamos esta información mientras la Mission o la cuenta del workspace correspondiente esté activa, además de un período razonable posterior para responder a preguntas de seguimiento. Aún no hemos establecido plazos de conservación contractuales específicos por jurisdicción; esta sección se actualizará cuando se complete esa revisión.",
  Deletion: "Eliminación",
  "You can request deletion of your information at any time via the Contact page. We will delete or anonymize it unless we are required to keep it for a legitimate purpose, such as an unresolved dispute.":
    "Puede solicitar la eliminación de su información en cualquier momento a través de la página de Contacto. La eliminaremos o anonimizaremos, salvo que debamos conservarla por un motivo legítimo, como una disputa sin resolver.",
  Security: "Seguridad",
  "We limit access to visitor and customer data to the systems and team members that need it, and rely on our hosting and email providers' own security controls. No online service can guarantee absolute security.":
    "Limitamos el acceso a los datos de visitantes y clientes a los sistemas y miembros del equipo que lo necesitan, y confiamos en los controles de seguridad propios de nuestros proveedores de alojamiento y correo. Ningún servicio en línea puede garantizar una seguridad absoluta.",
  "Cookies and similar technologies": "Cookies y tecnologías similares",
  "The public site stores your language preference (English/Spanish) and, during a Guided Project Intake, a session identifier, using your browser's local storage rather than tracking cookies. We do not currently use third-party advertising or analytics cookies.":
    "El sitio público almacena su preferencia de idioma (inglés/español) y, durante un Project Intake guiado, un identificador de sesión, mediante el almacenamiento local de su navegador en lugar de cookies de seguimiento. Actualmente no utilizamos cookies de publicidad o análisis de terceros.",
  "Your rights": "Sus derechos",
  "Depending on your location, you may have the right to access, correct, delete, or receive a copy of your information, and to object to certain processing. Contact us via the Contact page to exercise these rights.":
    "Según su ubicación, puede tener derecho a acceder, corregir, eliminar o recibir una copia de su información, así como a oponerse a determinados tratamientos. Contáctenos a través de la página de Contacto para ejercer estos derechos.",
  "Visitors in the United States": "Visitantes en Estados Unidos",
  "Depending on your state of residence, you may have additional rights under state privacy law. We will confirm the specific rights that apply once we complete a jurisdiction-by-jurisdiction legal review.":
    "Según su estado de residencia, puede tener derechos adicionales conforme a la ley de privacidad estatal. Confirmaremos los derechos específicos aplicables una vez completemos una revisión legal jurisdicción por jurisdicción.",
  "Visitors in the European Economic Area": "Visitantes en el Espacio Económico Europeo",
  "If you are located in the EEA, UK or Switzerland, additional rights under the GDPR may apply, including the right to lodge a complaint with your local data protection authority. Our EU-specific legal basis and representative details are to be confirmed.":
    "Si se encuentra en el EEE, el Reino Unido o Suiza, pueden aplicarse derechos adicionales conforme al RGPD, incluido el derecho a presentar una reclamación ante su autoridad local de protección de datos. Nuestra base jurídica específica para la UE y los datos de nuestro representante están pendientes de confirmación.",
  "Questions about this policy can be emailed to contact@metre-pro.com or sent through the Contact page.":
    "Las preguntas sobre esta política pueden enviarse a contact@metre-pro.com o a través de la página de Contacto.",
  "What this service is": "Qué es este servicio",
  "Métré Build is a guided project-intake tool: it helps a visitor describe a project — a deck project today — and turns the answers into a structured Project Brief for the business that published the intake.":
    "Métré Build es una herramienta de captación de proyectos guiada: ayuda a un visitante a describir un proyecto (un proyecto de terraza hoy en día) y convierte las respuestas en un Project Brief estructurado para la empresa que publicó el intake.",
  "Creating an account": "Creación de una cuenta",
  "Creating a workspace account gives you a self-service space to publish a Guided Project Intake and review the Project Briefs it produces. You are responsible for keeping your account credentials secure.":
    "Crear una cuenta de workspace le da un espacio de autoservicio para publicar un Project Intake guiado y revisar los Project Briefs que produce. Usted es responsable de mantener seguras las credenciales de su cuenta.",
  "Authorized use": "Uso autorizado",
  "You agree not to use Métré Build to submit false information at scale, attempt to disrupt the service, or extract other workspaces' data.":
    "Usted se compromete a no utilizar Métré Build para enviar información falsa a gran escala, intentar interrumpir el servicio ni extraer datos de otros workspaces.",
  "Your responsibilities as a workspace owner":
    "Sus responsabilidades como propietario de un workspace",
  "If you operate a workspace, you are responsible for the accuracy of the Playbook you publish, for how you use the Project Briefs you receive, and for your own compliance obligations toward the visitors your Guided Project Intake collects information from.":
    "Si opera un workspace, usted es responsable de la exactitud del Playbook que publica, del uso que haga de los Project Briefs que recibe, y de sus propias obligaciones de cumplimiento frente a los visitantes de los que su Project Intake guiado recopila información.",
  "Service limitations": "Limitaciones del servicio",
  "Métré Build assists project discovery and qualification. It does not replace professional judgment, a site visit, or a formal proposal process.":
    "Métré Build ayuda en el descubrimiento y la calificación de proyectos. No sustituye el criterio profesional, una visita al sitio ni un proceso formal de propuesta.",
  "No final quote or price guarantee": "Sin cotización final ni garantía de precio",
  "Nothing produced by a Guided Project Intake or a Project Brief is a binding price quote. Budget ranges and estimates are visitor-provided or calculated approximations, clearly marked as such.":
    "Nada de lo producido por un Project Intake guiado o un Project Brief constituye una cotización de precio vinculante. Los rangos de presupuesto y las estimaciones son aproximaciones proporcionadas por el visitante o calculadas, claramente identificadas como tales.",
  "No technical or engineering validation": "Sin validación técnica ni de ingeniería",
  "A Project Brief is not an engineering assessment, a permit review, or a regulatory determination. Any measurements, materials, or site conditions it lists are visitor-reported or AI-assisted observations to be verified on site.":
    "Un Project Brief no es una evaluación de ingeniería, una revisión de permisos ni una determinación regulatoria. Las medidas, materiales o condiciones del sitio que enumera son observaciones reportadas por el visitante o asistidas por IA que deben verificarse en el sitio.",
  "Data you submit": "Datos que usted envía",
  "You are responsible for having the right to submit any information, photo, or document you upload through a Guided Project Intake or as a workspace owner.":
    "Usted es responsable de tener el derecho de enviar cualquier información, foto o documento que suba a través de un Project Intake guiado o como propietario de un workspace.",
  "Content and photos": "Contenido y fotos",
  "You retain ownership of the photos and content you submit. You grant Métré Build the license needed to store, process, and display that content back to the relevant workspace for the purpose of generating and reviewing a Project Brief.":
    "Usted conserva la propiedad de las fotos y el contenido que envía. Otorga a Métré Build la licencia necesaria para almacenar, procesar y mostrar ese contenido al workspace correspondiente con el fin de generar y revisar un Project Brief.",
  "Intellectual property": "Propiedad intelectual",
  "The Métré Build product, its Playbooks, and its software are the property of the team operating the service. Nothing in these Terms transfers that ownership to you.":
    "El producto Métré Build, sus Playbooks y su software son propiedad del equipo que opera el servicio. Nada en estos Términos le transfiere esa propiedad.",
  Availability: "Disponibilidad",
  "We aim to keep the service available but do not guarantee uninterrupted access. Features may change as the product evolves.":
    "Procuramos mantener el servicio disponible, pero no garantizamos un acceso ininterrumpido. Las funciones pueden cambiar a medida que el producto evoluciona.",
  Suspension: "Suspensión",
  "We may suspend access to a workspace that violates these Terms or that we reasonably believe is abusing the service, after attempting to notify you where practical.":
    "Podemos suspender el acceso a un workspace que infrinja estos Términos o que razonablemente consideremos que abusa del servicio, tras intentar notificarle cuando sea posible.",
  Termination: "Terminación",
  "You may stop using the service at any time. We may discontinue or change the service with reasonable notice.":
    "Puede dejar de usar el servicio en cualquier momento. Podemos discontinuar o modificar el servicio con un aviso razonable.",
  "Limitation of liability": "Limitación de responsabilidad",
  "To the extent permitted by law, Métré Build is provided without warranties of any kind, and liability for any claim related to the service is limited as far as applicable law allows.":
    "En la medida permitida por la ley, Métré Build se proporciona sin garantías de ningún tipo, y la responsabilidad por cualquier reclamación relacionada con el servicio se limita en la medida en que lo permita la ley aplicable.",
  "Governing law": "Ley aplicable",
  "The governing law and jurisdiction for these Terms are to be confirmed based on where the operating entity is registered and where its customers are located.":
    "La ley aplicable y la jurisdicción de estos Términos están pendientes de confirmación en función del lugar de registro de la entidad operadora y de la ubicación de sus clientes.",
  "Questions about these Terms can be emailed to contact@metre-pro.com or sent through the Contact page.":
    "Las preguntas sobre estos Términos pueden enviarse a contact@metre-pro.com o a través de la página de Contacto.",
  "We'll show a representative preview once approximate length and width are provided.":
    "Mostraremos una vista previa representativa en cuanto se indiquen el largo y el ancho aproximados.",
  "This project shape can't be represented in the visual preview yet.":
    "Esta forma de proyecto todavía no se puede representar en la vista previa visual.",
  "Illustrative preview of your deck": "Vista previa ilustrativa de su terraza",
  "Rotate left": "Girar a la izquierda",
  "Rotate right": "Girar a la derecha",
  "Zoom in": "Acercar",
  "Zoom out": "Alejar",
  "Reset view": "Restablecer vista",
  "Elevation shown is simplified and subject to on-site verification.":
    "La elevación mostrada es simplificada y está sujeta a verificación en el sitio.",
  "The visual preview couldn't be shown.": "No se pudo mostrar la vista previa visual.",
  "Questions, answered": "Preguntas frecuentes, respondidas",
  "Don't see your question? Ask it here.": "¿No encuentra su pregunta? Pregúntenos aquí.",
  "Type your question…": "Escriba su pregunta…",
  "Asking…": "Preguntando…",
  Ask: "Preguntar",
  "Talk to the team": "Hablar con el equipo",
  "We couldn't process that question — please try again or contact the team.":
    "No pudimos procesar esa pregunta — intente de nuevo o contacte al equipo.",
  "You can ask another question above.": "Puede hacer otra pregunta más arriba.",
  "Questions?": "¿Preguntas?",
  "Have a question?": "¿Tiene una pregunta?",
  "View full FAQ": "Ver todas las preguntas frecuentes",
  "How would this work on my website?": "¿Cómo funcionaría esto en mi sitio web?",
  "What would my team receive?": "¿Qué recibiría mi equipo?",
  "Can I use it for more than one project type?": "¿Puedo usarlo para más de un tipo de proyecto?",
  "Does it replace my contact form?": "¿Reemplaza mi formulario de contacto?",
  Pricing: "Precios",
  "Create account": "Crear cuenta",
  "Simple pricing that scales with your Project Intakes.":
    "Precios simples que crecen con sus Project Intakes.",
  "Every plan includes the same guided Project Intake, AI-drafted Project Briefs and client portal. Plans only differ by how many active Project Intakes and monthly Project Briefs you need.":
    "Todos los planes incluyen el mismo Project Intake guiado, Project Briefs redactados por IA y portal de cliente. Los planes solo difieren en cuántos Project Intakes activos y Project Briefs mensuales necesita.",
  "Talk to us": "Hablar con nosotros",
  "/month": "/mes",
  Custom: "Personalizado",
  "active Project Intake": "Project Intake activo",
  "active Project Intakes": "Project Intakes activos",
  "Project Briefs / month": "Project Briefs / mes",
  Enterprise: "Enterprise",
  "For teams that need more active Project Intakes, a higher monthly Project Brief quota, or custom terms.":
    "Para equipos que necesitan más Project Intakes activos, una cuota mensual de Project Briefs más alta, o condiciones personalizadas.",
  "Every plan includes": "Todos los planes incluyen",
  "Guided Project Intake for your website": "Project Intake guiado para su sitio web",
  "AI-drafted Project Briefs": "Project Briefs redactados por IA",
  "Secure Project Summary link and email copy for visitors":
    "Enlace seguro de Project Summary y copia por correo para los visitantes",
  "Client portal access for your team": "Acceso al portal de cliente para su equipo",
  "Pricing FAQ": "Preguntas frecuentes sobre precios",
  "What counts as an active Project Intake?": "¿Qué cuenta como un Project Intake activo?",
  "Each Project Intake published on your website counts toward your plan's limit, whether or not it is currently receiving visitors.":
    "Cada Project Intake publicado en su sitio web cuenta para el límite de su plan, reciba o no visitantes actualmente.",
  "What counts as a Project Brief?": "¿Qué cuenta como un Project Brief?",
  "Each completed Project Intake that produces a Project Brief counts once toward your monthly quota, reset every billing cycle.":
    "Cada Project Intake completado que produce un Project Brief cuenta una vez para su cuota mensual, que se reinicia en cada ciclo de facturación.",
  "Can I change plans later?": "¿Puedo cambiar de plan más adelante?",
  "Yes. You can change your plan at any time from your client portal billing page.":
    "Sí. Puede cambiar su plan en cualquier momento desde la página de facturación de su portal de cliente.",
  "Is there a free trial?": "¿Hay una prueba gratuita?",
  "You can try the public Deck demo before creating an account. Once you sign up, you get your own workspace right away and can publish your first Guided Project Intake yourself.":
    "Puede probar la demo pública de Deck antes de crear una cuenta. Al registrarse, obtiene su propio workspace de inmediato y puede publicar usted mismo su primer Project Intake guiado.",
  "Prefer a guided setup instead?": "¿Prefiere una configuración guiada?",
  "Analyze your website first to see what a Project Brief looks like for your business, with no account required.":
    "Analice primero su sitio web para ver cómo sería un Project Brief para su negocio, sin necesidad de crear una cuenta.",

  // Field-validation message templates (see localizeValidationMessage in
  // MissionRuntime.tsx) — "{field}" and "{n0}" are literal placeholders
  // substituted in after translation, never real text to match against.
  '"{field}" is required.': '"{field}" es obligatorio.',
  '"{field}" requires a specific answer.': '"{field}" requiere una respuesta específica.',
  '"{field}" has an invalid option.': '"{field}" tiene una opción no válida.',
  '"{field}" must be a list.': '"{field}" debe ser una lista.',
  '"{field}" requires at least {n0} selection(s).':
    '"{field}" requiere al menos {n0} selección(es).',
  '"{field}" allows at most {n0} selection(s).':
    '"{field}" permite como máximo {n0} selección(es).',
  '"{field}" must be text.': '"{field}" debe ser texto.',
  '"{field}" is too short.': '"{field}" es demasiado corto.',
  '"{field}" is too long.': '"{field}" es demasiado largo.',
  '"{field}" is not valid.': '"{field}" no es válido.',
  '"{field}" must be a number.': '"{field}" debe ser un número.',
  '"{field}" is below the minimum.': '"{field}" está por debajo del mínimo.',
  '"{field}" is above the maximum.': '"{field}" está por encima del máximo.',
  '"{field}" has an invalid range.': '"{field}" tiene un rango no válido.',
  '"{field}" is invalid.': '"{field}" no es válido.',
  '"{field}" requires at least one value.': '"{field}" requiere al menos un valor.',
  '"{field}" must be a list of photos.': '"{field}" debe ser una lista de fotos.',
  '"{field}" allows at most {n0} photo(s).': '"{field}" permite como máximo {n0} foto(s).',
  '"{field}" has an unsupported photo.': '"{field}" tiene una foto no compatible.',
  '"{field}" must be accepted.': '"{field}" debe aceptarse.',

  // Inspiration-photo brief line label (engine/brief.ts) — surfaced in the
  // visitor Project Summary's "still to confirm" section for inspiration-
  // photo intakes only.
  "Please check the following before continuing:": "Revise lo siguiente antes de continuar:",

  // Recap screen shown before the visitor submits.
  "Check your answers before sending": "Revise sus respuestas antes de enviar",
  "Nothing has been sent yet. Change anything that is not right.":
    "Todavía no se ha enviado nada. Cambie lo que no esté bien.",
  "Review my answers": "Revisar mis respuestas",
  Edit: "Editar",
  "Not answered": "Sin responder",

  // The Vérificateur's framing. Rule messages themselves are Playbook-authored
  // and pass through untranslated, like every other Playbook string.
  "This combination does not work:": "Esta combinación no funciona:",
  "Worth checking before you continue:": "Conviene revisar esto antes de continuar:",

  // Deck Playbook consistency-rule messages.
  "A deck cannot be both ground-level and second-story. Please pick the one that describes this project.":
    "Una terraza no puede estar a la vez a nivel del suelo y en el segundo piso. Elija la que describe este proyecto.",
  "This deck is raised but no stairs are mentioned. If it is reached from inside, say so — otherwise stairs change the scope.":
    "Esta terraza está elevada pero no se mencionan escaleras. Si se accede desde el interior, indíquelo; de lo contrario las escaleras cambian el alcance.",
  "Stairs are listed as required but not selected as a feature. Add them to the features so the quote includes them.":
    "Las escaleras figuran como necesarias pero no están seleccionadas como elemento. Agréguelas para que la cotización las incluya.",
  "Select Continue again to keep your answers as they are.":
    "Seleccione Continuar de nuevo para dejar sus respuestas como están.",
  "Select Generate project brief again to send your answers as they are.":
    "Seleccione Generar Project Brief de nuevo para enviar sus respuestas como están.",
  Steps: "Pasos",
  "current step": "paso actual",
  "Last look before sending": "Última revisión antes de enviar",
  "Questions to explore (from the inspiration photo)":
    "Preguntas a explorar (a partir de la foto de inspiración)",
};

export function publicCopy(locale: SupportedLocale, text: string): string {
  if (locale !== "es-US") return text;
  return ES_PUBLIC_COPY[text] ?? text;
}

export function publicCopies(locale: SupportedLocale, values: string[]): string[] {
  return values.map((value) => publicCopy(locale, value));
}
