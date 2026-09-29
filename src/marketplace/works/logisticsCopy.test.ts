import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { FINE_BINDERY_LOCALES } from "@/marketplace/i18n/fineBinderyLocale";
import { logisticsKinds, type LogisticsJournal } from "./logistics";
import { logisticsCopy } from "./logisticsCopy";

const workspace = vi.hoisted(() => ({ locale: "fr" }));
vi.mock("@/marketplace/i18n/FineBinderyWorkspaceContext", () => ({
  useFineBinderyWorkspace: () => workspace,
}));
vi.mock("@/marketplace/services/workLogistics.data.functions", () => ({
  readWorkLogistics: vi.fn(),
  appendWorkLogistics: vi.fn(),
  uploadLogisticsPhoto: vi.fn(),
}));
import { LogisticsEditor } from "@/marketplace/pages/binder/works/LogisticsPanel";

const journal: LogisticsJournal = {
  events: logisticsKinds.map((kind, index) => ({
    id: String(index),
    sequence: index + 1,
    kind,
    created_at: "2026-09-29T12:00:00Z",
    actor_id: "qa",
    details: {
      mode: "parcel",
      condition: "difference",
      description: "Texte libre conservé",
      proof: "QA-EVIDENCE",
    },
    photos: [{ id: "photo", path: "", url: "https://example.invalid/private-photo" }],
  })),
};
const render = (value: LogisticsJournal) =>
  renderToStaticMarkup(
    createElement(LogisticsEditor, {
      workId: "qa",
      journal: value,
      pending: false,
      uploading: false,
      save: async () => {},
      upload: async () => {},
    }),
  );

describe.each(FINE_BINDERY_LOCALES)("logistics journal in %s", (locale) => {
  it("renders every event, privacy and attribution in the active language without translating evidence", () => {
    workspace.locale = locale;
    const t = logisticsCopy[locale],
      html = render(journal);
    for (const kind of logisticsKinds) expect(html).toContain(t.kinds[kind]);
    expect(html).toContain(t.finalDeclaration);
    expect(html).toContain(t.privatePhoto);
    expect(html).toContain(t.difference);
    expect(html).toContain(t.choosePhoto);
    expect(html).toContain("Texte libre conservé");
    expect(html).toContain("QA-EVIDENCE");
    if (locale !== "fr") expect(html).not.toContain("Référence de preuve");
  });
  it("localizes the empty editor and final-handover warning", () => {
    workspace.locale = locale;
    const t = logisticsCopy[locale],
      empty = render({ events: [] });
    for (const value of [t.empty, t.carrier, t.tracking, t.parcel, t.hand, t.save])
      expect(empty).toContain(value);
    const returning = render({
      events: journal.events.filter((e) => ["outbound", "received", "return"].includes(e.kind)),
    });
    expect(returning).toContain(t.completionHint);
  });
});
