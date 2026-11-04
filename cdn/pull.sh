#!/bin/bash
set -e

REPO_URL="https://github.com/moezlogics/khanbaba.git"
BRANCH="main"

echo "=== [CDN] Pulling CDN Updates from GitHub ==="
if [ ! -d ".deploy-source/.git" ]; then
  echo "Initializing .deploy-source repository..."
  rm -rf .deploy-source
  git clone --branch "$BRANCH" "$REPO_URL" .deploy-source
else
  cd .deploy-source
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  cd ..
fi

echo "=== [CDN] Syncing cdn/ folder to Root ==="
rsync -av --delete \
  --exclude='.deploy-source/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='uploads/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='logs/' \
  .deploy-source/cdn/ .

chmod +x ./pull.sh 2>/dev/null || true

echo "=== [CDN] Building and Reloading CDN ==="
mkdir -p logs uploads
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm run build
else
  npm install --no-audit --no-fund
  npm run build
fi

if pm2 describe khanbaba-cdn >/dev/null 2>&1; then
  pm2 reload khanbaba-cdn --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "=== [CDN] CDN Updated Successfully ==="
