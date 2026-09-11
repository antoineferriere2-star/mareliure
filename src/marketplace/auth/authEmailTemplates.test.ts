// Les e-mails de connexion ne vivent pas dans le code qui s'exécute : ils sont
// posés dans Supabase par `scripts/configureMareliureAuth.ts`. Ce test garde
// les deux côtés d'accord — ce que l'écran promet, ce que l'e-mail dit, ce que
// la production applique.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCESS_LINK_RESEND_DELAY_SECONDS, ACCESS_LINK_VALIDITY } from "./accessLink";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const script = read("scripts/configureMareliureAuth.ts");

describe("Ma Reliure sign-in emails", () => {
  for (const file of ["magic-link.html", "confirmation.html"]) {
    it(`${file} carries the link, in French, under the Ma Reliure name only`, () => {
      const html = read(`supabase/templates/mareliure/${file}`);
      expect(html).toContain('href="{{ .ConfirmationURL }}"');
      expect(html).toContain('lang="fr"');
      expect(html).toContain("Ma Reliure");
      expect(html).toContain(ACCESS_LINK_VALIDITY);
      expect(html).not.toMatch(/Métré|Supabase|Lovable/);
      expect(script).toContain(`template("${file}")`);
    });
  }

  it("promises exactly the delays production is set to", () => {
    expect(ACCESS_LINK_VALIDITY).toBe("une heure");
    expect(script).toContain("mailer_otp_exp: 3600");
    expect(script).toContain(`smtp_max_frequency: ${ACCESS_LINK_RESEND_DELAY_SECONDS}`);
  });

  it("opens sign-ups only behind a Ma Reliure SMTP sender, and never touches the SMTP password", () => {
    expect(script).toContain("disable_signup: false");
    expect(script).toContain('if (apply) throw new Error(`Refus d\'écrire.');
    expect(script).toContain('const SENDER_DOMAIN = "mareliure.fr"');
    expect(script).not.toContain("smtp_pass");
  });
});
