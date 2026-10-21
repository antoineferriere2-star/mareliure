/**
 * Les pages par discipline de Fine Bindery — une par discipline de l'accueil (`home.offers`).
 *
 * Elles existent pour la recherche, dans les cinq langues : quelqu'un tape « book restoration »
 * ou « Buchrestaurierung », pas « Fine Bindery ». Elles ne disent que ce que le site dit déjà :
 * le titre et la phrase de la discipline (dictionnaires), les prestations du catalogue avec leurs
 * noms traduits (`fineBinderyGlossary`) et les photographies de l'atelier Ferrière, les étapes,
 * le transport et les questions de l'accueil. Le seul texte propre à une page est son
 * introduction, qui ne promet rien que l'accueil ne promette : ni prix, ni délai, ni avis.
 *
 * Même adresse dans toutes les langues (`/en/fine-binding`, `/fr/fine-binding`…) : les
 * alternatives hreflang de `fineBinderyLocalizedHead` supposent un chemin commun.
 */
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import type { IllustratedServiceKey } from "@/marketplace/pages/pricing/ferriereServiceIllustrations";

type Localized = Record<FineBinderyLocale, string>;

export type DisciplineSlug = "fine-binding" | "book-restoration" | "collector-rebinding" | "bespoke-commissions";

export interface Discipline {
  slug: DisciplineSlug;
  /** Index dans `home.offers` et `FERRIERE_FINE_BINDERY_OFFER_KEYS` : même titre, même planche qu'à l'accueil. */
  offerIndex: number;
  seoTitle: Localized;
  seoDescription: Localized;
  intro: Localized;
  /** Prestations du catalogue (toutes traduites et illustrées), dans l'ordre de lecture. */
  serviceKeys: readonly IllustratedServiceKey[];
}

