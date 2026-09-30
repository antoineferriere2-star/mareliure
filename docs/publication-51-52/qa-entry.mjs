import app from './index.mjs';
import { timingSafeEqual } from 'node:crypto';
import { maintenanceDecision } from './maintenance-gate.mjs';
export default { async fetch(request, env, ctx) {
 if(env.SUPABASE_URL !== 'https://qwfhebtxeubfmvvdsqdt.supabase.co') return new Response('Invalid QA target',{status:503});
 const a=Buffer.from(request.headers.get('x-qa-access')||''), b=Buffer.from(env.QA_ACCESS_TOKEN||'');
 if(b.length<32||a.length!==b.length||!timingSafeEqual(a,b)) return new Response('Private QA',{status:403});
 const decision=maintenanceDecision(request,{enabled:env.QA_MAINTENANCE==='on',operatorToken:env.QA_OPERATOR_TOKEN,readPaths:['/qa-health']});
 if(decision)return decision;
 const pathname=new URL(request.url).pathname;
 if(pathname==='/qa-health')return Response.json({target:'qwfhebtxeubfmvvdsqdt',maintenance:env.QA_MAINTENANCE==='on'});
 const headers=new Headers(request.headers);headers.delete('x-qa-access');headers.delete('x-publication-operator');
 return app.fetch(new Request(request,{headers}),env,ctx);
}};