import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createWorkshopInvoicePaymentLink } from './workshopOnlinePayment.server';
import { hashAccessToken } from '@/build/services/dossierAccessToken.server';
import { openWorkshopPaymentToken } from './workshopPaymentToken.server';
import type { Supa } from '@/build/services/adminAuth.server';
let row: Record<string, unknown> | null;
let reservations: number;
const fixture=()=>({
  rpc: async (_name: string,args: Record<string,unknown>)=>{reservations++; row={id:'payment-fixture',binder_id:'binder-fixture',invoice_id:'invoice-fixture',status:'ready',sealed_token:null,checkout_session_id:null,paid_at:null,fee_brand:'MA_RELIURE',token_hash:args.p_token_hash}; return {data:{...row},error:null};},
  from:()=>{
    let patch:Record<string,unknown>|undefined;const filters:Array<(r:Record<string,unknown>)=>boolean>=[];
    const run=()=>{if(!row||!filters.every(f=>f(row!)))return {data:null,error:null};if(patch)Object.assign(row,patch);return {data:{...row},error:null};};
    const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},is:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},update:(p:Record<string,unknown>)=>{patch=p;return q;},single:async()=>run(),maybeSingle:async()=>run(),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(run()).then(resolve)};return q;
  },
}) as unknown as Supa;
beforeEach(()=>{row=null;reservations=0;vi.stubEnv('WORKSHOP_PAYMENT_LINK_KEY',btoa('01234567890123456789012345678901'));vi.stubEnv('MARKETPLACE_PUBLIC_ORIGIN','https://recipe.example.com');});
afterEach(()=>vi.unstubAllEnvs());
it('conserve Fine Bindery malgré la marque par défaut du déclencheur SQL, avec un lien récupérable sans doublon',async()=>{
  const sb=fixture();const first=await createWorkshopInvoicePaymentLink(sb,'binder-fixture','invoice-fixture','FINE_BINDERY');
  expect(row?.fee_brand).toBe('FINE_BINDERY');
  const token=await openWorkshopPaymentToken(String(row?.sealed_token),'binder-fixture','payment-fixture');
  expect(first.url).toContain('/reglement-atelier/'+token);expect(hashAccessToken(token)).toBe(row?.token_hash);
  const second=await createWorkshopInvoicePaymentLink(sb,'binder-fixture','invoice-fixture','MA_RELIURE');
  expect(second).toEqual(first);expect(reservations).toBe(1);expect(row?.fee_brand).toBe('FINE_BINDERY');
});
it('ne reclasse pas une facture déjà payée quand son lien est retrouvé depuis une autre marque',async()=>{
  const sb=fixture();await createWorkshopInvoicePaymentLink(sb,'binder-fixture','invoice-fixture','FINE_BINDERY');
  row!.paid_at='2026-10-07T10:00:00Z';row!.status='paid';row!.checkout_session_id='cs_test_fixture';
  await createWorkshopInvoicePaymentLink(sb,'binder-fixture','invoice-fixture','MA_RELIURE');expect(row?.fee_brand).toBe('FINE_BINDERY');expect(reservations).toBe(1);
});
