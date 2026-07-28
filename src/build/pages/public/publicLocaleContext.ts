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

const ES_PUBLIC_COPY: Record<string, string> = {
  "Deck Builders": "Constructores de terrazas",
  "Qualify deck projects before the first sales call.":
    "Califique proyectos de terraza antes de la primera llamada comercial.",
  "Métré Build helps deck builders turn vague website inquiries into structured Project Briefs with scope, site context, photos, budget, timing and contact consent.":
    "Métré Build ayuda a constructores de terrazas a convertir consultas vagas del sitio web en Project Briefs estructurados con alcance, contexto del sitio, fotos, presupuesto, plazo y consentimiento de contacto.",
  "Get a Free Website Inquiry Audit": "Solicitar una auditoría gratis",
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
  "Free audit": "Auditoría gratis",
  "Free Website Inquiry Audit for Deck Builders":
    "Auditoría gratis de consultas web para constructores de terrazas",
  "Send us your website. We'll review your current inquiry flow, identify what project context it misses and recommend a clearer Guided Project Intake.":
    "Envíenos su sitio web. Revisaremos su flujo actual de consultas, identificaremos qué contexto de proyecto falta y recomendaremos un Guided Project Intake más claro.",
  "Audit My Website": "Auditar mi sitio web",
  "We review your public website and send a short, practical audit with the biggest gaps, recommended intake path and a lightweight preview. No obligation.":
    "Revisamos su sitio público y enviamos una auditoría breve y práctica con las principales brechas, un recorrido recomendado y una vista previa ligera. Sin compromiso.",
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
  "Send a direct message to the Métré Build team. We reply from contact@oppe.fr.":
    "Envíe un mensaje directo al equipo de Métré Build. Respondemos desde contact@oppe.fr.",
  "Company (optional)": "Empresa (opcional)",
  Subject: "Asunto",
  "Send message": "Enviar mensaje",
  Sending: "Enviando",
  "Unable to send this message.": "No se pudo enviar este mensaje.",
  "Message sent. We will reply from contact@oppe.fr.":
    "Mensaje enviado. Responderemos desde contact@oppe.fr.",
  "Setup review": "Revisión de configuración",
  "Request a setup review": "Solicitar revisión de configuración",
  "Tell us about your business and we'll get back to you about setting up a guided Project Intake for your website.":
    "Cuéntenos sobre su negocio y le responderemos sobre la configuración de un Project Intake guiado para su sitio web.",
  Website: "Sitio web",
  "Business type": "Tipo de negocio",
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
  "Loading mission…": "Cargando Mission…",
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
  "Métré Build collects information submitted through website audit and setup request forms so the team can review requests and respond.":
    "Métré Build recopila la información enviada mediante formularios de auditoría del sitio y solicitudes de configuración para que el equipo pueda revisar y responder.",
  "Métré Build collects information submitted through website audit, setup request and contact forms so the team can review requests and respond.":
    "Métré Build recopila la información enviada mediante formularios de auditoría del sitio, solicitudes de configuración y formularios de contacto para que el equipo pueda revisar y responder.",
  "Demo Project Brief data is fictional or stored locally in your browser unless you submit a real request.":
    "Los datos del Project Brief de demo son ficticios o se almacenan localmente en su navegador, salvo que envíe una solicitud real.",
  "Real customer responses, runtime sessions and project briefs are not intended to be indexed or exposed publicly.":
    "Las respuestas reales de clientes, sesiones de ejecución y Project Briefs no están destinados a indexarse ni exponerse públicamente.",
  "Categories of data collected: contact details (name, email), website URL, and any information you provide in a request form. Questions about this policy can be sent to contact@oppe.fr.":
    "Categorías de datos recopilados: datos de contacto (nombre, email), URL del sitio web y cualquier información que proporcione en un formulario de solicitud. Las preguntas sobre esta política pueden enviarse a contact@oppe.fr.",
  "Métré Build is provided for project discovery and qualification purposes only.":
    "Métré Build se proporciona únicamente para descubrimiento y calificación de proyectos.",
  "The Deck Project Demo does not produce a guaranteed quote, engineering assessment or regulatory review.":
    "La demo Deck Project no produce una cotización garantizada, evaluación de ingeniería ni revisión regulatoria.",
  "Access and available features may change as the product evolves. Contact contact@oppe.fr with any questions.":
    "El acceso y las funciones disponibles pueden cambiar a medida que el producto evoluciona. Contacte a contact@oppe.fr si tiene preguntas.",
};

export function publicCopy(locale: SupportedLocale, text: string): string {
  if (locale !== "es-US") return text;
  return ES_PUBLIC_COPY[text] ?? text;
}

export function publicCopies(locale: SupportedLocale, values: string[]): string[] {
  return values.map((value) => publicCopy(locale, value));
}
