// Guards that self-service setup stays open to every trade.
//
// The portal used to refuse any client whose website was not a deck business:
// the wizard hid the "continue" button, and the server rejected the confirmed
// product. That refusal was never a technical limit — the draft generator has
// always built a Playbook for whatever product it is given — so it turned away
// clients the engine could already serve.
//
// These are source-level assertions for the same reason as
// multiIntakeContract: the server functions are wrapped in HTTP/auth
// middleware and cannot be invoked outside a real request.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/** Source with comments stripped, so prose about a pattern never satisfies a check for it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const server = withoutComments(read("src/build/services/portalOnboarding.data.functions.ts"));
const wizard = withoutComments(read("src/routes/_authenticated/portal/setup.tsx"));

describe("no vertical gate stands between a client and their Playbook", () => {
  it.each([
    ["the server", () => server],
    ["the setup wizard", () => wizard],
  ])("%s never asks whether the trade is eligible", (_label, source) => {
    expect(source()).not.toContain("resolveVerticalEligibility");
    expect(source()).not.toContain("checkVerticalProduct");
  });

  it("validates the confirmed product on length only", () => {
    // checkProduct rejects empty and over-long input. Anything else is a
    // legitimate product, including trades absent from the vertical registry.
    expect(server).toContain("checkProduct(data.product)");
    expect(wizard).toContain("checkProduct(product)");
  });

  it("does not label a generated Playbook 'deck' regardless of the product", () => {
    // `project_type: \`deck ${product}\`` produced "deck Pergola" for a pergola
    // installer, which then flowed into the Mission and the Dossier.
    expect(server).toContain("project_type: row.confirmed_product,");
    expect(server).not.toContain("`deck ${");
  });

  it("asks for a product without naming a trade", () => {
    expect(server).toContain("Confirm your product first.");
    expect(server).not.toContain("Confirm your deck product first.");
  });

  it("offers the site's own products as suggestions, unfiltered", () => {
    // Filtering suggestions by vertical left a pergola installer with an empty
    // list and no idea what to type.
    expect(wizard).toContain("analysis.products.filter(");
    expect(wizard).not.toContain("suggestedProducts");
  });

  it("does not fall back to the word Deck in the client's own fields", () => {
    expect(wizard).not.toContain('?? "Deck"');
    expect(wizard).not.toContain('?? "Deck builder"');
  });
});
