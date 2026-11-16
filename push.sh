#!/usr/bin/env bash
# 一条流水线：init → add → commit → 设远程 → push
#
#   ./push.sh                                  # 只做本地提交（不推）
#   REPO=git@github.com:you/u.git ./push.sh     # 设远程并推送（SSH，推荐）
#   REPO=https://github.com/you/u.git TOKEN=ghp_xxx ./push.sh   # HTTPS + 令牌，不落盘
#   MSG="feat: 视频放大页" ./push.sh             # 自定义提交说明
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="${BRANCH:-main}"
MSG="${MSG:-update: $(date '+%Y-%m-%d %H:%M')}"

# 1) 仓库初始化（已经初始化过就跳过）
if [ ! -d .git ]; then
  git init -b "$BRANCH" >/dev/null
  echo "[1/5] 已初始化仓库（分支 $BRANCH）"
else
  echo "[1/5] 仓库已存在，跳过 init"
fi

# 2) 提交身份（缺省时补一个，避免 commit 直接失败）
git config user.name  >/dev/null 2>&1 || git config user.name  "${GIT_NAME:-U Developer}"
git config user.email >/dev/null 2>&1 || git config user.email "${GIT_EMAIL:-u@example.com}"

# 3) 当前分支
cur="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ "$cur" != "$BRANCH" ]; then git checkout -B "$BRANCH" >/dev/null; fi

# 4) 提交（.gitignore 已经排掉 dist/、11111/、node_modules/、.android-sdk/ 等大件）
git add -A
if git diff --cached --quiet; then
  echo "[2/5] 没有新改动，工作区已是干净的"
else
  git commit -q -m "$MSG"
  echo "[2/5] 已提交：$MSG"
fi
echo "[3/5] 改动文件数：$(git status --porcelain | wc -l | tr -d ' ')（0 = 干净）"

# 5) 推送
if [ -z "${REPO:-}" ]; then
  echo "[4/5] 未提供 REPO，跳过推送。配置好远程后执行："
  echo "      git remote add origin <仓库地址> && git push -u origin $BRANCH"
  echo "[5/5] 本地提交已就绪：$(git log --oneline -1)"
  exit 0
fi

case "$REPO" in
  https://*)
    if [ -n "${TOKEN:-}" ]; then
      # 令牌只在本条命令里用，不写进 .git/config
      host_path="${REPO#https://}"
      push_url="https://x-access-token:${TOKEN}@${host_path}"
    else
      push_url="$REPO"
    fi
    ;;
  *) push_url="$REPO" ;;
esac

if git remote | grep -qx origin; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi
echo "[4/5] 远程：$REPO（分支 $BRANCH）"
git push -u "$push_url" "HEAD:$BRANCH"
echo "[5/5] 推送完成：$(git log --oneline -1)"
