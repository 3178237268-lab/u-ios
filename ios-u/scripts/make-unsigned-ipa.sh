#!/usr/bin/env bash
# 已经有 U.app（比如别人给你的、或你自己编译的），用它直接压一个 ipa。
# 用法：./scripts/make-unsigned-ipa.sh path/to/U.app [输出名]
set -euo pipefail
APP="${1:?用法: make-unsigned-ipa.sh path/to/U.app [out.ipa]}"
OUT="${2:-U-unsigned.ipa}"
[ -d "$APP" ] || { echo "$APP 不存在"; exit 1; }
TMP="$(mktemp -d)"
mkdir -p "$TMP/Payload"
cp -R "$APP" "$TMP/Payload/"
( cd "$TMP" && zip -qr "$OLDPWD/$OUT" Payload )
rm -rf "$TMP"
ls -lh "$OUT"
