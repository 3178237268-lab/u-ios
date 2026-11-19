# 无 Gradle 的 APK 打包脚本（Windows 版，等价于 build-apk.sh）
# aapt2 + javac + d8 + jar + zipalign + apksigner
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

$SDK = 'D:\deepseek\gouzuoqu\U\.android-sdk'
$BT  = 'D:\deepseek\gouzuoqu\U\.tmp-build\bt\android-14'
$AJ  = Join-Path $SDK 'platform\android.jar'
$env:JAVA_HOME = 'D:\MCLDownload\ext\jre-v64-220420\jdk17'
$JAVAC = Join-Path $env:JAVA_HOME 'bin\javac.exe'
$JAR   = Join-Path $env:JAVA_HOME 'bin\jar.exe'

$code = '35'
$name = '1.5.29'
# 版本号以 AndroidManifest.xml 为准，避免改了一处忘了另一处
$mf = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'AndroidManifest.xml'))
$mCode = [regex]::Match($mf, 'android:versionCode="(\d+)"')
$mName = [regex]::Match($mf, 'android:versionName="([^"]+)"')
if ($mCode.Success) { $code = $mCode.Groups[1].Value }
if ($mName.Success) { $name = $mName.Groups[1].Value }

# 保留签名密钥，避免每次打包换签名导致无法覆盖安装
$ksBak = Join-Path $env:TEMP ('u-keystore-' + [guid]::NewGuid().ToString('N'))
$hasKs = Test-Path build\u.keystore
if ($hasKs) { Copy-Item build\u.keystore $ksBak -Force }
if (Test-Path build) { Remove-Item build -Recurse -Force }
New-Item -ItemType Directory -Force -Path build\gen, build\classes, build\dex | Out-Null
if ($hasKs) { Copy-Item $ksBak build\u.keystore -Force; Remove-Item $ksBak -Force }

Write-Host '[0/6] 同步前端到 assets'
# 仓库根目录的 index.html 才是最新前端，assets\www 里那份只是上次打包的副本，
# 不抄一遍就会把旧页面打进 APK（表现为改了前端但装上去没变化）。
$webSrc = Join-Path (Split-Path $PSScriptRoot -Parent) 'index.html'
$webDst = Join-Path $PSScriptRoot 'assets\www\index.html'
if (Test-Path $webSrc) {
  New-Item -ItemType Directory -Force -Path (Split-Path $webDst -Parent) | Out-Null
  Copy-Item $webSrc $webDst -Force
  $it = Get-Item $webDst
  Write-Host ("     前端 -> assets\www\index.html  " + $it.Length + " B  " + $it.LastWriteTime)
} else {
  Write-Host '     未找到 index.html，沿用 assets\www 里的旧副本'
}
$jsSrc = Join-Path (Split-Path $PSScriptRoot -Parent) 'app.js'
if (Test-Path $jsSrc) {
  Copy-Item $jsSrc (Join-Path $PSScriptRoot 'assets\www\app.js') -Force
  Write-Host ("     脚本 -> assets\www\app.js  " + (Get-Item $jsSrc).Length + " B")
}

Write-Host '[1/6] 编译资源'
& "$BT\aapt2.exe" compile --dir res -o build\res.zip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }

Write-Host "[2/6] 链接资源与 assets (v$name / $code)"
& "$BT\aapt2.exe" link -o build\base.apk -I $AJ --manifest AndroidManifest.xml -A assets --java build\gen --min-sdk-version 24 --target-sdk-version 34 --version-code $code --version-name $name build\res.zip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }

# aapt2 在 Windows 上会把 -A 目录写成反斜杠条目（assets\www\index.html），
# AssetManager 只认正斜杠，运行时会 404 Not Found。这里统一改成 /。
Write-Host '[2.5/6] 规范 zip 条目名为 /'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fixSrc = Join-Path $PWD 'build\base.apk'
$fixDst = Join-Path $PWD 'build\base-fixed.apk'
if (Test-Path $fixDst) { Remove-Item $fixDst -Force }
$zin = [System.IO.Compression.ZipFile]::OpenRead($fixSrc)
$zout = [System.IO.Compression.ZipFile]::Open($fixDst, 'Create')
$renamed = 0
foreach ($e in $zin.Entries) {
  $name = $e.FullName.Replace('\', '/')
  if ($name -ne $e.FullName) { $renamed++ }
  $ne = $zout.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
  $ne.LastWriteTime = $e.LastWriteTime
  $ein = $e.Open(); $eout = $ne.Open()
  $ein.CopyTo($eout); $eout.Close(); $ein.Close()
}
$zout.Dispose(); $zin.Dispose()
Move-Item $fixDst $fixSrc -Force
Write-Host ("     改名条目: $renamed")

Write-Host '[3/6] 编译 Java'
$sources = Get-ChildItem src, build\gen -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$sources | Set-Content build\sources.txt -Encoding ASCII
& $JAVAC -source 8 -target 8 -Xlint:-options -nowarn -encoding UTF-8 -bootclasspath $AJ -d build\classes '@build\sources.txt' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { & $JAVAC -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath $AJ -d build\classes '@build\sources.txt'; throw 'javac 失败' }

Write-Host '[4/6] 生成 dex'
$classes = Get-ChildItem build\classes -Recurse -Filter *.class | ForEach-Object { $_.FullName }
$classes | Set-Content build\classes.txt -Encoding ASCII
& "$BT\d8.bat" --lib $AJ --min-api 24 --output build\dex '@build\classes.txt'
if ($LASTEXITCODE -ne 0) { throw 'd8 失败' }

Push-Location build\dex
& $JAR uf ..\base.apk classes.dex
Pop-Location
if ($LASTEXITCODE -ne 0) { throw '写入 classes.dex 失败' }

Write-Host '[5/6] 对齐'
& "$BT\zipalign.exe" -f -p 4 build\base.apk build\aligned.apk
if ($LASTEXITCODE -ne 0) { throw 'zipalign 失败' }

Write-Host '[6/6] 签名'
if (!(Test-Path build\u.keystore)) {
  & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -keystore build\u.keystore -alias u -keyalg RSA -keysize 2048 -validity 10000 -storepass uapp123456 -keypass uapp123456 -dname 'CN=U App, O=Trae, C=CN' | Out-Null
}
if (Test-Path U.apk) { Remove-Item U.apk -Force }
# 三种签名方案一起用：v1（JAR）给老系统/某些模拟器安装器，v2/v3 给 Android 7+（Android 11+ 必须 v2 以上）
& "$BT\apksigner.bat" sign --ks build\u.keystore --ks-pass pass:uapp123456 --key-pass pass:uapp123456 --min-sdk-version 21 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out U.apk build\aligned.apk
if ($LASTEXITCODE -ne 0) { throw 'apksigner 失败' }

& "$BT\apksigner.bat" verify --verbose U.apk
Write-Host ('完成: ' + (Join-Path $PSScriptRoot 'U.apk'))
Get-Item U.apk | Select-Object FullName, Length, LastWriteTime | Format-List | Out-String | Write-Host
