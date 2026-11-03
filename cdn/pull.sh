#!/bin/bash
echo "=== Pulling CDN Updates from GitHub ==="
cd .deploy-source
if ! git pull origin main; then
  echo ""
  echo "!!! git pull failed — ABORTING before rsync."
  echo "    Nothing was copied, so the live site still runs the previous"
  echo "    build rather than being re-deployed from stale checkout files."
  echo "    Fix the pull (usually GitHub auth), then run this script again."
  exit 1
fi
cd ..

echo "=== Syncing files to Root ==="
rsync -av --delete \
  --exclude='.deploy-source/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='pull.sh' \
  --exclude='uploads/' \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='logs/' \
  .deploy-source/cdn/ .

echo "=== Building and Reloading CDN ==="
mkdir -p logs uploads
npm install --no-audit --no-fund
npm run build

if pm2 describe khanbaba-cdn >/dev/null 2>&1; then
  pm2 reload khanbaba-cdn --update-env
else
  pm2 start ecosystem.config.js
fi

echo "=== CDN Updated Successfully ==="
