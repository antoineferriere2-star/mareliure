const h=require('D:/CodexProjects/qa-reconciliation-qwf/hosted-recipe.cjs'),fs=require('node:fs'),crypto=require('node:crypto');
const root=__dirname,output='D:/CodexProjects/mareliure-publication-51-52/.output/server';
const secret=JSON.parse(fs.readFileSync(root+'/qa-worker-secrets.json'));
const base='https://mareliure-ops-qa-20260930-paid.aferriere.workers.dev';
(async()=>{
 if(h.c.projectRef!=='qwfhebtxeubfmvvdsqdt')throw Error('Wrong test target');
 if(fs.existsSync(root+'/qa-paid-fixtures.json'))throw Error('Fixture manifest exists; inspect before rerun');
 const health=await fetch(base+'/qa-health',{headers:{'x-qa-access':secret.QA_ACCESS_TOKEN}});if(!health.ok)throw Error('QA health failed '+health.status);
 const ser=await import('file:///D:/CodexProjects/mareliure-workspace-i18n/node_modules/seroval/dist/esm/production/index.mjs');
 const manifest=fs.readFileSync(output+'/'+fs.readdirSync(output).find(f=>f.includes('server-fn-resolver')),'utf8');
 const fn=manifest.match(/"([0-9a-f]+)": \{\s*functionName: "uploadLogisticsPhoto_createServerFn_handler"/)[1];
 const [a,b]=h.state.actors;for(const actor of [a,b]){const s=await h.requireOk('/auth/v1/token?grant_type=password',{method:'POST',body:{email:actor.email,password:actor.password},key:h.c.publishableKey});actor.token=s.access_token;}h.save();
 const work=await h.insert('marketplace_binder_works',{binder_id:a.binderId,contact_id:a.clientId,reference:'QA-OPS-'+crypto.randomUUID().slice(0,8),title:'QA temporaire CPU 20260930'});
 const event=crypto.randomUUID(),fixtures={target:h.c.projectRef,workId:work.id,eventId:event,binderId:a.binderId,createdAt:new Date().toISOString()};fs.writeFileSync(root+'/qa-paid-fixtures.json',JSON.stringify(fixtures,null,2));
 await h.requireOk('/rest/v1/rpc/marketplace_work_logistics',{method:'POST',body:{p_work:work.id,p_binder:a.binderId,p_actor:a.userId,p_action:'append',p_data:{id:event,version:0,kind:'incident',details:{description:'QA temporaire CPU, aucune opération réelle'}}}});
 const results=[];
 async function call(name,bytes,actor=a){const payload=JSON.stringify(await ser.toJSONAsync({data:{workId:work.id,eventId:event,base64:bytes.toString('base64')}}));const started=new Date().toISOString();let result;
 try{const r=await fetch(base+'/_serverFn/'+fn,{method:'POST',headers:{'x-qa-access':secret.QA_ACCESS_TOKEN,'Content-Type':'application/json','x-tsr-serverFn':'true',...(actor?{Authorization:'Bearer '+actor.token}:{})},body:payload,signal:AbortSignal.timeout(90000)});const body=await r.text();fs.writeFileSync(root+'/paid-response-'+name+'.private',body);result={name,bytes:bytes.length,started,ended:new Date().toISOString(),status:r.status,applicationError:body.includes('$TSR/Error'),resourceLimit:body.includes('1102'),ray:r.headers.get('cf-ray')};}catch{result={name,started,ended:new Date().toISOString(),transportError:true}}
 await new Promise(r=>setTimeout(r,4000)); results.push(result);fs.writeFileSync(root+'/qa-paid-requests.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result));}
 const four=fs.readFileSync(h.root+'/audit-photo-4MiB.png'),five=fs.readFileSync(h.root+'/audit-photo-5MiB.png');
 await call('upload-4MiB',four);await call('upload-5MiB',five);await call('retry-5MiB',five);await call('other-workshop',five,b);await call('anonymous',four,null);await call('oversize',Buffer.concat([five,Buffer.from([0])]));
 const photos=await h.requireOk('/rest/v1/marketplace_work_logistics_photos?event_id=eq.'+event);
 const objects=await h.requireOk('/storage/v1/object/list/work-logistics-private',{method:'POST',body:{prefix:a.binderId+'/'+work.id+'/'+event,limit:100}});
 const stored=[];for(const p of photos){const path=a.binderId+'/'+work.id+'/'+event+'/'+p.id;const signed=await h.requireOk('/storage/v1/object/sign/work-logistics-private/'+path,{method:'POST',body:{expiresIn:60}});const r=await fetch(h.c.url+'/storage/v1'+signed.signedURL);const bytes=Buffer.from(await r.arrayBuffer());stored.push({id:p.id,bytes:bytes.length,identical:bytes.equals(four)||bytes.equals(five)});}
 fs.writeFileSync(root+'/qa-paid-storage-results.json',JSON.stringify({sqlCount:photos.length,storageCount:objects.length,stored},null,2));console.log('SQL associations '+photos.length+'; Storage objects '+objects.length);
})().catch(e=>{console.error(e.message.replace(/eyJ[^\s]+/g,'[redacted]'));process.exitCode=1});
