#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo " Starting Zero-Downtime Next.js Storefront Deployment...  "
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
  rsync -a --exclude='.deploy-source' --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='logs' "$ACTIVE_DIR/" "$BUILD_DIR/"
else
  echo "rsync not found, falling back to cp..."
  cp -R "$ACTIVE_DIR/"* "$BUILD_DIR/"
  rm -rf "$BUILD_DIR/.deploy-source" "$BUILD_DIR/.git" "$BUILD_DIR/.next" "$BUILD_DIR/node_modules" "$BUILD_DIR/logs" 2>/dev/null || true
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

echo "[4/7] Compiling Next.js application..."
export NODE_OPTIONS="--max-old-space-size=2048"
if command -v pnpm >/dev/null 2>&1; then
  pnpm run build
else
  npm run build
fi

# 5. Swap the builds atomically
echo "[5/7] Build successful! Swapping builds in active directory..."

mkdir -p "$ACTIVE_DIR/logs"

if [ -d "$ACTIVE_DIR/.next" ]; then
  rm -rf "$ACTIVE_DIR/.next_old"
  mv "$ACTIVE_DIR/.next" "$ACTIVE_DIR/.next_old"
fi
mv "$BUILD_DIR/.next" "$ACTIVE_DIR/.next"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$BUILD_DIR/public/" "$ACTIVE_DIR/public/"
  rsync -a --delete "$BUILD_DIR/node_modules/" "$ACTIVE_DIR/node_modules/"
else
  rm -rf "$ACTIVE_DIR/public"
  cp -R "$BUILD_DIR/public" "$ACTIVE_DIR/"
fi

# 6. Reload PM2 with Zero-Downtime
echo "[6/7] Reloading storefront processes via PM2..."
cd "$ACTIVE_DIR"

if [ ! -f "ecosystem.config.js" ]; then
  cp "$BUILD_DIR/ecosystem.config.js" "$ACTIVE_DIR/"
fi

if pm2 describe khanbaba >/dev/null 2>&1; then
  pm2 reload khanbaba --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

# 7. Cleanup
echo "[7/7] Cleaning up temporary folders..."
rm -rf "$ACTIVE_DIR/.next_old"
rm -rf "$BUILD_DIR"

echo "=========================================================="
echo " Next.js Storefront Deployment Completed Successfully!    "
echo "=========================================================="
