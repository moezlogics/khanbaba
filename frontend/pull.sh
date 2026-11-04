#!/bin/bash
set -e

REPO_URL="https://github.com/moezlogics/khanbaba.git"
BRANCH="main"

echo "=== [Frontend] Pulling Storefront Updates from GitHub ==="
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

echo "=== [Frontend] Syncing frontend/ folder to Root ==="
rsync -av --delete \
  --exclude='.deploy-source/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='logs/' \
  .deploy-source/frontend/ .

chmod +x ./pull.sh ./deploy-storefront.sh 2>/dev/null || true

echo "=== [Frontend] Running Deploy script ==="
if [ -f "./deploy-storefront.sh" ]; then
  ./deploy-storefront.sh
else
  echo "No deploy-storefront.sh found. Please build manually or restart PM2."
fi

echo "=== [Frontend] Storefront Updated Successfully ==="
