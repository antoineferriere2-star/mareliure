import {Link} from "@tanstack/react-router";
import {useMutation,useQuery} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import type {CaseView} from "@/marketplace/cases/dossierProjection";
import {getMyWorkshopCustomerCase,getMyWorkshopCustomerDocument} from "@/marketplace/services/workshopCustomerCase.data.functions";
import type {WorkshopCustomerDocument} from "@/marketplace/services/workshopCustomerCase.server";
import {workshopCustomerCopy} from "@/marketplace/customer/workshopCustomerCopy";
import {savePdf} from "./savePdf";
import {ConversationPanel} from "@/marketplace/pages/ConversationPanel";
const card="min-w-0 rounded-lg border border-stone-300 bg-[#fffdf8] p-5 [overflow-wrap:anywhere]";
export function WorkshopCustomerCasePage({caseId,view,language,assigned}:{caseId:string;view:CaseView;language:string;assigned:boolean}) {
  const t=workshopCustomerCopy(language);
  const load=useServerFn(getMyWorkshopCustomerCase),pdf=useServerFn(getMyWorkshopCustomerDocument);
  const query=useQuery({queryKey:["workshop-customer-case",caseId],queryFn:()=>load({data:{caseId}}),refetchInterval:30000});
  const download=useMutation({mutationFn:(doc:WorkshopCustomerDocument)=>pdf({data:{caseId,id:doc.id,kind:doc.kind}}),onSuccess:result=>savePdf(result.filename,result.base64)});
  const money=(cents:number,currency="EUR")=>new Intl.NumberFormat(language,{style:"currency",currency}).format(cents/100);
  return <div className="space-y-6">
    <Link to="/mes-livres" className="inline-flex min-h-11 items-center underline">← {t.back}</Link>
    <header><h1 className="font-serif text-3xl break-words">{view.title}</h1><p className="mt-2">{view.reference}</p></header>
    <section className={card}><h2 className="font-serif text-xl">{t.title}</h2><p className="mt-3">{t.role}</p>{!query.data?.documents.length&&<p className="mt-3">{t.waiting}</p>}</section>
    {query.isPending&&<p role="status">{t.loading}</p>}
    {query.isError&&<p role="alert">{t.error} <button className="underline" onClick={()=>void query.refetch()}>{t.retry}</button></p>}
    {!!query.data?.documents.length&&<section className={card}><h2 className="font-serif text-xl">{t.documents}</h2><ul className="mt-4 space-y-4">{query.data.documents.map(doc=><li key={`${doc.kind}-${doc.id}`} className="border-t pt-3"><p>{t[doc.kind]} {doc.number} · {money(doc.totalCents,doc.currency)}</p><p>{t.statuses[doc.status as keyof typeof t.statuses]??doc.status}</p><button className="min-h-11 underline" disabled={download.isPending} onClick={()=>download.mutate(doc)}>{t.pdf}</button></li>)}</ul>{download.isError&&<p role="alert">{t.error}</p>}</section>}
    {!!query.data?.payments.length&&<section className={card}><h2 className="font-serif text-xl">{t.stripe}</h2><ul className="mt-3 space-y-3">{query.data.payments.map(p=><li key={p.invoiceId}><p>{p.paidAt?t.paid:p.status==="processing"?t.processing:t.pending}</p>{p.refundedCents>0&&<p>{t.refund} · {money(p.refundedCents)}</p>}{p.url&&<a href={p.url} rel="noreferrer" className="inline-flex min-h-11 items-center underline">{t.paymentLink}</a>}{p.receiptUrl&&<a href={p.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{t.receipt}</a>}</li>)}</ul></section>}
    {!!query.data?.declarations.length&&<section className={card}><h2 className="font-serif text-xl">{t.declarations}</h2><p className="mt-3 text-sm">{t.declaredNote}</p><ul className="mt-3 space-y-2">{query.data.declarations.map((d,i)=><li key={`${d.invoiceId}-${d.at}-${i}`}>{d.kind==="receipt"?t.declaredReceipt:d.kind==="refund"?t.declaredRefund:d.kind==="dispute_open"?t.disputeOpen:t.disputeClose}{d.amountCents>0&&<> · {money(d.amountCents,d.currency)}</>} · {new Date(d.at).toLocaleDateString(language)}</li>)}</ul></section>}
    {!!query.data?.journey.length&&<section className={card}><h2 className="font-serif text-xl">{t.transport}</h2><p className="mt-3 text-sm">{t.transportNote}</p><ol className="mt-4 space-y-4">{query.data.journey.map((step,i)=><li key={`${step.at}-${i}`} className="border-l-2 border-stone-400 pl-3"><p className="font-medium">{t[step.kind]}</p>{step.carrier&&step.tracking&&<p>{step.carrier} · {step.tracking}</p>}{step.payer&&<p>{t.payer} : {step.payer==="customer"?t.customer:t.workshop}</p>}<p>{new Date(step.at).toLocaleString(language)}</p>{step.labels.map(label=><a key={label.id} href={label.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{t.label}</a>)}</li>)}</ol></section>}
    <section className={card}><p>{view.summary}</p>{view.photos.length>0&&<ul className="mt-4 flex flex-wrap gap-3">{view.photos.map((photo,i)=>photo.url?<li key={i}><img src={photo.url} alt={photo.caption??""} className="h-32 w-32 object-contain"/></li>:null)}</ul>}</section>
    {assigned&&<ConversationPanel caseId={caseId} viewerRole="customer" locale={language.startsWith("en")?"en-US":"fr-FR"} channel="direct"/>}
  </div>;
}
