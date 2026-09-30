import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
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
