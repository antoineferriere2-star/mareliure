/** La fenêtre elle-même : fermée, rien ; ouverte, ce qui va être figé, et le refus avant l'action. */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Radix passe par un portail, absent du rendu serveur : on garde la structure, sans le portail.
vi.mock("@/components/ui/alert-dialog", () => {
  const tag = (name: string) => ({ children }: { children?: ReactNode }) => createElement(name, null, children);
  return {
    AlertDialog: ({ open, children }: { open: boolean; children?: ReactNode }) =>
      open ? createElement("div", null, children) : null,
    AlertDialogContent: tag("section"),
    AlertDialogHeader: tag("header"),
    AlertDialogTitle: tag("h2"),
    AlertDialogDescription: tag("p"),
    AlertDialogFooter: tag("footer"),
    AlertDialogCancel: tag("button"),
    AlertDialogAction: tag("button"),
  };
});

const { IssueConfirmDialog } = await import("./IssueConfirmDialog");

const props = {
  onOpenChange: () => undefined,
  onConfirm: () => undefined,
  title: "Émettre cette facture ?",
  description: "Elle ne pourra plus être modifiée.",
  details: [{ label: "Client", value: "Jeanne Martin" }],
  confirmLabel: "Émettre définitivement",
};

describe("IssueConfirmDialog", () => {
  it("n'affiche rien tant que la demande n'est pas faite", () => {
    expect(renderToStaticMarkup(createElement(IssueConfirmDialog, { ...props, open: false }))).toBe("");
  });

  it("montre ce qui va être figé et place le refus avant l'action", () => {
    const html = renderToStaticMarkup(createElement(IssueConfirmDialog, { ...props, open: true }));
    expect(html).toContain("Jeanne Martin");
    expect(html).toContain("Elle ne pourra plus être modifiée.");
    expect(html.indexOf("Revenir")).toBeLessThan(html.indexOf("Émettre définitivement"));
  });
});
