#!/usr/bin/env bash
# Packs the server as an MCPB bundle (.mcpb) for one-click install into
# Claude Desktop and other MCPB-compatible hosts.
#
# The bundle is built from a staging tree, never from the working directory,
# so devDependencies (Biome, Vitest, tsup, ...) can never leak into it.
set -euo pipefail

cd "$(dirname "$0")/.."

STAGING=".mcpb-staging"
VERSION="$(node -p "require('./package.json').version")"
OUTPUT="inkeedecoder-mcp-${VERSION}.mcpb"
SIZE_LIMIT_MB=20

rm -rf "$STAGING"
mkdir -p "$STAGING"

# App code + metadata
npm run build >/dev/null
cp -R dist "$STAGING/dist"
cp package.json package-lock.json manifest.json README.md LICENSE "$STAGING/"

# Production dependencies only (ignore-scripts also covers the .npmrc case)
(cd "$STAGING" && npm ci --omit=dev --ignore-scripts >/dev/null)

# Pack
npx --yes @anthropic-ai/mcpb pack "$STAGING" "$OUTPUT"

SIZE_MB=$(( $(stat -f%z "$OUTPUT") / 1024 / 1024 ))
echo "Packed ${OUTPUT} (${SIZE_MB} MB)"
if [ "$SIZE_MB" -gt "$SIZE_LIMIT_MB" ]; then
  echo "WARNING: bundle exceeds ${SIZE_LIMIT_MB} MB — check for unwanted dependencies:" >&2
  unzip -l "$OUTPUT" | awk '{print $4}' | grep '^node_modules/' | cut -d/ -f2 | sort -u >&2
  exit 1
fi
