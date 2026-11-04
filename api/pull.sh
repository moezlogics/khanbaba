#!/bin/bash
set -e

REPO_URL="https://github.com/moezlogics/khanbaba.git"
BRANCH="main"

echo "=== [API] Pulling Backend Updates from GitHub ==="
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

echo "=== [API] Syncing api/ folder to Root ==="
rsync -av --delete \
  --exclude='.deploy-source/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='admin-static/' \
  --exclude='node_modules/' \
  --exclude='.medusa/' \
  --exclude='dist/' \
  --exclude='logs/' \
  .deploy-source/api/ .

chmod +x ./pull.sh ./deploy-backend.sh 2>/dev/null || true

echo "=== [API] Running Deploy script ==="
if [ -f "./deploy-backend.sh" ]; then
  ./deploy-backend.sh
else
  echo "No deploy-backend.sh found. Please build manually or restart PM2."
fi

echo "=== [API] Backend Updated Successfully ==="
