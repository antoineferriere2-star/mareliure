import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { loadCaseContext } from "./caseRepository.server";
import { commercialOriginOf } from "@/marketplace/cases/commercialOrigin";
import { customerJourney } from "@/marketplace/shipping/customerJourney";
import { getQuote,getInvoice,getCreditNote } from "./binderQuotes.server";
import { renderDocumentPdf } from "@/marketplace/quotes/documentPdf";
import { openWorkshopPaymentToken } from "@/marketplace/stripe/workshopPaymentToken.server";
import { hashAccessToken } from "@/build/services/dossierAccessToken.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";

export type WorkshopCustomerDocument = {id:string;kind:"quote"|"invoice"|"credit";number:string;status:string;currency:string;totalCents:number};
const read = async <T>(q:PromiseLike<{data:T;error:unknown}>) => { const r=await q; if(r.error) throw r.error; return r.data; };

/** Authenticated case ownership first; every subsequent relation is bound to its recorded seller and contact. */
export async function workshopCustomerCase(sb:Supa,userId:string,caseId:string) {
  const context=await loadCaseContext(sb,caseId);
  if(!context || context.customerUserId !== userId || commercialOriginOf(context.row.acquisition_origin) !== "workshop_client" || !context.row.referred_binder_id) fail(404,"Dossier atelier introuvable.");
  const binderId=context!.row.referred_binder_id!;
  const raw=sb as unknown as SupabaseClient;
  const work=await read(raw.from("marketplace_binder_works").select("id,contact_id").eq("case_id",caseId).eq("binder_id",binderId).eq("source","workshop_platform").maybeSingle());
  const empty = {binderId,documents:[] as WorkshopCustomerDocument[],payments:[] as {invoiceId:string;status:string;paidAt:string|null;refundedCents:number;receiptUrl:string|null;url:string|null}[],declarations:[] as {invoiceId:string;kind:string;amountCents:number;currency:string;at:string}[],journey:[] as (ReturnType<typeof customerJourney>[number]&{payer:"customer"|"workshop"|null;labels:{id:string;url:string}[]})[]};
  if(!work) return empty;
  // The imported contact's immutable origin binds the documents to this case.
  // Moving the work to another contact must neither disclose that client's documents
  // nor remove the original customer's historical documents.
  const contacts=await read(raw.from("marketplace_binder_clients").select("id").eq("binder_id",binderId).eq("origin_case_id",caseId).eq("origin","workshop_platform"));
  if(!contacts?.length) return empty;
  const contactIds=contacts.map(c=>c.id);
  const quotes=await read(raw.from("marketplace_binder_quotes").select("id,quote_number,status,currency,total_ttc_cents").eq("work_id",work.id).eq("binder_id",binderId).in("client_id",contactIds).in("status",["sent","accepted","invoiced","refused","expired"]));
  if(!quotes?.length) return empty;
  const invoices=await read(raw.from("marketplace_binder_invoices").select("id,invoice_number,status,currency,total_ttc_cents").eq("binder_id",binderId).in("client_id",contactIds).eq("status","issued").in("quote_id",quotes.map(q=>q.id)));
  const invoiceIds=(invoices??[]).map(i=>i.id);
  const credits=invoiceIds.length ? await read(raw.from("marketplace_binder_credit_notes").select("id,credit_note_number,currency,total_ttc_cents").eq("binder_id",binderId).in("invoice_id",invoiceIds)) : [];
  empty.documents=[...quotes.map(q=>({id:q.id,kind:"quote" as const,number:q.quote_number,status:q.status,currency:q.currency,totalCents:q.total_ttc_cents})),...(invoices??[]).map(i=>({id:i.id,kind:"invoice" as const,number:i.invoice_number,status:i.status,currency:i.currency,totalCents:i.total_ttc_cents})),...(credits??[]).map(c=>({id:c.id,kind:"credit" as const,number:c.credit_note_number,status:"issued",currency:c.currency,totalCents:c.total_ttc_cents}))];
  if(!invoiceIds.length) return empty;
  const payments=await read(raw.from("marketplace_workshop_online_payments").select("id,invoice_id,status,paid_at,refunded_cents,receipt_url,sealed_token,token_hash,token_expires_at").eq("binder_id",binderId).in("invoice_id",invoiceIds));
  for (const p of payments??[]) {
    let url:string|null=null;
    if(p.sealed_token && p.token_expires_at && Date.parse(p.token_expires_at)>Date.now()) {
      const token=await openWorkshopPaymentToken(p.sealed_token,binderId,p.id);
      if(hashAccessToken(token)!==p.token_hash) throw new Error("workshop_payment_token_invalid");
      url=`${workshopOrigin()}/reglement-atelier/${token}`;
    }
    empty.payments.push({invoiceId:p.invoice_id,status:p.status,paidAt:p.paid_at,refundedCents:p.refunded_cents,receiptUrl:p.receipt_url,url});
  }
  const declarations=await read(raw.from("marketplace_external_settlements").select("invoice_id,kind,amount_cents,currency,created_at").in("invoice_id",invoiceIds).order("created_at",{ascending:true}));
  empty.declarations=(declarations??[]).map(d=>({invoiceId:d.invoice_id,kind:d.kind,amountCents:d.amount_cents,currency:d.currency,at:d.created_at}));
  const events=await read(raw.from("marketplace_work_logistics_events").select("id,kind,created_at,details").eq("work_id",work.id).order("sequence",{ascending:true}));
  const legs=(events??[]).filter(e=>["outbound","return"].includes(e.kind) && invoiceIds.includes(e.details?.invoiceId));
  const labels=legs.length ? await read(raw.from("marketplace_work_logistics_labels").select("id,event_id,path").in("event_id",legs.map(e=>e.id))) : [];
  let currentLegOwned=false;
  for(const event of events??[]) {
    if(["outbound","return"].includes(event.kind)) currentLegOwned=invoiceIds.includes(event.details?.invoiceId);
    if(!currentLegOwned) continue;
    const step=customerJourney([event])[0]; if(!step) continue;
    const signedLabels:{id:string;url:string}[]=[];
    for(const label of labels??[]) if(label.event_id===event.id) {
      const signed=await sb.storage.from("work-transport-labels-private").createSignedUrl(label.path,60);
      if(signed.error) throw signed.error; if(signed.data?.signedUrl) signedLabels.push({id:label.id,url:signed.data.signedUrl});
    }
    empty.journey.push({...step,payer:event.details?.payer==="customer"?"customer":event.details?.payer==="workshop"?"workshop":null,labels:signedLabels});
  }
  return empty;
}

export async function workshopCustomerDocument(sb:Supa,userId:string,caseId:string,kind:WorkshopCustomerDocument["kind"],id:string) {
  const owned=await workshopCustomerCase(sb,userId,caseId);
  const doc=owned.documents.find(d=>d.id===id && d.kind===kind);
  if(!doc) fail(404,"Document introuvable.");
  const actual=kind==="quote"?await getQuote(sb,owned.binderId,id):kind==="invoice"?await getInvoice(sb,owned.binderId,id):await getCreditNote(sb,owned.binderId,id);
  const {base64}=await renderDocumentPdf(actual);
  return {filename:`${kind}-${doc!.number.replace(/[^A-Za-z0-9._-]/g,"_")}.pdf`,base64};
}
