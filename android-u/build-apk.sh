#!/usr/bin/env bash
# 无 Gradle 的 APK 打包脚本：aapt2 + javac + d8 + zipalign + apksigner
set -euo pipefail
cd "$(dirname "$0")"

SDK=/workspace/.android-sdk
BT="$SDK/build-tools"
AJ="$SDK/platform/android.jar"
export JAVA_HOME=/root/.local/share/mise/installs/java/17
export PATH="$JAVA_HOME/bin:$PATH"

rm -rf build
mkdir -p build/gen build/classes build/dex

echo "[1/6] 编译资源"
"$BT/aapt2" compile --dir res -o build/res.zip

echo "[2/6] 链接资源与 assets"
"$BT/aapt2" link \
  -o build/base.apk \
  -I "$AJ" \
  --manifest AndroidManifest.xml \
  -A assets \
  --java build/gen \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 33 \
  --version-name 1.5.27 \
  build/res.zip

echo "[3/6] 编译 Java"
find src build/gen -name "*.java" > build/sources.txt
javac -source 8 -target 8 -Xlint:-options -bootclasspath "$AJ" \
  -d build/classes @build/sources.txt

echo "[4/6] 生成 dex"
find build/classes -name "*.class" > build/classes.txt
"$BT/d8" --lib "$AJ" --min-api 24 --output build/dex @build/classes.txt
( cd build/dex && zip -q ../base.apk classes.dex )

echo "[5/6] 对齐"
"$BT/zipalign" -f -p 4 build/base.apk build/aligned.apk

echo "[6/6] 签名"
if [ ! -f build/u.keystore ]; then
  keytool -genkeypair -keystore build/u.keystore -alias u \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass uapp123456 -keypass uapp123456 \
    -dname "CN=U App, O=Trae, C=CN" >/dev/null 2>&1
fi
"$BT/apksigner" sign \
  --ks build/u.keystore \
  --ks-pass pass:uapp123456 \
  --key-pass pass:uapp123456 \
  --out U.apk build/aligned.apk

"$BT/apksigner" verify --verbose U.apk | head -6
echo "完成: $(pwd)/U.apk"
ls -lh U.apk
