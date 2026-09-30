param([Parameter(Mandatory)][string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
# LOCAL ONLY. This rehearsal cannot connect to a hosted project.
$container='supabase_db_qwf-archive-isolated'
$database='production_ops_20260930'
$docker='C:/Users/antoi/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
$repo=Resolve-Path (Join-Path $PSScriptRoot '../..')
$expected=[ordered]@{
 '20260928090000_marketplace_payment_circuits.sql'='B5259DBA1A453D02B8183F22F57D79576AE5DD7D964EBA36F1BFFBC48224DEF6'
 '20260928110000_own_client_external_settlement.sql'='D367A183CD61B7DD7158A4B013BD845E686438FF31ED674B4451A4C9F3A2C63E'
 '20260928130000_work_logistics_manual.sql'='1129357F312E12572B7C36E4C97F8E9C97A48D9FB0E7731BF10AD0D3C565CC0C'
}
function D { $value=& $docker @args; if($LASTEXITCODE){throw 'Local Docker operation failed'}; $value }
$info=D inspect $container | ConvertFrom-Json
$network=D network inspect qwf-reconciliation-isolated | ConvertFrom-Json
if(!$network.Internal -or $info.HostConfig.PortBindings.PSObject.Properties.Count -gt 0 -or @($info.NetworkSettings.Networks.PSObject.Properties.Name) -cne 'qwf-reconciliation-isolated'){throw 'Isolation failed'}
if(!(Get-Acl $EvidenceDirectory).AreAccessRulesProtected){throw 'Evidence directory is not protected'}
$attempt=Join-Path $EvidenceDirectory 'migration-attempt.json'
if(Test-Path $attempt){throw 'Attempt already recorded. Inspect state; no automatic replay.'}
$sql=@'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $$ BEGIN
 IF current_database()<>'production_ops_20260930' OR current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'wrong_local_identity'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>91 THEN RAISE EXCEPTION 'history_drift'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20260928090000','20260928110000','20260928130000')) THEN RAISE EXCEPTION 'already_applied'; END IF;
END $$;
LOCK TABLE public.marketplace_cases, public.marketplace_events, public.marketplace_commercial_proposals, public.marketplace_binder_quotes, public.marketplace_binder_invoices, supabase_migrations.schema_migrations IN ACCESS EXCLUSIVE MODE;
'@
foreach($file in $expected.Keys){
 $path=Join-Path $repo "supabase/migrations/$file"
 if((Get-FileHash $path -Algorithm SHA256).Hash -cne $expected[$file]){throw 'Migration hash mismatch'}
 $body=[IO.File]::ReadAllText($path)
 if($body.Contains('$publication_body$')){throw 'Unsafe SQL delimiter'}
 $version=$file.Substring(0,14);$name=$file.Substring(15).Replace('.sql','')
 $sql+="`n$body`nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('$version','$name',ARRAY[`$publication_body`$$body`$publication_body`$]);`n"
}
$sql+="`nCOMMIT;`nSELECT 'publication_commit_confirmed';`n"
$path=Join-Path $EvidenceDirectory 'local-migrations.sql'
[IO.File]::WriteAllText($path,$sql,[Text.UTF8Encoding]::new($false))
D cp $path "${container}:/tmp/publication-migrations.sql" | Out-Null
@{state='attempt-started';target=$container;database=$database;at=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content $attempt
$timer=[Diagnostics.Stopwatch]::StartNew()
& $docker exec $container psql -X -v ON_ERROR_STOP=1 -U postgres -d $database -f /tmp/publication-migrations.sql > (Join-Path $EvidenceDirectory 'migration-execution.log') 2>&1
$exit=$LASTEXITCODE
$confirmed=($exit -eq 0) -and ((Get-Content (Join-Path $EvidenceDirectory 'migration-execution.log') -Raw).Contains('publication_commit_confirmed'))
@{state=$(if($confirmed){'commit-confirmed-postchecks-required'}else{'STOP-inspect-readonly-no-retry'});exit=$exit;seconds=$timer.Elapsed.TotalSeconds} | ConvertTo-Json | Set-Content (Join-Path $EvidenceDirectory 'migration-result.json')
if(!$confirmed){throw 'Error or uncertain COMMIT. Read-only inspection required; no replay.'}
'Local COMMIT confirmed; preservation checks remain mandatory.'
