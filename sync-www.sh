#!/usr/bin/env bash
# 把仓库根的 index.html 与 vendor/ 预同步到两个打包目录，省得等打包脚本再复制一次。
#   ./sync-www.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f index.html ] || { echo "缺少 index.html"; exit 1; }
for dst in android-u/assets/www ios-u/U/www; do
  mkdir -p "$dst/vendor"
  cp -f index.html "$dst/index.html"
  cp -f vendor/three.min.js "$dst/vendor/three.min.js"
  echo "同步 $dst  $(wc -c < "$dst/index.html") 字节"
done
