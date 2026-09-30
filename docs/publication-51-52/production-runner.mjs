import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertTarget, assertReceipt, migrations, target, hash, outcome } from './publication-contract.mjs';
import { fingerprintQuery, validateBaseline, comparisonSQL, identifiers } from './execution-fingerprints.mjs';
export function migrationBodies(repo) {
 return Object.entries(migrations).map(([name,digest])=>{const bytes=readFileSync(resolve(repo,'supabase/migrations',name));if(hash(bytes)!==digest)throw Error('Migration hash mismatch');const body=bytes.toString('utf8');if(body.includes('$publication_body$'))throw Error('Delimiter collision');return {name,body};});
}
export function executionSQL({baseline,repo,local=false}) {
 validateBaseline(baseline);
 const tables=identifiers(baseline.business_tables.map(t=>t.name));
 const fingerprint=fingerprintQuery(tables);
 const bodies=migrationBodies(repo);
 const identity=local?"current_database()<>'publication_runner_v3_20260930'":"current_database()<>'postgres'";
 const tls=local?'':"IF NOT EXISTS(SELECT 1 FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl AND version IN ('TLSv1.2','TLSv1.3')) THEN RAISE EXCEPTION 'TLS_required'; END IF;";
 let sql=`\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF ${identity} OR session_user<>'postgres' OR current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'wrong_identity'; END IF;
 ${tls}
 IF to_regprocedure('publication_guard_v2.reject_mutation()') IS NULL THEN RAISE EXCEPTION 'maintenance_missing'; END IF;
END $$;
LOCK TABLE ${tables.map(n=>'public.'+n).join(',')},supabase_migrations.schema_migrations IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgname='publication_maintenance_v2' AND tgenabled='O' AND tgfoid='publication_guard_v2.reject_mutation()'::regprocedure AND tgrelid IN (${tables.map(n=>"'public."+n+"'::regclass").join(',')}))<>${tables.length} THEN RAISE EXCEPTION 'maintenance_coverage_drift'; END IF;
END $$;
CREATE TEMP TABLE publication_live_fingerprint ON COMMIT DROP AS SELECT fingerprint AS data FROM (${fingerprint}) f;
${comparisonSQL(baseline)}
CREATE TEMP TABLE publication_old_history ON COMMIT DROP AS TABLE supabase_migrations.schema_migrations;
SELECT jsonb_build_object('stage','execution-connection-preflight','backend',pg_backend_pid(),'managed',(SELECT data->'managed' FROM publication_live_fingerprint));
`;
 for(const {name,body} of bodies){sql+=`\n${body}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('${name.slice(0,14)}','${name.slice(15,-4)}',ARRAY[$publication_body$${body}$publication_body$]);\n`;}
 for(const name of ['marketplace_case_payment_circuits','marketplace_own_client_agreements','marketplace_external_settlements','marketplace_work_logistics_events','marketplace_work_logistics_photos'])sql+=`CREATE TRIGGER publication_maintenance_v2 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.${name} FOR EACH STATEMENT EXECUTE FUNCTION publication_guard_v2.reject_mutation();\n`;
 sql+=`CREATE TEMP TABLE publication_post_fingerprint ON COMMIT DROP AS SELECT fingerprint AS data FROM (${fingerprint}) f;
DO $$ BEGIN
 IF (SELECT data->>'business_hash' FROM publication_post_fingerprint)<>'${baseline.business_hash}' THEN RAISE EXCEPTION 'business_conservation_failed'; END IF;
 IF (SELECT data#>>'{managed,existing_buckets_hash}' FROM publication_post_fingerprint) IS DISTINCT FROM (SELECT data#>>'{managed,existing_buckets_hash}' FROM publication_live_fingerprint) THEN RAISE EXCEPTION 'existing_bucket_metadata_changed'; END IF;
 IF EXISTS((SELECT * FROM publication_old_history) EXCEPT (SELECT * FROM supabase_migrations.schema_migrations)) OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>94 THEN RAISE EXCEPTION 'history_conservation_failed'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE oid IN ('public.marketplace_case_payment_circuits'::regclass,'public.marketplace_own_client_agreements'::regclass,'public.marketplace_external_settlements'::regclass,'public.marketplace_work_logistics_events'::regclass,'public.marketplace_work_logistics_photos'::regclass) AND relrowsecurity)<>5 THEN RAISE EXCEPTION 'new_rls_missing'; END IF;
END $$;
SELECT jsonb_build_object('stage','precommit-preservation','backend',pg_backend_pid(),'history',94,'business_preserved',true,'managed_before',(SELECT data->'managed' FROM publication_live_fingerprint),'managed_before_commit',(SELECT data->'managed' FROM publication_post_fingerprint));
COMMIT;
SELECT 'publication_commit_confirmed';
${fingerprint};
`;
 return sql;
}
export function connectedValidationSQL(baseline) {
 validateBaseline(baseline);
 const query=fingerprintQuery(baseline.business_tables.map(t=>t.name));
 // Transaction protection comes from the launcher, never an input SQL file.
 return `BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s'; SELECT jsonb_build_object('stage','validation-identity','backend',pg_backend_pid(),'role',current_user,'session',session_user,'read_only',current_setting('transaction_read_only'),'database',current_database(),'tls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),'tls_version',(SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid())); ${query}; ROLLBACK;`;
}
export function validateFreshComparison(receipt) {
 assertReceipt(receipt);
 const comparison=JSON.parse(readFileSync(receipt.evidence.restoreComparison.path,'utf8'));
 if(comparison.completedAt!==receipt.completedAt||!Number.isFinite(Date.parse(comparison.snapshotAt))||Date.now()-Date.parse(comparison.snapshotAt)>30*60*1000||Date.parse(comparison.snapshotAt)>Date.parse(comparison.completedAt))throw Error('Snapshot/restoration freshness not bound to receipt');
 if(comparison.target?.project!==target.project||comparison.archiveSha256!==receipt.evidence.databaseArchive.sha256||comparison.storageManifestSha256!==receipt.evidence.storageManifest.sha256||comparison.equal!==true)throw Error('Restore receipt does not bind archive/Storage comparison');
 validateBaseline(comparison.sourceFingerprint);validateBaseline(comparison.restoredFingerprint);
 for(const key of ['history_hash','schema_hash','business_hash'])if(comparison.sourceFingerprint[key]!==comparison.restoredFingerprint[key])throw Error('Restored fingerprint differs');
 return comparison.sourceFingerprint;
}
export function pinnedEnvironment({connection,caFile,caSha256,passwordFile}) {
 assertTarget(connection);
 if(caSha256!=='251D085FAFA4D42E394E932118F55A337DCF53DC8347CB34D79895BC530C83F0'||hash(readFileSync(caFile))!==caSha256)throw Error('CA trust bundle changed');
 const password=readFileSync(passwordFile,'utf8').trim();if(!password||/[\r\n\0]/.test(password))throw Error('Invalid protected password file');
 const env={...process.env};for(const n of Object.keys(env))if(/^PG/i.test(n))delete env[n];
 return {...env,PGHOST:target.host,PGPORT:String(target.port),PGUSER:target.user,PGDATABASE:target.database,PGSSLMODE:target.sslmode,PGSSLROOTCERT:resolve(caFile),PGPASSWORD:password,PGCONNECT_TIMEOUT:'15',PGOPTIONS:'-c default_transaction_read_only=on'};
}
export function runConnectedValidate(config) {
 if(config.mode!=='ValidateConnected')throw Error('REMOTE EXECUTE DISABLED');
 if(hash(readFileSync(config.psql))!=='AA12E27530AC07F129E69DACA953EA5F02202A7BDE45D503E771ABC39016536D')throw Error('Reviewed psql binary changed');
 const baseline=validateFreshComparison(config.receipt);
 if(existsSync(config.attemptFile))throw Error('Prior attempt; inspect only, no replay');
 const sql=connectedValidationSQL(baseline);
 const env=pinnedEnvironment(config);
 const r=spawnSync(config.psql,['-X','-w','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,env,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
 // Raw stderr stays protected; only a classification is printed.
 writeFileSync(config.evidenceOutput,JSON.stringify({exit:r.status,stdout:r.stdout,stderr:r.stderr}),{flag:'wx'});
 if(r.status!==0)throw Error('Connected validation failed; inspect protected evidence');
 const lines=r.stdout.trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
 if(lines[0].read_only!=='on'||lines[0].session!=='postgres'||lines[0].role!=='postgres'||lines[0].tls!==true||lines[0].database!=='postgres'||!['TLSv1.2','TLSv1.3'].includes(lines[0].tls_version))throw Error('Connected identity/TLS failed');
 const actual=lines[1];for(const key of ['history_hash','schema_hash','business_hash'])if(actual[key]!==baseline[key])throw Error('Connected drift: '+key);
 writeFileSync(config.out,executionSQL({baseline,repo:config.repo}),{flag:'wx'});
 return {state:'connected-readonly-validation-passed',sqlSha256:hash(readFileSync(config.out)),managedDriftObserved:JSON.stringify(actual.managed)!==JSON.stringify(baseline.managed),remoteExecuteEnabled:false};
}
export function executeLocalOnce({docker,containerId,sqlFile,attemptFile,logFile}) {
 if(!/^[a-f0-9]{64}$/.test(containerId))throw Error('Pinned local container ID required');
 if(existsSync(attemptFile))throw Error('Prior local attempt; no replay');
 const info=spawnSync(docker,['--context','desktop-linux','inspect',containerId],{encoding:'utf8'});if(info.status)throw Error('Local container unavailable');
 const c=JSON.parse(info.stdout)[0];const networks=Object.keys(c.NetworkSettings.Networks);if(networks.length!==1||networks[0]!=='qwf-reconciliation-isolated'||Object.keys(c.HostConfig.PortBindings||{}).length)throw Error('Local isolation failed');
 const network=spawnSync(docker,['--context','desktop-linux','network','inspect',networks[0]],{encoding:'utf8'});if(network.status||!JSON.parse(network.stdout)[0].Internal)throw Error('Local network is not internal');
 const sql=readFileSync(sqlFile,'utf8');writeFileSync(attemptFile,JSON.stringify({state:'attempt-started',containerId,sqlSha256:hash(sql)}),{flag:'wx'});
 const r=spawnSync(docker,['--context','desktop-linux','exec','-i',containerId,'psql','-X','-v','ON_ERROR_STOP=1','-qAt','-U','postgres','-d','publication_runner_v3_20260930'],{input:sql,encoding:'utf8',timeout:150000,maxBuffer:4*1024*1024});
 writeFileSync(logFile,JSON.stringify({exit:r.status,stdout:r.stdout,stderr:r.stderr}),{flag:'wx'});
 const state=outcome(r.status,r.stdout||'');writeFileSync(attemptFile,JSON.stringify({state,exit:r.status,containerId,sqlSha256:hash(sql)}));
 if(state!=='commit-confirmed-postchecks-required')throw Error('Error or COMMIT uncertain; STOP read-only, no replay');
 return {state};
}

// Reviewed dormant production path. The flag cannot be changed by a configuration,
// environment variable, CLI argument or approval-text file.
export const productionExecuteEnabled = false;
export function runHostedExecute(config) {
 if(!productionExecuteEnabled)throw Error('REMOTE EXECUTE DISABLED: explicit publication authorization required');
 // This path is intentionally unreachable in the reviewed preparation version.
 assertTarget(config.connection);
 if(hash(readFileSync(config.psql))!=='AA12E27530AC07F129E69DACA953EA5F02202A7BDE45D503E771ABC39016536D')throw Error('Reviewed psql binary changed');
 const baseline=validateFreshComparison(config.receipt);
 if(existsSync(config.attemptFile)||existsSync(config.evidenceOutput))throw Error('Prior attempt/evidence: read-only inspection, no replay');
 const sql=executionSQL({baseline,repo:config.repo});
 const env=pinnedEnvironment(config);
 env.PGOPTIONS='-c default_transaction_read_only=off';
 writeFileSync(config.attemptFile,JSON.stringify({state:'attempt-started',target,sqlSha256:hash(sql),startedAt:new Date().toISOString()}),{flag:'wx'});
 const r=spawnSync(config.psql,['-X','-w','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,env,encoding:'utf8',timeout:150000,maxBuffer:4*1024*1024});
 writeFileSync(config.evidenceOutput,JSON.stringify({exit:r.status,stdout:r.stdout,stderr:r.stderr}),{flag:'wx'});
 const state=outcome(r.status,r.stdout||'');
 writeFileSync(config.attemptFile,JSON.stringify({state,target,sqlSha256:hash(sql),exit:r.status,endedAt:new Date().toISOString()}));
 if(state!=='commit-confirmed-postchecks-required')throw Error('Error or uncertain COMMIT: STOP, read-only inspection; no replay');
 const lines=r.stdout.trim().split(/\r?\n/);const actual=JSON.parse(lines.at(-1));
 if(actual.history_count!==94||actual.business_hash!==baseline.business_hash||actual.managed.existing_buckets_hash!==baseline.managed.existing_buckets_hash)throw Error('Committed, postcheck failed: STOP; preserve state; no replay/restore');
 const result={state:'committed-postchecks-passed',sqlSha256:hash(sql),target,managedBefore:baseline.managed,managedAfter:actual.managed,managedDriftObserved:JSON.stringify(actual.managed)!==JSON.stringify(baseline.managed)};
 if(result.managedDriftObserved)result.state='committed-managed-drift-STOP-review';
 writeFileSync(config.attemptFile,JSON.stringify(result));
 if(result.managedDriftObserved)throw Error('Committed, managed Auth/Storage drift: STOP for review; preserve service data; no replay/restore');
 return result;
}
