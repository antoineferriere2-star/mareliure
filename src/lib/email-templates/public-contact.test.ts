import * as React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { template } from "./public-contact";

describe("public-contact email template", () => {
  it("renders the submitted contact message for the admin recipient", async () => {
    const data = {
      name: "Jane Miller",
      email: "jane@example.com",
      company: "Sunrise Decks",
      subject: "Setup question",
      message: "Can you help us connect a guided intake to our website?",
      sourcePath: "/contact",
    };

    const text = await render(React.createElement(template.component, data), {
      plainText: true,
    });

    expect(template.to).toBe("contact@metre-pro.com");
    expect(text.toLowerCase()).toContain("new contact message");
    expect(text).toContain("Jane Miller");
    expect(text).toContain("jane@example.com");
    expect(text).toContain("Setup question");
    expect(text).toContain("Source page:");
    expect(text).toContain("/contact");
  });

  it("builds a stable subject", () => {
    expect(typeof template.subject).toBe("function");
    if (typeof template.subject !== "function") return;

    expect(template.subject({ subject: "Setup question" })).toBe(
      "Métré Build contact - Setup question",
    );
    expect(template.subject({})).toBe("Métré Build contact");
  });
});
