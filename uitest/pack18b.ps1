$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$B = 'D:\deepseek\gouzuoqu\U\11111'
$out = 'D:\deepseek\gouzuoqu\U\dist\U-server-1.8.zip'
if (Test-Path $out) { Remove-Item $out -Force }
$items = @()
foreach ($f in @('index.html','package.json','run-all.js','serve-app.js')) { $p = Join-Path $B $f; if (Test-Path $p) { $items += $p } }
Get-ChildItem $B -Filter '*.md' | ForEach-Object { $items += $_.FullName }
Get-ChildItem $B -Filter '*.cmd' | ForEach-Object { $items += $_.FullName }
foreach ($d in @('src','public','vendor')) { $p = Join-Path $B $d; if (Test-Path $p) { $items += $p } }
Compress-Archive -Path $items -DestinationPath $out -CompressionLevel Optimal
$zip = [System.IO.Compression.ZipFile]::OpenRead($out)
Write-Output ('ZIP ' + (Get-Item $out).Length)
$zip.Entries | ForEach-Object { Write-Output ('{0}|{1}' -f $_.FullName, $_.Length) }
$zip.Dispose()
