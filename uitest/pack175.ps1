
$ErrorActionPreference='Stop'
$U='D:\deepseek\gouzuoqu\U'
Copy-Item -Force (Join-Path $U 'android-u\U.apk') (Join-Path $U 'dist\U-1.75.apk')
$items=@('public\admin.html','src\db.js','src\server.js','index.html','package.json','run-all.js','serve-app.js','修改记录.md','停止U.cmd','启动U.cmd')
$stage=Join-Path $U '.tmp-build\pkg-1.75'
if(Test-Path $stage){Remove-Item -Recurse -Force $stage}
New-Item -ItemType Directory -Path $stage | Out-Null
foreach($it in $items){$src=Join-Path $U ('11111\'+$it); $dst=Join-Path $stage $it; New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null; Copy-Item -Force $src $dst}
$zip=Join-Path $U 'dist\U-server-1.75.zip'
if(Test-Path $zip){Remove-Item -Force $zip}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage
Get-ChildItem (Join-Path $U 'dist') | Select-Object Name,Length | Format-Table -AutoSize
