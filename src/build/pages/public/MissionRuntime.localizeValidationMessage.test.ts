import { describe, expect, it } from "vitest";
import type { AddressField, PlaybookField } from "@/build/schema/playbook";
import { publicCopy } from "./publicLocaleContext";
import { localizeValidationMessage } from "./MissionRuntime";

const esCopy = (text: string) => publicCopy("es-US", text);

const textField: PlaybookField = {
  key: "widgetName",
  label: "Widget name",
  type: "text",
  desirability: "required",
};

const addressField: AddressField = {
  key: "address",
  label: "Address",
  type: "address",
  desirability: "optional",
  components: [{ key: "zip", label: "ZIP code" }],
};

describe("localizeValidationMessage", () => {
  it("translates the template and splices the (untranslated) field label back in", () => {
    const message = localizeValidationMessage('"Widget name" is required.', textField, esCopy);
    expect(message).toBe('"Widget name" es obligatorio.');
  });

  it("matches an address component's label, not the field's own label, and translates it too", () => {
    const message = localizeValidationMessage('"ZIP code" is not valid.', addressField, esCopy);
    expect(message).toBe('"Código postal" no es válido.');
  });

  it("preserves an interpolated count while translating the surrounding phrase", () => {
    const multiField: PlaybookField = {
      key: "widgets",
      label: "Widget count preference",
      type: "multi_choice",
      desirability: "optional",
      options: [{ value: "a", label: "A" }],
      minSelected: 2,
    };
    const message = localizeValidationMessage(
      '"Widget count preference" requires at least 2 selection(s).',
      multiField,
      esCopy,
    );
    expect(message).toBe('"Widget count preference" requiere al menos 2 selección(es).');
  });

  it("falls back to the original message when no dictionary entry matches (English locale)", () => {
    const identity = (text: string) => text;
    const message = localizeValidationMessage('"Name" is required.', textField, identity);
    expect(message).toBe('"Name" is required.');
  });
});
