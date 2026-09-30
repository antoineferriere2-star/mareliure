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

 if(pathname.startsWith('/qa-cpu/')){
  const stage=pathname.slice(8); if(request.method!=='POST'||!['parse','decode','canonical','hash'].includes(stage))return new Response('Bad probe',{status:400});
  const data=await request.json(); const b64=data.base64; if(typeof b64!=='string'||b64.length>6990508)return new Response('Bad input',{status:400});
  if(stage==='parse')return Response.json({stage,length:b64.length});
  const bytes=Buffer.from(b64,'base64');
  if(stage==='decode')return Response.json({stage,bytes:bytes.length});
  if(bytes.toString('base64')!==b64)return new Response('Bad input',{status:400});
  if(stage==='canonical')return Response.json({stage,bytes:bytes.length});
  const prefix=new TextEncoder().encode('logistics-photo-v1:QA-PROBE:');const input=new Uint8Array(prefix.length+bytes.length);input.set(prefix);input.set(bytes,prefix.length);await crypto.subtle.digest('SHA-256',input);
  return Response.json({stage,bytes:bytes.length});
 }
 const headers=new Headers(request.headers);headers.delete('x-qa-access');headers.delete('x-publication-operator');
 return app.fetch(new Request(request,{headers}),env,ctx);
}};