#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo " Starting Zero-Downtime Medusa Backend Deployment...      "
echo "=========================================================="

# 1. Define paths
ACTIVE_DIR="$(pwd)"
BUILD_DIR="${ACTIVE_DIR}_build_temp"

echo "[1/7] Directories:"
echo "      Active Dir: $ACTIVE_DIR"
echo "      Build Dir:  $BUILD_DIR"

# 2. Sync files to build directory
echo "[2/7] Syncing source files to build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude='.deploy-source' --exclude='.git' --exclude='.medusa/server' --exclude='node_modules' --exclude='logs' "$ACTIVE_DIR/" "$BUILD_DIR/"
else
  echo "rsync not found, falling back to cp..."
  cp -R "$ACTIVE_DIR/"* "$BUILD_DIR/"
  rm -rf "$BUILD_DIR/.deploy-source" "$BUILD_DIR/.git" "$BUILD_DIR/.medusa/server" "$BUILD_DIR/node_modules" "$BUILD_DIR/logs" 2>/dev/null || true
fi

# 3. Copy node_modules to build folder to cache package installs
if [ -d "$ACTIVE_DIR/node_modules" ]; then
  echo "[3/7] Copying cached node_modules to build directory..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$ACTIVE_DIR/node_modules/" "$BUILD_DIR/node_modules/"
  else
    cp -R "$ACTIVE_DIR/node_modules" "$BUILD_DIR/"
  fi
else
  echo "[3/7] No cached node_modules found. Fresh install will be performed."
fi

# 4. Install dependencies and build in the build folder
cd "$BUILD_DIR"
echo "[4/7] Installing dependencies in build directory..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install --no-audit --no-fund
fi

echo "[4/7] Compiling Medusa typescript files..."
export NODE_OPTIONS="--max-old-space-size=2048"
if command -v pnpm >/dev/null 2>&1; then
  pnpm run build
else
  npm run build
fi

# 5. Run Database Sync
echo "[5/7] Syncing database schema..."
if [ -f "$ACTIVE_DIR/.env" ] && [ ! -f ".env" ]; then
  cp "$ACTIVE_DIR/.env" ".env"
fi
if [ -f "sync-db-completely.js" ]; then
  node sync-db-completely.js || true
fi

# 6. Swap the builds atomically
echo "[6/7] Build successful! Swapping compiled server files in active directory..."

mkdir -p "$ACTIVE_DIR/logs"
mkdir -p "$ACTIVE_DIR/.medusa"
if [ -d "$ACTIVE_DIR/.medusa/server" ]; then
  rm -rf "$ACTIVE_DIR/.medusa/server_old"
  mv "$ACTIVE_DIR/.medusa/server" "$ACTIVE_DIR/.medusa/server_old"
fi
mv "$BUILD_DIR/.medusa/server" "$ACTIVE_DIR/.medusa/server"

# Keep node_modules synced back to active dir if new packages were added
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$BUILD_DIR/node_modules/" "$ACTIVE_DIR/node_modules/"
fi

# 7. Reload PM2 with Zero-Downtime
echo "[7/7] Reloading Medusa processes via PM2..."
cd "$ACTIVE_DIR"

GEN_CONFIG="/home/khanbaba-api/htdocs/api.khanbaba.pk/ecosystem.config.js"

if [ -f "ecosystem.config.js" ] && head -n 1 ecosystem.config.js | grep -q "cat >"; then
  echo "Generating ecosystem.config.js file..."
  bash ecosystem.config.js
fi

if pm2 describe medusa-backend >/dev/null 2>&1; then
  echo "Removing legacy 'medusa-backend' process..."
  pm2 delete medusa-backend || true
fi

pm2 startOrReload "$GEN_CONFIG" --update-env
pm2 save

# Cleanup
echo "Cleaning up temporary folders..."
rm -rf "$ACTIVE_DIR/.medusa/server_old"
rm -rf "$BUILD_DIR"

echo "=========================================================="
echo " Medusa Backend Deployment Completed Successfully!        "
echo "=========================================================="
