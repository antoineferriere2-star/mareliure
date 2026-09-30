import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
test('CPU package retains all reviewed product bytes; only Wrangler configuration changes',()=>{
 const old=read('artifact-manifest.json'),next=read('artifact-cpu1000-manifest.json');
 assert.equal(next.target,'hljxohondjvrkzqicexl');assert.equal(next.worker,'mareliure');assert.equal(next.deployed,false);assert.equal(next.cpu_ms,1000);assert.equal(next.source,old.source);
 assert.equal(next.files.length,830);assert.equal(next.files.length,old.files.length);
 const changes=[];
 for(const f of old.files){const n=next.files.find(x=>x.path===f.path);assert.ok(n);if(n.sha256!==f.sha256){changes.push(f.path);}else assert.equal(n.bytes,f.bytes);}
 assert.deepEqual(changes,['server/wrangler.json']);
 assert.equal(createHash('sha256').update(readFileSync(new URL('artifact-cpu1000-manifest.json',import.meta.url))).digest('hex').toUpperCase(),'CFFAE4DA529D215309BF133BBAEB144B735A67C7D233AD886776296361EE3FF5');
});
