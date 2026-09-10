/**
 * Les pages légales disent ce que le code fait.
 *
 * Une politique de confidentialité exacte le jour de sa rédaction devient
 * fausse sans que personne n'y touche : il suffit qu'un prestataire change
 * dans le code. Ce test confronte les affirmations des pages aux fichiers qui
 * les rendent vraies, et vérifie que le tunnel Ma Reliure mène bien à ces
 * pages — et plus aux pages anglaises de Métré Build.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MARELIURE_CONTACT_EMAIL,
  MARELIURE_PROVIDERS,
  MARELIURE_PUBLISHER,
  SUMMARY_LINK_VALIDITY_DAYS,
} from "./legalEntity";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("l'éditeur est déclaré une seule fois", () => {
  it("porte l'identité fournie par l'éditeur", () => {
    expect(MARELIURE_PUBLISHER).toMatchObject({
      name: "OPPE SAS",
      siren: "943 317 610",
      siret: "943 317 610 00013",
      vat: "FR55 943 317 610",
    });
    expect(MARELIURE_CONTACT_EMAIL).toBe("contact@oppe.fr");
  });

  /** Un numéro recopié en dur dans une page finirait par diverger de la source. */
  it("n'est recopié en dur dans aucune page", () => {
    const pages = read("src/marketplace/pages/legal/LegalPages.tsx");
    expect(pages).not.toContain("943 317 610");
    expect(pages).not.toContain("705 route du Montclair");
  });
});

describe("les affirmations correspondent au code", () => {
  it("annonce la durée réelle du lien de récapitulatif", () => {
    const source = read("src/build/services/dossierAccessToken.server.ts");
    expect(source).toMatch(new RegExp(`TTL_DAYS\\s*=\\s*${SUMMARY_LINK_VALIDITY_DAYS}\\b`));
  });

  it("nomme le domaine d'envoi des e-mails réellement utilisé", () => {
    const source = read("src/lib/email-templates/send-email.ts");
    expect(source).toContain(`SENDER_DOMAIN = "${MARELIURE_PROVIDERS.email.senderDomain}"`);
  });

  it("nomme la passerelle d'IA réellement appelée", () => {
    const calls = [read("src/build/ai/runAgent.ts"), read("src/routes/api/public/build-runtime.ts")]
      .join("\n")
      .toLowerCase();
    expect(calls).toMatch(/lovable|ai_gateway|gateway/);
  });

  it("décrit une empreinte d'IP salée, parce que le code la sale", () => {
    expect(read("src/build/services/visitorFingerprint.server.ts")).toContain("IP_HASH_SALT");
  });
});

describe("le tunnel et le site mènent aux pages de Ma Reliure", () => {
  it("existent comme routes", () => {
    for (const route of ["confidentialite", "conditions", "mentions-legales"])
      expect(existsSync(resolve(process.cwd(), `src/routes/${route}.tsx`)), route).toBe(true);
  });

  it("remplace, sur Ma Reliure seulement, les liens vers les pages de Métré", () => {
    const shell = read("src/build/pages/public/BuildPublicShell.tsx");
    expect(shell).toContain('isMaReliure ? "/confidentialite" : "/privacy"');
    expect(shell).toContain('isMaReliure ? "/conditions" : "/terms"');
  });

  /** L'adresse avait été introduite sans vérifier que la boîte existait. */
  it("ne publie plus une adresse de contact jamais vérifiée", () => {
    for (const file of [
      "src/marketplace/pages/ReliureLanding.tsx",
      "src/marketplace/pages/landing/LandingChrome.tsx",
    ])
      expect(read(file), file).not.toContain("contact@mareliure.fr");
  });

  it("lie les pages légales depuis le pied de page au lieu de les annoncer", () => {
    const chrome = read("src/marketplace/pages/landing/LandingChrome.tsx");
    for (const href of ["/mentions-legales", "/confidentialite", "/conditions"])
      expect(chrome).toContain(`href: "${href}"`);
  });
});
