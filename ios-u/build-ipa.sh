#!/bin/bash
# 在 macOS 上一条命令出 IPA。
#   无签名（自签/侧载工具再签）：./build-ipa.sh
#   有开发者证书：            DEVELOPMENT_TEAM=ABCDE12345 ./build-ipa.sh sign
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="U"
VER="1.75"
OUT="$(cd .. && pwd)/dist"
WWW="../android-u/assets/www"
ROOT="$(cd .. && pwd)"

# 前端以仓库根目录的 index.html 为准（和安卓打包脚本同一套规则）
cp -f "$ROOT/index.html" "$WWW/index.html"
mkdir -p U/www
rm -rf U/www/*
cp -R "$WWW/." U/www/
echo "[0/4] 前端已同步到 U/www（$(wc -c < U/www/index.html) 字节）"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "需要 xcodegen：brew install xcodegen"; exit 1
fi
xcodegen generate >/dev/null
echo "[1/4] 已生成 U.xcodeproj"

MODE="${1:-unsigned}"
if [ "$MODE" = "sign" ]; then
  if [ -z "${DEVELOPMENT_TEAM:-}" ]; then echo "请设置 DEVELOPMENT_TEAM"; exit 1; fi
  xcodebuild -project U.xcodeproj -scheme U -configuration Release -sdk iphoneos \
    -archivePath build/U.xcarchive archive \
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates
  cat > build/export.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>development</string>
<key>signingStyle</key><string>automatic</string>
<key>stripSwiftSymbols</key><true/>
<key>compileBitcode</key><false/>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath build/U.xcarchive -exportPath build/export \
    -exportOptionsPlist build/export.plist -allowProvisioningUpdates
  cp -f build/export/U.ipa "$OUT/U-$VER.ipa"
else
  xcodebuild -project U.xcodeproj -scheme U -configuration Release -sdk iphoneos \
    -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
  rm -rf build/Payload && mkdir -p build/Payload
  cp -R build/dd/Build/Products/Release-iphoneos/U.app build/Payload/
  ( cd build && rm -f U-unsigned.ipa && zip -qry U-unsigned.ipa Payload )
  cp -f build/U-unsigned.ipa "$OUT/U-$VER-unsigned.ipa"
fi
echo "[4/4] 完成：$OUT"
ls -la "$OUT" | tail -5
