import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const target = Object.freeze({project:'hljxohondjvrkzqicexl',host:'aws-1-eu-west-1.pooler.supabase.com',port:5432,user:'postgres.hljxohondjvrkzqicexl',database:'postgres',sslmode:'verify-full'});
export const migrations = Object.freeze({
 '20260928090000_marketplace_payment_circuits.sql':'B5259DBA1A453D02B8183F22F57D79576AE5DD7D964EBA36F1BFFBC48224DEF6',
 '20260928110000_own_client_external_settlement.sql':'D367A183CD61B7DD7158A4B013BD845E686438FF31ED674B4451A4C9F3A2C63E',
 '20260928130000_work_logistics_manual.sql':'1129357F312E12572B7C36E4C97F8E9C97A48D9FB0E7731BF10AD0D3C565CC0C',
});
export function assertTarget(value) { for(const [key,expected] of Object.entries(target)) if(value?.[key]!==expected) throw Error('Target/TLS mismatch: '+key); }
export function assertReceipt(receipt, now=Date.now()) {
 assertTarget(receipt.target);
 const age=now-Date.parse(receipt.completedAt);
 if(!Number.isFinite(age)||age<0||age>30*60*1000)throw Error('Fresh backup required (maximum 30 minutes)');
 if(receipt.historyCount!==91||receipt.restoredTableCount!==96)throw Error('Baseline drift');
 for(const key of ['maintenanceVerified','directWritersStopped','authStorageDriftChecked','restoreCompared','storageObjectsCompared']) if(receipt[key]!==true)throw Error('Missing gate: '+key);
 for(const key of ['databaseArchive','storageManifest','restoreComparison','schemaComparison','historyComparison','maintenanceEvidence']) {
  const e=receipt.evidence?.[key];
  if(!e?.path||!e.sha256||!existsSync(e.path))throw Error('Missing evidence: '+key);
  if(hash(readFileSync(e.path))!==e.sha256)throw Error('Evidence changed: '+key);
 }
}
export function hash(bytes){return createHash('sha256').update(bytes).digest('hex').toUpperCase();}
export function outcome(exitCode,output){return exitCode===0&&output.includes('publication_commit_confirmed')?'commit-confirmed-postchecks-required':'STOP-inspect-readonly-no-retry';}
export function prepare({mode='Validate',receipt,repo,out,attemptFile}) {
 // Deliberately unconditional: no environment variable or argument enables hosted writes.
 if(mode!=='Validate')throw Error('REMOTE MUTATION DISABLED: new review and authorization required');
 if(existsSync(attemptFile))throw Error('Prior attempt: inspect read-only; no automatic replay');
 assertReceipt(receipt);
 const bodies=Object.entries(migrations).map(([name,digest])=>{const body=readFileSync(resolve(repo,'supabase/migrations',name));if(hash(body)!==digest)throw Error('Migration hash mismatch: '+name);return [name,body.toString('utf8')];});
 let sql=`\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='120s';\nDO $$ BEGIN\nIF current_database()<>'postgres' OR session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'wrong_identity'; END IF;\nIF NOT EXISTS(SELECT 1 FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl) THEN RAISE EXCEPTION 'TLS_required'; END IF;\nIF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>91 THEN RAISE EXCEPTION 'history_drift'; END IF;\nIF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20260928090000','20260928110000','20260928130000')) THEN RAISE EXCEPTION 'already_applied'; END IF;\nEND $$;\nLOCK TABLE public.marketplace_cases,public.marketplace_events,public.marketplace_commercial_proposals,public.marketplace_binder_quotes,public.marketplace_binder_invoices,supabase_migrations.schema_migrations IN ACCESS EXCLUSIVE MODE;\n`;
 for(const [name,body] of bodies){if(body.includes('$publication_body$'))throw Error('SQL delimiter collision');sql+=`\n${body}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('${name.slice(0,14)}','${name.slice(15,-4)}',ARRAY[$publication_body$${body}$publication_body$]);\n`;}
 sql+="COMMIT;\nSELECT 'publication_commit_confirmed';\n";
 writeFileSync(out,sql,{flag:'wx'});
 return {state:'prepared-not-executed',sqlSha256:hash(sql),target,migrations};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try { const config=JSON.parse(readFileSync(process.argv[2],'utf8'));const result=prepare(config);console.log(JSON.stringify(result,null,2)); }
 catch(e){console.error(e.message);process.exitCode=1;}
}
