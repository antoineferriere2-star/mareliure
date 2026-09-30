param([Parameter(Mandatory)][string]$PrivateRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root=(Resolve-Path -LiteralPath $PrivateRoot).Path
if(!(Get-Acl -LiteralPath $root).AreAccessRulesProtected){throw 'Protected private directory required'}
$source=Join-Path $root 'worker-production-ea09dba.zip'
if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne '1E1C60528C09D21E4C82AFB443979AA76E35574F529B4ECF9C0AC585528C2994'){throw 'Reviewed source archive changed'}
$manifestPath=Join-Path $PSScriptRoot 'artifact-manifest.json'
if((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne '6C560B8F405801E2FF27A1C7FF03777A1D58E08C0A58020409BB332A819E126D'){throw 'Reviewed source manifest changed'}
$old=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
$dest=Join-Path $root 'production-cpu1000-package'
$zip=Join-Path $root 'worker-production-cpu1000.zip'
if((Test-Path -LiteralPath $dest) -or (Test-Path -LiteralPath $zip)){throw 'Output exists: inspect, no overwrite'}
$archive=[IO.Compression.ZipFile]::OpenRead($source)
try {
 foreach($entry in $archive.Entries){$name=$entry.FullName.Replace('\','/');$resolved=[IO.Path]::GetFullPath((Join-Path $dest $name));if(!$name.StartsWith('.output/') -or !$resolved.StartsWith($dest+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected archive path'}}
}finally{$archive.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory($source,$dest)
foreach($f in $old.files){$path=Join-Path (Join-Path $dest '.output') $f.path;if(!(Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $f.sha256.ToLowerInvariant()){throw 'Source file differs from reviewed manifest'}}
if(@(Get-ChildItem -LiteralPath $dest -File -Recurse).Count -ne $old.files.Count){throw 'Unexpected artifact files'}
$configPath=Join-Path $dest '.output/server/wrangler.json'
$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json
if($config.name -ne 'mareliure' -or $config.compatibility_date -ne '2026-09-25' -or $config.PSObject.Properties.Name -contains 'limits'){throw 'Unexpected source configuration'}
$config | Add-Member -NotePropertyName limits -NotePropertyValue @{cpu_ms=1000}
[IO.File]::WriteAllText($configPath,($config|ConvertTo-Json -Depth 30).Replace("`r`n","`n"),[Text.UTF8Encoding]::new($false))
$files=@(foreach($f in $old.files){$path=Join-Path (Join-Path $dest '.output') $f.path;@{path=$f.path;bytes=(Get-Item -LiteralPath $path).Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}})
$changed=@($files|Where-Object {$x=$_;($old.files|Where-Object path -eq $x.path).sha256 -ne $x.sha256})
if($changed.Count -ne 1 -or $changed[0].path -ne 'server/wrangler.json'){throw 'More than CPU configuration changed'}
[IO.Compression.ZipFile]::CreateFromDirectory($dest,$zip)
$new=@{source=$old.source;preparedAtSource='6781e9b3f5a89d0756d21978eb82b2f3bbc03e88';target=$old.target;worker=$old.worker;deployed=$false;cpu_ms=1000;privateRuntimeValueScan='unchanged verified source bytes; config only';files=$files}
$newPath=Join-Path $PSScriptRoot 'artifact-cpu1000-manifest.json'
if(Test-Path -LiteralPath $newPath){throw 'Manifest already exists'}
[IO.File]::WriteAllText($newPath,($new|ConvertTo-Json -Depth 8).Replace("`r`n","`n"),[Text.UTF8Encoding]::new($false))
@{result='prepared-not-deployed';changedFiles=@($changed.path);cpu_ms=1000;archiveSha256=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash;manifestSha256=(Get-FileHash -LiteralPath $newPath -Algorithm SHA256).Hash;files=$files.Count}|ConvertTo-Json
