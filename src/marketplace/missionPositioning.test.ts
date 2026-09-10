/**
 * Ce que le tunnel promet au visiteur doit être ce que Ma Reliure vend.
 *
 * Ma Reliure n'est pas une place de marché : elle étudie le projet, fixe un
 * prix et confie le livre à un atelier. Le Playbook et la Mission disaient
 * pourtant encore l'inverse, longtemps après la décision — « des relieurs
 * sélectionnés vous répondront », « vous recevrez leurs propositions »,
 * « après votre choix ». Le texte de confirmation s'affichait sous « La suite »,
 * sur l'écran même où quelqu'un venait de confier son livre.
 *
 * La page d'accueil avait été réécrite. Ces textes-là ne l'étaient pas, parce
 * qu'ils ne vivent pas dans l'interface : ils sont des données, dans un
 * Playbook et dans le seed d'une Mission, et personne ne les relit en
 * retravaillant un écran. Ce test les relit.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bookbindingPlaybookSchema } from "@/build/playbooks/bookbindingPlaybookSchema";

/**
 * Les formulations écartées par la décision de positionnement, plus celles
 * qu'on a retrouvées dans les données. Des phrases précises plutôt que des mots
 * isolés : « choix » et « choisissez » servent légitimement ailleurs (« choisissez
 * ce qui vous plaît »).
 */
const INTERDITS = [
  "relieurs sélectionnés",
  "vous répondront",
  "leurs propositions",
  "après votre choix",
  "plusieurs devis",
  "recevez plusieurs",
  "comparez",
  "comparer plusieurs",
  "trois propositions",
  "mise en concurrence",
  "choisissez parmi",
  "le moins cher",
  "marketplace de relieurs",
];

/** Le seed sans ses commentaires : on juge ce qui est publié, pas ce qui l'explique. */
const SEED = readFileSync(resolve(process.cwd(), "scripts/seedBookbindingPlaybook.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

describe("le tunnel Ma Reliure parle comme le service qu'il vend", () => {
  const playbook = JSON.stringify(bookbindingPlaybookSchema).toLowerCase();

  it.each(INTERDITS)("le Playbook ne dit jamais « %s »", (phrase) => {
    expect(playbook).not.toContain(phrase.toLowerCase());
  });

  it.each(INTERDITS)("la Mission ne dit jamais « %s »", (phrase) => {
    expect(SEED.toLowerCase()).not.toContain(phrase.toLowerCase());
  });

  /**
   * Le consentement est un texte juridique avant d'être un texte commercial :
   * il doit nommer qui traite la demande et dire honnêtement que son descriptif
   * est partagé avec des ateliers, sans promettre qu'ils répondront.
   */
  it("fait consentir au traitement par Ma Reliure, pas à une diffusion", () => {
    // Parcours en profondeur plutôt qu'un chemin fixe : les étapes vivent sous
    // `sections`, et ce test n'a pas à casser le jour où la structure bouge.
    let consent: { label: string; consentText?: string } | undefined;
    (function walk(node: unknown): void {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      const record = node as Record<string, unknown>;
      if (record.key === "consentement") consent = record as unknown as typeof consent;
      Object.values(record).forEach(walk);
    })(bookbindingPlaybookSchema);
    expect(consent).toBeDefined();
    for (const text of [consent!.label, consent!.consentText ?? ""]) {
      expect(text).toContain("Ma Reliure");
      expect(text).toContain("atelier retenu");
    }
  });

  it("annonce au visiteur un prix, et un atelier", () => {
    expect(SEED).toMatch(/confirmationText:\s*"[^"]*prix[^"]*atelier/);
  });
});
