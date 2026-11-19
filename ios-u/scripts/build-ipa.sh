#!/usr/bin/env bash
# 在 macOS 上把工程打成 ipa。用法：
#   ./scripts/build-ipa.sh                        # 打无签名 ipa（免开发者账号）
#   TEAM_ID=ABCDE12345 ./scripts/build-ipa.sh sign  # 用你的开发者账号打签名 ipa
set -euo pipefail

cd "$(dirname "$0")/.."
MODE="${1:-unsigned}"
SCHEME="U"
CONFIG="Release"
OUT="build"
mkdir -p "$OUT"

echo "==> xcodebuild archive"
if [ "$MODE" = "sign" ]; then
  : "${TEAM_ID:?签名模式需要 TEAM_ID，例如 TEAM_ID=ABCDE12345 ./scripts/build-ipa.sh sign}"
  xcodebuild -project U.xcodeproj -scheme "$SCHEME" -configuration "$CONFIG" \
    -sdk iphoneos -archivePath "$OUT/U.xcarchive" \
    DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic \
    archive
else
  xcodebuild -project U.xcodeproj -scheme "$SCHEME" -configuration "$CONFIG" \
    -sdk iphoneos -archivePath "$OUT/U.xcarchive" \
    CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
    archive
fi

APP="$OUT/U.xcarchive/Products/Applications/U.app"
[ -d "$APP" ] || { echo "找不到 $APP"; exit 1; }

if [ "$MODE" = "sign" ]; then
  cat > "$OUT/exportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>development</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>compileBitcode</key><false/>
  <key>stripSwiftSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
PLIST
  xcodebuild -exportArchive -archivePath "$OUT/U.xcarchive" \
    -exportPath "$OUT/ipa" -exportOptionsPlist "$OUT/exportOptions.plist"
  ls -lh "$OUT/ipa"
else
  # 无签名 ipa：Payload/U.app 直接 zip，给 Sideloadly / AltStore / TrollStore 之类重签
  rm -rf "$OUT/Payload" "$OUT/U-unsigned.ipa"
  mkdir -p "$OUT/Payload"
  cp -R "$APP" "$OUT/Payload/"
  ( cd "$OUT" && zip -qr U-unsigned.ipa Payload )
  ls -lh "$OUT/U-unsigned.ipa"
  echo "无签名 ipa 需要用 Sideloadly / AltStore / 爱思助手 之类工具用你自己的 Apple ID 重签后才能装。"
fi
