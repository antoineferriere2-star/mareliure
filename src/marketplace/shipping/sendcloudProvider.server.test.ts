import { describe, expect, it } from "vitest";
import { announceBody, createSendcloudProvider } from "./sendcloudProvider.server";
import type { LabelRequest } from "./labelProvider";

// Réponses HTTP simulées selon la documentation publique v3 ; aucun appel réseau réel.
const req: LabelRequest = {
  reference: "job-1", direction: "outbound", shippingOptionCode: "qa:option",
  from: { name: "QA exp", addressLine1: "1 rue QA", postalCode: "75001", city: "Paris", countryCode: "FR" },
  to: { name: "QA dest", addressLine1: "2 rue QA", postalCode: "69001", city: "Lyon", countryCode: "FR" },
  parcel: { weightGrams: 500, dimensionsMm: [350, 250, 80] },
};
const shipment = { id: "shp-1", carrier: { code: "colissimo" }, label_file: btoa("%PDF-1.4 QA"),
  parcels: [{ id: 42, tracking_number: "QA42", status: { code: "announced", message: "Announced" }, documents: [] }] };
function provider(responses: (Response | Error)[], calls: { url: string; init?: RequestInit }[] = []) {
  return createSendcloudProvider({ publicKey: "pk", secretKey: "sk", fetchImpl: (async (url: string, init?: RequestInit) => {
    calls.push({ url, init }); const next = responses.shift(); if (!next || next instanceof Error) throw next ?? new Error("no response"); return next;
  }) as typeof fetch });
}
const ok = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("adaptateur Sendcloud v3 (non activé)", () => {
  it("refuse de s'instancier sans clés", () => {
    expect(() => createSendcloudProvider({ publicKey: "", secretKey: "" })).toThrow("sendcloud_keys_missing");
  });
  it("envoie la référence de réservation comme external_reference_id, poids en grammes et dimensions en mm", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const result = await provider([ok(200, { data: shipment })], calls).create(req);
    expect(calls[0].url).toBe("https://panel.sendcloud.sc/api/v3/shipments/announce");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ external_reference_id: "job-1",
      ship_with: { type: "shipping_option_code", properties: { shipping_option_code: "qa:option" } },
      parcels: [{ weight: { value: "500", unit: "g" }, dimensions: { length: "350", width: "250", height: "80", unit: "mm" } }] });
    expect(result.kind).toBe("created");
    if (result.kind === "created") {
      expect(result.label).toMatchObject({ labelId: "42", carrier: "colissimo", tracking: "QA42", chargedTtcCents: null });
      expect(new TextDecoder().decode(await result.label.pdf())).toBe("%PDF-1.4 QA");
    }
    expect(announceBody(req).from_address).not.toHaveProperty("email");
  });
  it("traite le 409 comme l'envoi existant (aucun second achat)", async () => {
    expect((await provider([ok(409, { data: shipment })]).create(req)).kind).toBe("created");
  });
  it.each([
    [ok(400, {}), "rejected"], [ok(422, {}), "rejected"], [ok(429, {}), "not_created"], [ok(401, {}), "not_created"],
    [ok(500, {}), "ambiguous"], [ok(200, { data: { parcels: [] } }), "ambiguous"], [new Error("timeout"), "ambiguous"],
  ] as const)("classe %#", async (response, kind) => {
    expect((await provider([response]).create(req)).kind).toBe(kind);
  });
  it("relit par référence : présent, absent ou illisible", async () => {
    expect(await provider([ok(200, { data: [shipment] })]).findByReference("job-1")).toMatchObject({ labelId: "42" });
    expect(await provider([ok(200, { data: [] })]).findByReference("job-1")).toBeNull();
    expect(await provider([ok(500, {})]).findByReference("job-1")).toBe("unknown");
    expect(await provider([new Error("down")]).findByReference("job-1")).toBe("unknown");
  });
  it.each([[200, "cancelled"], [202, "queued"], [409, "refused"], [404, "refused"], [500, "ambiguous"]] as const)(
    "annulation HTTP %i ⇒ %s", async (status, kind) => {
      const calls: { url: string }[] = [];
      expect((await provider([ok(200, { data: [shipment] }), ok(status, {})], calls).cancel("job-1")).kind).toBe(kind);
      expect(calls[1].url).toBe("https://panel.sendcloud.sc/api/v3/shipments/shp-1/cancel");
    });
});

describe("méthodes disponibles (fetch-shipping-options)", () => {
  it("n'envoie que pays, codes postaux, poids et dimensions ; lit code, kilomètres, prix et facturation", async () => {
    const { fetchSendcloudShippingOptions } = await import("./sendcloudProvider.server");
    let sent: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ data: [{ code: "mondial_relay:home/domestic", name: "Mondial Relay Home", carrier: { code: "mondial_relay", name: "Mondial Relay" },
        functionalities: { first_mile: "dropoff", last_mile: "home_delivery", returns: false }, charging_type: "first_scan",
        quotes: [{ price: { total: { value: "5.17", currency: "EUR" } } }] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await fetchSendcloudShippingOptions({ publicKey: "p", secretKey: "s", fetchImpl },
      { fromCountry: "FR", fromPostalCode: "75011", toCountry: "FR", toPostalCode: "69002", weightGrams: 480, dimensionsMm: [340, 240, 60] });
    expect(Object.keys(sent).sort()).toEqual(["dimensions", "from_country_code", "from_postal_code", "to_country_code", "to_postal_code", "weight"]);
    expect(result).toEqual([{ code: "mondial_relay:home/domestic", name: "Mondial Relay Home", carrier: "Mondial Relay", firstMile: "dropoff",
      lastMile: "home_delivery", returns: false, servicePointRequired: false, chargingType: "first_scan", priceCents: 517, currency: "EUR" }]);
  });
  it("sans clés ou en cas de refus : indisponible, jamais une liste vide trompeuse", async () => {
    const { fetchSendcloudShippingOptions } = await import("./sendcloudProvider.server");
    const q = { fromCountry: "FR", fromPostalCode: "75011", toCountry: "FR", toPostalCode: "69002", weightGrams: 480, dimensionsMm: [340, 240, 60] as [number, number, number] };
    expect(await fetchSendcloudShippingOptions({ publicKey: "", secretKey: "" }, q)).toBe("unavailable");
    expect(await fetchSendcloudShippingOptions({ publicKey: "p", secretKey: "s", fetchImpl: (async () => new Response("", { status: 401 })) as unknown as typeof fetch }, q)).toBe("unavailable");
  });
});
