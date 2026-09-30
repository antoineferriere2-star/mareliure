import { test } from 'node:test';import assert from 'node:assert/strict';import { mkdtempSync,writeFileSync,readFileSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
import { identifiers,fingerprintQuery,comparisonSQL,validateBaseline } from './execution-fingerprints.mjs';
import { executionSQL,connectedValidationSQL,pinnedEnvironment,runConnectedValidate } from './production-runner.mjs';
const baseline={history_count:91,history_hash:'a'.repeat(32),schema_hash:'b'.repeat(32),business_hash:'c'.repeat(32),business_tables:[{name:'marketplace_cases',rows:0,digest:'d'.repeat(32)}]};
test('Injected relation name and invalid fingerprints are refused before SQL generation',()=>{assert.throws(()=>identifiers(['marketplace_cases;DROP SCHEMA public CASCADE']),/Unsafe/);assert.throws(()=>validateBaseline({...baseline,history_hash:"';SELECT 1;--"}),/Invalid/);});
test('Live validation is forced read-only and obtains digests without row contents',()=>{const sql=connectedValidationSQL(baseline);assert.ok(sql.startsWith('BEGIN READ ONLY;'));assert.ok(sql.endsWith('ROLLBACK;'));assert.ok(sql.includes('pg_backend_pid()'));assert.ok(sql.includes('business_hash'));assert.equal(/CREATE|ALTER|INSERT|UPDATE|DELETE/.test(sql),false);});
test('Transaction checks drift after locking, then writes history and guards before COMMIT',()=>{const sql=executionSQL({baseline,repo:new URL('../..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});const lock=sql.indexOf('LOCK TABLE'),check=sql.indexOf('schema_drift'),mutation=sql.indexOf('CREATE TABLE public.marketplace_case_payment_circuits'),commit=sql.indexOf('\nCOMMIT;');assert.ok(lock<check&&check<mutation&&mutation<commit);assert.ok(sql.includes('business_conservation_failed'));assert.ok(sql.includes('history_conservation_failed'));assert.equal((sql.match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,3);assert.equal((sql.match(/CREATE TRIGGER publication_maintenance_v2/g)||[]).length,5);assert.ok(sql.indexOf("SELECT 'publication_commit_confirmed'")>commit);assert.ok(sql.includes('TLS_required'));});
test('Remote Execute cannot call the connected entry point',()=>assert.throws(()=>runConnectedValidate({mode:'Execute'}),/DISABLED/));
test('TLS CA and target cannot be substituted',()=>{assert.throws(()=>pinnedEnvironment({connection:{project:'qwfhebtxeubfmvvdsqdt'}}),/mismatch/);const d=mkdtempSync(join(tmpdir(),'publication-ca-'));try{const f=join(d,'synthetic-ca');writeFileSync(f,'not a trusted CA');assert.throws(()=>pinnedEnvironment({connection:{project:'hljxohondjvrkzqicexl',host:'aws-1-eu-west-1.pooler.supabase.com',port:5432,user:'postgres.hljxohondjvrkzqicexl',database:'postgres',sslmode:'verify-full'},caFile:f,caSha256:'0000'}),/changed/);}finally{rmSync(d,{recursive:true,force:true});}});
import { runHostedExecute,productionExecuteEnabled } from './production-runner.mjs';
test('Dormant execution refuses before any file or connection, even when called directly',()=>{assert.equal(productionExecuteEnabled,false);assert.throws(()=>runHostedExecute({}),/REMOTE EXECUTE DISABLED/);});
import { validateFreshComparison } from './production-runner.mjs';
import { target,hash } from './publication-contract.mjs';
test('A restore comparison is bound to the actual fresh archive and source/restored fingerprints',()=>{
 const d=mkdtempSync(join(tmpdir(),'publication-restore-'));
 try {
  const evidence={};
  for(const key of ['databaseArchive','storageManifest','schemaComparison','historyComparison','maintenanceEvidence']){const path=join(d,key);writeFileSync(path,'synthetic '+key);evidence[key]={path,sha256:hash('synthetic '+key)};}
  const completedAt=new Date().toISOString();const path=join(d,'restoreComparison');
  const comparison={target,completedAt,snapshotAt:completedAt,archiveSha256:evidence.databaseArchive.sha256,storageManifestSha256:evidence.storageManifest.sha256,equal:true,sourceFingerprint:baseline,restoredFingerprint:baseline};
  const receipt={target,completedAt,historyCount:91,restoredTableCount:96,maintenanceVerified:true,directWritersStopped:true,authStorageDriftChecked:true,restoreCompared:true,storageObjectsCompared:true,evidence};
  function save(value){writeFileSync(path,JSON.stringify(value));evidence.restoreComparison={path,sha256:hash(readFileSync(path))};}
  save(comparison);assert.equal(validateFreshComparison(receipt).business_hash,baseline.business_hash);
  save({...comparison,archiveSha256:'0'.repeat(64)});assert.throws(()=>validateFreshComparison(receipt),/does not bind/);
  save({...comparison,restoredFingerprint:{...baseline,business_hash:'f'.repeat(32)}});assert.throws(()=>validateFreshComparison(receipt),/differs/);
  save({...comparison,snapshotAt:'2020-01-01'});assert.throws(()=>validateFreshComparison(receipt),/freshness/);
 }finally{rmSync(d,{recursive:true,force:true});}
});
