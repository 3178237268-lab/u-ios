
$ErrorActionPreference='Stop'
$U='D:\deepseek\gouzuoqu\U'
$B=Join-Path $U '11111'
if(!(Test-Path (Join-Path $U 'dist'))){New-Item -ItemType Directory -Path (Join-Path $U 'dist') | Out-Null}
Copy-Item -Force (Join-Path $U 'android-u\U.apk') (Join-Path $U 'dist\U-1.75.apk')
$stage=Join-Path $U '.tmp-build\pkg-1.75'
if(Test-Path $stage){Remove-Item -Recurse -Force $stage}
New-Item -ItemType Directory -Path $stage | Out-Null
$items=@('public\admin.html','src\db.js','src\server.js','index.html','package.json','run-all.js','serve-app.js')
foreach($it in $items){$src=Join-Path $B $it; $dst=Join-Path $stage $it; New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null; Copy-Item -Force $src $dst}
Get-ChildItem $B -Filter '*.cmd' | ForEach-Object { Copy-Item -Force $_.FullName (Join-Path $stage $_.Name) }
Get-ChildItem $B -Filter '*.md' | Where-Object { $_.Name -match '^[^\x00-\x7F]{4}\.md$' } | ForEach-Object { Copy-Item -Force $_.FullName (Join-Path $stage $_.Name) }
$zip=Join-Path $U 'dist\U-server-1.75.zip'
if(Test-Path $zip){Remove-Item -Force $zip}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Get-ChildItem $stage -Recurse -File | ForEach-Object { $_.FullName.Substring($stage.Length+1) }
Remove-Item -Recurse -Force $stage
Get-ChildItem (Join-Path $U 'dist') | Select-Object Name,Length | Format-Table -AutoSize
