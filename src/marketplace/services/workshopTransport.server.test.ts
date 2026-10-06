import { afterEach, expect, it, vi } from "vitest";
import { workshopTransportOptions } from "./workshopTransport.server";
import { fetchSendcloudShippingOptions } from "@/marketplace/shipping/sendcloudProvider.server";
vi.mock("@/marketplace/shipping/sendcloudProvider.server", () => ({ fetchSendcloudShippingOptions: vi.fn() }));
const address = { name: "Recette fictive", line1: "1 rue de la Recette", line2: null, phone: null, postalCode: "75001", city: "Paris", countryCode: "FR" };
const input = { workId: "work", invoiceId: "invoice", fromAddress: address, toAddress: address, parcel: { weightGrams: 450, lengthMm: 250, widthMm: 180, heightMm: 60 } };
function client(work: unknown = { source: "mon_client" }, invoice: unknown = { quote_id: "quote" }, quote: unknown = { id: "quote" }) {
  const filters: unknown[] = [];
  return { filters, from(table: string) {
    const q = { select: () => q, eq: (key: string, value: string) => { filters.push([table,key,value]); return q; }, maybeSingle: async () => ({ error: null, data: table === "marketplace_binder_works" ? work : table === "marketplace_binder_invoices" ? invoice : quote }) };
    return q;
  } };
}
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it.each([null, {source:"ma_reliure"}])("refuse un ouvrage extérieur ou du circuit A avant toute consultation fournisseur", async work => {
  await expect(workshopTransportOptions(client(work) as never,"binder",input)).rejects.toMatchObject({status:404});
  expect(fetchSendcloudShippingOptions).not.toHaveBeenCalled();
});
it.each([[null,{id:"quote"}],[{quote_id:"quote"},null]])("refuse une facture étrangère ou détachée de l’ouvrage", async (invoice,quote) => {
  await expect(workshopTransportOptions(client(undefined,invoice,quote) as never,"binder",input)).rejects.toMatchObject({status:404});
  expect(fetchSendcloudShippingOptions).not.toHaveBeenCalled();
});
it("ne propose aucun tarif international, Corse ou fournisseur non configuré", async () => {
  for (const [countryCode,postalCode] of [["BE","1000"],["FR","20000"]]) {
    await expect(workshopTransportOptions(client() as never,"binder",{...input,toAddress:{...address,countryCode,postalCode}})).resolves.toMatchObject({available:false,reason:"outside_qualified_area",options:[]});
  }
  vi.stubEnv("SENDCLOUD_PUBLIC_KEY",""); vi.stubEnv("SENDCLOUD_SECRET_KEY","");
  await expect(workshopTransportOptions(client() as never,"binder",input)).resolves.toMatchObject({available:false,reason:"provider_unconfigured"});
  expect(fetchSendcloudShippingOptions).not.toHaveBeenCalled();
});
it("consulte seulement les données nécessaires et affiche uniquement les prix réels qualifiés", async () => {
  vi.stubEnv("SENDCLOUD_PUBLIC_KEY","test-only"); vi.stubEnv("SENDCLOUD_SECRET_KEY","test-only");
  const base = { code:"test", carrier:"Fixture carrier", name:"Fixture service", currency:"EUR", priceCents:700, servicePointRequired:false };
  vi.mocked(fetchSendcloudShippingOptions).mockResolvedValue([base,{...base,code:"unknown",priceCents:null},{...base,code:"USD",currency:"USD"},{...base,code:"pickup",servicePointRequired:true}] as never);
  const sb=client();
  await expect(workshopTransportOptions(sb as never,"binder",input)).resolves.toMatchObject({available:true,options:[base]});
  expect(sb.filters).toContainEqual(["marketplace_binder_quotes","work_id","work"]);
  expect(sb.filters).toContainEqual(["marketplace_binder_invoices","status","issued"]);
  expect(fetchSendcloudShippingOptions).toHaveBeenCalledWith({publicKey:"test-only",secretKey:"test-only"},{fromCountry:"FR",fromPostalCode:"75001",toCountry:"FR",toPostalCode:"75001",weightGrams:450,dimensionsMm:[250,180,60]});
});