export const DISCIPLINES: readonly Discipline[] = [
  {
    slug: "fine-binding",
    offerIndex: 0,
    seoTitle: {
      en: "Fine bookbinding in leather, cloth and paper — Fine Bindery",
      fr: "Reliure d’art en cuir, toile et papier — Fine Bindery",
      de: "Handeinbände aus Leder, Gewebe und Papier — Fine Bindery",
      it: "Legatura artigianale in pelle, tela e carta — Fine Bindery",
      es: "Encuadernación artesanal en piel, tela y papel — Fine Bindery",
    },
    seoDescription: {
      en: "Full leather, half leather, cloth and fine papers, titled and decorated in gold by independent bookbinding ateliers. Present your book, receive a proposal.",
      fr: "Plein cuir, demi-cuir, toile et beaux papiers, titrés et décorés à l’or par des ateliers de reliure indépendants. Présentez votre livre, recevez une offre.",
      de: "Ganz- und Halbleder, Gewebe und edle Papiere, Goldprägung und Dekor aus unabhängigen Buchbindereien. Buch vorstellen und ein Angebot erhalten.",
      it: "Legature in piena e mezza pelle, tela e carte pregiate, con titoli e decorazioni in oro. Legatorie indipendenti: presentate il libro e ricevete una proposta.",
      es: "Piel, media piel, tela y papeles finos, con títulos y decoración en oro por talleres independientes. Presente su libro y reciba una propuesta.",
    },
    intro: {
      en: "A binding is made to be opened for generations. Leather, cloth or fine papers, a title tooled in gold, decorated endpapers: the atelier proposes the structure and materials that suit your book, and you receive a proposal before anything is decided.",
      fr: "Une reliure est faite pour être ouverte pendant des générations. Cuir, toile ou beaux papiers, titre poussé à l’or, gardes décorées : l’atelier propose la structure et les matières qui conviennent à votre livre, et vous recevez une proposition avant que rien ne soit décidé.",
      de: "Ein Einband soll ein Buch über Generationen begleiten. Leder, Gewebe oder edle Papiere, ein goldgeprägter Titel, gestaltete Vorsätze: Die Buchbinderei schlägt die zu Ihrem Buch passende Konstruktion und Materialien vor. Sie erhalten ein Angebot, bevor Sie sich entscheiden.",
      it: "Una legatura è pensata per accompagnare la lettura attraverso le generazioni. Pelle, tela o carte pregiate, titoli impressi in oro, carte di guardia decorate: la legatoria propone la struttura e i materiali adatti al vostro libro. Ricevete una proposta prima di prendere una decisione.",
      es: "Una encuadernación está pensada para que un libro pueda seguir leyéndose durante generaciones. Piel, tela o papeles selectos, un título dorado, guardas decoradas: el taller propone la estructura y los materiales adecuados para su libro. Usted recibe una propuesta antes de decidir.",
    },
    serviceKeys: ["pleine_toile", "demi_toile", "dos_cuir", "demi_cuir", "demi_cuir_a_coins", "plein_cuir", "nerfs", "dorure_titrage", "dorure_filets", "gardes_decorees", "tranches"],
  },
  {
    slug: "book-restoration",
    offerIndex: 1,
    seoTitle: {
      en: "Book restoration and conservation — Fine Bindery",
      fr: "Restauration et conservation de livres anciens — Fine Bindery",
      de: "Buchrestaurierung und Buchkonservierung — Fine Bindery",
      it: "Restauro e conservazione di libri antichi — Fine Bindery",
      es: "Restauración y conservación de libros antiguos — Fine Bindery",
    },
    seoDescription: {
      en: "Spines, joints, sewing, leather and paper: old, rare and valuable books restored by independent ateliers, respecting their history. Each book reviewed.",
      fr: "Dos, mors, couture, cuir et papier : livres anciens, rares ou précieux restaurés par des ateliers indépendants, dans le respect de leur histoire.",
      de: "Rücken, Gelenke, Heftung, Leder und Papier: Unabhängige Werkstätten restaurieren alte, seltene und wertvolle Bücher unter Wahrung ihrer Geschichte.",
      it: "Dorsi, cerniere, cuciture, pelle e carta: legatorie indipendenti restaurano libri antichi, rari e preziosi nel rispetto della loro storia.",
      es: "Lomos, charnelas, costuras, piel y papel: talleres independientes restauran libros antiguos, raros y valiosos respetando su historia.",
    },
    intro: {
      en: "Restoring a book means preserving it while respecting its history: the original leather, paper and structure are kept wherever they can be. Old, rare or valuable books are always reviewed individually, and their journey is arranged to suit them.",
      fr: "Restaurer un livre, c’est le préserver en respectant son histoire : le cuir, le papier et la structure d’origine sont conservés chaque fois qu’ils peuvent l’être. Un livre ancien, rare ou précieux est toujours étudié individuellement, et son trajet est organisé en conséquence.",
      de: "Ein Buch zu restaurieren heißt, es zu erhalten und seiner Geschichte gerecht zu werden. Das ursprüngliche Leder, Papier und die Konstruktion bleiben nach Möglichkeit erhalten. Alte, seltene oder wertvolle Bücher werden einzeln begutachtet; ihr Transport wird darauf abgestimmt.",
      it: "Restaurare un libro significa conservarlo nel rispetto della sua storia: la pelle, la carta e la struttura originali si mantengono ogni volta che è possibile. Ogni libro antico, raro o prezioso viene esaminato singolarmente e il trasporto viene organizzato di conseguenza.",
      es: "Restaurar un libro significa conservarlo respetando su historia: se preservan la piel, el papel y la estructura originales siempre que es posible. Cada libro antiguo, raro o valioso se estudia por separado y el transporte se organiza en función de sus necesidades.",
    },
    serviceKeys: ["reemboitage", "reparation_dos", "reparation_mors", "reparation_coiffes", "reparation_coins", "recouture_complete", "reparation_papier", "restauration_cuir", "restauration_papier", "restauration_reliure_ancienne", "restauration_patrimoniale"],
  },
  {
    slug: "collector-rebinding",
    offerIndex: 2,
    seoTitle: {
      en: "Collector rebinding of a favourite edition — Fine Bindery",
      fr: "Nouvelle reliure pour une édition de collection — Fine Bindery",
      de: "Neueinband für eine Sammlerausgabe — Fine Bindery",
      it: "Nuova legatura per un’edizione da collezione — Fine Bindery",
      es: "Nueva encuadernación para una edición de colección — Fine Bindery",
    },
    seoDescription: {
      en: "A favourite or collectible edition rebound as a unique object: new leather covering, leather mosaic, gilded decoration, marbled endpapers.",
      fr: "Une édition préférée ou de collection reliée à nouveau en pièce unique : nouvelle couverture en cuir, mosaïque, décor doré, gardes marbrées.",
      de: "Ein Lieblingsbuch oder eine Sammlerausgabe als Einzelstück neu gebunden: Lederbezug, Ledermosaik, Goldprägung und marmorierte Vorsatzpapiere.",
      it: "Una nuova legatura per un’edizione amata o da collezione: coperta in pelle, mosaico di pelli, decorazioni in oro e carte di guardia marmorizzate.",
      es: "Una edición apreciada o de colección, reencuadernada como pieza única: cubierta en piel, mosaico de pieles, decoración dorada y guardas de papel marmoleado.",
    },
    intro: {
      en: "A favourite or collectible edition can become a unique object: a new covering in leather, a mosaic of leathers, gilded decoration, marbled or decorated endpapers. The atelier proposes from the book itself and what you want it to become; you decide before any work begins.",
      fr: "Une édition préférée ou de collection peut devenir une pièce unique : nouvelle couverture en cuir, mosaïque de cuirs, décor doré, gardes marbrées ou décorées. L’atelier propose à partir du livre et de ce que vous voulez en faire ; vous décidez avant que le travail ne commence.",
      de: "Ein Lieblingsbuch oder eine Sammlerausgabe kann als Einzelstück neu gebunden werden: mit neuem Lederbezug, Ledermosaik, Goldprägung und marmorierten oder gestalteten Vorsatzpapieren. Die Buchbinderei entwickelt ihren Vorschlag anhand des Buches und Ihrer Wünsche. Sie entscheiden, bevor die Arbeit beginnt.",
      it: "Un’edizione a cui tenete o da collezione può diventare un pezzo unico: una nuova coperta in pelle, un mosaico di pelli, decorazioni in oro, carte di guardia marmorizzate o decorate. La legatoria elabora una proposta a partire dal libro e dai vostri desideri. Decidete voi, prima che il lavoro inizi.",
      es: "Un libro al que tenga especial apego o una edición de colección puede convertirse en una pieza única: una nueva cubierta en piel, mosaico de pieles, decoración dorada y guardas de papel marmoleado o decorado. El taller prepara una propuesta a partir del libro y de sus deseos. Usted decide antes de que comience el trabajo.",
    },
    serviceKeys: ["rebind_collector", "nouvelle_couverture", "plein_cuir", "mosaique", "dorure_decor", "dorure_fleurons", "papiers_marbres", "decor_personnalise"],
  },
  {
    slug: "bespoke-commissions",
    offerIndex: 3,
    seoTitle: {
      en: "Bespoke bindings, slipcases and boxes — Fine Bindery",
      fr: "Reliure de création, étuis et boîtes sur mesure — Fine Bindery",
      de: "Künstlereinbände, Schuber und Kassetten nach Maß — Fine Bindery",
      it: "Legature d’arte, astucci e scatole su misura — Fine Bindery",
      es: "Encuadernación artística, estuches y cajas a medida — Fine Bindery",
    },
    seoDescription: {
      en: "One-off design bindings, family books, presentation copies, slipcases, boxes and folders made to measure by independent ateliers. Each commission reviewed.",
      fr: "Reliures de création, livres de famille, exemplaires d’hommage, étuis, boîtes et chemises sur mesure par des ateliers indépendants. Chaque commande étudiée.",
      de: "Künstlerische Einbände, Familienbücher, Widmungsexemplare, Schuber, Kassetten und Mappen nach Maß aus unabhängigen Buchbindereien. Jeder Auftrag geprüft.",
      it: "Legature d’arte, libri di famiglia, esemplari d’omaggio, astucci, scatole e cartelle su misura, realizzati da legatorie indipendenti.",
      es: "Encuadernaciones artísticas, libros de familia, ejemplares de obsequio, estuches, cajas y carpetas a medida, realizados por talleres independientes.",
    },
    intro: {
      en: "One-off bindings, family books, presentation copies, slipcases and boxes: work designed around a book and what you want from it. A box or slipcase is made to measure around the volume without altering it; a design binding is drawn with you. Each commission is reviewed individually.",
      fr: "Reliures uniques, livres de famille, exemplaires d’hommage, étuis et boîtes : un travail conçu autour d’un livre et de ce que vous en attendez. Une boîte ou un étui est monté sur mesure autour du volume sans le modifier ; une reliure de création se dessine avec vous. Chaque commande est étudiée individuellement.",
      de: "Individuelle Einbände, Familienbücher, Widmungsexemplare, Schuber und Kassetten: Die Arbeit richtet sich nach dem Buch und Ihren Vorstellungen. Kassetten und Schuber werden dem Band angepasst, ohne ihn zu verändern; einen künstlerischen Einband entwirft die Werkstatt gemeinsam mit Ihnen. Jeder Auftrag wird einzeln geprüft.",
      it: "Legature uniche, libri di famiglia, esemplari d’omaggio, astucci e scatole: ogni progetto prende forma attorno al libro e ai vostri desideri. Una scatola o un astuccio viene realizzato su misura senza modificare il volume; una legatura d’arte viene ideata insieme a voi. Ogni incarico viene valutato singolarmente.",
      es: "Encuadernaciones únicas, libros de familia, ejemplares de obsequio, estuches y cajas: cada trabajo se concibe a partir del libro y de sus deseos. Las cajas y los estuches se hacen a medida sin modificar el volumen; la encuadernación artística se diseña con usted. Cada encargo se estudia por separado.",
    },
    serviceKeys: ["reliure_de_creation", "projet_sur_mesure", "etui", "chemise", "boite", "coffret"],
  },
];

