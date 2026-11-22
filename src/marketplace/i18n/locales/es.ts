import type { FineBinderyPublicCopy } from "./types";
import { FINE_BINDERY_HOME } from "./homeCopy";
import { FINE_BINDERY_DISCIPLINE_COPY } from "./disciplineCopy";
import { esSeo, esHomeFaq, esProjectStart, esDirectoryLabel, esProfileNotFound } from "./esHead";


export const es: FineBinderyPublicCopy = {
  seo: esSeo,
  nav: { features: "Funciones", pricing: "Precios", how: "Cómo funciona", services: "Oficios", workshops: esDirectoryLabel, faq: "Preguntas", signIn: "Iniciar sesión", language: "Idioma", menu: "Menú" },
  common: { signup: "Crear mi cuenta de taller", start: esProjectStart, project: "Proyecto", france: "Francia", skills: "Oficios", languages: "Idiomas", techniques: "Técnicas y materiales", originalText: "Texto del taller en su idioma original." },
  footer: { summary: "La herramienta de presupuesto y seguimiento para encuadernadores y talleres de restauración.", information: "Información", legal: "Aviso legal", privacy: "Privacidad", terms: "Condiciones de uso", sales: "Condiciones de venta", closing: "Expediente, presupuesto y seguimiento para encuadernadores y restauradores." },
  home: { ...FINE_BINDERY_HOME.es, ...FINE_BINDERY_DISCIPLINE_COPY.es },
  directory: {
    eyebrow: "La red", title: "Encuadernadores y restauradores, elegidos por su oficio.",
    lead: "Descubre los talleres publicados. Un proyecto presentado desde la página de un taller llega directamente a ese taller.",
    filters: "Filtrar los talleres", country: "País", specialty: "Especialidad", language: "Idioma",
    allCountries: "Todos los países", allSpecialties: "Todas las especialidades", allLanguages: "Todos los idiomas",
    empty: "Ningún taller publicado coincide con estos filtros.", reset: "Borrar los filtros",
    count: (n) => (n === 1 ? "1 taller" : `${n} talleres`), view: "Ver el taller",
    emptyTitle: "Los primeros talleres se están publicando.",
    emptyBody: "Sus páginas aparecerán aquí en cuanto se hayan revisado. Mientras tanto, presenta tu proyecto: Fine Bindery encontrará el taller adecuado para tu libro.",
    openingNote: "La red abre con talleres en Francia y acogerá a encuadernadores y restauradores de toda Europa.",
  },
  profile: {
    workshop: "Taller", discuss: "Habla de tu proyecto", about: "El taller", location: "Dónde está",
    specialties: "Especialidades", languages: "Idiomas", techniques: "Técnicas y materiales", according: "Según el proyecto",
    training: "Formación y trayectoria", approach: "Enfoque", portfolio: "Trabajos seleccionados", work: "El trabajo del taller.", before: "Antes", after: "Después",
    finalEyebrow: "Un libro, una conversación", finalTitle: (w) => `Habla de tu proyecto directamente con ${w}.`,
    website: "Web del taller", call: "Llamar al taller", email: "Escribir al taller",
    notFound: esProfileNotFound, notFoundBody: "Esta página no está publicada o ya no existe.", back: "Ver los talleres",
  },
};
