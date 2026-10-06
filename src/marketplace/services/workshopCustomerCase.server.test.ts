import { beforeEach, expect, it, vi } from "vitest";
import { workshopCustomerCase, workshopCustomerDocument } from "./workshopCustomerCase.server";
import { loadCaseContext } from "./caseRepository.server";
import { getInvoice } from "./binderQuotes.server";
import { sealWorkshopPaymentToken } from "@/marketplace/stripe/workshopPaymentToken.server";
import { hashAccessToken } from "@/build/services/dossierAccessToken.server";

vi.mock("./caseRepository.server",()=>({loadCaseContext:vi.fn()}));
vi.mock("./binderQuotes.server",()=>({getQuote:vi.fn(),getInvoice:vi.fn(),getCreditNote:vi.fn()}));
vi.mock("@/marketplace/quotes/documentPdf",()=>({renderDocumentPdf:vi.fn(async()=>({base64:"PDF"}))}));
type Row=Record<string,unknown>;
function world() {
  const tables:Record<string,Row[]>={
    marketplace_binder_clients:[{id:"contact",binder_id:"seller",origin_case_id:"case",origin:"workshop_platform"},{id:"other-contact",binder_id:"seller",origin_case_id:"other-case",origin:"workshop_platform"}],
    marketplace_binder_works:[{id:"work",case_id:"case",binder_id:"seller",source:"workshop_platform",contact_id:"contact"},{id:"other-work",case_id:"case",binder_id:"foreign",source:"workshop_platform",contact_id:"other-contact"}],
    marketplace_binder_quotes:[{id:"quote",work_id:"work",binder_id:"seller",client_id:"contact",status:"accepted",quote_number:"Q-1",currency:"EUR",total_ttc_cents:10000},{id:"draft",work_id:"work",binder_id:"seller",client_id:"contact",status:"draft"},{id:"foreign-quote",work_id:"work",binder_id:"seller",client_id:"other-contact",status:"sent"}],
    marketplace_binder_invoices:[{id:"invoice",quote_id:"quote",binder_id:"seller",client_id:"contact",status:"issued",invoice_number:"I-1",currency:"EUR",total_ttc_cents:10000},{id:"foreign-invoice",quote_id:"quote",binder_id:"seller",client_id:"other-contact",status:"issued"},{id:"draft-invoice",quote_id:"quote",binder_id:"seller",client_id:"contact",status:"draft"}],
    marketplace_binder_credit_notes:[{id:"credit",invoice_id:"invoice",binder_id:"seller",credit_note_number:"C-1",currency:"EUR",total_ttc_cents:2000}],
    marketplace_workshop_online_payments:[{id:"payment",invoice_id:"invoice",binder_id:"seller",status:"paid",paid_at:"2026-10-06T12:00Z",refunded_cents:2000,receipt_url:"https://pay.stripe.com/receipt/fixture",sealed_token:null},{id:"foreign-payment",invoice_id:"foreign-invoice",binder_id:"seller",status:"paid",paid_at:"private",token_hash:"private"}],
    marketplace_external_settlements:[{invoice_id:"invoice",kind:"receipt",amount_cents:500,currency:"EUR",created_at:"2026-10-06T12:00Z",evidence:"PRIVATE BANK PROOF"},{invoice_id:"foreign-invoice",kind:"receipt",amount_cents:9000}],
    marketplace_work_logistics_events:[{id:"leg",work_id:"work",kind:"outbound",created_at:"2026-10-06T12:00Z",details:{invoiceId:"invoice",mode:"parcel",carrier:"TEST CARRIER",tracking:"TEST-ONLY",payer:"customer",from:{line1:"PRIVATE ADDRESS"},note:"PRIVATE NOTE"}},{id:"received",work_id:"work",kind:"received",created_at:"2026-10-06T12:05Z",details:{photo_paths:["PRIVATE PHOTO"]}},{id:"foreign-leg",work_id:"work",kind:"return",created_at:"2026-10-06T12:10Z",details:{invoiceId:"foreign-invoice",mode:"parcel",tracking:"FOREIGN TRACKING"}},{id:"foreign-incident",work_id:"work",kind:"incident",created_at:"2026-10-06T12:11Z",details:{}}],
    marketplace_work_logistics_labels:[{id:"label",event_id:"leg",path:"PRIVATE LABEL"},{id:"foreign-label",event_id:"foreign-leg",path:"FOREIGN LABEL"}],
  };
  const signed=vi.fn(async()=>({data:{signedUrl:"https://private.example.test/signed-for-60s"},error:null}));
  const queried:string[]=[];
  const sb={from:(table:string)=>{
    queried.push(table);let rows=tables[table]??[];
    const q={select:()=>q,eq:(key:string,value:unknown)=>{rows=rows.filter(r=>r[key]===value);return q;},in:(key:string,values:unknown[])=>{rows=rows.filter(r=>values.includes(r[key]));return q;},order:()=>q,maybeSingle:async()=>({data:rows[0]??null,error:null}),then:(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(resolve,reject)};return q;
  },storage:{from:()=>({createSignedUrl:signed})}};
  return {sb,tables,signed,queried};
}
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv("WORKSHOP_PAYMENT_LINK_KEY",btoa("t".repeat(32)));vi.stubEnv("MARKETPLACE_PUBLIC_ORIGIN","https://qa.example.test");
  vi.mocked(loadCaseContext).mockResolvedValue({customerUserId:"owner",row:{acquisition_origin:"BINDER_REFERRED",referred_binder_id:"seller"}} as never);
});
it.each(["stranger","unclaimed"])("refuse %s avant toute lecture financière",async actor=>{
  const w=world();await expect(workshopCustomerCase(w.sb as never,actor,"case")).rejects.toThrow();expect(w.queried).toEqual([]);
});
it("refuse une commande Oppe même à son véritable client",async()=>{
  vi.mocked(loadCaseContext).mockResolvedValue({customerUserId:"owner",row:{acquisition_origin:"MA_RELIURE_ACQUIRED",referred_binder_id:"seller"}} as never);
  const w=world();await expect(workshopCustomerCase(w.sb as never,"owner","case")).rejects.toThrow();expect(w.queried).toEqual([]);
});
it("borne documents, paiements, déclarations et transports au vendeur et au contact enregistrés",async()=>{
  const w=world();const result=await workshopCustomerCase(w.sb as never,"owner","case");
  expect(result.documents.map(d=>d.id)).toEqual(["quote","invoice","credit"]);
  expect(result.payments).toHaveLength(1);expect(result.declarations).toHaveLength(1);
  expect(result.journey.map(s=>s.kind)).toEqual(["outbound","received"]);
  expect(result.journey[0].payer).toBe("customer");expect(w.signed).toHaveBeenCalledExactlyOnceWith("PRIVATE LABEL",60);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|FOREIGN|token_hash|sealed_token|draft/);
});
it("un document étranger ne déclenche ni lecture PDF ni récupération hors atelier",async()=>{
  const w=world();await expect(workshopCustomerDocument(w.sb as never,"owner","case","invoice","foreign-invoice")).rejects.toThrow();expect(getInvoice).not.toHaveBeenCalled();
});
it("changer le contact de l’ouvrage conserve l’historique du client initial sans révéler les documents du nouveau contact",async()=>{
  const w=world();w.tables.marketplace_binder_works[0].contact_id="other-contact";
  const result=await workshopCustomerCase(w.sb as never,"owner","case");
  expect(result.documents.map(d=>d.id)).toEqual(["quote","invoice","credit"]);
  expect(result.payments).toHaveLength(1);expect(JSON.stringify(result)).not.toContain("foreign");
});
it("un document historique reste téléchargeable indépendamment des droits de nouvelle création",async()=>{
  const w=world();vi.mocked(getInvoice).mockResolvedValue({} as never);
  expect(await workshopCustomerDocument(w.sb as never,"owner","case","invoice","invoice")).toEqual({filename:"invoice-I-1.pdf",base64:"PDF"});
  expect(getInvoice).toHaveBeenCalledWith(w.sb,"seller","invoice");expect(w.queried).not.toContain("marketplace_binder_subscriptions");
});
it("récupère seulement le lien authentifié existant sans renouveler sa validité",async()=>{
  const w=world(),token="a".repeat(64);const p=w.tables.marketplace_workshop_online_payments[0];
  p.sealed_token=await sealWorkshopPaymentToken(token,"seller","payment");p.token_hash=hashAccessToken(token);p.token_expires_at="2099-01-01T00:00Z";
  expect((await workshopCustomerCase(w.sb as never,"owner","case")).payments[0].url).toBe(`https://qa.example.test/reglement-atelier/${token}`);
  p.token_expires_at="2000-01-01T00:00Z";expect((await workshopCustomerCase(w.sb as never,"owner","case")).payments[0].url).toBeNull();
  expect(p.token_expires_at).toBe("2000-01-01T00:00Z");
});
