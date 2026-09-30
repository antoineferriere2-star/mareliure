param([ValidateSet('Validate','ValidateConnected','Execute')][string]$Mode='Validate',[string]$Configuration)
$ErrorActionPreference='Stop'
# Execute is unconditionally refused before reading any configuration or password.
if($Mode -eq 'Execute'){throw 'REMOTE MUTATION DISABLED: publication decision required'}
if(!$Configuration){throw 'A fresh protected evidence configuration is required'}
$root=Split-Path -Parent (Resolve-Path $Configuration)
if(!(Get-Acl $root).AreAccessRulesProtected){throw 'Evidence directory must have protected ACLs'}
$config=Get-Content -LiteralPath $Configuration -Raw|ConvertFrom-Json
foreach($path in @($Configuration,$config.passwordFile,$config.caFile)){
 if(!$path){continue}
 $item=Get-Item -LiteralPath $path
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse point refused'}
 if($path -cne $config.caFile -and !(Get-Acl $path).AreAccessRulesProtected){throw 'Sensitive file must have protected ACLs'}
}
& node (Join-Path $PSScriptRoot 'production-runner-cli.mjs') $Configuration $Mode
if($LASTEXITCODE){throw 'Preparation/validation stopped; no hosted migration executed'}
