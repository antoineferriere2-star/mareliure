import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { customerCopy } from "@/marketplace/customer/customerPresentation";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, activeProps: _a, ...rest }: { to: string; children?: ReactNode; activeProps?: unknown }) =>
    createElement("a", { href: to, ...rest }, children),
}));

const { CustomerPortalShell } = await import("./CustomerPortalShell");

const render = (brand: "MA_RELIURE" | "FINE_BINDERY", account?: ReactNode) =>
  renderToStaticMarkup(
    createElement(CustomerPortalShell, { brand, account, children: createElement("p", null, "contenu") }),
  );

describe("CustomerPortalShell — the way out", () => {
  it("places the account control in the header, next to My books", () => {
    const html = render("MA_RELIURE", createElement("button", null, "Se déconnecter"));
    const header = html.split("</header>")[0];
    expect(header).toContain("Se déconnecter");
    expect(header.indexOf("Mes livres")).toBeLessThan(header.indexOf("Se déconnecter"));
    expect(html.split("</header>")[1]).not.toContain("Se déconnecter");
  });

  it("renders without one — the frame needs no session, no router context", () => {
    expect(render("MA_RELIURE")).toContain("contenu");
  });

  it("has the words for both brands, in the brand's language", () => {
    expect(customerCopy("fr-FR").signOut).toBe("Se déconnecter");
    expect(customerCopy("fr-FR").signedInAs).toBe("Connecté en tant que");
    expect(customerCopy("en-US").signOut).toBe("Sign out");
    expect(customerCopy("en-US").signedInAs).toBe("Signed in as");
  });
});
