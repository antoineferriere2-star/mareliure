import type { FineBinderyPublicCopy } from "./types";

export const esSeo: FineBinderyPublicCopy["seo"] = {
    homeTitle: "Fine Bindery — Encuadernación y restauración de libros en Europa",
    homeDescription: "Descubre encuadernadores y restauradores con oficio, presenta tu proyecto y trabaja con el taller adecuado. La red abre en Francia.",
    directoryTitle: "Encuadernadores y restauradores de libros — Fine Bindery",
    directoryDescription: "Descubre talleres independientes de encuadernación, restauración, conservación y dorado, y presenta tu proyecto directamente a uno de ellos.",
    profileTitle: (w) => `${w} — Encuadernación y restauración | Fine Bindery`,
    profileDescription: (w, c) => `Descubre ${w}, taller independiente de encuadernación y conservación en ${c}.`,
  };

export const esHomeFaq: FineBinderyPublicCopy["home"]["faq"] = [
      { question: "¿Puedo contactar directamente con un taller?", answer: "Sí. Un proyecto presentado desde la página de un taller llega directamente a ese taller." },
      { question: "¿Quién me vende el servicio y quién me factura?", answer: "Depende de cómo empiece. Un proyecto presentado desde la página de un taller convierte a ese taller en su vendedor: le envía su propio presupuesto y le factura. Un proyecto presentado a Fine Bindery lo vende OPPE SAS bajo la marca Fine Bindery, que elige el taller, emite el presupuesto y la factura y cobra; el taller factura entonces a OPPE SAS, nunca a usted." },
      { question: "¿Cómo se eligen los talleres?", answer: "Fine Bindery revisa cada taller antes de publicar su página: su oficio, su trayectoria y el tipo de trabajo que desea recibir. No hay clasificaciones ni posiciones de pago." },
      { question: "¿Tengo que hablar el idioma del taller?", answer: "No. Cada taller indica los idiomas que habla, y Fine Bindery sigue siendo tu interlocutor cuando nos presentas un proyecto." },
      { question: "¿El envío está incluido?", answer: "No. Se presupuesta aparte, según el destino, el valor y el cuidado que requiere el libro." },
      { question: "¿Puedo confiar un libro antiguo o valioso?", answer: "Sí, tras un estudio individual y con una logística adecuada." },
    ];

export const esProjectStart: FineBinderyPublicCopy["common"]["start"] = "Presenta tu proyecto";

export const esDirectoryLabel: FineBinderyPublicCopy["nav"]["workshops"] = "Talleres";

export const esProfileNotFound: FineBinderyPublicCopy["profile"]["notFound"] = "Taller no encontrado";