/** Libellés propres à ces pages ; tout le reste vient du dictionnaire de l'accueil. */
export const DISCIPLINE_LABELS: Record<FineBinderyLocale, { coversEyebrow: string; coversTitle: string; coversNote: string; others: string; breadcrumb: string; more: string }> = {
  en: { coversEyebrow: "The work", coversTitle: "What the atelier may propose.", coversNote: "The atelier proposes the work your book needs; you decide before anything begins.", others: "Other disciplines", breadcrumb: "Breadcrumb", more: "About this discipline" },
  fr: { coversEyebrow: "Le travail", coversTitle: "Ce que l’atelier peut proposer.", coversNote: "L’atelier propose le travail dont votre livre a besoin ; vous décidez avant que rien ne commence.", others: "Les autres disciplines", breadcrumb: "Fil d’Ariane", more: "Découvrir la discipline" },
  de: { coversEyebrow: "Die Arbeit", coversTitle: "Was die Werkstatt vorschlagen kann.", coversNote: "Die Werkstatt schlägt die Arbeit vor, die Ihr Buch braucht; Sie entscheiden, bevor etwas beginnt.", others: "Weitere Disziplinen", breadcrumb: "Brotkrumennavigation", more: "Mehr über diese Disziplin" },
  it: { coversEyebrow: "Il lavoro", coversTitle: "Che cosa può proporre il laboratorio.", coversNote: "Il laboratorio propone il lavoro di cui il vostro libro ha bisogno; decidete voi prima che inizi qualsiasi cosa.", others: "Le altre discipline", breadcrumb: "Percorso di navigazione", more: "Scopri la disciplina" },
  es: { coversEyebrow: "El trabajo", coversTitle: "Lo que el taller puede proponer.", coversNote: "El taller propone el trabajo que su libro necesita; usted decide antes de que empiece nada.", others: "Otras disciplinas", breadcrumb: "Ruta de navegación", more: "Descubrir la disciplina" },
};

export function discipline(slug: DisciplineSlug): Discipline {
  const found = DISCIPLINES.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`Unknown Fine Bindery discipline: ${slug}`);
  return found;
}

export function disciplinePath(locale: FineBinderyLocale, slug: DisciplineSlug): string {
  return `/${locale}/${slug}`;
}
