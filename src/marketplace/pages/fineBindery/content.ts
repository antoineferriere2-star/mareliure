/**
 * Fine Bindery ne montre qu'un atelier réel, jamais une grille de
 * démonstration (§47 : de vrais profils, ou aucun). Tout le texte de la
 * page vit dans les dictionnaires `src/marketplace/i18n/locales/*` ;
 * ARTISANS (landing/content.ts) reste la source unique de l'atelier.
 */
import { ARTISANS } from "@/marketplace/pages/landing/content";

export const FEATURED_WORKSHOP = ARTISANS[0];
