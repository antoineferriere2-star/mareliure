/**
 * L'adresse publique du déploiement, pour les liens qu'un serveur écrit dans
 * un e-mail ou renvoie au navigateur.
 *
 * Le lien du récapitulatif était construit sur `SITE_URL`, l'adresse de Métré
 * Build, quelle que soit la marque : un visiteur de Ma Reliure recevait un
 * lien vers metre-pro.com, où son jeton n'existe pas — les deux marques n'ont
 * pas la même base. Un lien qu'on envoie se construit sur le domaine d'où la
 * personne vient.
 */
import { isMaReliure } from "@/brand";
import { MARELIURE_SITE_URL, SITE_URL } from "./structured-data";

export const PUBLIC_SITE_URL = isMaReliure ? MARELIURE_SITE_URL : SITE_URL;
