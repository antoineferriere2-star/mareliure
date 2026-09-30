param([ValidateSet('Validate','Execute')][string]$Mode='Validate',[string]$Configuration)
$ErrorActionPreference='Stop'
# No hosted mutation code exists in this launcher. Cannot be unlocked through arguments.
if($Mode -eq 'Execute'){throw 'REMOTE MUTATION DISABLED: publication gates and new review required'}
if(!$Configuration){throw 'A fresh protected evidence configuration is required'}
if(!(Get-Acl (Split-Path -Parent (Resolve-Path $Configuration))).AreAccessRulesProtected){throw 'Evidence directory must have protected ACLs'}
& node (Join-Path $PSScriptRoot 'prepare-production-execution.mjs') $Configuration
if($LASTEXITCODE){throw 'Preparation failed; no connection or migration executed'}
